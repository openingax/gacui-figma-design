import fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {OPS,validEvent} from './protocol.mjs';
import {commandDetails,boundedDetails,basicEvent} from './tuning.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const supportHome=()=>process.env.GAC_SUPPORT_HOME || join(homedir(),'.gacuiagent-public','support');
export const configPath=()=>process.env.GAC_SUPPORT_CONFIG || join(homedir(),'.gacuiagent-public','support-config.json');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function config(path=configPath()) {
 if(!fs.existsSync(path)) return null;
 const c=json(path);const u=new URL(c.endpoint);
 if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(u.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(u.hostname)))) throw Error('上传地址必须为HTTPS域名或本机测试地址');
 if(typeof c.token!=='string'||c.token.length<32) throw Error('上传凭据无效');
 return {...c,endpoint:u.origin};
}
// 采集授权与凭据分开；显式项目授权可开启 tuning，复制凭据本身不改变开关。
export function uploadPreference(){try{const p=json(join(supportHome(),'upload-preference.json'));return {autoUpload:p.autoUpload===true&&typeof p.epoch==='string',decision:p.decision??'not-asked',epoch:p.epoch,collection:p.collection==='tuning'?'tuning':'basic',authorization:p.authorization??null};}catch{return {autoUpload:false,decision:'not-asked',collection:'basic',authorization:null};}}
export function setAutoUpload(enabled,{ask=false,collection,authorization}={}){if(typeof enabled!=='boolean')throw Error('开关必须为布尔值');if(collection&&!['basic','tuning'].includes(collection))throw Error('采集模式无效');init();const old=uploadPreference();const p={autoUpload:enabled,decision:enabled?'enabled':ask?'not-asked':'declined',epoch:enabled?(old.autoUpload?old.epoch:randomUUID()):null,collection:collection??old.collection??'basic',authorization:authorization===undefined?(old.authorization??null):authorization,updatedAt:new Date().toISOString()};const dest=join(supportHome(),'upload-preference.json'),tmp=dest+'.'+randomUUID();fs.writeFileSync(tmp,JSON.stringify(p),{flag:'wx',mode:0o600});fs.renameSync(tmp,dest);return uploadPreference();}
function init(){const h=supportHome();fs.mkdirSync(join(h,'events'),{recursive:true,mode:0o700});fs.mkdirSync(join(h,'acks'),{recursive:true,mode:0o700});fs.mkdirSync(join(h,'queue'),{recursive:true,mode:0o700});const p=join(h,'installation');try{fs.writeFileSync(p,randomUUID(),{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e}return fs.readFileSync(p,'utf8')}
export function taskId(target='.') {return createHash('sha256').update(init()+'\0'+resolve(target)).digest('hex').slice(0,32)}
export function events(task) {const dir=join(supportHome(),'events');if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(n=>/^[0-9a-f-]+\.json$/.test(n)).flatMap(n=>{try{const e=validEvent(json(join(dir,n)));return !task||e.taskId===task?[e]:[]}catch{return []}}).sort((a,b)=>a.at.localeCompare(b.at));}
export function record(e) {init();if(e.details)e={...e,details:details(e.details)};validEvent(e);fs.writeFileSync(join(supportHome(),'events',e.id+'.json'),JSON.stringify(e),{flag:'wx',mode:0o600});const p=uploadPreference();if(p.autoUpload)fs.writeFileSync(join(supportHome(),'queue',e.id),p.epoch,{flag:'wx',mode:0o600});}
export function prune() {const all=events();let remainingBytes=all.reduce((n,e)=>n+fs.statSync(join(supportHome(),'events',e.id+'.json')).size,0);const queued=new Set(pending().map(e=>e.id));let dropped=0;for(const [i,e] of all.entries()){if(i<all.length-2000||Date.now()-Date.parse(e.at)>30*86400000||remainingBytes>128*1024*1024){remainingBytes-=fs.statSync(join(supportHome(),'events',e.id+'.json')).size;if(queued.has(e.id)) dropped++;fs.rmSync(join(supportHome(),'events',e.id+'.json'),{force:true});fs.rmSync(join(supportHome(),'acks',e.id),{force:true});fs.rmSync(join(supportHome(),'queue',e.id),{force:true});}}if(dropped){const p=join(supportHome(),'expired.json');let count=0;try{count=json(p).count}catch{}fs.writeFileSync(p,JSON.stringify({count:count+dropped,at:new Date().toISOString()}),{mode:0o600});}return dropped;}
export function pending(){const p=uploadPreference();if(!p.autoUpload)return [];return events().filter(e=>{try{return !fs.existsSync(join(supportHome(),'acks',e.id))&&fs.readFileSync(join(supportHome(),'queue',e.id),'utf8')===p.epoch}catch{return false}});}
export async function request(path,body,c=config(),timeoutMs=1800) {if(!c)throw Error('未配置上传');const r=await fetch(c.endpoint+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(timeoutMs)});if(!r.ok)throw Error('HTTP_'+r.status);return r.json();}
export async function flush() {prune();if(!uploadPreference().autoUpload)return {state:'disabled',pending:0};const c=config();if(!c)return {state:'unconfigured',pending:pending().length};const queued=pending();if(!queued.length)return {state:'sent',pending:0};const rich=queued.slice(0,50).some(e=>e.details),limit=rich?4*1024*1024:64*1024;const batch=[];let size=20;for(const e of queued.slice(0,50)){const bytes=Buffer.byteLength(JSON.stringify(e))+1;if(size+bytes>limit)break;batch.push(e);size+=bytes;}if(!batch.length)throw Error('event exceeds upload limit');// 公网链路按批大小放宽超时（约256KB/s），最长10秒；超时的批次下次幂等重放。
const result=await request(rich?'/v2/events':'/v1/events',{events:batch},c,Math.min(10000,1800+Math.ceil(size/256)));if(!Array.isArray(result.accepted))throw Error('invalid receipt');for(const e of batch)if(result.accepted.includes(e.id))fs.writeFileSync(join(supportHome(),'acks',e.id),'',{mode:0o600});return {state:'sent',pending:pending().length};}
export function status(){let c;try{c=config()}catch{return {state:'invalid_config',...uploadPreference(),pending:pending().length}}let expired=0;try{expired=json(join(supportHome(),'expired.json')).count}catch{}return {state:c?'configured':'unconfigured',...uploadPreference(),endpoint:c?.endpoint,managedEnrollment:c?.managedEnrollment===true,pending:pending().length,localEvents:events().length,expired};}
function version(target){try{const m=json(join(target,'versions.json'));return Math.max(0,...m.versions.map(v=>v.v))}catch{return 0}}
function environment(){let build='unknown',dirty=false;try{build=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1000}).trim();dirty=!!execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1000}).trim()}catch{}return {build,dirty,platform:['darwin','linux','win32'].includes(process.platform)?process.platform:'other',node:process.version};}
export function classify(e){const s=String(e?.message??'');if(/版本已变化|基线|草稿正被写入|摘要不同|未登记快照/.test(s))return 'version_conflict';if(e?.code&&/^(EACCES|EPERM|ENOENT|ENOSPC|EIO|EEXIST)$/.test(e.code))return 'storage';if(/校验|必须|无效|未通过|条件|缺口|尚无|格式|JSON/.test(s))return 'validation';return 'unexpected';}
export function tuningEnabled(){const p=uploadPreference();return p.autoUpload&&p.collection==='tuning';}
function details(value){let secrets=[];try{secrets=[config()?.token]}catch{}return boundedDetails(value,secrets);}
export function begin(command,target,args=[]){const base={taskId:taskId(target),runId:randomUUID(),operation:OPS.includes(command)?command:'unknown',before:version(target),...environment()};const start=Date.now();record({...base,id:randomUUID(),at:new Date().toISOString(),phase:'start',outcome:'running',after:base.before,durationMs:0,errorCode:'none',...(tuningEnabled()?{details:commandDetails(command,target,args,{phase:'start'})}:{})});return {...base,start,target,args};}
export function finish(run,code,error,output){const {start,target,args=[],...base}=run;record({...base,id:randomUUID(),at:new Date().toISOString(),phase:'finish',outcome:code===0?'success':'error',after:version(target),durationMs:Date.now()-start,errorCode:code===0?'none':error?classify(error):'check_failed',...(tuningEnabled()?{details:commandDetails(base.operation,target,args,{phase:'finish',error,output})}:{})});}
export async function previewContext(target,runId=null){const id=taskId(target);const context={taskId:id,runId,autoUpload:uploadPreference().autoUpload,events:events(id).slice(-20).map(basicEvent)};try{const c=config();if(c&&uploadPreference().autoUpload){const t=await request('/v1/tickets',{taskId:id},c);if(typeof t.ticket==='string'&&typeof t.expiresAt==='string')context.upload={endpoint:c.endpoint,ticket:t.ticket,expiresAt:t.expiresAt};}}catch{}return context;}

