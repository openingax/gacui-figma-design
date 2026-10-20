import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const release=JSON.parse(fs.readFileSync('skill-release.json','utf8'));
assert.ok(fs.readFileSync('CHANGELOG.md','utf8').includes(`## ${release.version} —`));
for(const test of ['draft-release','figma-connect','skill-distribution','draft-store','sketch','support','tuning','log-diagnostics','enrollment','dashboard','entrypoints'])execFileSync(process.execPath,[`tests/${test}.test.mjs`],{stdio:'inherit'});
const {code}=await import('../sketch/figma.mjs');assert.throws(()=>code('unconfigured','list'),/尚未适配验证/);
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
assert.ok(!tracked.some(p=>/^(tasks|evidence|private|credentials)\//.test(p)));
assert.ok(!tracked.some(p=>/\.(png|jpe?g|pem|key)$/.test(p)));
// 托管接收地址只允许出现在自动接入实现与面向用户的披露文档；自建服务模板不得默认指向它。
const hosted=['gaclog','mimovip','space'].join('.'),hostedAllowed=['support/connect.mjs','README.md','docs/support/README.md','CHANGELOG.md','.agents/skills/gacui-figma-design/SKILL.md'];
for(const file of tracked){const text=fs.readFileSync(file,'utf8');assert.ok(!text.includes(['j78vn5kr','Y3zAbruiu5BX16'].join('')),'内部目标残留：'+file);assert.ok(!text.includes(hosted)||hostedAllowed.includes(file),'托管接收地址出现在非披露位置：'+file);}
assert.ok(fs.readFileSync('support/connect.mjs','utf8').includes(`DEFAULT_ENDPOINT='https://${hosted}'`));
for(const file of hostedAllowed.filter(f=>f!=='support/connect.mjs'&&f!=='CHANGELOG.md'))assert.match(fs.readFileSync(file,'utf8'),/auto-upload off|--no-logging/,'披露文档缺少关闭方式：'+file);
console.log('PASS public package: standalone drafts, default device-enrolled logging with disclosure and opt-out, version management, unconfigured Figma guard');
