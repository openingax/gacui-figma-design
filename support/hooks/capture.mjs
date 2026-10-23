// Hook 输入和已落盘内容均是不可信数据；不执行命令、不读取会话历史、不联网。
import fs from 'node:fs';
import {resolve,join,relative,isAbsolute,sep,dirname,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {supportHome,tuningEnabled,config} from '../client.mjs';
import {protectCredentials} from '../tuning.mjs';
import {analyzeHookEvents} from './analysis.mjs';
import {queueBoundHook} from './bridge.mjs';
export {analyzeHookEvents} from './analysis.mjs';

export const HOOK_EVENTS=['SessionStart','UserPromptSubmit','Stop','PreToolUse','PostToolUse','PostToolUseFailure','Interrupt','SessionEnd','StopFailure'];
export const INPUT_LIMIT=256*1024;
const CLIENTS=['codex','claude','workbuddy'];
const sha=value=>createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const text=(v,max=32768)=>typeof v==='string'?v.slice(0,max):null;
const first=(v,...keys)=>keys.map(k=>v[k]).find(x=>x!==undefined);
function scope(project,cwd){
 if(!isAbsolute(project??'')||typeof cwd!=='string'||!isAbsolute(cwd))throw Error('invalid-project-scope');
 const root=fs.realpathSync(project),current=fs.realpathSync(cwd),rel=relative(root,current);
 if(!fs.statSync(root).isDirectory()||!fs.statSync(current).isDirectory())throw Error('invalid-project-scope');
 if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))throw Error('outside-project');
 return {root,cwd:current,key:sha(root).slice(0,32)};
}
function directory(path){fs.mkdirSync(path,{recursive:true,mode:0o700});if(fs.lstatSync(path).isSymbolicLink()||!fs.statSync(path).isDirectory())throw Error('invalid-storage');fs.chmodSync(path,0o700);return path;}
function save(path,value){
 const tmp=path+'.'+randomUUID()+'.tmp';
 try{fs.writeFileSync(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});fs.linkSync(tmp,path);return true;}catch(e){if(e.code==='EEXIST')return false;throw e;}finally{fs.rmSync(tmp,{force:true});}
}
function replace(path,value){const tmp=path+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(tmp,path);}finally{fs.rmSync(tmp,{force:true});}}
function cleanInput(input,client,secrets){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('invalid-input');
 const event=text(first(input,'hook_event_name','event_name','event'),64);
 if(!HOOK_EVENTS.includes(event))throw Error('unsupported-event');
 const payload={};
 for(const [name,keys] of Object.entries({prompt:['prompt','user_prompt'],finalResponse:['last_assistant_message'],toolName:['tool_name','toolName'],toolInput:['tool_input','toolInput'],toolResult:['tool_response','tool_result','toolResult'],error:['error','error_message'],interruptReason:['interrupt_reason','reason']})){
  const value=first(input,...keys);
  if(value!==undefined&&['string','object','boolean','number'].includes(typeof value))payload[name]=value;
 }
 // 仅保留当前事件中的公开字段；忽略 transcript_path、环境变量和任意附加属性。
 return protectCredentials({event,source:{client,eventName:event},sessionId:text(first(input,'session_id','sessionId'),256),hostTurnId:text(first(input,'turn_id','turnId'),256),toolCallId:text(first(input,'tool_use_id','tool_call_id','toolCallId'),256),hostEventId:text(first(input,'event_id','eventId'),256),payload},secrets);
}
function resolvedTarget(path){
 try{return fs.realpathSync(path);}catch(e){
  // 新建文件尚不存在：解析最近的真实父目录，仍检查父目录中的符号链接。
  if(e.code!=='ENOENT'||fs.lstatSync(path,{throwIfNoEntry:false})?.isSymbolicLink())throw e;
  const parent=dirname(path);if(parent===path)throw e;
  return join(resolvedTarget(parent),basename(path));
 }
}
function filterToolScope(event,scoped){
 const paths=[];
 const walk=value=>{if(Array.isArray(value)){value.forEach(walk);return;}if(!value||typeof value!=='object')return;
  for(const [key,child] of Object.entries(value)){
   if(/^(?:file_path|filePath|path|file_paths|filePaths|paths)$/.test(key)){
    for(const path of Array.isArray(child)?child:[child])if(typeof path==='string')paths.push(path);
   }else if(/^(?:target|target_path|targetPath)$/.test(key)&&typeof child==='string'&&isAbsolute(child))paths.push(child);
   if(child&&typeof child==='object')walk(child);
  }
 };
 walk(event.payload.toolInput);let reason=null;
 for(const path of paths){try{const real=resolvedTarget(resolve(scoped.cwd,path)),rel=relative(scoped.root,real);if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)){reason='outside-project-path';break;}}catch{reason='unverified-file-path';break;}}
 if(reason){
  // 不保留越界路径或工具正文，错误字段也可能带出文件内容。
  for(const field of ['toolInput','toolResult','error'])delete event.payload[field];
  event.payload.omitted={toolInput:reason,toolResult:reason,error:reason};
 }
 // Shell 的任意命令/输出没有可靠文件来源标识，本过滤器不声称覆盖此类来源。
 return reason;
}
function prune(base){
 const files=[];
 for(const name of fs.readdirSync(base)){if(!/^[a-f0-9]{32}$/.test(name))continue;const dir=join(base,name);if(fs.lstatSync(dir).isSymbolicLink())continue;
  for(const file of fs.readdirSync(dir)){if(!/^[a-f0-9]{64}\.json$/.test(file))continue;const path=join(dir,file),st=fs.lstatSync(path);if(st.isFile())files.push({path,mtime:st.mtimeMs,bytes:st.size});}
  const states=join(dir,'sessions');if(fs.existsSync(states)&&!fs.lstatSync(states).isSymbolicLink()){
   const entries=fs.readdirSync(states).filter(file=>/^[a-f0-9]{64}\.json$/.test(file)).map(file=>({path:join(states,file),mtime:fs.lstatSync(join(states,file)).mtimeMs})).sort((a,b)=>a.mtime-b.mtime);
   for(const [i,f] of entries.entries())if(i<entries.length-500||Date.now()-f.mtime>30*86400000){fs.rmSync(f.path,{force:true});fs.rmSync(f.path+'.conflict',{force:true});}
  }
 }
 files.sort((a,b)=>a.mtime-b.mtime);let bytes=files.reduce((n,f)=>n+f.bytes,0);
 for(const [i,f] of files.entries())if(i<files.length-2000||Date.now()-f.mtime>30*86400000||bytes>128*1024*1024){fs.rmSync(f.path,{force:true});bytes-=f.bytes;}
}

