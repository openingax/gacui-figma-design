// Composite assets: a family whose library holds instances of other assets (Drawer uses Button).
// The target file builds it with the family's own generator, after its dependencies exist.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildLibrary} from '../../components/drawer/generator.mjs';
const read=u=>JSON.parse(fs.readFileSync(u,'utf8'));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const composites=()=>read(new URL('./portable-composites.json',import.meta.url));
export function compositeRole(id){for(const [family,c] of Object.entries(composites()))if(c.roles[id])return {family,key:c.key,role:c.roles[id]};return null;}

// Button sources the Drawer library instantiates. Hover targets are not needed: a blank file cannot
// express the source CHANGE_TO between standalone components (see buildLibrary options.reactions).
function drawerDependencies(data){
 const sources=new Set(['22709:33461','22709:33639']);
 for(const footer of [data.footerLeft,data.footerRight])for(const b of footer.children[0].children)sources.add(b.mainComponentId);
 return [...sources].sort().map(source=>{const ref=data.buttonTargets[source];if(!ref)throw Error('Drawer按钮依赖未映射：'+source);return {source,ref};});
}
export function compositeAsset(family){
 if(family!=='drawer')throw Error('未知组合资产：'+family);
 const c=composites()[family],data=read(new URL('../../components/drawer/build-data.json',import.meta.url));
 const deps=drawerDependencies(data),{buttonTargets,...rest}=data;
 const roles=[...new Set(Object.values(c.roles))].sort();
 return {key:c.key,kind:'drawer-library',type:'COMPONENT_SET',nodeCount:null,roles,deps,data:rest,hash:hash({data:rest,deps,roles,builder:buildLibrary.toString(),runtime:initializeDrawerLibrary.toString()})};
}

// Runs inside use_figma. Dependencies are found by their asset markers, never by historical IDs.
export async function initializeDrawerLibrary(figma,request,buildLibrary){
 const {fileKey,pageId,asset}=request;
 if(figma.fileKey!==fileKey||fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标文件不符或规范源只读');
 const page=await figma.getNodeByIdAsync(pageId);if(page?.type!=='PAGE')throw Error('组件Page不存在');
 await figma.setCurrentPageAsync(page);
 const marker='GACUI / '+asset.key+' / '+asset.hash;
 function roles(wrapper){
  const one=(type,name)=>{const found=wrapper.children.filter(n=>n.type===type&&n.name===name);if(found.length!==1)throw Error('Drawer组件库结构已变化：'+name);return found[0];};
  const set=one('COMPONENT_SET','Drawer 抽屉'),close=one('COMPONENT_SET','Drawer / 关闭控件'),footer=one('COMPONENT_SET','Drawer / 底栏');
  const child=(parent,name)=>{const n=parent.children.find(c=>c.type==='COMPONENT'&&c.name===name);if(!n)throw Error('Drawer组件库缺少 '+name);return n.id;};
  const map={};
  for(const size of ['small','medium','large'])map['variants.'+size]=child(set,'尺寸='+size);
  for(const side of ['left','right'])map['footerIds.'+side]=child(footer,'按钮位置='+side);
  ['normal','hover','active'].forEach((state,i)=>{map['closeIds.'+state]=child(close,asset.data.close.children[i].name);});
  const header=one('COMPONENT','Drawer / 标题栏'),titleProperty=Object.keys(header.componentPropertyDefinitions).find(k=>k.split('#')[0]==='标题');
  return {set,map,titleProperty};
 }
 const existing=page.children.filter(n=>n.name===marker||n.name===marker+' / building');
 if(existing.length){
  if(existing.length!==1||existing[0].name!==marker)throw Error('初始化未完成或重名，请先回读本批次，不能重复创建');
  const wrapper=existing[0],r=roles(wrapper);
  return {status:'reused',fileKey,pageId,key:asset.key,hash:asset.hash,rootId:r.set.id,wrapperId:wrapper.id,type:r.set.type,nodeCount:wrapper.findAll(()=>true).length,map:r.map,titleProperty:r.titleProperty,createdNodeIds:[]};
 }
 const buttonTargets={};
 for(const d of asset.deps){
  const w=page.children.filter(n=>n.name==='GACUI / '+d.key+' / '+d.hash);
  if(w.length!==1||w[0].children[0]?.type!=='COMPONENT')throw Error('依赖组件未初始化：'+d.key);
  buttonTargets[d.source]=w[0].children[0].id;
 }
 const fonts=(await figma.listAvailableFontsAsync()).map(x=>x.fontName),has=(f,s)=>fonts.some(n=>n.family===f&&n.style===s);
 const fontFamily=['PingFang SC','Noto Sans SC'].find(f=>has(f,'Regular')&&has(f,'Medium'));
 if(!fontFamily)throw Error('规范字体和允许替代字体不可用');
 // Spec title is PingFang Semibold; Noto keeps the verified Medium substitute.
 const headingStyle=fontFamily==='PingFang SC'&&has(fontFamily,'Semibold')?'Semibold':'Medium';
 const wrapper=figma.createFrame();page.appendChild(wrapper);wrapper.name=marker+' / building';wrapper.fills=[];wrapper.clipsContent=false;
 wrapper.x=Math.max(0,...page.children.filter(n=>n!==wrapper).map(n=>n.x+n.width))+80;wrapper.y=80;
 const built=await buildLibrary(figma,wrapper,{...asset.data,buttonTargets},{fontFamily,headingStyle,reactions:false});
 let w=0,h=0;for(const n of wrapper.children){w=Math.max(w,n.x+n.width);h=Math.max(h,n.y+n.height);}
 wrapper.resize(Math.max(1,w+80),Math.max(1,h+80));wrapper.name=marker;
 const r=roles(wrapper);
 return {status:'created',fileKey,pageId,key:asset.key,hash:asset.hash,rootId:r.set.id,wrapperId:wrapper.id,type:r.set.type,nodeCount:wrapper.findAll(()=>true).length,map:r.map,titleProperty:built.titleProperty,fontFallback:fontFamily==='PingFang SC'?null:fontFamily,headingStyle,omitted:['Button悬停原型交互（空白文件中Button不是同一变体集）'],createdNodeIds:[wrapper.id,...built.createdNodeIds]};
}
