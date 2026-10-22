import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {manage,connectLogging} from '../.agents/skills/gacui-figma-design/scripts/manage.mjs';
import {createCollector} from '../support/server.mjs';
import {randomUUID,createHash} from 'node:crypto';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-distribution-'));
const origin=path.join(root,'origin'),workspace=path.join(root,'client');
const git=(...a)=>execFileSync('git',a,{cwd:origin,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
fs.mkdirSync(origin);git('init');git('config','user.name','Integration Test');git('config','user.email','test@example.invalid');
function release(v){fs.writeFileSync(path.join(origin,'skill-release.json'),JSON.stringify({version:v,protocol:1,nodeMajor:20,channel:'stable',notice:v}));fs.writeFileSync(path.join(origin,'CHANGELOG.md'),v);git('add','.');git('commit','-m',v);git('tag',`skill-v${v}`);}
const call=(o={})=>manage({workspace,repo:pathToFileURL(origin).href,...o});
try {
 release('0.6.0'); let x=call();assert.equal(x.version,'0.6.0');assert.equal(x.notice,undefined,'全新安装不显示更新说明');assert.ok(fs.existsSync(path.join(workspace,'CHANGELOG.md')));
 assert.equal(call().notice,undefined);assert.throws(()=>call({command:'ack',version:'0.6.1'}));
 fs.mkdirSync(path.join(workspace,'tasks'));fs.writeFileSync(path.join(workspace,'tasks','mine.json'),'preserve');
 release('0.6.1');x=call();assert.equal(x.version,'0.6.1');assert.ok(x.notice,'升级显示更新说明');assert.equal(fs.readFileSync(path.join(workspace,'tasks','mine.json'),'utf8'),'preserve');
 assert.ok(call().notice,'未确认前持续显示');call({command:'ack',version:'0.6.1'});assert.equal(call().notice,undefined);
 call({command:'pin',version:'0.6.1'});release('0.6.2');assert.equal(call().version,'0.6.1');assert.ok(call().blocked);call({command:'unpin'});
 fs.appendFileSync(path.join(workspace,'CHANGELOG.md'),'local edit');x=call();assert.equal(x.version,'0.6.1');assert.match(x.blocked,/修改/);assert.match(fs.readFileSync(path.join(workspace,'CHANGELOG.md'),'utf8'),/local edit/);
 execFileSync('git',['restore','CHANGELOG.md'],{cwd:workspace});assert.equal(call().version,'0.6.2');
 release('0.7.0');x=call();assert.equal(x.version,'0.6.2');assert.match(x.blocked,/不兼容/);assert.equal(call({acceptBreaking:true}).version,'0.7.0');
 assert.match(call({version:'0.6.0',acceptBreaking:true}).blocked,/回退/);
 fs.renameSync(origin,origin+'-offline');assert.match(call().blocked,/无法检查/);fs.renameSync(origin+'-offline',origin);
 // 锁：新空锁/存活进程/他机持有拒绝并给出路径；已退出进程或超时旧空锁可接管。
 const lock=workspace+'.skill-lock',setLock=v=>fs.writeFileSync(lock,typeof v==='string'?v:JSON.stringify(v));
 setLock('');assert.throws(()=>call(),e=>e.code==='LOCKED'&&e.message.includes(lock));
 const old=new Date(Date.now()-20*60*1000);fs.utimesSync(lock,old,old);assert.equal(call().lockTakeover.previous,'legacy-empty-lock');assert.ok(!fs.existsSync(lock));
 setLock({pid:process.pid,hostname:os.hostname(),startedAt:'t'});assert.throws(()=>call(),/PID/);
 setLock({pid:1,hostname:'another-host',startedAt:'t'});assert.throws(()=>call(),/another-host/);
 const dead=spawnSync(process.execPath,['-e','']).pid;setLock({pid:dead,hostname:os.hostname(),startedAt:'t'});assert.equal(call().lockTakeover.previous.pid,dead);assert.ok(!fs.existsSync(lock));
 const other=path.join(root,'other');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'mine'),'keep');assert.throws(()=>call({workspace:other}));assert.equal(fs.readFileSync(path.join(other,'mine'),'utf8'),'keep');
 const rollback=call({workspace:path.join(root,'rollback'),version:'0.6.0'});assert.equal(rollback.version,'0.6.0');assert.equal(rollback.pinned,'0.6.0');
 execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','local'],{cwd:workspace});release('0.7.1');assert.match(call().blocked,/提交/);
 execFileSync('git',['remote','set-url','origin','https://example.invalid/untrusted.git'],{cwd:workspace});assert.throws(()=>call(),/origin/);
 // 安装后入口在真实运行目录执行接入：首次自动登记、重复不增设备、显式关闭不联网。
 const collector=createCollector({dataDir:path.join(root,'collector'),tokenHashes:[createHash('sha256').update(randomUUID()).digest('hex')],ticketSecret:randomUUID(),autoEnroll:true});
 await new Promise(r=>collector.listen(0,'127.0.0.1',r));let hits=0;collector.on('request',()=>hits++);
 const endpoint='http://127.0.0.1:'+collector.address().port,runtime=path.resolve('.');
 process.env.GAC_SUPPORT_HOME=path.join(root,'runtime-state');process.env.GAC_SUPPORT_CONFIG=path.join(root,'runtime-config.json');
 try {
  const first=await connectLogging(runtime,{endpoint});assert.equal(first.state,'connected',JSON.stringify(first));assert.ok(first.notice);
  assert.equal((await connectLogging(runtime,{endpoint})).enrolled,false);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(path.join(root,'collector','devices.json'),'utf8'))).length,1);
  assert.equal((await connectLogging(runtime,{disable:true})).state,'disabled');const seen=hits;
  assert.equal((await connectLogging(runtime,{endpoint})).state,'disabled');assert.equal(hits,seen);
  assert.equal((await connectLogging(root)).state,'unavailable');
 } finally { await new Promise(r=>collector.close(r)); }
 console.log('PASS skill distribution: install/update/notice/ack/pin/dirty/breaking/offline/lock/rollback/local commit/origin/logging connect');
}finally{fs.rmSync(root,{recursive:true,force:true});}
