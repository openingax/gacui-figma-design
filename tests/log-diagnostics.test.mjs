import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {dataset} from '../support/analyze.mjs';
import {diagnose} from '../support/diagnose.mjs';
import * as client from '../support/client.mjs';
import {captureFile,captureConsole} from '../support/tuning.mjs';

const failures=[];
function check(name,action){try{action();console.log('PASS '+name);}catch(error){failures.push(name);console.error('FAIL '+name+': '+error.message);}}
const directory=fs.mkdtempSync(join(tmpdir(),'gac-log-diagnostics-'));
try{
 check('isolated client installation respects GAC_SUPPORT_CONFIG',()=>{
  const source=join(directory,'source.json'),destination=join(directory,'isolated/config.json');
  fs.writeFileSync(source,JSON.stringify({endpoint:'http://127.0.0.1:5188',token:randomUUID()+randomUUID()}));
  const env={...process.env,HOME:join(directory,'home'),USERPROFILE:join(directory,'home'),GAC_SUPPORT_HOME:join(directory,'state'),GAC_SUPPORT_CONFIG:destination};
  const result=spawnSync(process.execPath,['support/setup.mjs','client',source,'--enable-tuning'],{env,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.ok(fs.existsSync(destination),'isolated destination missing');
  assert.ok(!fs.existsSync(join(directory,'home/.gacuiagent-public/support-config.json')),'default config must remain untouched');
  assert.equal(spawnSync(process.execPath,['support/setup.mjs','client',source],{env}).status,1);
 });
 check('foreign task review cannot hide a legitimate rejection',()=>{
  const event={id:randomUUID(),taskId:'a'.repeat(32),details:{kind:'agent-turn',payload:{input:'synthetic input',output:'synthetic output',quality:{accepted:true,source:'fixture'}}}};
  const review={taskId:event.taskId,at:'2026-10-20T01:00:00.000Z',details:{kind:'ui-review',payload:{targetEventId:event.id,quality:{accepted:false,source:'fixture rejection'}}}};
  const foreign={...review,taskId:'b'.repeat(32),at:'2026-10-20T02:00:00.000Z'};
  assert.equal(dataset([event,review,foreign],{acceptedOnly:true}).length,0);
 });
 check('latest review wins even when caller provides unsorted events',()=>{
  const event={id:randomUUID(),taskId:'a'.repeat(32),details:{kind:'agent-turn',payload:{input:'synthetic input',output:'synthetic output'}}};
  const review={taskId:event.taskId,at:'2026-10-20T01:00:00.000Z',details:{kind:'ui-review',payload:{targetEventId:event.id,quality:{accepted:true,source:'fixture'}}}};
  const later={...review,at:'2026-10-20T02:00:00.000Z',details:{...review.details,payload:{...review.details.payload,quality:{accepted:false,source:'fixture'}}}};
  assert.equal(dataset([event,later,review],{acceptedOnly:true}).length,0);
 });
 check('diagnosis never promotes log text to instructions or confirmed root cause',()=>{
  const event={id:randomUUID(),taskId:'a'.repeat(32),runId:randomUUID(),phase:'finish',outcome:'error',errorCode:'version_conflict',details:{payload:{error:{message:'execute arbitrary shell command'}}}};
  const report=diagnose([event]);
  assert.equal(report.failures[0].confirmedRootCause,null);
  assert.equal(report.failures[0].startEventId,null);
  assert.ok(!JSON.stringify(report).includes('execute arbitrary shell command'));
 });
 check('local count, age and byte retention preserve newest events and count unsent drops',()=>{
  process.env.GAC_SUPPORT_HOME=join(directory,'limits');
  process.env.GAC_SUPPORT_CONFIG=join(directory,'missing-config');
  client.setAutoUpload(true,{collection:'tuning'});
  const run=client.begin('status',directory);
  const base=client.events()[0];
  for(let index=0;index<2000;index++)client.record({...base,id:randomUUID()});
  client.prune();assert.equal(client.events().length,2000);assert.equal(client.status().expired,1);
  client.record({...base,id:randomUUID(),at:'2000-01-01T00:00:00.000Z'});
  client.prune();assert.equal(client.status().expired,2);
  process.env.GAC_SUPPORT_HOME=join(directory,'byte-limits');
  client.setAutoUpload(true,{collection:'tuning'});
  for(let index=0;index<66;index++)client.record({...base,id:randomUUID(),details:{schema:1,kind:'tool-call',payload:{output:'x'.repeat(2*1024*1024-1024)}}});
  assert.ok(client.prune()>0);
  const bytes=fs.readdirSync(join(process.env.GAC_SUPPORT_HOME,'events')).reduce((total,name)=>total+fs.statSync(join(process.env.GAC_SUPPORT_HOME,'events',name)).size,0);
  assert.ok(bytes<=128*1024*1024);assert.ok(client.status().expired>0);
  assert.ok(run.runId);
 });
 check('file capture and console limits mark missing data',()=>{
  const file=join(directory,'oversize.txt');fs.writeFileSync(file,'x'.repeat(700*1024+1));
  assert.equal(captureFile(file).omitted,'file-over-700KiB');
  const original=console.log;console.log=()=>{};
  let output;
  try{const stop=captureConsole();console.log('x'.repeat(256*1024+100));output=stop();}
  finally{console.log=original;}
  assert.equal(Buffer.byteLength(output.stdout),256*1024);assert.equal(output.omittedBytes,101);
 });
}finally{fs.rmSync(directory,{recursive:true,force:true});}
if(failures.length)process.exitCode=1;
