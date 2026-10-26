import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {basicEvent} from '../support/tuning.mjs';
import * as client from '../support/client.mjs';import {figmaTrace} from '../support/figma-log.mjs';import {figmaWorkflows} from '../support/workflow-state.mjs';
const root=fs.mkdtempSync(join(os.tmpdir(),'gac-log-client-'));process.env.GAC_SUPPORT_HOME=join(root,'support');process.env.GAC_SUPPORT_CONFIG=join(root,'absent.json');
try{
 for(const arg of ['--help','-h','help']){const p=spawnSync(process.execPath,['sketch/sketch.mjs',arg],{encoding:'utf8',env:process.env});assert.equal(p.status,0);assert.match(p.stdout,/用法/);assert.equal(client.events().length,0);}
 const invalid=spawnSync(process.execPath,['sketch/sketch.mjs','bogus'],{encoding:'utf8',env:process.env});assert.equal(invalid.status,2);assert.equal(client.events().find(e=>e.phase==='finish').context.command,'bogus');
 const draft=join(root,'draft');fs.mkdirSync(draft);fs.writeFileSync(join(draft,'versions.json'),JSON.stringify({draftConfirmed:5}));client.setAutoUpload(true,{collection:'tuning'});
 const request=figmaTrace(draft,{stage:'request',status:'started',reason:'request'});
 const plan=figmaTrace(draft,{stage:'preflight',status:'completed',reason:'planned',fileKey:'a'.repeat(22)});assert.equal(request.workflowId,plan.workflowId,'目标后补仍属于同一次请求');
 const restart=spawnSync(process.execPath,['--input-type=module','-e',`import {figmaTrace} from './support/figma-log.mjs';console.log(JSON.stringify(figmaTrace(${JSON.stringify(draft)},{stage:'initialize',status:'completed',reason:'ready',fileKey:'${'a'.repeat(22)}'})));`],{encoding:'utf8',env:process.env});assert.equal(restart.status,0,restart.stderr);assert.equal(JSON.parse(restart.stdout).workflowId,plan.workflowId,'跨进程持久化');
 const other=figmaTrace(draft,{stage:'request',status:'started',reason:'new',fileKey:'b'.repeat(22)});assert.notEqual(other.workflowId,plan.workflowId);
 const base=client.events().find(e=>e.details?.payload?.stage==='preflight');const legacy={...base,at:'2026-01-01T00:00:00.000Z',outcome:'error',details:{...base.details,payload:{...base.details.payload,workflowId:null,status:'blocked'}}};
 const verify={...base,id:'99999999-9999-4999-8999-999999999999',at:'2026-01-02T00:00:00.000Z',details:{...base.details,payload:{...base.details.payload,stage:'verify',status:'completed',deliveryComplete:true,receipt:{verified:true},resolvesEventIds:[legacy.id]}}};
 assert.equal(figmaWorkflows([legacy,verify]).find(w=>w.legacy).state,'verified');
 assert.equal(figmaWorkflows([legacy,{...verify,taskId:'f'.repeat(32)}]).find(w=>w.legacy).state,'blocked');
 assert.equal(figmaWorkflows([legacy,{...verify,details:{...verify.details,payload:{...verify.details.payload,receipt:null}}}]).find(w=>w.legacy).state,'blocked');
 const run=client.begin('check',draft);run.diagnostic={category:'business_pending',message:'待回答'};client.finish(run,1);const finish=client.events().find(e=>e.runId===run.runId&&e.phase==='finish');assert.equal(finish.context.category,'business_pending');assert.equal(finish.context.exitCode,1);assert.ok(finish.context.skillVersion);assert.ok(!JSON.stringify(basicEvent(finish)).includes('待回答'));
 client.setAutoUpload(false);const basic=client.begin('check',draft);basic.diagnostic={category:'business_pending',message:'private-content'};client.finish(basic,1);assert.ok(!JSON.stringify(client.events().filter(e=>e.runId===basic.runId)).includes('private-content'));
 console.log('PASS client semantics: help, unknown command, workflow continuity/target isolation, explicit legacy recovery, metadata and basic privacy');
}finally{fs.rmSync(root,{recursive:true,force:true});}
