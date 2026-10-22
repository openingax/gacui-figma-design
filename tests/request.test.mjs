import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {requestWarnings,unknownKeys,diff} from '../sketch/core.mjs';

// 每个版本在草稿顶层记录本轮需求原文与来源，随保存自动上传；缺失只提示不阻断，不进入版本对比。
const examples=['examples/draft-first/v1.json','sketch/examples/work-order.json'].filter(f=>fs.existsSync(f));
const base=JSON.parse(fs.readFileSync(examples[0],'utf8'));
assert.deepEqual(requestWarnings(base),[],'示例已带 request');

const {request,...without}=base;
assert.match(requestWarnings(without)[0],/缺少 request/);
assert.match(requestWarnings({...base,request:'文本'})[0],/必须是对象/);
assert.ok(requestWarnings({...base,request:{text:' ',sources:[]}}).some(w=>/text 为空/.test(w)));
const feishu='https://example.feishu.cn/docx/Req123',figma='https://www.figma.com/design/KEY/name?node-id=1-2';
const partial={...base,request:{text:`按 ${feishu} 做，参考 ${figma}。`,sources:[{url:feishu,read:true}]}};
assert.deepEqual(requestWarnings(partial),[`request：text 中的链接未列入 sources：${figma}`]);
assert.ok(requestWarnings({...base,request:{text:'x',sources:[{note:'无地址'}]}}).some(w=>/需要 url 或 path/.test(w)));
assert.ok(unknownKeys({...base,request:{text:'x',sources:[{url:feishu,reed:true}],extra:1}}).some(w=>w.includes('reed')&&w.includes('是否应为 read')));
const complete={...base,request:{text:partial.request.text,sources:[{url:feishu,read:true},{url:figma,read:false,note:'无权限'}]}};
assert.deepEqual(requestWarnings(complete),[]);
const changes=d=>d.added.length+d.removed.length+d.changed.length;
assert.equal(changes(diff(base,complete)),0,'request 不进入版本对比');
assert.ok(changes(diff(base,{...complete,task:base.task+'（改）'}))>0,'设计内容变化仍被对比');

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'gacui-request-'));
const env={...process.env,GAC_SUPPORT_HOME:path.join(temp,'support'),GAC_SUPPORT_CONFIG:path.join(temp,'none.json')};
const save=(dir,data,expected)=>{const file=path.join(temp,'c-'+Math.random().toString(36).slice(2)+'.json');fs.writeFileSync(file,JSON.stringify(data));return spawnSync(process.execPath,['sketch/sketch.mjs','save',path.join(temp,dir),file,String(expected)],{env,encoding:'utf8'});};
try{
 const missing=save('a',without,0);
 assert.equal(missing.status,0,missing.stderr);assert.match(missing.stdout,/已保存草稿 v1/);assert.match(missing.stderr,/缺少 request/);
 const ok=save('b',complete,0);
 assert.equal(ok.status,0,ok.stderr);assert.doesNotMatch(ok.stderr,/request/);
 const check=spawnSync(process.execPath,['sketch/sketch.mjs','check',path.join(temp,'a'),'--discussion'],{env,encoding:'utf8'});
 assert.match(check.stderr,/缺少 request/);
 console.log('PASS request: per-version request text and sources, hints on save/check without blocking, excluded from diff');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
