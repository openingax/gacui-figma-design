import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {captureHook,readHookEvents} from '../support/hooks/capture.mjs';
import {bindSession,queueBoundHook} from '../support/hooks/bridge.mjs';
import {localReport,renderReport} from '../support/hooks/report.mjs';
import * as client from '../support/client.mjs';
import {createCollector} from '../support/server.mjs';

function setup(){
 const temp=fs.mkdtempSync(join(tmpdir(),'gac-hook-bridge-')),project=join(temp,'project'),other=join(temp,'other'),draft=join(project,'draft'),second=join(project,'second'),home=join(temp,'support');
 for(const path of [project,other,draft,second,home])fs.mkdirSync(path,{recursive:true});
 for(const path of [draft,second,other]){fs.writeFileSync(join(path,'versions.json'),JSON.stringify({versions:[{v:1}],draftConfirmed:1}));fs.writeFileSync(join(path,'v1.json'),JSON.stringify({content:'original-draft-content'}));}
 const env={home:process.env.GAC_SUPPORT_HOME,config:process.env.GAC_SUPPORT_CONFIG};
 process.env.GAC_SUPPORT_HOME=home;process.env.GAC_SUPPORT_CONFIG=join(temp,'config.json');client.setAutoUpload(true,{collection:'tuning'});
 const snapshot=()=>[fs.readFileSync(join(draft,'versions.json'),'utf8'),fs.readFileSync(join(draft,'v1.json'),'utf8')];
 return {temp,project,other,draft,second,home,snapshot,before:snapshot(),cleanup(){for(const [key,value] of [['GAC_SUPPORT_HOME',env.home],['GAC_SUPPORT_CONFIG',env.config]])if(value===undefined)delete process.env[key];else process.env[key]=value;fs.rmSync(temp,{recursive:true,force:true});}};
}
const input=(x,event,extra={})=>({cwd:x.project,hook_event_name:event,session_id:'session-a',turn_id:'turn-a',...extra});
const capture=(x,event,extra={})=>captureHook({project:x.project,client:'codex',input:input(x,event,extra)});
const hash=value=>createHash('sha256').update(value).digest('hex');

test('真实 capture 在显式绑定前不排队，绑定后复用原事件和原草稿 task',async()=>{
 const x=setup();try{
  const captured=await capture(x,'UserPromptSubmit',{prompt:'请在 Figma 创建页面'});assert.equal(captured.recorded,true);
  assert.equal(client.events().length,0);assert.equal(client.pending().length,0);
  const binding=bindSession(x.project,'codex','session-a',x.draft);assert.equal(binding.target,fs.realpathSync(x.draft));
  const original=readHookEvents(x.project)[0],queued=queueBoundHook(original,x.project);
  assert.equal(queued.recorded,true);assert.equal(queued.taskId,client.taskId(x.draft));
  const [e]=client.events();assert.equal(e.details.payload.hookEventId,captured.id);assert.equal(e.details.payload.input,original.payload.prompt);assert.equal(e.details.payload.binding,'explicit');assert.equal(e.at,original.at);
  assert.equal(e.details.payload.deliveryComplete,false);assert.equal(e.details.payload.userAccepted,null);
  await capture(x,'Stop',{last_assistant_message:'当前无法生成设计稿。'});
  assert.equal(client.events().length,2);assert.ok(client.events().every(e=>e.taskId===queued.taskId));
  assert.equal(localReport(x.project).hookSummary.facts.unboundDraftCount,0);
  assert.deepEqual(x.snapshot(),x.before);
 }finally{x.cleanup();}
});

test('绑定拒绝跨项目、无有效 versions、逃逸软链接以及改绑',()=>{
 const x=setup();try{
  assert.throws(()=>bindSession(x.project,'codex','s',x.other),/当前项目/);
  assert.throws(()=>bindSession(x.project,'codex','s',x.project),/当前项目/);
  const bad=join(x.project,'bad');fs.mkdirSync(bad);fs.writeFileSync(join(bad,'versions.json'),'not-json');assert.throws(()=>bindSession(x.project,'codex','s',bad),/当前项目/);
  fs.symlinkSync(x.other,join(x.project,'escaped'),'dir');assert.throws(()=>bindSession(x.project,'codex','s',join(x.project,'escaped')),/当前项目/);
  const original=bindSession(x.project,'codex','s',x.draft);assert.deepEqual(bindSession(x.project,'codex','s',x.draft),original);
  assert.throws(()=>bindSession(x.project,'codex','s',x.second),/禁止覆盖关联/);
 }finally{x.cleanup();}
});

