import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {componentTarget} from '../../scripts/lib/figma-target.mjs';
import {generateFromData} from '../../scripts/lib/figma-build.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const data=read('./build-data.json'),definition=read('./definition.json');
export function selectProfile(profile){
 const roots=data.nodes.filter(n=>n.type==='COMPONENT');
 const type={base:'base 基础',outline:'outline 描边按钮',text:'text 文字按钮',ghost:'ghost 幽灵按钮'}[profile];
 if(!type&&profile!=='layouts')throw Error('未知Button profile');
 const selected=roots.filter(n=>profile==='layouts'?n.name.includes('variant 类型=base 基础,')&&n.name.includes('theme 主题样式=primary 主要,')&&n.name.includes('state 状态=normal 默认, disabled 禁用=false'):n.name.startsWith('variant 类型='+type+',')&&n.name.includes('size 尺寸=medium 中尺寸,')&&n.name.includes('shape 形状=rectangle 矩形, icon 图标=false'));
 const ids=new Set([data.rootId,...selected.map(n=>n.sourceId)]);const nodes=data.nodes.filter(n=>{if(ids.has(n.sourceId))return true;if(ids.has(n.parentSourceId)&&n.parentSourceId!==data.rootId){ids.add(n.sourceId);return true}return false});
 const names=new Set(nodes.flatMap(n=>[n.fillStyleName,n.strokeStyleName]).filter(Boolean));
 return {data:{...data,nodes,vectors:Object.fromEntries(Object.entries(data.vectors).filter(([id])=>ids.has(id))),styles:Object.fromEntries(Object.entries(data.styles).filter(([name])=>names.has(name)))},definition:{...definition,name:'Button 按钮 / '+(type||'尺寸与内容布局'),displayLayout:{columns:profile==='layouts'?7:4,padding:24,gap:24}}};
}
export function propertyCode(target,state,loading=false){
 if(!state.componentSetId||target.fileKey===definition.source.fileKey)throw Error('需要已生成的目标组件集');
 return `if(figma.fileKey!==${JSON.stringify(target.fileKey)})throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(${JSON.stringify(target.pageId)});await figma.setCurrentPageAsync(page);const set=await figma.getNodeByIdAsync(${JSON.stringify(state.componentSetId)});if(set.parent!==page)throw Error('组件集不在授权Page');${bindTextProperties.toString()};return await bindTextProperties(figma,set,${loading});`;
}
async function bindTextProperties(figma,set,loading){
 const fields=set.componentPropertyDefinitions,ids=[set.id];
 const prop=(name,value)=>Object.keys(fields).find(k=>k.startsWith(name+'#'))||set.addComponentProperty(name,'TEXT',value);
 const label=prop('label',loading?'加载':'按钮');let square;
 for(const c of set.children)for(const t of c.findAllWithCriteria({types:['TEXT']})){
  for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);
  const isSquare=c.name.includes('icon 图标=false')&&!c.name.includes('shape 形状=rectangle')&&c.name.includes('shape 形状=');
  if(isSquare&&!square)square=prop('squareText','T');
  t.componentPropertyReferences={...t.componentPropertyReferences,characters:isSquare?square:label};ids.push(t.id);
 }
 return {mutatedNodeIds:ids,labelProperty:label,squareTextProperty:square};
}
export function generateButton(profile,stage,target,state={}){if(stage==='properties')return propertyCode(target,state);const p=selectProfile(profile);return generateFromData(p.data,p.definition,stage,target,state)}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [profile,stage,statePath]=process.argv.slice(2);process.stdout.write(generateButton(profile,stage,componentTarget('button'),statePath?JSON.parse(readFileSync(statePath)):{}))}
