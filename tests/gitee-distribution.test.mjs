import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {manage,REPO,WORKSPACE_DIRECTORY} from '../.agents/skills/gacui-figma-design/scripts/manage.mjs';
assert.equal(REPO,'https://gitee.com/xieliying/gacui-figma-design.git');
assert.equal(WORKSPACE_DIRECTORY,'.gacuiagent-gitee');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-gitee-'));
try {
 const skill=path.join(temp,'skill');fs.cpSync('.agents/skills/gacui-figma-design',skill,{recursive:true});
 const link=path.join(temp,'linked');fs.symlinkSync(skill,link,process.platform==='win32'?'junction':'dir');
 for(const base of [skill,link]){
  const r=spawnSync(process.execPath,[path.join(base,'scripts/manage.mjs'),'status'],{env:{...process.env,HOME:temp,USERPROFILE:temp},encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).workspace,path.join(temp,WORKSPACE_DIRECTORY,'workspace'));
 }
 const workspace=path.join(temp,'rejected');fs.mkdirSync(workspace);
 const git=(...a)=>execFileSync('git',a,{cwd:workspace,encoding:'utf8',stdio:'pipe'});
 git('init');git('remote','add','origin','https://github.com/openingax/gacui-figma-design.git');
 fs.writeFileSync(path.join(workspace,'mine.json'),'keep');
 assert.throws(()=>manage({workspace,command:'status'}),/origin 不符/);
 assert.equal(fs.readFileSync(path.join(workspace,'mine.json'),'utf8'),'keep');
 assert.equal(git('remote','get-url','origin').trim(),'https://github.com/openingax/gacui-figma-design.git');
 const manager=fs.readFileSync(path.join(skill,'scripts/manage.mjs'),'utf8');
 assert.ok(!manager.includes('github.com'));assert.ok(!manager.includes('gacexly8638'));
 assert.match(fs.readFileSync('README.md','utf8'),/skills@latest add https:\/\/gitee.com\/xieliying\/gacui-figma-design.git/);
 console.log('PASS Gitee distribution: fixed source, isolated default workspace, copied/symlinked standalone entry, GitHub origin refused without mutation; update/pin/offline/dirty covered by distribution suite');
} finally {fs.rmSync(temp,{recursive:true,force:true});}
