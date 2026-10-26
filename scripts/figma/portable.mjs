#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {code,plan} from '../../sketch/figma.mjs';
import {buildNodes,restoreTransform,applyFinalStrokes} from '../lib/figma-build.mjs';
import {initializeAsset} from './portable-runtime.mjs';
import {composites,compositeRole,compositeAsset,initializeDrawerLibrary} from './portable-composite.mjs';
import {buildLibrary} from '../../components/drawer/generator.mjs';
import {logFigma} from '../../support/figma-log.mjs';
import {isMain} from '../../support/entry.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const index=()=>read('scripts/figma/portable-index.json');
export function targetKey(input){let key=input;if(/^https?:/.test(input)){const u=new URL(input);if(!['figma.com','www.figma.com'].includes(u.hostname))throw Error('不是Figma链接');key=u.pathname.match(/^\/(?:design|file)\/([a-zA-Z0-9]+)/)?.[1];}if(!/^[a-zA-Z0-9]{22,128}$/.test(key??'')||key==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标无效或规范源只读');return key;}
function checkboxData(ref){
 const d=read(ref.path),v=d.variants.find(v=>v.name===ref.variant),sourceId='checkbox/'+v.name;
 const nodes=[{sourceId,parentSourceId:null,type:'COMPONENT',name:v.name,props:{x:0,y:0,width:v.width,height:v.height,layoutMode:'NONE',fills:[],strokes:[],clipsContent:false}}],vectors={};
 for(const [i,l] of v.layers.entries()){const id=sourceId+'/'+i,props={...l,fills:l.fills.paints,strokes:l.strokes.paints,width:l.width??16,height:l.height??16};delete props.geometry;delete props.type;delete props.name;nodes.push({sourceId:id,parentSourceId:sourceId,type:l.type,name:l.name,props,fillStyleName:l.fills.style,strokeStyleName:l.strokes.style});if(l.geometry)vectors[id]=d.geometries[l.geometry].vectorNetwork;}
 return {sourceId,data:{nodes,vectors,styles:d.styles}};
}
export function assetFor(id){
 const ref=index()[id];if(!ref)throw Error('尚无可移植构建数据：'+id);
 let sourceId=ref.sourceId,data;
 if(ref.variant)({sourceId,data}=checkboxData(ref));
 else{const all=read(ref.path),ids=new Set([sourceId]);let changed=true;while(changed){changed=false;for(const n of all.nodes)if(ids.has(n.parentSourceId)&&!ids.has(n.sourceId)){ids.add(n.sourceId);changed=true;}}
 const nodes=all.nodes.filter(n=>ids.has(n.sourceId));const styles=new Set(nodes.flatMap(n=>[n.fillStyleName,n.strokeStyleName]).filter(Boolean));
 data={nodes,vectors:Object.fromEntries(Object.entries(all.vectors??{}).filter(([id])=>ids.has(id))),styles:Object.fromEntries(Object.entries(all.styles??{}).filter(([name])=>styles.has(name)))};
 }
 if(ref.type==='COMPONENT_SET')throw Error('本次依赖需要组件集适配：'+ref.path+' / '+sourceId);
 if(data.nodes.some(n=>(n.props.fills??[]).some(p=>p.type==='IMAGE')))throw Error('组件位图资产尚未适配：'+ref.path+' / '+sourceId);
 const key=ref.path.replace(/^components\//,'').replace(/\/build-data.json$/,'')+'/'+sourceId;
 return {key,hash:hash(data),sourceId,type:ref.type,nodeCount:data.nodes.length,button:ref.path==='components/button/build-data.json'&&ref.type==='COMPONENT',data};
}
// A composite's hash covers its dependencies, so a changed Button rebuilds the Drawer library too.
function compositeFor(family){
 const base=compositeAsset(family),deps=base.deps.map(d=>{const a=assetFor(d.ref);return {...d,key:a.key,hash:a.hash};});
 return {...base,deps,hash:hash({base:base.hash,deps:deps.map(d=>d.hash)})};
}
function resolveRef(fileKey,id){
 const role=compositeRole(id);
 if(role){const asset=compositeFor(role.family);compositeSource(fileKey,'0:1',asset);return {asset,alias:asset.key+'#'+role.role,deps:asset.deps.map(d=>d.ref)};}
 const asset=assetFor(id);assetSource(fileKey,'0:1',asset);return {asset,alias:asset.key,deps:[]};
}
// Known component families that the blank-file path cannot build yet. Used only to explain a gap.
const gaps=()=>{try{return read('scripts/figma/portable-gaps.json');}catch{return {};}};
function explain(id,error){
 const found=id&&Object.entries(gaps()).find(([,g])=>g.ids.includes(id));
 if(found)return {ref:id,family:found[0],label:found[1].label,reason:found[1].reason,suggestion:found[1].suggestion};
 const missing=/^尚无可移植构建数据/.test(error.message),component=error.message.match(/components\/(.+?)\/build-data\.json/)?.[1]??error.message.match(/需拆分构建：([^/\s]+)\//)?.[1]??null;
 // A generator-level limit has no single reference; its own sentence is shown as is.
 return {ref:id,family:component,label:component&&component+' 组件',limit:!id&&!component?error.message:null,reason:missing?'组件引用 '+id+' 暂无空白文件构建数据':error.message,suggestion:null};
}
function summarize(problems){
 const unique=k=>[...new Set(problems.map(x=>x[k]).filter(Boolean))],labels=unique('label'),others=new Set(problems.filter(x=>!x.label&&!x.limit).map(x=>x.ref)).size;
 const parts=[];
 if(labels.length||others)parts.push([labels.join('、'),others?(labels.length?'另外 ':'')+others+' 项组件依赖':''].filter(Boolean).join('及')+'暂未支持空白文件初始化');
 parts.push(...unique('limit'));
 return parts.join('；');
}
// One unsupported component skips only the boards that use it (and boards drawn on top of them);
// whole-draft errors such as an unconfirmed version still stop planning.
function boardSupport(dir,fileKey,p){
 const included=[],skippedBoards=[],resolved=new Map(),skippedNames=new Set();
 for(const b of p.boards){
  const problems=[],refs=new Set(),dependsOn=[b.def?.over,b.def?.base].find(n=>n&&skippedNames.has(n))??null;
  if(!dependsOn){
   try{code(dir,b.id,{portable:true,fileKey,resolveReference:id=>{refs.add(id);return id;}});}catch(e){problems.push(explain(null,e));}
   // Composite dependencies (Drawer's Buttons) join the board's references before planning assets.
   const queue=[...refs].sort(),seen=new Set();
   while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);try{const r=resolved.get(id)??resolveRef(fileKey,id);resolved.set(id,r);queue.push(...r.deps.filter(d=>!seen.has(d)));}catch(e){problems.push(explain(id,e));}}
   if(!problems.length){included.push({board:b,refs:seen});continue;}
  }
  skippedNames.add(b.name);
  const unique=k=>[...new Set(problems.map(x=>x[k]).filter(Boolean))];
  // summary is for the product user; reason/refs stay for maintainers and logs.
  skippedBoards.push(dependsOn?{boardId:b.id,name:b.name,dependsOn,summary:'依赖的底图画板「'+dependsOn+'」本次未生成',reason:'依赖的底图画板「'+dependsOn+'」本次未生成',suggestion:null,families:[],refs:[]}
   :{boardId:b.id,name:b.name,dependsOn:null,summary:summarize(problems),reason:unique('reason').join('；'),suggestion:unique('suggestion')[0]??null,families:unique('family'),refs:unique('ref')});
 }
 return {included,skippedBoards,resolved};
}
export function planNotice(p){
 if(!p.skippedBoards.length)return null;
 const total=p.boardIds.length+p.skippedBoards.length,roots=p.skippedBoards.filter(s=>!s.dependsOn);
 const lines=roots.map(s=>{const followers=p.skippedBoards.filter(x=>x.dependsOn===s.name).length;return '「'+s.name+'」暂不生成：'+s.summary+'。'+(followers?'基于它的 '+followers+' 个状态画板也一并暂缓。':'');});
 const advice=[...new Set(roots.map(s=>s.suggestion).filter(Boolean))];
 return (p.boardIds.length?'已规划 '+p.boardIds.length+'/'+total+' 个画板，其余画板可继续出稿。':'本次没有可在空白文件生成的画板。')+lines.join('')+[...advice,'缺口已记录，供维护者补齐；草稿内容保持不变。'].join('')
}
export function portablePlan(dir,target){
 const fileKey=targetKey(target),p=plan(dir),{included,skippedBoards,resolved}=boardSupport(dir,fileKey,p);
 const refs=new Set(included.flatMap(x=>[...x.refs]));
 const assets=[],aliases={},byKey=new Map();
 // Plain assets first, composites last: a composite finds its dependencies already built.
 const ordered=[...refs].sort().map(id=>[id,resolved.get(id)]).sort(([,a],[,b])=>!!a.asset.kind-!!b.asset.kind);
 for(const [id,r] of ordered){aliases[id]=r.alias;if(!byKey.has(r.asset.key)){byKey.set(r.asset.key,r.asset);assets.push(r.asset);}}
 // Runtime colors are named tokens; include them once, not an arbitrary target's styles.
 const styles=Object.assign({},...assets.map(a=>a.kind?Object.fromEntries(Object.values(a.data.styles).filter(s=>s.type==='PAINT'&&s.paints).map(s=>[s.name,s.paints])):a.data.styles));
 for(const file of ['components/input/build-data.json','components/button/build-data.json','components/select/build-data.json','components/form-help/build-data.json'])Object.assign(styles,read(file).styles);
 const drafts=fs.readFileSync(path.join(dir,'versions.json'),'utf8');
 const result={schema:1,fileKey,version:p.version,pageName:p.pageName,draftHash:hash(drafts),boardIds:included.map(x=>x.board.id),skippedBoards,complete:!skippedBoards.length,aliases,assets:assets.map(a=>({key:a.key,hash:a.hash,type:a.type,nodeCount:a.nodeCount,...(a.kind?{kind:a.kind,roles:a.roles}:{})})),styles};
 result.notice=planNotice(result);
 result.generatorHash=hash(included.map(x=>code(dir,x.board.id,{portable:true,fileKey,resolveReference:id=>id})));result.fingerprint=hash(result);for(let i=0;i<result.assets.length;i++)assetCode(result,'0:1',i);return result;
}
export function setupCode(p){return `if(figma.fileKey!==${JSON.stringify(p.fileKey)}||figma.fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标不符');const styles=${JSON.stringify(p.styles)},existingStyles=await figma.getLocalPaintStylesAsync(),createdStyleIds=[];const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='boundVariables'?undefined:v));for(const [name,paints]of Object.entries(styles)){const found=existingStyles.filter(s=>s.name===name);if(found.length>1||found.length&&JSON.stringify(clean(found[0].paints))!==JSON.stringify(clean(paints)))throw Error('颜色样式冲突 '+name);}for(const [name,paints]of Object.entries(styles))if(!existingStyles.some(s=>s.name===name)){const s=figma.createPaintStyle();s.name=name;s.paints=clean(paints);createdStyleIds.push(s.id);}const name='GACUI · 本文件组件';const matches=figma.root.children.filter(n=>n.name===name);if(matches.length>1)throw Error('组件Page重名');let page=matches[0];const ids=[];if(!page){page=figma.createPage();page.name=name;ids.push(page.id);}return {fileKey:figma.fileKey,pageId:page.id,name:page.name,createdNodeIds:ids,createdStyleIds};`;}
// Lossless string dictionary keeps complex exact geometry below the tool's 50k limit.
export function pack(value){const json=JSON.stringify(value),tokens=json.match(/"(?:[^"\\]|\\.)*"/g)??[],counts=new Map();for(const t of tokens)counts.set(t,(counts.get(t)??0)+1);const pool=[...counts].filter(([t,n])=>(n>1&&t.length>6)||/^"~\d+"$/.test(t)).map(([t])=>t),lookup=new Map(pool.map((t,i)=>[t,JSON.stringify('~'+i)]));return {strings:pool.map(t=>JSON.parse(t)),value:JSON.parse(json.replace(/"(?:[^"\\]|\\.)*"/g,t=>lookup.get(t)??t))};}
export function unpack(p){function expand(v){if(typeof v==='string'&&/^~\d+$/.test(v))return p.strings[Number(v.slice(1))];if(Array.isArray(v))return v.map(expand);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[expand(k),expand(x)]));return v;}return expand(p.value);}
function assetSource(fileKey,pageId,asset){const out=`${buildNodes.toString()}\n${restoreTransform.toString()}\n${applyFinalStrokes.toString()}\n${initializeAsset.toString()}\n${unpack.toString()}\nreturn await initializeAsset(figma,unpack(${JSON.stringify(pack({fileKey,pageId,asset}))}),buildNodes,restoreTransform,applyFinalStrokes);`;if(out.length>50000)throw Error('资产超过单批限制，需拆分构建：'+asset.key+' '+out.length);return out;}
function compositeSource(fileKey,pageId,asset){const {key,hash,deps,data}=asset,out=`${buildLibrary.toString()}\n${initializeDrawerLibrary.toString()}\n${unpack.toString()}\nreturn await initializeDrawerLibrary(figma,unpack(${JSON.stringify(pack({fileKey,pageId,asset:{key,hash,deps:deps.map(({source,key,hash})=>({source,key,hash})),data}}))}),buildLibrary);`;if(out.length>50000)throw Error('资产超过单批限制，需拆分构建：'+key+' '+out.length);return out;}
// Several plain assets in one use_figma call: shared builders once, each asset still initialized and
// receipted by initializeAsset. A failure leaves earlier assets complete; reuse-code then resumes.
export function batchCode(p,pageId,indexes){
 if(!indexes.length)throw Error('批次为空');
 const prefix=`${buildNodes.toString()}\n${restoreTransform.toString()}\n${applyFinalStrokes.toString()}\n${initializeAsset.toString()}\n${unpack.toString()}\nconst receipts=[];\n`;
 let body='';
 for(const i of indexes){const row=p.assets[i];if(!row)throw Error('无效资产批次');if(row.kind)throw Error('组合资产须单独执行 asset-code：'+row.key);
  const id=Object.keys(p.aliases).find(id=>p.aliases[id]===row.key),asset=assetFor(id);if(asset.hash!==row.hash)throw Error('构建数据已变化，请重新规划');
  body+=`receipts.push(await initializeAsset(figma,unpack(${JSON.stringify(pack({fileKey:p.fileKey,pageId,asset}))}),buildNodes,restoreTransform,applyFinalStrokes));\n`;}
 const out=prefix+body+'return {receipts};';if(out.length>50000)throw Error('批次超过单次限制，请减少资产数量：'+out.length);return out;
}
// Greedy split of plain asset indexes into batches under the tool limit; composites stay alone.
export function batchPlan(p,pageId,indexes){const batches=[];let cur=[];for(const i of indexes){if(p.assets[i]?.kind){if(cur.length)batches.push(cur);batches.push([i]);cur=[];continue;}const next=[...cur,i];let fits=true;try{batchCode(p,pageId,next);}catch(e){if(!/批次超过/.test(e.message))throw e;fits=false;}if(fits)cur=next;else{if(!cur.length)throw Error('单个资产超过限制：'+p.assets[i].key);batches.push(cur);cur=[i];}}if(cur.length)batches.push(cur);return batches;}
export function assetCode(p,pageId,batch){const row=p.assets[batch];if(!row)throw Error('无效资产批次');
 if(row.kind){const family=Object.keys(composites()).find(f=>composites()[f].key===row.key),asset=family&&compositeFor(family);if(!asset||asset.hash!==row.hash)throw Error('构建数据已变化，请重新规划');return compositeSource(p.fileKey,pageId,asset);}
 const id=Object.keys(p.aliases).find(id=>p.aliases[id]===row.key),asset=assetFor(id);if(asset.hash!==row.hash)throw Error('构建数据已变化，请重新规划');return assetSource(p.fileKey,pageId,asset);}
