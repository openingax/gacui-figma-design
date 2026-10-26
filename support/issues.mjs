// 问题处理记录独立于不可变事件；读取无副作用，所有人工动作追加保存。
import fs from 'node:fs';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {eventCategory,eventMessage,eventVersion,helpEventIds,isWaiting} from './event-semantics.mjs';
import {figmaPayload,figmaWorkflows} from './workflow-state.mjs';
export const ISSUE_STATES=['open','in_progress','fixed_pending','closed'];
export const ISSUE_LABELS={open:'待处理',in_progress:'处理中',fixed_pending:'已修复待验证',closed:'已关闭'};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function keyOf(e){
 const p=figmaPayload(e),message=eventMessage(e,Infinity).replace(/\s+/g,' ').trim();
 // 不删数字、路径、节点或目标，避免把不同原因误合并。无具体原因时按run隔离。
 const detail=message&&message!==e.errorCode?message:e.runId??e.id;
 return hash([1,e.client,e.taskId,e.context?.command??e.operation,p?.stage??null,p?.fileKey??null,p?.confirmedVersion??null,eventCategory(e),detail]);
}
function historyOf(dataDir,id){
 const dir=join(dataDir,'issues',id);
 if(!fs.existsSync(dir))return [];
 const names=fs.readdirSync(dir).filter(n=>/^\d{8}\.json$/.test(n)).sort();
 return names.map((n,i)=>{
  const r=JSON.parse(fs.readFileSync(join(dir,n),'utf8'));
  if(r.schema!==1||r.issueId!==id||r.revision!==i+1||!ISSUE_STATES.includes(r.state))throw Error('问题记录损坏，请恢复备份');
  return r;
 });
}
export function buildIssues(dataDir,events){
 const ignored=helpEventIds(events),groups=new Map();
 const workflows=figmaWorkflows(events);
 for(const e of events){
  if(e.phase!=='finish'||e.outcome!=='error'||ignored.has(e.id))continue;
  const id=keyOf(e);
  if(!groups.has(id))groups.set(id,[]);
  groups.get(id).push(e);
 }
 return [...groups].map(([id,rows])=>{
  rows.sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id));
  const first=rows[0],last=rows.at(-1),history=historyOf(dataDir,id),action=history.at(-1);
  const recovered=rows.every(e=>workflows.some(w=>w.client===e.client&&w.taskId===e.taskId&&w.recoveryEventId&&w.eventIds.includes(e.id)&&!w.unresolvedEventIds.includes(e.id)));
  const latestAt=last.at;
  const relapse=action?.state==='closed'&&rows.some(e=>!action.eventIds.includes(e.id)&&e.at>action.latestErrorAt);
  const state=relapse?'open':action?.state??(recovered?'closed':'open');
  const resolution=relapse?null:action?.resolution??(recovered?'verified':null);
  const eventIds=rows.map(e=>e.id);
  return {id,number:'ISS-'+id.slice(0,12).toUpperCase(),client:first.client,taskId:first.taskId,
   kind:isWaiting(first)?'followup':'technical',category:eventCategory(first),operation:first.context?.command??first.operation,
   stage:figmaPayload(first)?.stage??null,message:eventMessage(last),firstAt:first.at,lastAt:latestAt,count:rows.length,
   events:rows.map(e=>({id:e.id,at:e.at,version:eventVersion(e),workflowId:figmaPayload(e)?.workflowId??null})),eventIds,
   state,stateLabel:ISSUE_LABELS[state],resolution,reopened:!!relapse,revision:history.length,
   // 同时覆盖新事件和自动恢复，防止基于旧页面关闭问题。
   etag:hash([history.length,eventIds,recovered]),history,assignee:action?.assignee??'',fixVersion:action?.fixVersion??'',
   evidence:action?.evidence??'',duplicateOf:action?.duplicateOf??null,
   recoveryEvidence:recovered?workflows.filter(w=>w.client===first.client&&w.taskId===first.taskId&&w.recoveryEventId&&w.eventIds.some(x=>eventIds.includes(x))).map(w=>w.recoveryEventId):[],
   closureSource:state==='closed'?(action?'manual':'workflow-receipt'):null};
 }).sort((a,b)=>b.lastAt.localeCompare(a.lastAt)||a.id.localeCompare(b.id));
}
export function issueSummary(issues){
 const counts=Object.fromEntries(ISSUE_STATES.map(s=>[s,issues.filter(i=>i.kind==='technical'&&i.state===s).length]));
 return {...counts,total:issues.filter(i=>i.kind==='technical').length,followup:issues.filter(i=>i.kind==='followup'&&i.state!=='closed').length};
}
export function updateIssue(dataDir,issues,id,input,{now=new Date().toISOString()}={}){
 if(!/^[a-f0-9]{64}$/.test(id))fail('问题不存在',404);
 const issue=issues.find(i=>i.id===id);if(!issue)fail('问题不存在',404);
 if(!input||typeof input!=='object'||Array.isArray(input))fail('请求格式无效');
 if(input.etag!==issue.etag)fail('问题已有新日志或处理记录，请重新打开详情后提交',409);
 if(!ISSUE_STATES.includes(input.state))fail('状态无效');
 const str=(key,max,required=false)=>{
  const v=input[key]??'';
  if(typeof v!=='string'||v.length>max||(required&&!v.trim()))fail(key+' 必须填写且长度有效');
  return v.trim();
 };
 const actor=str('actor',80,true),note=str('note',4000,true),assignee=str('assignee',80),fixVersion=str('fixVersion',200),evidence=str('evidence',4000),resolution=str('resolution',40),duplicateOf=str('duplicateOf',64);
 if(input.state==='fixed_pending'&&!fixVersion&&!evidence)fail('请填写修复版本、提交或修复证据');
 if(input.state==='closed'){
  if(!['verified','false_positive','duplicate','wont_fix'].includes(resolution))fail('请选择关闭原因');
  if(!evidence)fail('关闭必须填写验证结果或处理依据');
  if(resolution==='duplicate'&&(duplicateOf===id||!issues.some(i=>i.id===duplicateOf&&i.resolution!=='duplicate')))fail('请选择有效的非重复目标问题');
 }
 const revision=issue.revision+1;
 if(historyOf(dataDir,id).length!==issue.revision)fail('处理记录已更新',409);
 const record={schema:1,issueId:id,revision,at:now,actor,actorSource:'self-reported',state:input.state,previousState:issue.state,note,assignee,fixVersion,evidence,
  resolution:input.state==='closed'?resolution:null,duplicateOf:input.state==='closed'&&resolution==='duplicate'?duplicateOf:null,
  eventIds:issue.eventIds,latestErrorAt:issue.lastAt,reopened:issue.reopened};
 const dir=join(dataDir,'issues',id);fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const temp=join(dir,'.'+randomUUID()+'.tmp'),file=join(dir,String(revision).padStart(8,'0')+'.json');
 try{
  const fd=fs.openSync(temp,'wx',0o600);
  try{fs.writeFileSync(fd,JSON.stringify(record,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  // 同修订号只能有一位写入者成功；完整文件才对读取端可见。
  try{fs.linkSync(temp,file);}catch(e){if(e.code==='EEXIST')fail('处理记录已更新',409);throw e;}
 }finally{if(fs.existsSync(temp))fs.unlinkSync(temp);}
 return record;
}
