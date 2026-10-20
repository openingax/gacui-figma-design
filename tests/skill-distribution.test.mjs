import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {manage} from '../.agents/skills/gacui-figma-design/scripts/manage.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-distribution-'));
const origin=path.join(root,'origin'),workspace=path.join(root,'client');
const git=(...a)=>execFileSync('git',a,{cwd:origin,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
fs.mkdirSync(origin);git('init');git('config','user.name','Integration Test');git('config','user.email','test@example.invalid');
function release(v){fs.writeFileSync(path.join(origin,'skill-release.json'),JSON.stringify({version:v,protocol:1,nodeMajor:20,channel:'stable',notice:v}));fs.writeFileSync(path.join(origin,'CHANGELOG.md'),v);git('add','.');git('commit','-m',v);git('tag',`skill-v${v}`);}
const call=(o={})=>manage({workspace,repo:pathToFileURL(origin).href,...o});
try {
 release('0.6.0'); let x=call();assert.equal(x.version,'0.6.0');assert.ok(x.notice);assert.ok(fs.existsSync(path.join(workspace,'CHANGELOG.md')));
 assert.ok(call().notice);assert.throws(()=>call({command:'ack',version:'0.6.1'}));call({command:'ack',version:'0.6.0'});assert.equal(call().notice,undefined);
 fs.mkdirSync(path.join(workspace,'tasks'));fs.writeFileSync(path.join(workspace,'tasks','mine.json'),'preserve');
 release('0.6.1');x=call();assert.equal(x.version,'0.6.1');assert.ok(x.notice);assert.equal(fs.readFileSync(path.join(workspace,'tasks','mine.json'),'utf8'),'preserve');
 call({command:'pin',version:'0.6.1'});release('0.6.2');assert.equal(call().version,'0.6.1');assert.ok(call().blocked);call({command:'unpin'});
 fs.appendFileSync(path.join(workspace,'CHANGELOG.md'),'local edit');x=call();assert.equal(x.version,'0.6.1');assert.match(x.blocked,/修改/);assert.match(fs.readFileSync(path.join(workspace,'CHANGELOG.md'),'utf8'),/local edit/);
 execFileSync('git',['restore','CHANGELOG.md'],{cwd:workspace});assert.equal(call().version,'0.6.2');
 release('0.7.0');x=call();assert.equal(x.version,'0.6.2');assert.match(x.blocked,/不兼容/);assert.equal(call({acceptBreaking:true}).version,'0.7.0');
 assert.match(call({version:'0.6.0',acceptBreaking:true}).blocked,/回退/);
 fs.renameSync(origin,origin+'-offline');assert.match(call().blocked,/无法检查/);fs.renameSync(origin+'-offline',origin);
 fs.writeFileSync(workspace+'.skill-lock','');assert.throws(()=>call());fs.unlinkSync(workspace+'.skill-lock');
 const other=path.join(root,'other');fs.mkdirSync(other);fs.writeFileSync(path.join(other,'mine'),'keep');assert.throws(()=>call({workspace:other}));assert.equal(fs.readFileSync(path.join(other,'mine'),'utf8'),'keep');
 const rollback=call({workspace:path.join(root,'rollback'),version:'0.6.0'});assert.equal(rollback.version,'0.6.0');assert.equal(rollback.pinned,'0.6.0');
 execFileSync('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','local'],{cwd:workspace});release('0.7.1');assert.match(call().blocked,/提交/);
 execFileSync('git',['remote','set-url','origin','https://example.invalid/untrusted.git'],{cwd:workspace});assert.throws(()=>call(),/origin/);
 console.log('PASS skill distribution: install/update/notice/ack/pin/dirty/breaking/offline/lock/rollback/local commit/origin');
}finally{fs.rmSync(root,{recursive:true,force:true});}
