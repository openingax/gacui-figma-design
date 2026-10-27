import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {portablePlan,assetCode,outputCode} from '../scripts/figma/portable.mjs';
import {digest} from '../sketch/store.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gac-dialog-portable-'));
try {
 const draft=JSON.parse(fs.readFileSync(new URL('./fixtures/portable-metrics.json',import.meta.url)));
 draft.states=[];
 const page=draft.pages[0];
 page.children.push({id:'confirm',type:'dialog',title:'确认操作',message:'确认更新当前记录？',confirm:'确定',cancel:'取消',visible:false,from:'演示'});
 for(const theme of ['default','info','warning','error','success'])for(const closable of [false,true])for(const divider of [false,true])draft.states.push({id:`${theme}-${closable}-${divider}`,page:page.id,title:'确认状态',codes:[],patch:{[`${page.id}/confirm`]:{visible:true,theme,closable,divider}}});
 for(const divider of [false,true])draft.states.push({id:`fullscreen-${divider}`,page:page.id,title:'全屏确认',codes:[],patch:{[`${page.id}/confirm`]:{visible:true,theme:'info',closable:true,fullscreen:true,divider}}});
 for(const closeState of ['hover','active'])draft.states.push({id:closeState,page:page.id,title:'关闭状态',codes:[],patch:{[`${page.id}/confirm`]:{visible:true,theme:'info',closable:true,closeState}}});
 fs.writeFileSync(path.join(dir,'v1.json'),JSON.stringify(draft));
 fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({storeVersion:1,versions:[{v:1,hash:digest(draft)}],draftConfirmed:1,draftConfirmation:{v:1,hash:digest(draft)},confirmed:1,figmaPage:'Dialog迁移回归'}));
 const before=fs.readFileSync(path.join(dir,'versions.json'),'utf8');
 const p=portablePlan(dir,'PortableDialogTestingTarget');
 assert.deepEqual(p.skippedBoards,[]);assert.equal(p.boardIds.length,25);
 assert.ok(!p.aliases['415:2'],'历史Page不是组件资产');
 assert.ok(p.aliases['415:9'],'基础变体必须有规范构建数据');
 assert.equal(p.assets.filter(a=>a.key.startsWith('dialog/')).length,25,'20普通、2全屏、3关闭');
 const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
 for(let i=0;i<p.assets.length;i++)new AsyncFunction(assetCode(p,'10:1',i));
 const receipts=p.assets.map((a,i)=>({...a,fileKey:p.fileKey,status:'created',pageId:'10:1',rootId:'900:'+i,wrapperId:'901:'+i}));
 for(const board of p.boardIds){const c=outputCode(dir,p,receipts,board);new AsyncFunction(c);assert.ok(!c.includes('415:2'));assert.ok(!c.includes('415:9'));assert.ok(!c.includes('importComponentByKeyAsync'));}
 assert.throws(()=>outputCode(dir,p,receipts.slice(1),p.boardIds[1]),/回执/);
 assert.equal(fs.readFileSync(path.join(dir,'versions.json'),'utf8'),before);
 // Isolate the reported info/closable case: no default, fullscreen or unused close-state assets.
 draft.states=draft.states.filter(s=>s.id==='info-true-false');
 fs.writeFileSync(path.join(dir,'v1.json'),JSON.stringify(draft));
 const meta=JSON.parse(before);meta.versions[0].hash=digest(draft);meta.draftConfirmation.hash=digest(draft);fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify(meta));
 const one=portablePlan(dir,p.fileKey);assert.deepEqual(one.skippedBoards,[]);
 assert.deepEqual(Object.keys(one.aliases).filter(id=>id.startsWith('731:')).sort(),['731:20700','731:34']);assert.ok(!one.aliases['415:9']);
 console.log('portable Dialog: 20 ordinary + 2 fullscreen + 3 close assets; 25 boards passed');
} finally {fs.rmSync(dir,{recursive:true,force:true});}
