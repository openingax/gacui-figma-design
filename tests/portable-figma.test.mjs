import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {portablePlan,assetCode,outputCode,mapping,checkCode,targetKey,pack,unpack} from '../scripts/figma/portable.mjs';
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
const privateTarget=['j78vn5kr','Y3zAbruiu5BX16'].join('');
assert.ok(!output.includes("getNodeByIdAsync('180:3')"));assert.ok(!output.includes(privateTarget));assert.ok(output.includes('900:'));assert.deepEqual(files(),before);
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
// Regression 2026-10-26: a confirmed v5 with one Drawer page blocked the whole blank-file plan
// ("尚无可移植构建数据：203:17"). The Drawer library is now a composite asset built in the target file.
const mixedDir=fs.mkdtempSync(path.join(os.tmpdir(),'gac-portable-drawer-'));
process.env.GAC_SUPPORT_HOME=path.join(mixedDir,'support');process.env.GAC_SUPPORT_CONFIG=path.join(mixedDir,'support-config.json');
const mixed=JSON.parse(fs.readFileSync(new URL('./fixtures/portable-metrics-drawer.json',import.meta.url)));
mixed.states.push({id:'detail-long',page:'metricDetail',title:'长定义',codes:[],patch:{'metricDetail/detailForm/definition':{value:'演示：较长的指标定义文字，用于检查抽屉内换行。'}}});
const mixedDraft=path.join(mixedDir,'draft');fs.mkdirSync(mixedDraft);
const saveDraft=(d,page)=>{fs.writeFileSync(path.join(mixedDraft,'v5.json'),JSON.stringify(d));fs.writeFileSync(path.join(mixedDraft,'versions.json'),JSON.stringify({storeVersion:1,versions:[{v:5,hash:digest(d)}],draftConfirmed:5,draftConfirmation:{v:5,hash:digest(d)},confirmed:5,figmaPage:page}));};
saveDraft(mixed,'含抽屉验证');
const mixedFiles=()=>Object.fromEntries(fs.readdirSync(mixedDraft).map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(mixedDraft,f))).digest('hex')]));const mixedBefore=mixedFiles();
const mp=portablePlan(mixedDraft,target);
assert.deepEqual(mp.boardIds,['metrics','metricDetail','empty','error','detail-long']);assert.equal(mp.complete,true);assert.equal(mp.notice,null);
const composite=mp.assets.at(-1);
assert.equal(composite.key,'drawer/library');assert.equal(composite.kind,'drawer-library');assert.equal(composite.nodeCount,null);assert.ok(mp.assets.slice(0,-1).every(a=>!a.kind),'组合资产排在依赖之后');
assert.equal(mp.aliases['203:17'],'drawer/library#footerIds.left');assert.equal(mp.aliases['203:2'],'drawer/library#closeIds.normal');
for(const button of ['107:86','107:95'])assert.ok(mp.aliases[button]?.startsWith('button/'),'Drawer依赖的Button须先初始化：'+button);
assert.ok(!mp.aliases['107:93']&&!mp.aliases['107:97'],'空白文件不建立无法表达的悬停目标');
assert.ok(!JSON.stringify(mp).includes('buttonReactions'));
// Form fields take one concrete variant instead of a whole component set.
assert.ok(!Object.values(mp.assets).some(a=>a.type==='COMPONENT_SET'&&!a.kind));
assert.ok(mp.aliases['56:17']&&mp.aliases['72:39'],'只读输入框与选择器使用具体变体');
assert.ok(Object.values(mp.styles).length&&mp.styles['Gray 中性/Gray8-正文'],'Drawer颜色样式随初始化创建');
const compositeCode=assetCode(mp,'10:1',mp.assets.length-1);assert.ok(compositeCode.length<50000);new AsyncFunction(compositeCode);
assert.ok(compositeCode.includes('async function buildLibrary')&&!compositeCode.includes(privateTarget),'组合资产不依赖旧目标');
assert.ok(compositeCode.includes('reactions:false'),'空白文件不设置Button悬停原型');assert.ok(!Object.keys(mp.styles).some(n=>/^(Headline|Title|Body)\//.test(n)),'文字样式不能当颜色样式创建');
for(let i=0;i<mp.assets.length;i++)new AsyncFunction(assetCode(mp,'10:1',i));
const roleIds=Object.fromEntries(composite.roles.map((r,i)=>[r,'920:'+i]));
const mixedReceipts=mp.assets.map((a,i)=>({...a,fileKey:target,status:'created',pageId:'10:1',rootId:'910:'+i,wrapperId:'911:'+i,...(a.kind?{nodeCount:57,map:roleIds}:{})}));
for(const b of mp.boardIds)new AsyncFunction(outputCode(mixedDraft,mp,mixedReceipts,b));
const drawerOut=outputCode(mixedDraft,mp,mixedReceipts,'metricDetail');assert.ok(drawerOut.includes('"920:')&&!/"203:(17|25|36|52|68)"/.test(drawerOut),'抽屉引用映射到本文件组合资产');
assert.ok(checkCode(mp,mixedReceipts).includes('920:'));new AsyncFunction(checkCode(mp,mixedReceipts));
const missingRole=mixedReceipts.map(r=>r.kind?{...r,map:{...r.map,'footerIds.left':undefined}}:r);assert.throws(()=>mapping(mp,missingRole),/回执.*footerIds\.left/);
assert.throws(()=>mapping(mp,mixedReceipts.map(r=>r.kind?{...r,nodeCount:0}:r)),/回执/);
assert.throws(()=>outputCode(mixedDraft,mp,mixedReceipts,'nope'),/没有画板/);
// An unsupported icon Link skips only its boards; upload fields are now portable.
const withUpload=structuredClone(mixed);withUpload.pages[1].children[0].fields.push({id:'attachments',label:'附件',kind:'upload',from:'演示',help:'演示：上传说明附件。'});
withUpload.pages[1].children.push({id:'iconLink',type:'link',text:'演示链接',prefix:true,from:'演示'});
for(const code of ['U1','U2','U3','U4','U5'])withUpload.decisions.push({code,text:'演示：上传规则按推荐处理。',decision:'按推荐',from:'推荐'});
saveDraft(withUpload,'含抽屉降级验证');
const up=portablePlan(mixedDraft,target);
assert.deepEqual(up.boardIds,['metrics','empty','error']);assert.equal(up.complete,false);
assert.deepEqual(up.skippedBoards.map(s=>[s.boardId,s.dependsOn]),[['metricDetail',null],['detail-long','统计指标说明 · v5']]);
assert.ok(!Object.keys(up.aliases).some(id=>id.startsWith('203:')),'跳过的画板不得带入组件初始化');assert.ok(!up.assets.some(a=>a.kind));
assert.match(up.notice,/已规划 3\/5 个画板，其余画板可继续出稿/);assert.match(up.notice,/1 个状态画板也一并暂缓/);assert.ok(!up.notice.includes('尚无可移植构建数据'),'用户提示不暴露内部编译符号');
const upReceipts=up.assets.map((a,i)=>({...a,fileKey:target,status:'created',pageId:'10:1',rootId:'930:'+i,wrapperId:'931:'+i}));
assert.throws(()=>outputCode(mixedDraft,up,upReceipts,'metricDetail'),/未纳入空白文件出稿/);
// CLI: partial plan exits 0, keeps stdout pure JSON, explains on stderr and logs the gap as non-blocking.
const {spawnSync}=await import('node:child_process');const client=await import('../support/client.mjs');
client.setAutoUpload(true,{collection:'tuning',authorization:'project-meeting-20261020'});
const run=spawnSync(process.execPath,['scripts/figma/portable.mjs','plan',mixedDraft,target],{encoding:'utf8',env:process.env});
assert.equal(run.status,0,run.stderr);assert.deepEqual(JSON.parse(run.stdout).boardIds,up.boardIds);assert.match(run.stderr,/提示：已规划 3\/5/);
const logged=client.events().map(e=>e.details.payload).find(x=>x.stage==='preflight');
assert.equal(logged.status,'completed');assert.match(logged.reason,/部分画板暂不生成/);assert.deepEqual(logged.receipt.skippedBoards.map(s=>s.boardId),['metricDetail','detail-long']);
// Only a draft with nothing to generate is still reported as blocked.
const onlyDrawer=structuredClone(withUpload);onlyDrawer.pages=onlyDrawer.pages.filter(pg=>pg.frame==='drawer').map(pg=>({...pg,over:undefined}));onlyDrawer.states=[];onlyDrawer.questions=onlyDrawer.questions.filter(q=>q.node.startsWith('metricDetail'));
saveDraft(onlyDrawer,'仅抽屉');
const empty=portablePlan(mixedDraft,target);
assert.deepEqual(empty.boardIds,[]);assert.match(empty.notice,/本次没有可在空白文件生成的画板/);assert.ok(!empty.notice.includes('其余画板可继续'));
const none=spawnSync(process.execPath,['scripts/figma/portable.mjs','plan',mixedDraft,target],{encoding:'utf8',env:process.env});assert.equal(none.status,1);
assert.equal(client.events().map(e=>e.details.payload).filter(x=>x.stage==='preflight').at(-1).status,'blocked');
saveDraft(mixed,'含抽屉验证');
assert.deepEqual(mixedFiles(),mixedBefore,'规划不修改草稿');
fs.rmSync(mixedDir,{recursive:true});
// Composite runtime guards: wrong file, an interrupted build and a missing dependency never create nodes.
{const {initializeDrawerLibrary}=await import('../scripts/figma/portable-composite.mjs');
 const asset={key:'drawer/library',hash:'h1',deps:[{source:'22709:33461',key:'button/x',hash:'b1'}],data:{close:{children:[]}}};
 const pageNode={type:'PAGE',children:[]},api={fileKey:target,getNodeByIdAsync:async()=>pageNode,setCurrentPageAsync:async()=>{},createFrame:()=>{throw Error('不应创建');},listAvailableFontsAsync:async()=>[]};
 await assert.rejects(()=>initializeDrawerLibrary({...api,fileKey:'OtherTargetForTesting123'},{fileKey:target,pageId:'10:1',asset},null),/目标/);
 pageNode.children=[{name:'GACUI / drawer/library / h1 / building',children:[]}];
 await assert.rejects(()=>initializeDrawerLibrary(api,{fileKey:target,pageId:'10:1',asset},null),/未完成/);
 pageNode.children=[];await assert.rejects(()=>initializeDrawerLibrary(api,{fileKey:target,pageId:'10:1',asset},null),/依赖组件未初始化：button\/x/);}
fs.rmSync(dir,{recursive:true});console.log('PASS portable Figma: confirmed-version preservation, on-demand assets, exact packing, target isolation, receipt guards, safe reuse, interrupted initialization, generated syntax, Drawer composite library, single-variant form fields, per-board degradation of unsupported families');