// Read-only probe: one call returns the same 'reused' receipts initializeAsset would, for plain assets
// already complete in this file, so only missing assets need their (large) initialization batch.
export function reuseCode(p,pageId){if(!nodeId(pageId))throw Error('组件Page无效');const rows=p.assets.map((a,i)=>({i,key:a.key,hash:a.hash,type:a.type,nodeCount:a.nodeCount,composite:!!a.kind}));return `if(figma.fileKey!==${JSON.stringify(p.fileKey)}||figma.fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标不符');const page=await figma.getNodeByIdAsync(${JSON.stringify(pageId)});if(page?.type!=='PAGE')throw Error('组件Page不存在');await figma.setCurrentPageAsync(page);const rows=${JSON.stringify(rows)},receipts=[],missing=[],readback=[];for(const a of rows){const marker='GACUI / '+a.key+' / '+a.hash,found=page.children.filter(n=>n.name===marker||n.name===marker+' / building');if(!found.length){missing.push(a.i);continue;}if(a.composite){missing.push(a.i);continue;}const w=found[0],root=w.children[0];if(found.length!==1||w.name!==marker||root?.type!==a.type||w.findAll(()=>true).length!==a.nodeCount){readback.push(a.key);continue;}receipts.push({status:'reused',fileKey:figma.fileKey,pageId:page.id,key:a.key,hash:a.hash,rootId:root.id,wrapperId:w.id,type:root.type,createdNodeIds:[],nodeCount:a.nodeCount});}return {receipts,missing,readback};`;}
const nodeId=v=>typeof v==='string'&&/^\d+:\d+$/.test(v);
// A composite's node count is only known after building it; its receipt must still name every role.
export function mapping(p,receipts){const result={};for(const a of p.assets){const matches=receipts.filter(r=>r.key===a.key&&r.hash===a.hash&&r.fileKey===p.fileKey&&r.type===a.type&&(a.kind?Number.isInteger(r.nodeCount)&&r.nodeCount>0:r.nodeCount===a.nodeCount)&&['created','reused'].includes(r.status));if(matches.length!==1||!nodeId(matches[0].rootId))throw Error('缺少有效资产回执：'+a.key);result[a.key]=matches[0].rootId;
 for(const role of a.roles??[]){const id=matches[0].map?.[role];if(!nodeId(id))throw Error('缺少有效资产回执：'+a.key+' '+role);result[a.key+'#'+role]=id;}}return result;}
