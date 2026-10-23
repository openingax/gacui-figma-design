#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {code,plan} from '../../sketch/figma.mjs';
import {buildNodes,restoreTransform,applyFinalStrokes} from '../lib/figma-build.mjs';
import {initializeAsset} from './portable-runtime.mjs';
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
export function portablePlan(dir,target){
 const fileKey=targetKey(target),p=plan(dir),refs=new Set();
 for(const b of p.boards)code(dir,b.id,{portable:true,fileKey,resolveReference:id=>{refs.add(id);return id;}});
 const assets=[],aliases={},byKey=new Map();
 for(const id of [...refs].sort()){const a=assetFor(id);aliases[id]=a.key;if(!byKey.has(a.key)){byKey.set(a.key,a);assets.push(a);}}
 // Runtime colors are named tokens; include them once, not an arbitrary target's styles.
 const styles=Object.assign({},...assets.map(a=>a.data.styles));
 for(const file of ['components/input/build-data.json','components/button/build-data.json','components/select/build-data.json','components/form-help/build-data.json'])Object.assign(styles,read(file).styles);
 const drafts=fs.readFileSync(path.join(dir,'versions.json'),'utf8');
 const result={schema:1,fileKey,version:p.version,pageName:p.pageName,draftHash:hash(drafts),boardIds:p.boards.map(b=>b.id),aliases,assets:assets.map(a=>({key:a.key,hash:a.hash,type:a.type,nodeCount:a.nodeCount})),styles};
 result.generatorHash=hash(p.boards.map(b=>code(dir,b.id,{portable:true,fileKey,resolveReference:id=>id})));result.fingerprint=hash(result);for(let i=0;i<result.assets.length;i++)assetCode(result,'0:1',i);return result;
}
export function setupCode(p){return `if(figma.fileKey!==${JSON.stringify(p.fileKey)}||figma.fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标不符');const styles=${JSON.stringify(p.styles)},existingStyles=await figma.getLocalPaintStylesAsync(),createdStyleIds=[];const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='boundVariables'?undefined:v));for(const [name,paints]of Object.entries(styles)){const found=existingStyles.filter(s=>s.name===name);if(found.length>1||found.length&&JSON.stringify(clean(found[0].paints))!==JSON.stringify(clean(paints)))throw Error('颜色样式冲突 '+name);}for(const [name,paints]of Object.entries(styles))if(!existingStyles.some(s=>s.name===name)){const s=figma.createPaintStyle();s.name=name;s.paints=clean(paints);createdStyleIds.push(s.id);}const name='GACUI · 本文件组件';const matches=figma.root.children.filter(n=>n.name===name);if(matches.length>1)throw Error('组件Page重名');let page=matches[0];const ids=[];if(!page){page=figma.createPage();page.name=name;ids.push(page.id);}return {fileKey:figma.fileKey,pageId:page.id,name:page.name,createdNodeIds:ids,createdStyleIds};`;}
// Lossless string dictionary keeps complex exact geometry below the tool's 50k limit.
export function pack(value){const json=JSON.stringify(value),tokens=json.match(/"(?:[^"\\]|\\.)*"/g)??[],counts=new Map();for(const t of tokens)counts.set(t,(counts.get(t)??0)+1);const pool=[...counts].filter(([t,n])=>(n>1&&t.length>6)||/^"~\d+"$/.test(t)).map(([t])=>t),lookup=new Map(pool.map((t,i)=>[t,JSON.stringify('~'+i)]));return {strings:pool.map(t=>JSON.parse(t)),value:JSON.parse(json.replace(/"(?:[^"\\]|\\.)*"/g,t=>lookup.get(t)??t))};}
export function unpack(p){function expand(v){if(typeof v==='string'&&/^~\d+$/.test(v))return p.strings[Number(v.slice(1))];if(Array.isArray(v))return v.map(expand);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[expand(k),expand(x)]));return v;}return expand(p.value);}
export function assetCode(p,pageId,batch){const row=p.assets[batch];if(!row)throw Error('无效资产批次');const id=Object.keys(p.aliases).find(id=>p.aliases[id]===row.key),asset=assetFor(id);if(asset.hash!==row.hash)throw Error('构建数据已变化，请重新规划');const out=`${buildNodes.toString()}\n${restoreTransform.toString()}\n${applyFinalStrokes.toString()}\n${initializeAsset.toString()}\n${unpack.toString()}\nreturn await initializeAsset(figma,unpack(${JSON.stringify(pack({fileKey:p.fileKey,pageId,asset}))}),buildNodes,restoreTransform,applyFinalStrokes);`;if(out.length>50000)throw Error('资产超过单批限制，需拆分构建：'+row.key+' '+out.length);return out;}
export function mapping(p,receipts){const result={};for(const a of p.assets){const matches=receipts.filter(r=>r.key===a.key&&r.hash===a.hash&&r.fileKey===p.fileKey&&r.type===a.type&&r.nodeCount===a.nodeCount&&['created','reused'].includes(r.status));if(matches.length!==1||!/^\d+:\d+$/.test(matches[0].rootId))throw Error('缺少有效资产回执：'+a.key);result[a.key]=matches[0].rootId;}return result;}
export function outputCode(dir,p,receipts,board){const current=portablePlan(dir,p.fileKey);if(current.fingerprint!==p.fingerprint)throw Error('草稿或依赖发生变化，请重新规划；保留原确认版本');const m=mapping(p,receipts);const generated=code(dir,board,{portable:true,fileKey:p.fileKey,resolveReference:id=>{const value=m[p.aliases[id]];if(!value)throw Error('缺少目标映射：'+id);return value;}});const guard=checkCode(p,receipts,false);const out=guard+'\n'+generated;if(out.length>50000)throw Error('出稿代码超过工具限制');return out;}
export function checkCode(p,receipts,report=true){mapping(p,receipts);const rows=p.assets.map(a=>{const r=receipts.find(r=>r.key===a.key);return {...a,rootId:r.rootId,wrapperId:r.wrapperId,pageId:r.pageId};});return `if(figma.fileKey!==${JSON.stringify(p.fileKey)})throw Error('目标不符');const assets=${JSON.stringify(rows)};for(const a of assets){const root=await figma.getNodeByIdAsync(a.rootId),wrapper=await figma.getNodeByIdAsync(a.wrapperId);if(!root||root.type!==a.type||root.parent!==wrapper||wrapper.parent?.id!==a.pageId||wrapper.name!=='GACUI / '+a.key+' / '+a.hash||wrapper.findAll(()=>true).length!==a.nodeCount)throw Error('目标组件缺失或映射失效：'+a.key);}${report?"return {status:'verified',fileKey:figma.fileKey,verified:assets.map(a=>({key:a.key,rootId:a.rootId}))};":''}`;}
function main([command,dir,target,arg,...rest]){
 if(command==='plan'){console.log(JSON.stringify(portablePlan(dir,target),null,2));return;}
 const p=JSON.parse(fs.readFileSync(dir,'utf8'));
 if(command==='check-code')process.stdout.write(checkCode(p,JSON.parse(fs.readFileSync(target,'utf8'))));
 else if(command==='setup-code')process.stdout.write(setupCode(p));
 else if(command==='asset-code')process.stdout.write(assetCode(p,target,Number(arg)));
 else if(command==='code')process.stdout.write(outputCode(target,p,JSON.parse(fs.readFileSync(arg,'utf8')),rest[0]));
 else throw Error('用法：plan DRAFT TARGET | setup-code PLAN | asset-code PLAN PAGE INDEX | code PLAN DRAFT RECEIPTS BOARD');
}
if(isMain(import.meta.url)){
 const args=process.argv.slice(2),[command,dir,target]=args;
 let failure;
 try{main(args);}catch(e){failure=e;console.error(e.message);process.exitCode=1;}
 // stdout is a plan/code artifact. Diagnostics must never corrupt it.
 if(command==='plan'){
  let fileKey=null;try{fileKey=targetKey(target);}catch{}
  try{const result=await logFigma(dir,{stage:'preflight',status:failure?'blocked':'completed',fileKey,reason:failure?failure.message:'按需组件规划完成，尚未写入Figma'});console.error('Figma日志 '+JSON.stringify(result));}catch{console.error('Figma日志记录失败；不改变规划结果。');}
 }
}
