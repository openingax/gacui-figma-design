import fs from 'node:fs';
import {validateButton} from './business-spec.mjs';
import {buttonColorCandidate} from './offline-candidate.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url))),recipes=read('./recipes.json'),loadingData=read('../button-loading/build-data.json'),catalog=read('./business-catalog.json');
export function prepareButton(input){return prepareButtonForTarget(input,catalog);}
// 新目标必须传入真实初始化回执组装的目录；默认路径保留原有调用签名。
export function prepareButtonForTarget(input,catalog){
 const spec=validateButton(input),exact=(key,value)=>{const found=recipes.values[key].find(v=>v===value||v.startsWith(value+' '));if(!found)throw Error('源属性值不存在 '+value);return found;};
 const properties={'variant 类型':exact('variant 类型',spec.appearance),'size 尺寸':exact('size 尺寸',spec.size),'theme 主题样式':exact('theme 主题样式',spec.theme),'shape 形状':exact('shape 形状',spec.shape),'icon 图标':String(spec.icon!=='none'),'⬑icon type 图标类型':exact('⬑icon type 图标类型',{none:'n/a',prefix:'prefixIcon',suffix:'suffixIcon',only:'singleIcon'}[spec.icon]),'state 状态':exact('state 状态',spec.state),'disabled 禁用':String(spec.disabled)};
 let data,main,root;
 if(spec.loading){main=catalog.loading.find(r=>r.props['appearance 外观']===spec.appearance&&r.props['theme 主题']===spec.theme&&r.props['tone 色阶']===spec.loadingTone);if(!main)throw Error('Loading配方不存在');root=loadingData.nodes.find(n=>n.sourceId===main.sourceId);const ids=new Set([root.sourceId]);const nodes=loadingData.nodes.filter(n=>{if(ids.has(n.sourceId))return true;if(ids.has(n.parentSourceId)){ids.add(n.sourceId);return true;}return false;});data={nodes,styles:loadingData.styles};}
 else{data=buttonColorCandidate(properties).data;root=data.nodes.find(n=>n.type==='COMPONENT');main=catalog.templates.find(t=>Object.entries(t.layout).every(([k,v])=>properties[k]===v));if(!main)throw Error('布局模板缺失');}
 const parts=data.nodes.filter(n=>n.parentSourceId===root.sourceId),text=parts.find(n=>n.type==='TEXT'),icon=parts.find(n=>n.type==='INSTANCE'),vectors=icon?data.nodes.filter(n=>n.parentSourceId===icon.sourceId):[];
 if(vectors.some(n=>n.type!=='VECTOR'))throw Error('图标结构变化');
 const iconMain=icon?(spec.loading?catalog.loadingIcons.find(n=>n.sourceId===icon.sourceId):catalog.icons.find(n=>n.name===spec.iconName)):null;
 if(icon&&!iconMain)throw Error('精确图标依赖缺失');
 const record=n=>{if(!n)return null;for(const k of ['fill','stroke'])if(n[k+'StyleName']&&!catalog.paintMap[n[k+'StyleName']])throw Error('缺少颜色样式映射 '+n[k+'StyleName']);return {props:structuredClone(n.props),fillStyleId:n.fillStyleName?catalog.paintMap[n.fillStyleName]:null,strokeStyleId:n.strokeStyleName?catalog.paintMap[n.strokeStyleName]:null};};
 const rootRecord=record(root);delete rootRecord.props.x;delete rootRecord.props.y;delete rootRecord.props.relativeTransform;
 return {spec,sourceId:root.sourceId,mainId:main.id,setId:main.parentId??(spec.loading?catalog.loadingSetId:catalog.templateSetId),root:rootRecord,text:text?{...record(text),font:text.font}:null,icon:icon?{...record(icon),mainId:iconMain.id,...(iconMain.parentId?{parentId:iconMain.parentId}:{}),position:parts.indexOf(icon),vectors:vectors.map(record)}:null};
}
export const buttonBusinessCatalog=catalog;
