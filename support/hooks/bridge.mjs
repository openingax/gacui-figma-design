// 显式绑定后才将本机 hook 转为既有 v2 事件。无网络；之后沿用 flush 的逐事件 ACK。
import fs from 'node:fs';
import {join,resolve,relative,isAbsolute,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {supportHome,tuningEnabled,trace} from '../client.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const uuid=s=>{const h=hash(s);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
function existingDraft(target){
 try{const path=join(target,'versions.json');if(!fs.statSync(path).isFile())return false;const value=JSON.parse(fs.readFileSync(path,'utf8'));return value&&typeof value==='object'&&!Array.isArray(value)&&Array.isArray(value.versions);}catch{return false;}
}
function bindingPath(project,client,sessionId){return join(supportHome(),'hook-bindings',hash(fs.realpathSync(project)+'\0'+client+'\0'+sessionId)+'.json');}
export function bindSession(project,client,sessionId,target){
 if(!['codex','claude','workbuddy'].includes(client)||typeof sessionId!=='string'||!sessionId||sessionId.length>256)throw Error('invalid binding identity');
 const root=fs.realpathSync(project),draft=fs.realpathSync(target),rel=relative(root,draft);
 if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)||!existingDraft(draft))throw Error('绑定必须是当前项目内已存在的原草稿目录');
 const dest=bindingPath(root,client,sessionId);fs.mkdirSync(join(supportHome(),'hook-bindings'),{recursive:true,mode:0o700});
 // client.taskId 使用调用方路径；保留显式原路径，避免路径别名改变既有任务身份。
 const value={schema:1,projectRoot:root,client,sessionId,target:draft,taskTarget:resolve(target),at:new Date().toISOString()};
 if(fs.existsSync(dest)){const old=JSON.parse(fs.readFileSync(dest));if(old.target!==draft)throw Error('会话已绑定其他草稿；请使用新的会话，禁止覆盖关联');return old;}
 const tmp=dest+'.'+randomUUID();try{fs.writeFileSync(tmp,JSON.stringify(value),{flag:'wx',mode:0o600});fs.linkSync(tmp,dest);}finally{fs.rmSync(tmp,{force:true});}return value;
}
export function queueBoundHook(event,project){
 if(!tuningEnabled())return {recorded:false,reason:'tuning-disabled'};
 try{
  const path=bindingPath(project,event.source?.client,event.sessionId);
  if(!fs.existsSync(path))return {recorded:false,reason:'unbound'};
  const b=JSON.parse(fs.readFileSync(path));
  if(b.projectRoot!==fs.realpathSync(project)||event.projectRoot!==b.projectRoot||b.client!==event.source?.client||b.sessionId!==event.sessionId)return {recorded:false,reason:'binding-mismatch'};
  // 不扫描用户文件；目标搬走或变成越界软链接后停止映射。
  const target=fs.realpathSync(b.target),rel=relative(b.projectRoot,target);
  if(target!==b.target||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))return {recorded:false,reason:'target-moved'};
  const taskTarget=b.taskTarget??b.target;if(fs.realpathSync(taskTarget)!==target)return {recorded:false,reason:'target-moved'};
  if(!existingDraft(target))return {recorded:false,reason:'draft-unavailable'};
  const error=['PostToolUseFailure','StopFailure'].includes(event.event);
  return trace(taskTarget,{id:uuid('hook-event:'+event.id),at:event.at,runId:uuid('hook-turn:'+event.source.client+':'+event.sessionId+':'+(event.turnId??event.id)),kind:event.event.includes('Tool')?'tool-call':'agent-turn',outcome:error?'error':'success',payload:{hookEventId:event.id,hookEvent:event.event,sessionId:event.sessionId,turnId:event.turnId,source:event.source,captureStatus:event.captureStatus,binding:'explicit',...(event.payload.prompt!==undefined?{input:event.payload.prompt}:{}),...(event.payload.finalResponse!==undefined?{output:event.payload.finalResponse}:{}),tool:event.payload.toolName??null,toolInput:event.payload.toolInput??null,toolResult:event.payload.toolResult??null,error:error?{message:String(event.payload.error??'工具或模型失败')}:null,deliveryComplete:false,userAccepted:null}});
 }catch{return {recorded:false,reason:'bridge-failed'};}
}
