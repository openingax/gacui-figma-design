import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
import {buttonAssets,buttonAssetCode,buttonTargetCatalog} from '../components/button/portable.mjs';
import {prepareButton,prepareButtonForTarget} from '../components/button/business-data.mjs';
import {portablePlan,outputCode} from '../scripts/figma/portable.mjs';
import {loadVersions,renderHtml} from '../sketch/sketch.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'button-release-')),fileKey='A'.repeat(22),pageId='900:1';
try{
 fs.copyFileSync('tests/fixtures/button-release.json',path.join(dir,'v1.json'));fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({confirmed:1,figmaPage:'Button公开包合成验证',validationOnly:true,versions:[{v:1,label:'合成'}]}));
 const p=portablePlan(dir,fileKey);assert.equal(p.complete,true,JSON.stringify(p.skippedBoards));assert.equal(p.boardIds.length,23);
 const assets=buttonAssets(),receipts=assets.map((a,i)=>({...a,fileKey,pageId,rootId:`900:${i*2+2}`,wrapperId:`900:${i*2+3}`,status:'created'})),paintMap=Object.fromEntries(Object.keys(p.styles).map((n,i)=>[n,'S:test-'+i])),catalog=buttonTargetCatalog(fileKey,pageId,receipts,paintMap);
 assert.equal(assets.length,39);let writes=0;for(const a of assets){const js=buttonAssetCode(fileKey,pageId,a.key,receipts,paintMap);assert.ok(js.length<=48000);const fn=new Function('return async function(figma){'+js+'}')();await assert.rejects(()=>fn({fileKey:'wrong',createFrame(){writes++;}}),/目标/);}assert.equal(writes,0);
 for(const patch of [{hash:'wrong'},{fileKey:'wrong'},{pageId:'1:1'},{wrapperId:'bad'},{nodeCount:0}])assert.throws(()=>buttonTargetCatalog(fileKey,pageId,[{...receipts[0],...patch},...receipts.slice(1)],paintMap));
 const rs=p.assets.map((a,i)=>({fileKey,pageId,key:a.key,hash:a.hash,type:a.type,nodeCount:a.nodeCount??100,status:'created',rootId:`950:${i*20+2}`,wrapperId:`950:${i*20+3}`,...(a.roles?{map:Object.fromEntries(a.roles.map((r,j)=>[r,`950:${i*20+4+j}`]))}:{})}));
 let max=0;for(const id of p.boardIds){const js=outputCode(dir,p,rs,id);max=Math.max(max,js.length);assert.ok(js.length<=50000);assert.ok(!js.includes('PORTABLE_BUTTON_RECEIPTS_REQUIRED'));const fn=new Function('return async function(figma){'+js+'}')();await assert.rejects(()=>fn({fileKey:'wrong'}),/目标/);}
 const v=JSON.parse(fs.readFileSync('tests/fixtures/button-release.json'));for(const page of v.pages)for(const action of page.children.filter(n=>n.type==='actions'))for(const b of action.buttons){const r=prepareButtonForTarget(b,catalog);assert.ok(r.mainId.startsWith('900:'));assert.deepEqual(r.spec,prepareButton(b).spec);}
 const html=renderHtml(loadVersions(dir));new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);
 for(const f of ['components/form/workbench-roundtrip.mjs','components/upload/workbench.mjs','components/datepicker/workbench.mjs','components/button/native-candidate.mjs'])assert.ok(!fs.existsSync(f),'越界导出 '+f);
 console.log(`PASS Button release: 39 assets, 23 formal plans/code, generated execution rejection, receipt guards and preview; maxLength=${max}`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
