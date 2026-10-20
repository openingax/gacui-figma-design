import fs from 'node:fs';
import {validateTransfer} from './family.mjs';
// 仅本家族已有4态列表项，不重新创建母组件。几何结果仍需真实Figma验证。
export async function updateTransferItems(figma,parent,spec,deps){
 const mains={};
 for(const key of new Set(spec.items.map(o=>o.disabled?'disabled':o.checked?'checked':o.state==='hover'?'hover':'normal'))){const d=deps.rows[key],n=await figma.getNodeByIdAsync(d.id);if(!n||n.type!=='COMPONENT'||n.name!==d.name)throw Error('Transfer列表项依赖已变化 '+key);mains[key]=n;for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);}
 const existing=new Map();for(const row of parent.children){if(row.type!=='INSTANCE'||!row.name.startsWith('Transfer/item/'))throw Error('列表中出现非本生成器内容，停止更新');if(existing.has(row.name))throw Error('业务项重复，先回读');existing.set(row.name,row);for(const t of row.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);}
 parent.layoutMode='VERTICAL';parent.primaryAxisSizingMode='AUTO';parent.counterAxisSizingMode='FIXED';parent.itemSpacing=4;parent.paddingTop=parent.paddingBottom=parent.paddingLeft=parent.paddingRight=0;parent.fills=[];parent.resize(spec.width,Math.max(1,parent.height));
 const kept=new Set(),rows=[];
 for(const [i,o]of spec.items.entries()){
  const key=o.disabled?'disabled':o.checked?'checked':o.state==='hover'?'hover':'normal',name='Transfer/item/'+encodeURIComponent(o.id);let row=existing.get(name);const created=!row;if(!row){row=mains[key].createInstance();parent.appendChild(row);}else if((await row.getMainComponentAsync())?.id!==mains[key].id)row.swapComponent(mains[key]);
  parent.insertChild(i,row);row.name=name;row.resize(spec.width,32);row.layoutSizingHorizontal='FILL';row.layoutSizingVertical='HUG';row.minHeight=32;
  const labels=row.findAll(n=>n.type==='TEXT'&&n.name==='label');if(labels.length!==1)throw Error('列表项文字槽变化，请回读');const label=labels[0];for(const seg of label.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);label.characters=o.label;label.textAutoResize='HEIGHT';label.layoutSizingHorizontal='FILL';
  kept.add(name);rows.push({key:o.id,rowId:row.id,textId:label.id,state:key,created});
 }
 for(const [name,row]of existing)if(!kept.has(name))row.remove();
 if(!spec.items.length)parent.resize(spec.width,1);
 return {rootId:parent.id,rows,width:parent.width,height:parent.height,validation:'written-needs-readback-and-visual',fontPolicy:'preserve-current-font; no implicit replacement'};
}
export function generateTransferItems(stage,target,spec){
 if(target?.fileKey!=='UNCONFIGURED_FIGMA_TARGET'||target.pageId!=='615:2')throw Error('仅允许已授权Transfer测试页');
 if(!['create','update'].includes(stage))throw Error('未知阶段');
 if(typeof spec?.id!=='string'||!spec.id||!Number.isFinite(spec.width)||spec.width<184)throw Error('需要稳定列表ID和至少184宽度');
 const items=validateTransfer({source:spec.items,target:[]}).source;if(items.some(o=>o.depth))throw Error('列表项生成器不代替树结构');if(items.some(o=>o.checked&&o.state==='hover'))throw Error('源列表项没有已选加悬停的独立组合');
 if(stage==='update'&&!/^\d+:\d+$/.test(spec.rootId??''))throw Error('原位修改需要真实rootId');
 const data=JSON.parse(fs.readFileSync(new URL('../transfer-item/build-data.json',import.meta.url))),state=JSON.parse(fs.readFileSync(new URL('../../evidence/transfer-item/state.json',import.meta.url)));
 const rows=Object.fromEntries(data.nodes.filter(n=>n.type==='COMPONENT').map(n=>[n.name.includes('true')?'disabled':n.name.includes('active')?'checked':n.name.includes('hover')?'hover':'normal',{id:state.map[n.sourceId],name:n.name}]));if(Object.values(rows).some(r=>!r.id))throw Error('列表项依赖未构建');
 const normalized={id:spec.id,width:spec.width,items},name='Transfer/items/'+spec.id;
 const pre=`if(figma.fileKey!==${JSON.stringify(target.fileKey)})throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(${JSON.stringify(target.pageId)});if(!page||page.type!=='PAGE')throw Error('授权页缺失');const spec=${JSON.stringify(normalized)},deps=${JSON.stringify({rows})};${updateTransferItems.toString()};`;
 let code;if(stage==='create')code=pre+`if(page.children.some(n=>n.name===${JSON.stringify(name)}))throw Error('已有同名列表，回读后原位修改');const parent=figma.createFrame();page.appendChild(parent);parent.name=${JSON.stringify(name)};try{return await updateTransferItems(figma,parent,spec,deps);}catch(error){parent.remove();throw error;}`;
 else code=pre+`const parent=await figma.getNodeByIdAsync(${JSON.stringify(spec.rootId)});if(!parent||parent.type!=='FRAME'||parent.name!==${JSON.stringify(name)})throw Error('修改对象不匹配');let owner=parent;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==page)throw Error('修改对象不在授权页');return await updateTransferItems(figma,parent,spec,deps);`;
 if(code.length>45000)throw Error('单次代码超出预算，需明确分批，不能截断项目');return code;
}
