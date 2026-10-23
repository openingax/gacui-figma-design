import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {portablePlan,assetCode,outputCode,mapping,targetKey,pack,unpack} from '../scripts/figma/portable.mjs';
import {initializeAsset} from '../scripts/figma/portable-runtime.mjs';
import {digest} from '../sketch/store.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gac-portable-'));
const draft=JSON.parse(fs.readFileSync(new URL('./fixtures/portable-metrics.json',import.meta.url)));
// A newer unconfirmed draft must not replace the already-confirmed v5.
fs.writeFileSync(path.join(dir,'v5.json'),JSON.stringify(draft));
fs.writeFileSync(path.join(dir,'v6.json'),JSON.stringify({...draft,task:'尚未确认的后续需求'}));
fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({storeVersion:1,versions:[{v:5,hash:digest(draft)},{v:6,hash:digest({...draft,task:'尚未确认的后续需求'})}],draftConfirmed:5,draftConfirmation:{v:5,hash:digest(draft)},confirmed:5,figmaPage:'新文件验证'}));
const files=()=>Object.fromEntries(fs.readdirSync(dir).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(dir,f))).digest('hex')]));const before=files();
const target='PortableTargetForTesting12',p=portablePlan(dir,target);
assert.equal(p.version,5);assert.ok(p.assets.length<20);assert.ok(!p.assets.some(a=>/checkbox|header-menu|charging-sidebar/.test(a.key)));
const AsyncFunction=Object.getPrototypeOf(async()=>{}).constructor;
for(let i=0;i<p.assets.length;i++){const c=assetCode(p,'10:1',i);assert.ok(c.length<50000);new AsyncFunction(c);}
const receipts=p.assets.map((a,i)=>({...a,fileKey:target,status:'created',pageId:'10:1',rootId:'900:'+i,wrapperId:'901:'+i}));
const output=outputCode(dir,p,receipts,'metrics');new AsyncFunction(output);
assert.ok(!output.includes("getNodeByIdAsync('180:3')"));assert.ok(output.includes('900:'));assert.deepEqual(files(),before);
assert.throws(()=>mapping(p,receipts.slice(1)),/回执/);assert.throws(()=>mapping(p,[...receipts,receipts[0]]),/回执/);
assert.throws(()=>mapping(p,receipts.map(r=>({...r,fileKey:'OtherTargetForTesting123'}))),/回执/);
assert.throws(()=>targetKey('https://example.com/design/'+target),/Figma/);assert.throws(()=>targetKey('jNf9icrxfw8B7QkSQa9g33'),/只读/);
assert.deepEqual(unpack(pack({data:p,'~0':'~1',text:'107:86 中文 \\"'})),{data:p,'~0':'~1',text:'107:86 中文 \\"'});
// Business strings that look like historical IDs are preserved, not remapped.
const changed=structuredClone(draft);changed.pages[0].children.find(n=>n.type==='table').data[0].name='107:86';
fs.writeFileSync(path.join(dir,'v5.json'),JSON.stringify(changed));const meta=JSON.parse(fs.readFileSync(path.join(dir,'versions.json')));meta.versions[0].hash=digest(changed);meta.draftConfirmation.hash=digest(changed);fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify(meta));
assert.throws(()=>outputCode(dir,p,receipts,'metrics'),/变化/);
const next=portablePlan(dir,target),out=outputCode(dir,next,receipts,'metrics');assert.ok(out.includes('"name":"107:86"'));
// Disabled action is resolved to a locally built variant rather than a sibling in the old file.
changed.pages[0].children.find(n=>n.type==='actions').buttons[0].disabled=true;
fs.writeFileSync(path.join(dir,'v5.json'),JSON.stringify(changed));meta.versions[0].hash=digest(changed);meta.draftConfirmation.hash=digest(changed);fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify(meta));
const disabledPlan=portablePlan(dir,target);assert.ok(disabledPlan.assets.length>p.assets.length);for(let i=0;i<disabledPlan.assets.length;i++)new AsyncFunction(assetCode(disabledPlan,'10:1',i));
// Safe reuse and interruption handling must not create a second component.
const asset={key:'button/example',hash:'abc',type:'COMPONENT',nodeCount:2},child={type:'COMPONENT',id:'12:1'},wrapper={name:'GACUI / button/example / abc',children:[child],id:'12:0',findAll:()=>[child,{type:'TEXT'}]},page={type:'PAGE',children:[wrapper]};
const api={fileKey:target,getNodeByIdAsync:async()=>page,setCurrentPageAsync:async()=>{},createFrame:()=>{throw Error('不应创建');}};
assert.equal((await initializeAsset(api,{fileKey:target,pageId:'10:1',asset})).status,'reused');
wrapper.name+=' / building';await assert.rejects(()=>initializeAsset(api,{fileKey:target,pageId:'10:1',asset}),/未完成/);
await assert.rejects(()=>initializeAsset(api,{fileKey:'OtherTargetForTesting123',pageId:'10:1',asset}),/目标/);
fs.rmSync(dir,{recursive:true});console.log('PASS portable Figma: confirmed-version preservation, on-demand assets, exact packing, target isolation, receipt guards, safe reuse, interrupted initialization, generated syntax');