export function outputCode(dir,p,receipts,board){const skipped=p.skippedBoards?.find(s=>s.boardId===board);if(skipped)throw Error('画板「'+skipped.name+'」本次未纳入空白文件出稿：'+skipped.summary+'。'+skipped.suggestion);if(!p.boardIds.includes(board))throw Error('没有画板 '+board+'，可用：'+p.boardIds.join('、'));const current=portablePlan(dir,p.fileKey);if(current.fingerprint!==p.fingerprint)throw Error('草稿或依赖发生变化，请重新规划；保留原确认版本');const m=mapping(p,receipts);const generated=code(dir,board,{portable:true,fileKey:p.fileKey,resolveReference:id=>{const value=m[p.aliases[id]];if(!value)throw Error('缺少目标映射：'+id);return value;}});const guard=checkCode(p,receipts,false);const out=guard+'\n'+generated;if(out.length>50000)throw Error('出稿代码超过工具限制');return out;}
export function checkCode(p,receipts,report=true){mapping(p,receipts);const rows=p.assets.map(a=>{const r=receipts.find(r=>r.key===a.key&&r.hash===a.hash);return {key:a.key,hash:a.hash,type:a.type,nodeCount:a.kind?r.nodeCount:a.nodeCount,rootId:r.rootId,wrapperId:r.wrapperId,pageId:r.pageId,...(a.kind?{roles:r.map}:{})};});// Counting instance sublayers needs the component Page loaded; the first call in a session may not have it.
 return `if(figma.fileKey!==${JSON.stringify(p.fileKey)})throw Error('目标不符');const assets=${JSON.stringify(rows)};for(const id of [...new Set(assets.map(a=>a.pageId))])await figma.setCurrentPageAsync(await figma.getNodeByIdAsync(id));for(const a of assets){const root=await figma.getNodeByIdAsync(a.rootId),wrapper=await figma.getNodeByIdAsync(a.wrapperId);if(!root||root.type!==a.type||root.parent!==wrapper||wrapper.parent?.id!==a.pageId||wrapper.name!=='GACUI / '+a.key+' / '+a.hash||wrapper.findAll(()=>true).length!==a.nodeCount)throw Error('目标组件缺失或映射失效：'+a.key);for(const id of Object.values(a.roles??{})){let n=await figma.getNodeByIdAsync(id);if(n?.type!=='COMPONENT')throw Error('目标组件缺失或映射失效：'+a.key);while(n&&n!==wrapper)n=n.parent;if(!n)throw Error('目标组件缺失或映射失效：'+a.key);}}${report?"return {status:'verified',fileKey:figma.fileKey,verified:assets.map(a=>({key:a.key,rootId:a.rootId}))};":''}`;}
