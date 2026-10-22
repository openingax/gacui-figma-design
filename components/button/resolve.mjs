import {readFileSync} from 'node:fs';
import {generateFromData} from '../../scripts/lib/figma-build.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const base=read('./build-data.json'),def=read('./definition.json'),recipes=read('./recipes.json');
const layoutKeys=['size 尺寸','shape 形状','icon 图标','⬑icon type 图标类型'];
const parse=name=>Object.fromEntries(name.split(', ').map(s=>{const i=s.indexOf('=');return[s.slice(0,i),s.slice(i+1)]}));
export function resolveButton(properties){
 if(recipes.axes.some(k=>typeof properties[k]!=='string')||Object.keys(properties).some(k=>!recipes.axes.includes(k)))throw Error('必须提供源稿8个精确变体属性，不猜测默认值');
 const row=recipes.rows.find(r=>recipes.axes.every((k,i)=>recipes.values[k][r[1][i]]===properties[k]));if(!row)throw Error('规范中不存在该组合');
 const template=base.nodes.find(n=>n.type==='COMPONENT'&&layoutKeys.every(k=>parse(n.name)[k]===properties[k]));if(!template)throw Error('没有已读取的布局模板');
 const ids=new Set([template.sourceId]);const selected=base.nodes.filter(n=>{if(ids.has(n.sourceId))return true;if(ids.has(n.parentSourceId)){ids.add(n.sourceId);return true}return false}).map(n=>structuredClone(n));
 const remap=id=>id===template.sourceId?row[0]:row[0]+'/'+id;
 const root=selected[0];root.name=recipes.axes.map(k=>k+'='+properties[k]).join(', ');const rp=structuredClone(recipes.roots[row[2]]);
 for(const k of Object.keys(root.props))if(k in rp)root.props[k]=rp[k];
 function paint(n,p){for(const kind of ['fill','stroke']){delete n[kind+'StyleName'];const st=recipes.styles[p[kind+'StyleId']];if(st)n[kind+'StyleName']=st.name;}}
 paint(root,rp);
 const direct=selected.filter(n=>n.parentSourceId===template.sourceId),parts=recipes.parts[row[3]];
 if(parts.length!==direct.length)throw Error('内容结构不匹配');
 direct.forEach((n,i)=>{for(const [k,v]of Object.entries(parts[i]))if(k in n.props&&!(v&&v.__figmaMixed))n.props[k]=structuredClone(v);paint(n,parts[i]);});
 const vectors={};let vi=0;const palette=row[4]===null?null:recipes.iconPalettes[row[4]];
 for(const n of selected){const old=n.sourceId;if(n.type==='VECTOR'){const net=structuredClone(base.vectors[old]);const color=palette?.[vi++];if(!color)throw Error('矢量颜色证据缺失');n.props.fills=structuredClone(color.fills);n.props.strokes=structuredClone(color.strokes);paint(n,color);for(const region of net.regions||[]){region.fills=structuredClone(color.fills);region.fillStyleId='';}vectors[remap(old)]=net;}n.sourceId=remap(old);n.parentSourceId=n===root?base.rootId:remap(n.parentSourceId);}
 const nodes=[structuredClone(base.nodes[0]),...selected],used=new Set(nodes.flatMap(n=>[n.fillStyleName,n.strokeStyleName]).filter(Boolean));
 const styles={};for(const s of Object.values(recipes.styles))if(s?.type==='PAINT'&&used.has(s.name))styles[s.name]=s.paints;
 return {rootType:'COMPONENT_SET',rootId:base.rootId,nodes,styles,vectors};
}
export function generateRequestedButton(properties,stage,target,state={}){return generateFromData(resolveButton(properties),{...def,name:'Button 按钮 / 按需 '+Object.values(properties).join(' · '),displayLayout:{columns:1,padding:24,gap:24}},stage,target,state)}
