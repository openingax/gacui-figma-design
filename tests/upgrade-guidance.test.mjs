import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {manage} from '../.agents/skills/gacui-figma-design/scripts/manage.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gac-upgrade-'));
const origin=path.join(root,'origin'),workspace=path.join(root,'old workspace');
fs.mkdirSync(origin);
const git=(...args)=>execFileSync('git',args,{cwd:origin,encoding:'utf8',stdio:'pipe'}).trim();
git('init');git('config','user.name','Test');git('config','user.email','test@example.invalid');
const release=v=>{fs.writeFileSync(path.join(origin,'skill-release.json'),JSON.stringify({version:v,protocol:1,nodeMajor:20,channel:'stable',notice:'新版说明 '+v}));fs.writeFileSync(path.join(origin,'.gitignore'),'tasks/\n');git('add','.');git('commit','-m',v);git('tag','skill-v'+v);};
const repo=pathToFileURL(origin).href,call=(o={})=>manage({workspace,repo,...o});
try {
 release('0.4.6');assert.equal(call().update,undefined);
 fs.mkdirSync(path.join(workspace,'tasks'));fs.writeFileSync(path.join(workspace,'tasks/draft'),'keep');
 release('1.2.4');let r=call();assert.equal(r.version,'0.4.6');assert.equal(r.update.current,'0.4.6');assert.equal(r.update.target,'1.2.4');assert.equal(r.update.summary,'新版说明 1.2.4');assert.equal(r.update.requiresAcceptance,true);assert.match(r.blocked,/现在升级/);
 assert.deepEqual(r.update.args,['sync','--workspace',workspace,'--upgrade-to','1.2.4','--accept-breaking']);
 assert.equal(call().update.target,'1.2.4','稍后不会消除提醒');
 call({command:'pin',version:'0.4.6'});r=call({upgradeTo:'1.2.4',acceptBreaking:true});assert.equal(r.version,'0.4.6');assert.equal(r.update.status,'pinned');call({command:'unpin'});
 release('2.0.0');r=call({upgradeTo:'1.2.4',acceptBreaking:true});assert.equal(r.version,'1.2.4','新标签不能扩大已接受版本');assert.equal(r.pinned,undefined,'接受目标不固定未来更新');assert.equal(r.update.status,'updated');assert.ok(r.notice);assert.equal(fs.readFileSync(path.join(workspace,'tasks/draft'),'utf8'),'keep');
 assert.equal(call().update.target,'2.0.0');
 fs.appendFileSync(path.join(workspace,'skill-release.json'),' ');r=call({upgradeTo:'2.0.0',acceptBreaking:true});assert.equal(r.version,'1.2.4');assert.match(r.blocked,/修改/);execFileSync('git',['restore','skill-release.json'],{cwd:workspace});
 fs.renameSync(origin,origin+'-offline');assert.match(call().blocked,/无法检查/);fs.renameSync(origin+'-offline',origin);
 // 从实际入口经软链接执行，stdout JSON 与 stderr 中文提示同时可用。仅测试副本替换发行来源。
 const entry=path.join(root,'entry');fs.mkdirSync(entry);let source=fs.readFileSync('.agents/skills/gacui-figma-design/scripts/manage.mjs','utf8');source=source.replace("import { REPO, WORKSPACE_DIRECTORY, defaultWorkspace } from './source.mjs';",`const REPO=${JSON.stringify(repo)}, WORKSPACE_DIRECTORY='unused', defaultWorkspace=()=>${JSON.stringify(workspace)};`);fs.writeFileSync(path.join(entry,'manage.mjs'),source);
 const link=path.join(root,'linked.mjs');fs.symlinkSync(path.join(entry,'manage.mjs'),link);
 const cli=spawnSync(process.execPath,[link,'sync','--workspace',workspace,'--no-logging'],{encoding:'utf8'});assert.equal(cli.status,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).update.target,'2.0.0');assert.match(cli.stderr,/发现新版本/);
 const accepted=spawnSync(process.execPath,[link,'sync','--workspace',workspace,'--upgrade-to','2.0.0','--accept-breaking','--no-logging'],{encoding:'utf8'});assert.equal(accepted.status,0,accepted.stderr);assert.equal(JSON.parse(accepted.stdout).version,'2.0.0');assert.match(accepted.stderr,/已升级/);
 console.log('PASS upgrade guidance: legacy series, repeated prompt, pinned, exact acceptance, draft preservation, dirty/offline, symlink CLI');
} finally {fs.rmSync(root,{recursive:true,force:true});}
