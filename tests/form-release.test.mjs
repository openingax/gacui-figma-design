import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {portablePlan,outputCode,assetCode,assetFor} from '../scripts/figma/portable.mjs';
import {loadVersions,renderHtml} from '../sketch/sketch.mjs';
import {packJson,unpackJson,packJsonValues,unpackJsonValues} from '../scripts/lib/pack-json.mjs';
import {compactFigmaCode} from '../scripts/lib/compact-figma-code.mjs';
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,root=fs.mkdtempSync(path.join(os.tmpdir(),'form-release-'));
try{
 let total=0,max=0;
 for(const fixture of ['form-release','form-fields-release']){
  const dir=path.join(root,fixture);fs.mkdirSync(dir);fs.copyFileSync('tests/fixtures/'+fixture+'.json',path.join(dir,'v1.json'));fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({confirmed:1,figmaPage:'合成Form验证',validationOnly:true,versions:[{v:1}]}));
  const p=portablePlan(dir,'A'.repeat(22));assert.equal(p.complete,true,JSON.stringify(p.skippedBoards));assert.ok(p.assets.length>0);const index=JSON.parse(fs.readFileSync('scripts/figma/portable-index.json'));const variantId=Object.keys(index).find(id=>index[id].type==='COMPONENT'&&index[id].path==='components/switch/build-data.json');assert.equal(assetFor(variantId).variantSet,true);
  const receipts=p.assets.map((a,i)=>({fileKey:p.fileKey,pageId:'950:1',key:a.key,hash:a.hash,type:a.type,nodeCount:a.nodeCount??100,status:'created',rootId:`950:${i*20+2}`,wrapperId:`950:${i*20+3}`,...(a.roles?{map:Object.fromEntries(a.roles.map((r,j)=>[r,`950:${i*20+4+j}`]))}:{})}));
  for(const id of p.boardIds){const js=outputCode(dir,p,receipts,id);assert.ok(js.length<=50000);new AsyncFunction('figma',js);let writes=0;await assert.rejects(()=>new AsyncFunction('figma',js)({fileKey:'wrong',createFrame(){writes++;}}),/目标|授权/);assert.equal(writes,0);max=Math.max(max,js.length);total++;}
  new Function(renderHtml(loadVersions(dir)).match(/<script>([\s\S]*)<\/script>/)[1]);
 }
 const sample={文字:'中文',array:[true,3,'~0','同一文字','同一文字'],meta:{sourceId:'1:2'}};for(const [pack,decode] of [[packJson,unpackJson],[packJsonValues,unpackJsonValues]])assert.deepEqual(await new AsyncFunction(decode.toString()+';return '+decode.name+'('+JSON.stringify(pack(sample))+');')(),sample);
 const snippet="const trace=[];async function go(n){trace.push(n);await Promise.resolve();return {文字:'中文',value:n+1};}try{return {result:await go(3),trace};}catch(e){return {error:String(e)}}";
 assert.deepEqual(await new AsyncFunction(snippet)(),await new AsyncFunction(compactFigmaCode(snippet))());
 for(const f of ['components/upload/workbench.mjs','components/upload/candidate.mjs','components/datepicker/workbench.mjs'])assert.ok(!fs.existsSync(f),'越界发行 '+f);
 console.log(`PASS Form release: ${total} boards, portable dependencies, generated execution guards, preview and minifier behavior; max=${max}`);
}finally{fs.rmSync(root,{recursive:true,force:true});}