/** 本地、独立 envelope；recorded=false 不包含输入内容。仅显式绑定后进入既有待传队列；本函数不联网。 */
export async function captureHook({project,client,input}){
 // 关闭时不解析内容、不创建目录；凭据的存在不会开启采集。
 if(!tuningEnabled())return {recorded:false,reason:'tuning-disabled'};
 if(!CLIENTS.includes(client))return {recorded:false,reason:'invalid-client'};
 try{
  if(Buffer.byteLength(JSON.stringify(input)??'')>INPUT_LIMIT)throw Error('input-too-large');
  const scoped=scope(project,input?.cwd);let secrets=[];try{secrets=[config()?.token];}catch{}
  const event=cleanInput(input,client,secrets),omitted=filterToolScope(event,scoped),base=directory(join(supportHome(),'hook-events')),dir=directory(join(base,scoped.key));
  const fingerprint=sha(stable({cwd:scoped.cwd,event}));
  // turnId 只标识轮次，不能充当交付ID（同轮可能重复调用同名同参工具）。
  const identity=event.hostEventId?{project:scoped.key,client,sessionId:event.sessionId,eventName:event.event,hostEventId:event.hostEventId}:event.toolCallId?{project:scoped.key,client,sessionId:event.sessionId,eventName:event.event,toolCallId:event.toolCallId}:null;
  const duplicateId=identity?sha(stable(identity)):null;
  function existing(){
   if(!duplicateId||!fs.existsSync(join(dir,duplicateId+'.json')))return null;
   const path=join(dir,duplicateId+'.json');if(fs.lstatSync(path).isSymbolicLink())return {recorded:false,reason:'identity-conflict',id:duplicateId};
   const previous=read(path);
   if(previous.fingerprint!==fingerprint)return {recorded:false,reason:'identity-conflict',id:duplicateId};
   try{queueBoundHook(previous,scoped.root);}catch{}
   return {recorded:false,reason:'duplicate',id:duplicateId};
  }
  // 重送必须在任何 session 锁或冲突标记副作用之前结束。
  const prior=existing();if(prior)return prior;
  const sessions=directory(join(dir,'sessions')),sessionKey=event.sessionId?sha(client+'\0'+event.sessionId):null;
  const statePath=sessionKey?join(sessions,sessionKey+'.json'):null,lock=statePath?statePath+'.lock':null;
  let locked=false,state={schema:1,current:null},association='unknown',turnId=event.hostTurnId,turnSource=turnId?'host':'unknown';
  if(lock){try{fs.mkdirSync(lock,{mode:0o700});locked=true;try{state=read(statePath);}catch{}}catch(e){if(e.code!=='EEXIST')throw e;}}
  try{
   const raced=existing();if(raced)return raced;
   // 并发提示可能代表另一轮；去重已先完成，不让已落盘重送污染 session。
   if(statePath&&!locked&&event.event==='UserPromptSubmit')save(statePath+'.conflict',{schema:1,reason:'concurrent-prompt'});
   if(locked&&event.event==='UserPromptSubmit'){
    if(state.current&&!(turnId&&state.current.turnId===turnId))state.current={turnId:null,ambiguous:true};
    else state.current={turnId:turnId??'local-'+randomUUID(),ambiguous:false,source:turnId?'host':'session-single-active-prompt'};
   }
   if(locked&&fs.existsSync(statePath+'.conflict'))state.current={turnId:null,ambiguous:true};
   if(!turnId&&locked&&state.current&&!state.current.ambiguous){turnId=state.current.turnId;turnSource=state.current.source;}
   if(turnId)association=turnSource==='host'?'host-turn-id':'single-active-prompt';
   // 锁竞争时保留事实，但绝不从正在变化的 session 状态推断轮次。
   if(!locked&&!event.hostTurnId){turnId=null;turnSource='unknown';association=event.sessionId?'session-lock-unavailable':'missing-session-id';}
   const id=duplicateId??sha(stable({project:scoped.key,...event,turnId,invocation:randomUUID()}));
   const envelope={schema:1,kind:'hook-event',id,fingerprint,at:new Date().toISOString(),projectRoot:scoped.root,cwd:scoped.cwd,...event,turnId,turnSource,captureStatus:{content:omitted?'partially-omitted':'captured',scope:'cwd-and-recognizable-file-paths',...(omitted?{toolData:omitted}:{}),association,deliveryIdentity:identity?'host-identified':'invocation-only',finalResponse:event.event==='Stop'?(typeof event.payload.finalResponse==='string'?'captured':'unavailable'):'not-applicable'},draftBinding:{status:'unbound'}};
   const path=join(dir,id+'.json'),written=save(path,envelope);
   if(!written)return existing()??{recorded:false,reason:'identity-conflict',id};
   try{queueBoundHook(envelope,scoped.root);}catch{}
   if(locked){
    if(['Stop','Interrupt','StopFailure','SessionEnd'].includes(event.event)){
     // 有明确 host turn 时不得关闭另一轮。重叠无标识一直保持未知，直至会话结束。
     if(event.event==='SessionEnd'||(!state.current?.ambiguous&&(!event.hostTurnId||state.current?.turnId===event.hostTurnId)))state.current=null;
     if(event.event==='SessionEnd')fs.rmSync(statePath+'.conflict',{force:true});
    }
    state.updatedAt=new Date().toISOString();replace(statePath,state);
   }
   prune(base);return {recorded:written,...(!written?{reason:'duplicate'}:{}),id,path};
  }finally{if(locked)fs.rmSync(lock,{recursive:true,force:true});}
 }catch(e){return {recorded:false,reason:['invalid-project-scope','outside-project','invalid-input','unsupported-event','input-too-large'].includes(e.message)?e.message:'capture-failed'};}
}

