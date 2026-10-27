import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {digest} from '../sketch/store.mjs';import {portablePlan,assetCode,outputCode} from '../scripts/figma/portable.mjs';
import {portableLinkDependencies} from '../components/link/portable.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'portable-upload-'));
try{
 const draft=JSON.parse(fs.readFileSync(new URL('./fixtures/portable-upload-drawer.json',import.meta.url)));
 const save=()=>{fs.writeFileSync(path.join(dir,'v1.json'),JSON.stringify(draft));fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({storeVersion:1,versions:[{v:1,hash:digest(draft)}],draftConfirmed:1,draftConfirmation:{v:1,hash:digest(draft)},confirmed:1,figmaPage:'抽屉回归'}));};save();
 const p=portablePlan(dir,'UploadDrawerPortableTesting');assert.deepEqual(p.skippedBoards,[]);assert.equal(p.boardIds.length,6);
 const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
 for(let i=0;i<p.assets.length;i++)new AsyncFunction(assetCode(p,'10:1',i));
 const receipts=p.assets.map((a,i)=>({...a,status:'created',fileKey:p.fileKey,pageId:'10:1',rootId:'900:'+i,wrapperId:'901:'+i,...(a.kind?{nodeCount:57,map:Object.fromEntries(a.roles.map((r,j)=>[r,'920:'+j]))}:{})}));
 for(const b of p.boardIds)new AsyncFunction(outputCode(dir,p,receipts,b));
 assert.ok(p.assets.some(a=>a.key.startsWith('upload/form-portable')));assert.ok(p.assets.some(a=>a.key.startsWith('link/text-portable')));
 assert.ok(!['521:2','525:130','523:3','524:2'].some(id=>p.aliases[id]));
 assert.throws(()=>portableLinkDependencies([{id:'x',text:'test',prefix:true}]),/图标槽位/);
 // Existing field states remain expressible when the upload subtree is initialized locally.
 const page=draft.pages.find(p=>p.frame==='drawer');
 for(const [id,patch] of Object.entries({success:{value:['演示.txt']},failure:{value:['演示.txt'],fileStates:{'演示.txt':'fail'},error:'请重试'},disabled:{disabled:true,value:['演示.txt']},disabledFailure:{disabled:true,value:['演示.txt'],fileStates:{'演示.txt':'fail'},error:'请重试'}}))draft.states.push({id,page:page.id,title:id,codes:[],patch:{[page.id+'/form/file']:patch}});
 save();const states=portablePlan(dir,p.fileKey);assert.deepEqual(states.skippedBoards,[]);
 console.log('PASS portable drawer: 6 complete boards, source upload fields, text link, conditionals and upload states');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