export function trace(target,input){
 if(!tuningEnabled())return {recorded:false,reason:'tuning-disabled'};
 const operations={'agent-turn':'agent','model-call':'model','tool-call':'tool','route':'route','ui-review':'review'};
 if(!operations[input.kind]||!input.payload||typeof input.payload!=='object'||Array.isArray(input.payload))throw Error('调优记录 kind/payload 无效');
 const event={id:input.id??randomUUID(),taskId:taskId(target),runId:input.runId??randomUUID(),at:input.at??new Date().toISOString(),phase:'finish',operation:operations[input.kind],outcome:input.outcome??'success',durationMs:input.durationMs??0,before:version(target),after:version(target),...environment(),errorCode:input.outcome==='error'?'unexpected':'none',details:{schema:1,kind:input.kind,payload:{target:resolve(target),...input.payload,durationMeasured:Number.isSafeInteger(input.durationMs)}}};
 // 先按既有采集规则过滤凭据并裁剪超大内容，再验证可落盘协议。
 event.details=details(event.details);validEvent(event);
 try{record(event);}catch(error){
  if(error.code!=='EEXIST')throw error;
  const existing=events(event.taskId).find(e=>e.id===event.id),fields=['runId','operation','outcome','durationMs','errorCode'];
  if(!existing||fields.some(key=>existing[key]!==event[key])||(input.at!==undefined&&existing.at!==event.at)||JSON.stringify(existing.details)!==JSON.stringify(details(event.details)))throw Error('trace event id conflict');
  // 原事件已经落盘而队列写入中断时补齐队列；不覆盖旧 epoch，也不重传已 ACK 的事件。
  if(!fs.existsSync(join(supportHome(),'acks',event.id)))try{fs.writeFileSync(join(supportHome(),'queue',event.id),uploadPreference().epoch,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  return {recorded:false,reason:'duplicate',id:event.id,taskId:event.taskId,runId:event.runId};
 }
 return {recorded:true,id:event.id,taskId:event.taskId,runId:event.runId};
}
