import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';
import {buildReport} from '../support/report.mjs';import {validEvent} from '../support/protocol.mjs';import {eventMessage} from '../support/event-semantics.mjs';
const root=fs.mkdtempSync(join(os.tmpdir(),'gac-log-semantics-'));const client='a'.repeat(64),taskId='b'.repeat(32);let seq=0;
const event=(extra={})=>({id:randomUUID(),taskId,runId:randomUUID(),at:new Date(1800000000000+seq++*1000).toISOString(),phase:'finish',operation:'check',outcome:'success',durationMs:1,before:5,after:5,build:'unknown',dirty:false,platform:'other',node:process.version,errorCode:'none',...extra});
const figma=(status,extra={})=>event({operation:'tool',outcome:status==='blocked'?'error':'success',errorCode:status==='blocked'?'unexpected':'none',details:{schema:1,kind:'tool-call',payload:{tool:'figma-workflow',stage:'preflight',status,fileKey:'a'.repeat(22),confirmedVersion:5,...extra}}});
function report(events){const dir=fs.mkdtempSync(join(root,'data-'));fs.mkdirSync(join(dir,'events'));for(const e of events)fs.writeFileSync(join(dir,'events',client+'-'+e.id+'.json'),JSON.stringify(validEvent(e)));return buildReport(dir);}
try {
 const start=event({phase:'start',operation:'unknown',outcome:'running',details:{schema:1,kind:'draft-command',payload:{command:'--help',args:[]}}});
 const end=event({runId:start.runId,operation:'unknown',outcome:'error',errorCode:'check_failed'});
 const help=report([start,end]);assert.equal(help.tasks.length,0);assert.equal(help.totals.errors,0);assert.equal(help.metrics.ignoredHelpEvents,2);
 assert.equal(report([end]).tasks.length,1,'缺少 start 不猜是帮助');
 const waiting=event({outcome:'error',errorCode:'check_failed',details:{schema:1,kind:'draft-command',payload:{output:{stderr:'',stdout:'v2 有 1 个错误：\n- 确认出稿前：问题 roles 未回答'}}}});
 assert.match(eventMessage(waiting),/roles/);const wait=report([waiting]);assert.equal(wait.tasks[0].status,'待业务确认');assert.equal(wait.metrics.draftFailures,0);
 const mixed={...waiting,id:randomUUID(),details:{schema:1,kind:'draft-command',payload:{output:{stdout:waiting.details.payload.output.stdout+'\n- 无效字段'}}}};assert.equal(report([mixed]).metrics.draftFailures,1,'混合结构错误不能隐藏');
 const blocked=figma('blocked',{reason:'尚无可移植构建数据：203:17'}),progress=figma('completed',{reason:'按需组件规划完成，尚未写入Figma'});const row=report([blocked,progress]).tasks[0];assert.equal(row.status,'待验证');assert.equal(row.deliveryState,'unverified');assert.equal(row.errors,1);assert.equal(row.lastErrorCategory,'component_unsupported');
 const failed=event({outcome:'error',errorCode:'unexpected'}),tool=figma('blocked');const metrics=report([failed,tool,event()]).metrics;assert.equal(metrics.draftAttempts,2);assert.equal(metrics.draftFailures,1,'工具错误不能除以草稿命令数');
 const contextual=event({context:{command:'check',exitCode:1,skillVersion:'1.2.8',category:'validation',message:'bad',buildSource:'manifest',evidenceSource:'local-cli'}});assert.equal(report([contextual]).tasks[0].latestEventVersion.skillVersion,'1.2.8');assert.throws(()=>validEvent({...contextual,context:{exitCode:'1'}}));
 console.log('PASS log semantics: help exclusion, missing start, business waiting, mixed errors, historical progress, denominator and version');
}finally{fs.rmSync(root,{recursive:true,force:true});}
