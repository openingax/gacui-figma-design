import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const release=JSON.parse(fs.readFileSync('skill-release.json','utf8'));
assert.ok(fs.readFileSync('CHANGELOG.md','utf8').includes(`## ${release.version} —`));
for(const test of ['skill-distribution','draft-store','sketch','support','tuning'])execFileSync(process.execPath,[`tests/${test}.test.mjs`],{stdio:'inherit'});
const {code}=await import('../sketch/figma.mjs');assert.throws(()=>code('unconfigured','list'),/尚未适配验证/);
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
assert.ok(!tracked.some(p=>/^(tasks|evidence|private|credentials)\//.test(p)));
assert.ok(!tracked.some(p=>/\.(png|jpe?g|pem|key)$/.test(p)));
for(const file of tracked){const text=fs.readFileSync(file,'utf8');assert.ok(!text.includes(['j78vn5kr','Y3zAbruiu5BX16'].join('')),'内部目标残留：'+file);assert.ok(!text.includes(['gaclog','mimovip','space'].join('.')),'内部接收地址残留：'+file);}
console.log('PASS public package: standalone drafts, opt-in logging, version management, unconfigured Figma guard');
