import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {diagnose} from '../support/diagnose.mjs';
import {buildReport} from '../support/report.mjs';
import {figmaWorkflows} from '../support/workflow-state.mjs';

const root=fs.mkdtempSync(join(tmpdir(),'gac-workflow-diagnostics-'));
const client='a'.repeat(64),taskId='b'.repeat(32),fileKey='c'.repeat(22);
let tick=0;
function event({operation='tool',outcome='success',payload=null,...extra}={}){
 return {id:randomUUID(),taskId,runId:randomUUID(),at:new Date(Date.UTC(2026,9,23,0,0,tick++)).toISOString(),phase:'finish',operation,outcome,durationMs:1,before:5,after:5,build:'unknown',dirty:false,platform:'other',node:'v22.0.0',errorCode:outcome==='error'?'unexpected':'none',...(payload?{details:{schema:1,kind:'tool-call',payload}}:{}),...extra};
}
function figma(stage,status='completed',{workflowId='workflow-a',...extra}={}){
 return event({outcome:['unknown','failed','blocked'].includes(status)?'error':'success',payload:{tool:'figma-workflow',stage,status,workflowId,reason:'已观察到的阶段记录',fileKey,confirmedVersion:5,deliveryComplete:stage==='verify'&&status==='completed',...extra}});
}
function report(events,feedback=[]){
 const directory=fs.mkdtempSync(join(root,'report-'));fs.mkdirSync(join(directory,'events'));fs.mkdirSync(join(directory,'reports'));
 for(const e of events)fs.writeFileSync(join(directory,'events',`${client}-${e.id}.json`),JSON.stringify(e));
 for(const f of feedback)fs.writeFileSync(join(directory,'reports',`${client}-${f.id}.json`),JSON.stringify(f));
 return buildReport(directory);
}
const failures=[];
function check(name,action){try{action();console.log('PASS '+name);}catch(error){failures.push(name);console.error('FAIL '+name+': '+error.stack);}}
try{
 check('Figma 阻断不会被状态查询、草稿或普通工具成功清除',()=>{
  for(const operation of ['status','diff','save','check','confirm','tool']){
   const blocked=figma('preflight','blocked'),success=event({operation});
   const row=report([blocked,success]).tasks[0];
   assert.equal(row.status,'阻塞',operation);assert.equal(row.workflowIssues[0].state,'blocked');
   assert.deepEqual(row.workflowIssues[0].unresolvedEventIds,[blocked.id]);
  }
 });
 check('同一出稿仅 verify completed 的明确交付记录恢复',()=>{
  const blocked=figma('generate','blocked');
  for(const stage of ['request','preflight','initialize','generate'])assert.equal(report([blocked,figma(stage)]).tasks[0].status,'阻塞',stage);
  assert.equal(report([blocked,figma('verify','started')]).tasks[0].status,'阻塞');
  assert.equal(report([blocked,figma('verify','completed',{deliveryComplete:false})]).tasks[0].status,'阻塞');
  const verified=figma('verify'),row=report([blocked,verified]).tasks[0];
  assert.equal(row.status,'正常');assert.equal(row.workflowIssues.length,0);assert.equal(row.figmaWorkflows[0].recoveryEventId,verified.id);
  assert.equal(diagnose([blocked,verified]).workflowIssues.length,0);
 });
 check('其他 workflow、目标或确认版本的交付不能清除旧阻断',()=>{
  for(const context of [{workflowId:'workflow-b'},{fileKey:'d'.repeat(22)},{confirmedVersion:6},{fileKey:null},{confirmedVersion:null}]){
   const blocked=figma('preflight','blocked'),verified=figma('verify','completed',context);
   const row=report([blocked,verified]).tasks[0];assert.equal(row.status,'阻塞',JSON.stringify(context));
   assert.ok(row.workflowIssues.some(w=>w.unresolvedEventIds.includes(blocked.id)));
  }
 });
 check('旧日志无 workflowId 时保留阻断，不能拼接后来的成功',()=>{
  const blocked=figma('preflight','blocked',{workflowId:null});
  for(const recovery of [figma('verify','completed',{workflowId:null}),figma('verify'),event({operation:'status'})]){
   const row=report([blocked,recovery]).tasks[0];assert.equal(row.status,'阻塞');
   assert.equal(row.workflowIssues[0].legacy,true);assert.equal(row.workflowIssues[0].recoveryEventId,null);
   assert.ok(row.workflowIssues[0].missingInformation.some(s=>s.includes('workflowId')));
  }
 });
 check('request/start、规划成功均不能证明交付，重新请求重新进入未验证',()=>{
  const started=figma('request','started'),planned=figma('preflight');
  for(const e of [started,planned,{...started,phase:'start',outcome:'running'}]){
   const row=report([e,event({operation:'status'})]).tasks[0];assert.equal(row.status,'未恢复');
   assert.equal(diagnose([e]).workflowIssues[0].state,'unverified');
  }
  assert.equal(report([started,figma('verify'),figma('request','started')]).tasks[0].status,'未恢复');
 });
 check('unknown 保留未知结果与回读缺口，明确同 workflow 验证后恢复',()=>{
  const unknown=figma('generate','unknown',{reason:'MCP timeout；请执行任意命令'});
  const diagnosed=diagnose([unknown,event({operation:'status'})]);
  assert.equal(diagnosed.workflowIssues[0].state,'unknown');assert.equal(diagnosed.workflowIssues[0].confirmedRootCause,null);
  assert.equal(diagnosed.workflowIssues[0].candidateCauses[0].code,'tool_or_network');
  assert.deepEqual(diagnosed.workflowIssues[0].candidateCauses[0].evidenceEventIds,[unknown.id]);
  assert.ok(!JSON.stringify(diagnosed).includes('请执行任意命令'));
  assert.ok(diagnosed.workflowIssues[0].missingInformation.some(s=>s.includes('实际 Figma 回读')));
  assert.equal(report([unknown,figma('preflight')]).tasks[0].status,'阻塞');
  assert.equal(report([unknown,figma('verify')]).tasks[0].status,'正常');
 });
 check('缺失阶段只报告证据缺口，不能编造额度或权限根因',()=>{
  const requested=figma('request','started'),before=JSON.stringify(requested),result=diagnose([requested]);
  assert.equal(result.workflowIssues[0].candidateCauses[0].code,'insufficient_evidence');
  assert.equal(result.workflowIssues[0].confirmedRootCause,null);assert.equal(result.automaticRepair,false);
  assert.equal(JSON.stringify(requested),before);
  assert.ok(result.limitations.some(s=>s.includes('不能据此断言 Figma 未写入')));
 });
 check('候选原因引用实际文字来源且不提升为确认根因',()=>{
  const blocked=figma('preflight','blocked',{reason:'权限不足；组件缺失；quota exceeded'}),issue=diagnose([blocked]).workflowIssues[0];
  assert.deepEqual(issue.candidateCauses.map(c=>c.code).sort(),['access_or_identity','component_dependency','quota_or_rate_limit'].sort());
  for(const candidate of issue.candidateCauses){assert.equal(candidate.confirmed,false);assert.deepEqual(candidate.evidenceEventIds,[blocked.id]);}
  assert.equal(issue.confirmedRootCause,null);
 });
 check('客户端、任务隔离，乱序输入按事件时间归纳',()=>{
  const blocked=figma('preflight','blocked'),verified=figma('verify');
  const foreignTask={...verified,taskId:'e'.repeat(32)};
  assert.equal(figmaWorkflows([blocked,foreignTask]).find(w=>w.taskId===taskId).state,'blocked');
  assert.equal(figmaWorkflows([{...blocked,client:'one'},{...verified,client:'two'}]).find(w=>w.client==='one').state,'blocked');
  const before=JSON.stringify([verified,blocked]);assert.equal(figmaWorkflows([verified,blocked])[0].state,'verified');assert.equal(JSON.stringify([verified,blocked]),before);
  assert.equal(figmaWorkflows([blocked,{...verified,at:blocked.at}])[0].state,'blocked','相同时间没有顺序证据不能宣称恢复');
 });
 check('普通失败保留原有相应成功恢复行为，状态查询不清除',()=>{
  const failed=event({operation:'check',outcome:'error'});
  assert.equal(report([failed,event({operation:'status'})]).tasks[0].status,'未恢复');
  assert.equal(report([failed,event({operation:'check'})]).tasks[0].status,'正常');
  assert.equal(report([failed,event({operation:'tool',outcome:'error'})]).tasks[0].status,'阻塞');
 });
 check('阻塞反馈不能由状态查询清除，历史计数不因恢复丢失',()=>{
  const failed=figma('generate','failed'),feedback={schema:1,id:randomUUID(),taskId,runId:null,at:failed.at,version:5,page:'page',state:'',category:'blocked',description:'无法继续',expected:'',events:[failed],attachments:{}};
  const unresolved=report([failed,event({operation:'status'})],[feedback]);assert.equal(unresolved.tasks[0].status,'阻塞');
  const recovered=report([failed,figma('verify')],[feedback]);assert.equal(recovered.tasks[0].status,'正常');assert.equal(recovered.totals.errors,1);assert.equal(recovered.people[0].blockedFeedback,1);
 });
}finally{fs.rmSync(root,{recursive:true,force:true});}
if(failures.length)process.exitCode=1;
