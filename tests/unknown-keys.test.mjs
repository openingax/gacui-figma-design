import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {unknownKeys} from '../sketch/core.mjs';

// #8：写错或放错层级的属性名不会生效；先在 save/check 时警告（不改变退出码），示例与现有稿件不得误报。
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const examples=['examples/draft-first/v1.json','examples/draft-first/v2.json','sketch/examples/work-order.json','sketch/examples/settlement.json'].filter(f=>fs.existsSync(f));
assert.ok(examples.length);
for(const f of examples)assert.deepEqual(unknownKeys(read(f)),[],'示例不应有未知属性：'+f);

const draft=read(examples[0]),page=draft.pages.find(p=>p.children?.some(n=>n.fields?.length)),node=page.children.find(n=>n.fields?.length);
node.bogusField='测试';node.visibel=true;node.rowActionRule=[];node.fields[0].typo='x';page.colour='red';draft.extra=1;
const warnings=unknownKeys(draft);
assert.ok(warnings.some(w=>w.includes('bogusField')&&!w.includes('是否应为')));
assert.ok(warnings.some(w=>w.includes('visibel')&&w.includes('是否应为 visible')));
assert.ok(warnings.some(w=>w.includes('rowActionRule')&&w.includes('是否应为 rowActionRules')));
assert.ok(warnings.some(w=>w.startsWith(`${page.id}/${node.id}/${node.fields[0].id}：`)&&w.includes('typo')),'字段层带完整路径');
assert.ok(warnings.some(w=>w.startsWith(`页面 ${page.id}：`)&&w.includes('colour')));
assert.ok(warnings.some(w=>w.startsWith('草稿：')&&w.includes('extra')));

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-keys-'));
const env={...process.env,GAC_SUPPORT_HOME:path.join(temp,'support'),GAC_SUPPORT_CONFIG:path.join(temp,'none.json')};
try{
 const candidate=path.join(temp,'candidate.json');fs.writeFileSync(candidate,JSON.stringify(draft));
 const save=spawnSync(process.execPath,['sketch/sketch.mjs','save',path.join(temp,'draft'),candidate,'0'],{env,encoding:'utf8'});
 assert.equal(save.status,0,save.stderr);assert.match(save.stdout,/已保存草稿 v1/);assert.match(save.stderr,/未知属性 bogusField/);assert.doesNotMatch(save.stdout,/未知属性/);
 const check=spawnSync(process.execPath,['sketch/sketch.mjs','check',path.join(temp,'draft'),'--discussion'],{env,encoding:'utf8'});
 assert.match(check.stderr,/未知属性 typo/);
 console.log('PASS unknown keys: warns with path and suggestion on save/check, keeps exit codes, no false positives on examples');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