test('绑定后目标失效、搬走、跨项目事件和另一会话均不映射',async()=>{
 const x=setup();try{
  bindSession(x.project,'codex','session-a',x.draft);await capture(x,'Stop',{last_assistant_message:'完成'});
  const [e]=readHookEvents(x.project),before=client.events().length;
  assert.equal(queueBoundHook({...e,projectRoot:x.other},x.project).reason,'binding-mismatch');
  assert.equal(queueBoundHook({...e,sessionId:'another'},x.project).reason,'unbound');
  fs.unlinkSync(join(x.draft,'versions.json'));assert.equal(queueBoundHook(e,x.project).reason,'draft-unavailable');
  fs.rmSync(x.draft,{recursive:true});fs.symlinkSync(x.other,x.draft,'dir');assert.equal(queueBoundHook(e,x.project).reason,'target-moved');
  assert.equal(client.events().length,before);
 }finally{x.cleanup();}
});

test('capture 重放与桥接重放幂等，内容冲突不能冒充 duplicate',async()=>{
 const x=setup();try{
  bindSession(x.project,'codex','session-a',x.draft);
  const first=await capture(x,'Stop',{event_id:'host-event',last_assistant_message:'一次完成'});
  assert.equal((await capture(x,'Stop',{event_id:'host-event',last_assistant_message:'一次完成'})).reason,'duplicate');
  const [e]=readHookEvents(x.project);assert.equal(queueBoundHook(e,x.project).reason,'duplicate');assert.equal(client.events().length,1);assert.equal(client.pending().length,1);
  assert.equal(client.events()[0].details.payload.hookEventId,first.id);
  assert.equal(queueBoundHook({...e,payload:{...e.payload,finalResponse:'改写历史'}},x.project).reason,'bridge-failed');
  assert.equal(client.events()[0].details.payload.output,'一次完成');
  // 环境或草稿更新不改写原事件；幂等回放也不修改原版本。
  fs.writeFileSync(join(x.draft,'versions.json'),JSON.stringify({versions:[{v:1},{v:2}],draftConfirmed:2}));
  assert.equal(queueBoundHook(e,x.project).reason,'duplicate');assert.equal(client.events()[0].after,1);
 }finally{x.cleanup();}
});

test('没有轮次的 orphan 保留未知，不猜为上一轮或创建 Figma 工作流',async()=>{
 const x=setup();try{
  bindSession(x.project,'codex','session-a',x.draft);
  await capture(x,'UserPromptSubmit',{prompt:'请在Figma创建页面'});await capture(x,'Stop',{last_assistant_message:'已结束'});
  await capture(x,'PostToolUse',{turn_id:undefined,tool_name:'figma',tool_response:'孤立回执'});
  const hook=readHookEvents(x.project).find(e=>e.event==='PostToolUse'),bridged=client.events().find(e=>e.details.payload.hookEventId===hook.id),previous=client.events().find(e=>e.details.payload.hookEvent==='UserPromptSubmit');
  assert.equal(hook.turnId,null);assert.equal(bridged.details.payload.turnId,null);assert.notEqual(bridged.runId,previous.runId);
  assert.equal(localReport(x.project).workflowSummary.length,0);
 }finally{x.cleanup();}
});

test('关闭采集阻止新内容与重放，不改变绑定、草稿或旧日志',async()=>{
 const x=setup();try{
  bindSession(x.project,'codex','session-a',x.draft);await capture(x,'Stop',{last_assistant_message:'旧内容'});const [e]=readHookEvents(x.project);
  client.setAutoUpload(false);const count=client.events().length;
  assert.equal(queueBoundHook(e,x.project).reason,'tuning-disabled');assert.equal((await capture(x,'Stop',{event_id:'new',last_assistant_message:'新秘密'})).reason,'tuning-disabled');
  assert.equal((await client.flush()).state,'disabled');assert.equal(client.events().length,count);assert.equal(JSON.stringify(readHookEvents(x.project)).includes('新秘密'),false);
  assert.deepEqual(x.snapshot(),x.before);assert.equal(localReport(x.project).evidenceSummary.events,count);
 }finally{x.cleanup();}
});

