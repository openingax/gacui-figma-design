import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {buildNodes,restoreTransform,applyFinalStrokes} from '../../scripts/lib/figma-build.mjs';
import {initializeAsset} from '../../scripts/figma/portable-runtime.mjs';
import {initializeButtonAsset} from './portable-runtime.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./portable-data.json',import.meta.url)));
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
// 图标先于模板；旧文件ID只存在于调用方目录，精确资产以源符号和内容哈希标识。
export function buttonAssets(){
 const icons=data.icons.map(r=>({key:'button-native/icon/'+r.sourceId,sourceId:r.sourceId,type:'COMPONENT',nodeCount:r.data.nodes.length,data:r.data,slots:[],iconName:r.name}));
 for(const a of icons)a.hash=hash(a);
 const templates=[...data.ordinary.map(r=>({...r,kind:'ordinary'})),...data.loading.map(r=>({...r,kind:'loading'}))].map(r=>{
  const nodes=r.nodes.filter(n=>n.type!=='VECTOR'),root=nodes.find(n=>n.sourceId===r.sourceId),direct=nodes.filter(n=>n.parentSourceId===r.sourceId);
  const slots=r.slots.map(s=>{const dependency=icons.find(a=>a.sourceId===s.mainSourceId);if(!dependency)throw Error('缺少精确图标');const n=nodes.find(n=>n.sourceId===s.sourceId);
   const paints=s.paints??r.nodes.filter(n=>n.parentSourceId===s.sourceId&&n.type==='VECTOR').map(n=>({fills:n.props.fills,strokes:n.props.strokes,fillStyleName:n.fillStyleName??null,strokeStyleName:n.strokeStyleName??null}));
   return {sourceId:s.sourceId,index:direct.indexOf(n),name:n.name,dependency:dependency.key,dependencyHash:dependency.hash,propertyName:s.propertyName??null,paints};});
  const a={key:'button-native/'+r.kind+'/'+r.sourceId,sourceId:r.sourceId,type:'COMPONENT',kind:r.kind,layout:r.layout,props:r.props,data:{nodes,styles:r.styles,vectors:{}},slots,nodeCount:nodes.length+slots.reduce((sum,s)=>sum+icons.find(a=>a.key===s.dependency).nodeCount-1,0)};
  if(!root||slots.some(s=>s.index<0))throw Error('Button结构不完整');a.hash=hash(a);return a;
 });
 return [...icons,...templates];
}
export function validateButtonReceipt(asset,r,fileKey,pageId){
 if(!r||r.fileKey!==fileKey||r.pageId!==pageId||r.key!==asset.key||r.hash!==asset.hash||r.type!=='COMPONENT'||r.nodeCount!==asset.nodeCount||!['created','reused'].includes(r.status)||![r.rootId,r.wrapperId].every(id=>/^\d+:\d+$/.test(id)))throw Error('Button真实资产回执不匹配 '+asset.key);
 return r;
}
export function buttonAssetCode(fileKey,pageId,key,receipts=[],paintMap={},bindStyles=false){
 if(!/^[a-zA-Z0-9]{22,128}$/.test(fileKey)||fileKey===data.sourceFile||!/^\d+:\d+$/.test(pageId))throw Error('Button迁移目标无效');
 const assets=buttonAssets(),asset=structuredClone(assets.find(a=>a.key===key));if(!asset)throw Error('Button资产不存在');
 for(const slot of asset.slots){const dep=assets.find(a=>a.key===slot.dependency),matches=receipts.filter(r=>r.key===dep.key);if(matches.length!==1)throw Error('Button图标回执缺失或重复');const r=validateButtonReceipt(dep,matches[0],fileKey,pageId);slot.mainId=r.rootId;slot.wrapperId=r.wrapperId;slot.marker='GACUI / '+dep.key+' / '+dep.hash;
 for(const p of slot.paints)for(const k of ['fillStyleName','strokeStyleName'])if(p[k]&&!paintMap[p[k]])throw Error('Button颜色映射缺失 '+p[k]);}
 const functions=[buildNodes,restoreTransform,applyFinalStrokes,initializeAsset,...(asset.kind?[initializeButtonAsset]:[])].map(f=>f.toString()).join('\n');
 const code=functions+'\nconst request='+JSON.stringify({fileKey,pageId,asset,paintMap})+';'+(bindStyles?"const styles=await figma.getLocalPaintStylesAsync();for(const name of Object.keys(request.paintMap)){const found=styles.filter(s=>s.name===name);if(found.length!==1)throw Error('Button颜色样式缺失或重名');request.paintMap[name]=found[0].id;}":'')+'\nreturn await '+(asset.kind?'initializeButtonAsset':'initializeAsset')+'(figma,request,'+(asset.kind?'initializeAsset,':'')+'buildNodes,restoreTransform,applyFinalStrokes);';
 if(code.length>48000)throw Error('Button迁移单批超限 '+code.length);return code;
}
export function buttonTargetCatalog(fileKey,pageId,receipts,paintMap){
 const assets=buttonAssets(),byKey=new Map();
 for(const a of assets){const matches=receipts.filter(r=>r.key===a.key);if(matches.length!==1)throw Error('Button目录回执缺失或重复 '+a.key);byKey.set(a.key,validateButtonReceipt(a,matches[0],fileKey,pageId));}
 const reference=a=>{const r=byKey.get(a.key);return {sourceId:a.sourceId,id:r.rootId,parentId:r.wrapperId};};
 const styles=Object.assign({},...assets.map(a=>a.data.styles));for(const name of Object.keys(styles))if(typeof paintMap?.[name]!=='string'||!paintMap[name])throw Error('Button目录颜色映射缺失 '+name);
 const icons=assets.filter(a=>!a.kind),find=id=>icons.find(a=>a.sourceId===id);
 return {fileKey,pageId,templates:assets.filter(a=>a.kind==='ordinary').map(a=>({...reference(a),layout:a.layout})),loading:assets.filter(a=>a.kind==='loading').map(a=>({...reference(a),props:a.props})),icons:icons.filter(a=>a.iconName).map(a=>({...reference(a),name:a.iconName})),loadingIcons:assets.filter(a=>a.kind==='loading').flatMap(a=>a.slots.map(s=>({sourceId:s.sourceId,id:byKey.get(s.dependency).rootId,parentId:byKey.get(s.dependency).wrapperId}))),paintMap};
}
// 历史ID仅作为编译符号；owner/page均由同一资产真实回执导出。
const legacy=JSON.parse(fs.readFileSync(new URL('./business-catalog.json',import.meta.url)));
export function buttonAssetReference(ref){
 const [id,role]=ref.split('#');if(role&&!['owner','page'].includes(role))return null;
 const assets=buttonAssets();let asset;
 const template=legacy.templates.find(t=>t.id===id),loading=legacy.loading.find(t=>t.id===id),icon=legacy.icons.find(t=>t.id===id),loadingIcon=legacy.loadingIcons.find(t=>t.id===id);
 if(template)asset=assets.find(a=>a.kind==='ordinary'&&a.sourceId===template.sourceId);
 else if(loading)asset=assets.find(a=>a.kind==='loading'&&a.sourceId===loading.sourceId);
 else if(icon)asset=assets.find(a=>!a.kind&&a.sourceId===icon.sourceId);
 else if(loadingIcon){const slot=assets.flatMap(a=>a.slots).find(s=>s.sourceId===loadingIcon.sourceId);asset=assets.find(a=>a.key===slot?.dependency);}
 if(!asset)return null;
 const deps=asset.slots.map(s=>{const a=assets.find(a=>a.key===s.dependency);return legacy.icons.find(r=>r.sourceId===a.sourceId)?.id??legacy.loadingIcons.find(r=>assets.some(b=>b.slots.some(t=>t.sourceId===r.sourceId&&t.dependency===a.key)))?.id;});
 if(deps.some(id=>!id))throw Error('Button编译依赖缺失');
 return {asset,alias:asset.key+(role?'#'+role:''),deps};
}
