import fs from 'node:fs';
import os from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {resolvePage} from '../sketch/core.mjs';
const root=fs.mkdtempSync(join(os.tmpdir(),'gac-draft-release-')),dir=join(root,'draft');
const env={...process.env,GAC_SUPPORT_HOME:join(root,'support'),GAC_SUPPORT_CONFIG:join(root,'no-config.json')};
const run=(...args)=>{const r=spawnSync(process.execPath,['sketch/sketch.mjs',...args],{env,encoding:'utf8'});return {code:r.status,out:r.stdout,err:r.stderr};};
const ok=(...args)=>{const r=run(...args);assert.equal(r.code,0,r.err||r.out);return r.out;};
try{
 ok('save',dir,'examples/draft-first/v1.json','0');const first=fs.readFileSync(join(dir,'v1.json'),'utf8');
 ok('check',dir,'--discussion');const v1=JSON.parse(ok('status',dir)).versions[0];assert.equal(run('confirm',dir,'1',v1.hash).code,1,'未决问题不得确认');
 ok('render',dir);assert.ok(fs.readFileSync(join(dir,'预览.html'),'utf8').includes('取消是否需要二次确认'));
 ok('save',dir,'examples/draft-first/v2.json','1');ok('check',dir);assert.ok(ok('diff',dir).includes('申请人姓名'));assert.equal(fs.readFileSync(join(dir,'v1.json'),'utf8'),first);
 const state=JSON.parse(ok('status',dir));assert.equal(state.latest,2);assert.equal(state.draftConfirmed,null);ok('confirm',dir,'2',state.versions[1].hash); // 明确的模拟确认，仅为测试。
 const meta=JSON.parse(fs.readFileSync(join(dir,'versions.json'),'utf8'));assert.equal(meta.confirmed,undefined);assert.equal(meta.figmaPage,undefined);
 const exported=join(root,'selected-v2.html');ok('export',dir,'2',exported);const html=fs.readFileSync(exported,'utf8');assert.ok(html.includes('申请人姓名'));assert.ok(html.includes('新建借用申请'));assert.equal(run('export',dir,'2',exported).code,1,'不覆盖既有导出');
 ok('restore',dir,'1','2');const restored=JSON.parse(ok('status',dir));assert.equal(restored.latest,3);assert.equal(restored.draftConfirmed,2);assert.equal(fs.readFileSync(join(dir,'v1.json'),'utf8'),first);
 assert.equal(JSON.parse(fs.readFileSync(join(dir,'v3.json'),'utf8')).pages[1].title,'发起借用');
 const initial=JSON.parse(first);assert.deepEqual(resolvePage(initial.pages[0]).children[2].rowActions[2].labels,['查看'],'已归还记录不能出现撤回');const changed=JSON.parse(fs.readFileSync(join(dir,'v2.json'),'utf8'));assert.deepEqual(changed.pages[0],initial.pages[0],'修改抽屉不改变列表');assert.equal(changed.pages[1].children[0].fields.length,initial.pages[1].children[0].fields.length+1);
 assert.ok(!fs.existsSync(env.GAC_SUPPORT_CONFIG),'全流程不需要日志或Figma账号配置');
 console.log('PASS draft release: independent prototype, pending gate, revision preservation, diff, explicit test confirmation, export and restore without Figma');
}finally{fs.rmSync(root,{recursive:true,force:true});}