test('真实 collector 逐事件 ACK、离线排队与恢复重传，不重复上传或改变原草稿',async()=>{
 const x=setup(),token=randomUUID()+randomUUID(),data=join(x.temp,'collector');
 const server=createCollector({dataDir:data,tokenHashes:[hash(token)],ticketSecret:randomUUID()});let requests=0;server.on('request',()=>requests++);
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  fs.writeFileSync(process.env.GAC_SUPPORT_CONFIG,JSON.stringify({endpoint:'http://127.0.0.1:'+server.address().port,token}));
  bindSession(x.project,'codex','session-a',x.draft);await capture(x,'UserPromptSubmit',{prompt:'实际采集'});assert.equal(requests,0,'capture 与 bridge 均不联网');
  assert.equal((await client.flush()).pending,0);assert.equal(requests,1);assert.equal(fs.readdirSync(join(data,'events')).length,1);
  await new Promise(r=>server.close(r));
  await capture(x,'Stop',{last_assistant_message:'离线结束'});assert.equal(client.pending().length,1);await assert.rejects(client.flush());assert.equal(client.pending().length,1);
  const [hook]=readHookEvents(x.project).filter(e=>e.event==='Stop');assert.equal(queueBoundHook(hook,x.project).reason,'duplicate');
  await new Promise(r=>server.listen(0,'127.0.0.1',r));fs.writeFileSync(process.env.GAC_SUPPORT_CONFIG,JSON.stringify({endpoint:'http://127.0.0.1:'+server.address().port,token}));
  assert.equal((await client.flush()).pending,0);assert.equal(fs.readdirSync(join(data,'events')).length,2);
  const before=requests;assert.equal(queueBoundHook(hook,x.project).reason,'duplicate');await client.flush();assert.equal(requests,before);
  for(const e of client.events())assert.ok(fs.existsSync(join(x.home,'acks',e.id)));
  assert.deepEqual(x.snapshot(),x.before);
 }finally{if(server.listening)await new Promise(r=>server.close(r));x.cleanup();}
});

test('trace 幂等只接受同一事实，补齐中断队列但不跨关闭 epoch 重排',()=>{
 const x=setup();try{
  const id=randomUUID(),runId=randomUUID(),at=new Date().toISOString(),value={id,runId,at,kind:'tool-call',payload:{hookEventId:'stable',toolResult:'原内容'}};
  assert.equal(client.trace(x.draft,value).recorded,true);assert.equal(client.trace(x.draft,value).reason,'duplicate');
  assert.throws(()=>client.trace(x.draft,{...value,payload:{...value.payload,toolResult:'改变内容'}}),/conflict/);
  assert.throws(()=>client.trace(x.second,value),/conflict/);
  fs.unlinkSync(join(x.home,'queue',id));assert.equal(client.trace(x.draft,value).reason,'duplicate');assert.equal(client.pending().length,1);
  client.setAutoUpload(false);client.setAutoUpload(true,{collection:'tuning'});assert.equal(client.pending().length,0);
  assert.equal(client.trace(x.draft,value).reason,'duplicate');assert.equal(client.pending().length,0);
 }finally{x.cleanup();}
});

test('默认报告仅限本项目，--data 可全量但投影不含对话、路径、设备与原标识',async()=>{
 const x=setup();try{
  const raw='RAW-PRIVATE-CONTENT',marker=join(x.temp,'must-not-execute');
  bindSession(x.project,'codex','session-a',x.draft);
  await capture(x,'UserPromptSubmit',{prompt:'请在Figma生成页面 '+raw});await capture(x,'Stop',{last_assistant_message:'我无法执行此操作。'+raw});
  const local=client.trace(x.draft,{kind:'tool-call',outcome:'error',payload:{tool:'figma-workflow',workflowId:raw+' /Users/private-device',stage:'generate',status:'unknown',reason:`timeout ${raw}; touch ${marker}`,fileKey:'RawPrivateFileKey2345678',confirmedVersion:1,hostname:raw,toolResult:raw}});
  const foreign=client.trace(x.other,{kind:'tool-call',outcome:'error',payload:{tool:'figma-workflow',workflowId:'foreign',stage:'preflight',status:'blocked',reason:raw,device:raw}});
  const report=localReport(x.project),serialized=JSON.stringify(report);
  assert.equal(report.evidenceSummary.events,3);assert.equal(report.workflowSummary[0].state,'unknown');assert.equal(report.workflowSummary[0].status,undefined);
  assert.equal(report.evidenceSummary.workflowIssues[0].candidateCauses[0].code,'tool_or_network');
  for(const secret of [raw,x.temp,x.project,'RawPrivateFileKey2345678','session-a','turn-a',client.taskId(x.draft),'private-device'])assert.equal(serialized.includes(secret),false,secret);
  assert.ok(report.evidenceSummary.failures.some(e=>e.eventId===local.id));assert.ok(!report.evidenceSummary.failures.some(e=>e.eventId===foreign.id));
  const all=localReport(x.project,{dataDir:x.home});assert.equal(all.evidenceSummary.events,4);assert.equal(all.workflowSummary.length,2);assert.equal(JSON.stringify(all).includes(raw),false);
  assert.equal(fs.existsSync(marker),false);assert.deepEqual(x.snapshot(),x.before);
 }finally{x.cleanup();}
});

test('HTML 注入转义，日志中的未知或可执行文本永远只是数据',()=>{
 const malicious='</pre><script>globalThis.sideEffect=true</script><img src=x onerror="attack()">';
 const html=renderReport({unknown:malicious});assert.equal(html.includes('<script>'),false);assert.equal(html.includes('<img src='),false);assert.ok(html.includes('&lt;script&gt;'));assert.equal(globalThis.sideEffect,undefined);
});
