#!/usr/bin/env node
// 仅从指定公开标签导出新目录；不读取工作区未提交内容，不推送任何平台。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [source,tag,expectedCommit,output]=process.argv.slice(2);
assert.ok(source && /^skill-v\d+\.\d+\.\d+$/.test(tag||'') && /^[a-f0-9]{40}$/.test(expectedCommit||'') && output,'用法: node scripts/distribution/build-gitee.mjs <公开GitHub源码目录> <skill-vX.Y.Z> <完整提交SHA> <全新输出目录>');
const git=(...args)=>execFileSync('git',['-C',source,...args],{maxBuffer:64*1024*1024});
assert.equal(git('rev-parse',`${tag}^{commit}`).toString().trim(),expectedCommit,'上游标签提交不符');
const release=JSON.parse(git('show',`${tag}:skill-release.json`));
assert.equal(tag,`skill-v${release.version}`);assert.equal(release.channel,'stable');
const entries=git('ls-tree','-r','-z',tag).toString().split('\0').filter(Boolean).map(row=>{const [meta,name]=row.split('\t');assert.ok(meta.startsWith('100644 blob ')||meta.startsWith('100755 blob '),'只导出普通文件');assert.ok(!/^(tasks|evidence|private|credentials)\//.test(name));return {name,mode:meta.slice(0,6)};});
assert.ok(!fs.existsSync(output),'输出必须不存在');fs.mkdirSync(output,{recursive:true});
const original=new Map();for(const {name,mode} of entries){const bytes=git('show',`${tag}:${name}`);original.set(name,bytes);const p=path.join(output,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes,{mode:mode==='100755'?0o755:0o644});}
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const edit=(name,fn)=>{const p=path.join(output,name);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));};
const replace=(s,old,value)=>{assert.ok(s.includes(old),'上游结构已变化，需重新审核: '+old);return s.replaceAll(old,value);};
edit('.agents/skills/gacui-figma-design/scripts/manage.mjs',s=>replace(replace(s,"export const REPO = 'https://github.com/openingax/gacui-figma-design.git';","import { REPO, WORKSPACE_DIRECTORY } from './source.mjs';\nexport { REPO, WORKSPACE_DIRECTORY };"),"path.join(os.homedir(),'.gacuiagent-public','workspace')","path.join(os.homedir(),WORKSPACE_DIRECTORY,'workspace')"));
for(const name of ['README.md','docs/onboarding.md','.agents/skills/gacui-figma-design/SKILL.md','docs/maintenance.md'])edit(name,s=>replace(s,'openingax/gacui-figma-design','https://gitee.com/xieliying/gacui-figma-design.git').replaceAll('~/.gacuiagent-public/workspace','~/.gacuiagent-gitee/workspace'));
edit('README.md',s=>s.replace(`版本：V${release.version}。`,`版本：V${release.version}（Gitee 发行版）。`)+'\n## Gitee 发行说明\n'+fs.readFileSync(path.join(here,'README.md'),'utf8').split('\n## Gitee 发行说明\n')[1]);
edit('docs/maintenance.md',s=>s.replace(/当前版本V[\d.]+，标签skill-v[\d.]+/,`当前版本V${release.version}，标签skill-v${release.version}`));
edit('scripts/verify.mjs',s=>replace(s,"'skill-distribution',","'skill-distribution','gitee-distribution',"));
for(const name of ['.agents/skills/gacui-figma-design/scripts/source.mjs','tests/gitee-distribution.test.mjs','docs/platform-distribution.md','scripts/distribution/build-gitee.mjs']){const p=path.join(output,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.copyFileSync(path.join(here,name),p);}
const names=[...new Set([...original.keys(),'.agents/skills/gacui-figma-design/scripts/source.mjs','tests/gitee-distribution.test.mjs','docs/platform-distribution.md','scripts/distribution/build-gitee.mjs'])].sort();
const sha=b=>createHash('sha256').update(b).digest('hex');
const files=names.map(name=>{const bytes=fs.readFileSync(path.join(output,name));return {path:name,sha256:sha(bytes),upstreamSha256:original.has(name)?sha(original.get(name)):null};});
fs.writeFileSync(path.join(output,'distribution-manifest.json'),JSON.stringify({schema:1,platform:'gitee',repository:'https://gitee.com/xieliying/gacui-figma-design.git',version:release.version,upstream:{repository:'https://github.com/openingax/gacui-figma-design.git',tag,commit:expectedCommit},differences:files.filter(f=>f.sha256!==f.upstreamSha256).map(f=>f.path),files},null,2)+'\n');
console.log(JSON.stringify({output,version:release.version,files:files.length,upstreamCommit:expectedCommit}));
