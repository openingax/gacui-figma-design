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
