import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';

// npx skills 默认以软链接安装；入口必须在软链接路径下照常执行，不能静默退出。
const root=path.resolve('.'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-entry-'));
const linked=path.join(temp,'linked');
fs.symlinkSync(root,linked,process.platform==='win32'?'junction':'dir');
const env={...process.env,GAC_SUPPORT_HOME:path.join(temp,'support'),GAC_SUPPORT_CONFIG:path.join(temp,'config.json')};
const run=(...args)=>spawnSync(process.execPath,args,{cwd:temp,env,encoding:'utf8',timeout:60000});
try{
 const status=run(path.join(linked,'.agents/skills/gacui-figma-design/scripts/manage.mjs'),'status','--workspace',path.join(temp,'ws'));
 assert.equal(status.status,0,status.stderr);assert.equal(JSON.parse(status.stdout).workspace,path.join(temp,'ws'));
 const cli=run(path.join(linked,'support/cli.mjs'),'status');
 assert.equal(cli.status,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).localDirectory,env.GAC_SUPPORT_HOME);
 // 缺参数的入口必须给出用法或错误，而不是无输出退出。
 for(const entry of ['sketch/sketch.mjs','support/dashboard.mjs','support/analyze.mjs','support/diagnose.mjs','support/manage.mjs']){
  const r=run(path.join(linked,entry));assert.ok((r.stdout+r.stderr).trim(),`软链接路径下 ${entry} 无任何输出`);
 }
 const tracked=execFileSync('git',['ls-files','*.mjs'],{encoding:'utf8'}).split('\n').filter(Boolean);
 // 私有版 figma-build.mjs 的哈希被 Transfer 离线预检证据固定，且只由维护者以真实路径调用。
 const pinned=['scripts/lib/figma-build.mjs'];
 for(const file of tracked.filter(f=>!pinned.includes(f)))assert.ok(!/import\.meta\.url\s*===\s*pathToFileURL/.test(fs.readFileSync(file,'utf8')),'旧入口判断残留：'+file);
 console.log('PASS entrypoints: symlinked skill entry, CLI and tools run instead of exiting silently');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
