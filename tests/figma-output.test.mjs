import fs from 'node:fs';
import os from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {fileKeyOf,requiredIds,checkCode,acceptReceipt,checkPlan,SOURCE_FILE_KEY} from '../scripts/figma/target.mjs';

const root=fs.mkdtempSync(join(os.tmpdir(),'gac-figma-output-')),dir=join(root,'draft');
const env={...process.env,GAC_SUPPORT_HOME:join(root,'support'),GAC_SUPPORT_CONFIG:join(root,'no-config.json')};
const run=(...args)=>{const r=spawnSync(process.execPath,['sketch/sketch.mjs',...args],{env,encoding:'utf8'});return {code:r.status,out:r.stdout,err:r.stderr};};
const ok=(...args)=>{const r=run(...args);assert.equal(r.code,0,r.err||r.out);return r.out;};
try{
 // 出稿请求只接受已通过内容核验的草稿确认版本，并写入 Figma 出稿所需的 confirmed/figmaPage。
 ok('save',dir,'examples/draft-first/v1.json','0');ok('save',dir,'examples/draft-first/v2.json','1');
 assert.equal(run('figma',dir,'2','出稿验证').code,1,'未确认版本不能请求出稿');
 const hash=JSON.parse(ok('status',dir)).versions[1].hash;ok('confirm',dir,'2',hash); // 明确的模拟确认，仅为测试。
 assert.equal(run('figma',dir,'1','出稿验证').code,1,'只能请求当前确认版本');
 assert.equal(run('figma',dir,'2','  ').code,1,'必须给出 Page 名称');
 ok('figma',dir,'2','出稿验证');
 const meta=JSON.parse(fs.readFileSync(join(dir,'versions.json'),'utf8'));
 assert.equal(meta.confirmed,2);assert.equal(meta.figmaPage,'出稿验证');assert.equal(meta.figmaRequest.hash,hash);assert.equal(JSON.parse(ok('status',dir)).draftConfirmed,2);

 // 目标适配：规范源不能作为目标；回执必须来自同一文件、覆盖当前全部依赖且无缺失。
 const key='A'.repeat(22),url=`https://www.figma.com/design/${key}/demo?node-id=1-2`;
 assert.equal(fileKeyOf(url),key);assert.throws(()=>fileKeyOf(SOURCE_FILE_KEY),/只读/);assert.throws(()=>fileKeyOf('bad'),/无法识别/);
 const ids=requiredIds();assert.ok(ids.length>400&&ids.every(id=>/^[1-9]\d{0,3}:\d+$/.test(id)),'依赖只含目标文件节点');
 assert.ok(!ids.includes('75:2123')&&ids.includes('180:3')&&ids.includes('203:52'),'排除规范源图标引用，包含基线与抽屉映射');
 const code=checkCode(key);assert.ok(code.includes(`figma.fileKey!==${JSON.stringify(key)}`));new Function('figma','return async function(){'+code+'}');
 const pages=[{id:'1:1',name:'组件目录',empty:false,draftOnly:false},{id:'2:1',name:'空白页',empty:true,draftOnly:false},{id:'3:1',name:'旧出稿',empty:false,draftOnly:true}];
 const spec=checkPlan(key);const receipt={schema:2,fileKey:key,fingerprint:spec.fingerprint,checked:ids.length,missing:[],pages,receipts:spec.batches.map(b=>({schema:2,fileKey:key,fingerprint:spec.fingerprint,batch:b.index,totalBatches:spec.batches.length,checkedIds:b.ids,missing:[],wrongTypes:[],...(b.index===0?{pages}:{})}))};
 assert.throws(()=>acceptReceipt(key,{...receipt,fileKey:'B'.repeat(22)},{write:false}),/不是指定目标/);
 assert.throws(()=>acceptReceipt(key,{...receipt,checked:ids.length-1},{write:false}),/数量与当前版本不符/);
 assert.throws(()=>acceptReceipt(key,{...receipt,missing:['180:3']},{write:false}),/缺少出稿所需组件/);
 assert.throws(()=>acceptReceipt(key,{...receipt,receipts:receipt.receipts.map(r=>r.batch===0?{...r,pages:pages.map(({empty,...p})=>p)}:r)},{write:false}),/Page 信息不完整/);
 const config=acceptReceipt(url,receipt,{write:false,now:'2026-10-20T00:00:00.000Z'});
 assert.equal(config.adapterVerified,true);assert.equal(config.sourceFileKey,SOURCE_FILE_KEY);assert.equal(config.contentPages,1);
 assert.deepEqual(config.pages.map(p=>p.name),['空白页'],'含内容的 Page 由运行时内容检查保护，名单只保护空 Page');
 console.log('PASS figma output: confirmed-draft request gate, target adapter receipt checks, source file refusal');
}finally{fs.rmSync(root,{recursive:true,force:true});}