function main([command,dir,target,arg,...rest]){
 if(command==='plan'){const p=portablePlan(dir,target);console.log(JSON.stringify(p,null,2));if(p.notice)console.error('提示：'+p.notice);if(!p.boardIds.length){process.exitCode=1;}return p;}
 const p=JSON.parse(fs.readFileSync(dir,'utf8'));
 if(command==='check-code')process.stdout.write(checkCode(p,JSON.parse(fs.readFileSync(target,'utf8'))));
 else if(command==='setup-code')process.stdout.write(setupCode(p));
 else if(command==='asset-code')process.stdout.write(assetCode(p,target,Number(arg)));
 else if(command==='reuse-code')process.stdout.write(reuseCode(p,target));
 else if(command==='batch-plan')console.log(JSON.stringify(batchPlan(p,target,(arg??'').split(',').filter(Boolean).map(Number))));
 else if(command==='batch-code')process.stdout.write(batchCode(p,target,(arg??'').split(',').filter(Boolean).map(Number)));
 else if(command==='code')process.stdout.write(outputCode(target,p,JSON.parse(fs.readFileSync(arg,'utf8')),rest[0]));
 else throw Error('用法：plan DRAFT TARGET | setup-code PLAN | reuse-code PLAN PAGE | batch-plan PLAN PAGE I,J,… | batch-code PLAN PAGE I,J,… | asset-code PLAN PAGE INDEX | check-code PLAN RECEIPTS | code PLAN DRAFT RECEIPTS BOARD');
}
if(isMain(import.meta.url)){
 const args=process.argv.slice(2),[command,dir,target]=args;
 let failure,planned;
 try{planned=main(args);}catch(e){failure=e;console.error(e.message);process.exitCode=1;}
 // stdout is a plan/code artifact. Diagnostics must never corrupt it.
 if(command==='plan'){
  let fileKey=null;try{fileKey=targetKey(target);}catch{}
  const nothing=planned&&!planned.boardIds.length;
  const reason=failure?failure.message:nothing?'没有可在空白文件生成的画板：'+planned.notice:planned.notice?'按需组件规划完成（部分画板暂不生成），尚未写入Figma。'+planned.notice:'按需组件规划完成，尚未写入Figma';
  const receipt=planned?.skippedBoards.length?{boardIds:planned.boardIds,skippedBoards:planned.skippedBoards}:null;
  try{const result=await logFigma(dir,{category:nothing||/尚无可移植构建数据|需拆分构建/.test(failure?.message??'')?'component_unsupported':failure?'validation':null,evidenceSource:'local-planner',stage:'preflight',status:failure||nothing?'blocked':'completed',fileKey,reason,receipt});console.error('Figma日志 '+JSON.stringify(result));}catch{console.error('Figma日志记录失败；不改变规划结果。');}
 }
}
