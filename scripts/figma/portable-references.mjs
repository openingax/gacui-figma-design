import fs from 'node:fs';
// Legacy renderer literals are compiler symbols, never cross-file Figma node IDs.
export function disabledButtonReferences(){
 const index=JSON.parse(fs.readFileSync(new URL('./portable-index.json',import.meta.url))),data=JSON.parse(fs.readFileSync(new URL('../../components/button/build-data.json',import.meta.url)));
 const out={};
 for(const id of ['107:86','107:124']){
   const ref=index[id],n=data.nodes.find(n=>n.sourceId===ref.sourceId);
   function naming(name){return name.replace('disabled 禁用=false','disabled 禁用=true');}
   const expected=naming(n.name),disabled=data.nodes.find(n=>n.type==='COMPONENT'&&n.name===expected);
   const target=Object.keys(index).find(k=>index[k].path===ref.path&&index[k].sourceId===disabled?.sourceId);
   if(!target)throw Error('缺少按钮禁用态规范构建引用');out[id]=target;
 }
 return out;
}
// A form field needs one variant of a component set; build that variant alone instead of the whole set.
// A set's variants can be split across family files (e.g. Select normal states vs expanded states).
let variantCache=null;
function setVariants(index){
 if(variantCache)return variantCache;variantCache=new Map();
 for(const file of new Set(Object.values(index).filter(v=>!v.variant).map(v=>v.path))){
  let data;try{data=JSON.parse(fs.readFileSync(new URL('../../'+file,import.meta.url)));}catch{continue;}
  for(const n of data.nodes??[])if(n.type==='COMPONENT'&&n.parentSourceId){if(!variantCache.has(n.parentSourceId))variantCache.set(n.parentSourceId,new Map());variantCache.get(n.parentSourceId).set(n.sourceId,n.name);}
 }
 return variantCache;
}
export function formVariantReference(query,layer){
 const index=JSON.parse(fs.readFileSync(new URL('./portable-index.json',import.meta.url))),set=index[query.set],who=layer??'字段';
 if(!set||set.type!=='COMPONENT_SET')throw Error(who+'的组件集 '+query.set+' 暂无空白文件构建数据');
 const matches=[...(setVariants(index).get(set.sourceId)??new Map())].filter(([,name])=>query.predicates.every(p=>name.includes(p)));
 if(matches.length!==1)throw Error(who+(matches.length?'匹配到多个现有变体':'缺少现有变体'));
 const ids=Object.keys(index).filter(k=>index[k].sourceId===matches[0][0]&&index[k].type==='COMPONENT').sort();
 if(!ids.length)throw Error(who+'的变体暂无空白文件构建数据');
 return ids[0];
}