export function readHookEvents(project,{client}={}){
 const root=fs.realpathSync(project),dir=join(supportHome(),'hook-events',sha(root).slice(0,32));if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir).filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).flatMap(name=>{try{const p=join(dir,name);if(fs.lstatSync(p).isSymbolicLink()||fs.statSync(p).size>INPUT_LIMIT*2)return [];const e=read(p);return e.schema===1&&e.kind==='hook-event'&&e.projectRoot===root&&e.id===name.slice(0,-5)&&(!client||e.source?.client===client)?[e]:[];}catch{return [];}}).sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
}
async function main(){
 const args=process.argv.slice(2),project=args[args.indexOf('--project')+1],client=args[args.indexOf('--client')+1];
 if(args.includes('--report')){try{process.stdout.write(JSON.stringify(analyzeHookEvents(readHookEvents(project,{client:CLIENTS.includes(client)?client:undefined})))+'\n');}catch{process.stderr.write('gac-hook: report-failed\n');process.stdout.write('{}\n');}return;}
 let bytes=0,chunks=[],tooLarge=false;
 for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>INPUT_LIMIT){tooLarge=true;chunks=[];break;}chunks.push(chunk);}
 if(tooLarge){process.stdin.destroy();process.stderr.write('gac-hook: input-too-large\n');process.stdout.write('{}\n');return;}
 let result;
 try{result=await captureHook({project,client,input:JSON.parse(Buffer.concat(chunks).toString('utf8'))});}catch{result={recorded:false,reason:'invalid-input'};}
 if(!result.recorded&&!['duplicate','tuning-disabled'].includes(result.reason))process.stderr.write('gac-hook: '+result.reason+'\n');
 // Codex Stop 接受空 JSON 对象；不得把业务数据或阻断指令写入 stdout。
 process.stdout.write('{}\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{process.stderr.write('gac-hook: capture-failed\n');process.stdout.write('{}\n');process.exitCode=0;});
