import fs from 'node:fs';
import {TARGET} from './generator.mjs';
const data=JSON.parse(fs.readFileSync(new URL('./build-data.json',import.meta.url)));
export function resolveUpload(spec={}){return validateUpload(spec,data.roots);}
export function validateUpload(spec={},roots){
 const theme=spec.theme??'file',draggable=spec.draggable??(theme.endsWith('-flow')),state=spec.state??'before',interaction=spec.interaction??'normal',disabled=spec.disabled??false;
 if(typeof draggable!=='boolean'||typeof disabled!=='boolean')throw Error('draggable/disabled 须为布尔值');
 const root=roots.find(r=>r.properties&&r.properties['theme 主题样式']===theme&&r.properties['draggable 启用拖拽']===String(draggable)&&r.properties['disabled 禁用']===String(disabled)&&r.properties['state 上传状态'].split(' ')[0]===state&&r.properties['state 交互状态'].split(' ')[0]===interaction);
 if(!root)throw Error('规范没有此状态组合');
 for(const k of ['filename','helperText','fileSize','uploadDate','buttonLabel'])if(spec[k]!==undefined&&typeof spec[k]!=='string')throw Error(k+' 须为字符串');
 if(spec.progress!==undefined&&(!Number.isFinite(spec.progress)||spec.progress<0||spec.progress>100))throw Error('进度须为 0–100');
 if(spec.files!==undefined){if(!theme.endsWith('-flow')||state==='before')throw Error('files 仅用于已选文件的批量状态');if(!Array.isArray(spec.files)||!spec.files.length)throw Error('files 须为非空数组；空列表请使用 before');for(const f of spec.files){if(typeof f.name!=='string'||!f.name)throw Error('文件名须为非空字符串');if(f.state!==undefined&&!['waiting','progress','success','fail'].includes(f.state))throw Error('未知文件状态');if(f.progress!==undefined&&(!Number.isFinite(f.progress)||f.progress<0||f.progress>100))throw Error('文件进度须为0–100');if(f.interaction!==undefined&&!['normal','hover'].includes(f.interaction))throw Error('未知文件交互状态');if(f.interaction==='hover'&&(theme!=='image-flow'||(f.state??state)!=='success'))throw Error('只有成功图片有 hover 展示');}}
 return {...spec,theme,draggable,state,interaction,disabled,sourceId:root.sourceId};
}
export async function loadUploadFonts(figma,node){for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);}
export function collectUploadSlots(node){
 const slots={helper:[],filename:[],progress:[],fileSize:[],uploadDate:[],button:[]};
 for(const t of node.findAllWithCriteria({types:['TEXT']})){const v=t.characters;let k;if(/^(额外提示语|错误提示语|支持批量上传文件)/.test(v))k='helper';else if(/^(文件名|文件名称|图片名|还未选择文件)/.test(v)&&v!=='文件名')k='filename';else if(/\d+%/.test(v))k='progress';else if(v.startsWith('文件大小:'))k='fileSize';else if(v.startsWith('上传日期:'))k='uploadDate';else if(['上传文件','重新上传','选择文件','点击上传图片'].includes(v))k='button';if(k)slots[k].push({id:t.id,initial:v});}
 return slots;
}
export async function updateUpload(figma,node,spec,slots){
 await loadUploadFonts(figma,node);const affected=[node.id];
 async function set(role,value){if(value===undefined)return;for(const slot of slots[role]){const t=await figma.getNodeByIdAsync(slot.id);if(!t||t.type!=='TEXT')throw Error('内容槽失效 '+slot.id);let owner=t;while(owner&&owner!==node)owner=owner.parent;if(owner!==node)throw Error('内容槽不在组件内');const text=typeof value==='function'?value(slot):value;t.characters=text;affected.push(t.id);
   if(role==='helper'){let width=spec.theme.endsWith('-flow')?316:spec.draggable?302:180;t.resize(width,20);t.textAutoResize='HEIGHT';}
   if(role==='filename'&&text.length>14){const width=spec.theme==='file-input'?180:spec.draggable?180:spec.theme==='image-flow'?112:spec.theme==='file-flow'?134:220;t.textAutoResize='NONE';t.resize(width,t.lineHeight.unit==='PIXELS'?t.lineHeight.value:22);t.textAutoResize='TRUNCATE';t.textTruncation='ENDING';t.maxLines=1;}
  }}
 await set('helper',spec.helperText);await set('filename',spec.filename);await set('fileSize',spec.fileSize===undefined?undefined:'文件大小: '+spec.fileSize);await set('uploadDate',spec.uploadDate===undefined?undefined:'上传日期: '+spec.uploadDate);await set('button',spec.buttonLabel);await set('progress',spec.progress===undefined||spec.files?undefined:slot=>slot.initial.replace(/\d+%/,spec.progress+'%'));
 // 依据最近的固定宽度容器，给状态图标和进度预留空间。
 for(const slot of slots.filename){const t=await figma.getNodeByIdAsync(slot.id);if(!t||t.characters.length<=14)continue;const line=t.parent;let current=line,offset=0,available=Infinity;while(current&&current!==node.parent){if(current.layoutSizingHorizontal==='FIXED'||current.layoutSizingHorizontal==='FILL'){available=current.width-(current.paddingRight||0)-offset-(line.paddingLeft||0);break;}offset+=current.x;current=current.parent;}if(line.layoutMode==='HORIZONTAL'){const siblings=line.children.filter(c=>c.visible&&c!==t);available-=siblings.reduce((sum,c)=>sum+c.width,0)+(line.itemSpacing||0)*siblings.length+(line.paddingRight||0);}if(Number.isFinite(available)&&available<t.width){t.textAutoResize='NONE';t.resize(Math.max(24,available),t.lineHeight.unit==='PIXELS'?t.lineHeight.value:22);t.textAutoResize='TRUNCATE';t.textTruncation='ENDING';t.maxLines=1;affected.push(t.id);}}
 // 帮助文本增长后，只有组件根负责整体高度；固定上传框维持规范尺寸。
 if(node.layoutMode!=='NONE')node.primaryAxisSizingMode='AUTO';
 return {mutatedNodeIds:affected,slots};
}
export async function configureUploadFiles(figma,node,spec,templates){
 if(!spec.files)return {createdNodeIds:[],mutatedNodeIds:[]};
 const created=[],mutated=[],texts=n=>n.findAllWithCriteria({types:['TEXT']}),cache={};
 async function getTemplate(file,last=false){const variant=(file.state??spec.state)+'/'+(file.interaction??'normal'),key=variant+'/'+last;if(cache[key])return cache[key];const id=templates[variant];if(!id)throw Error('文件状态模板缺失 '+key);const main=await figma.getNodeByIdAsync(id);await loadUploadFonts(figma,main);const holder=main.children.find(n=>n.name===(spec.theme==='file-flow'?'table':'upload'));const content=holder.children.find(n=>n.name==='content');const template=content.children[last?content.children.length-1:0].clone();figma.currentPage.appendChild(template);cache[key]=template;return template;}
 const dispose=()=>{for(const t of Object.values(cache))t.remove();};
 if(spec.theme==='file-flow'){
  const table=node.children.find(n=>n.name==='table'),content=table?.children.find(n=>n.name==='content');if(!content?.children.length)throw Error('批量文件结构不符');
  const old=[...content.children];for(const n of old){mutated.push(n.id);n.remove();}
  for(const [i,file]of spec.files.entries()){const row=(await getTemplate(file,i===spec.files.length-1)).clone();content.appendChild(row);for(const t of texts(row)){if(/^文件名/.test(t.characters)){t.characters=file.name;t.textAutoResize='TRUNCATE';t.maxLines=1;}else if(t.characters==='40K')t.characters=file.size??'—';else if(/\d+%/.test(t.characters))t.characters=t.characters.replace(/\d+%/,(file.progress??spec.progress??40)+'%');}created.push(row.id,...row.findAll().map(n=>n.id));}
  dispose();content.primaryAxisSizingMode='AUTO';table.primaryAxisSizingMode='AUTO';node.primaryAxisSizingMode='AUTO';mutated.push(content.id,table.id,node.id);
 }else if(spec.theme==='image-flow'){
  const grid=node.children.find(n=>n.name==='upload');const row=grid?.children.find(n=>n.name==='content');if(!row?.children.length)throw Error('批量图片结构不符');const rowTemplate=row.clone();figma.currentPage.appendChild(rowTemplate);for(const n of [...grid.children]){mutated.push(n.id);n.remove();}
  for(let i=0;i<spec.files.length;i+=4){const band=rowTemplate.clone();for(const n of [...band.children])n.remove();grid.appendChild(band);for(const file of spec.files.slice(i,i+4)){const cell=(await getTemplate(file)).clone();band.appendChild(cell);for(const t of texts(cell)){if(/^文件名/.test(t.characters)){t.characters=file.name;t.resize(112,20);t.textAutoResize='TRUNCATE';t.maxLines=1;}else if(/\d+%/.test(t.characters))t.characters=t.characters.replace(/\d+%/,(file.progress??spec.progress??40)+'%');}created.push(cell.id,...cell.findAll().map(n=>n.id));}band.primaryAxisSizingMode='AUTO';created.push(band.id);}
  rowTemplate.remove();dispose();grid.primaryAxisSizingMode='AUTO';node.primaryAxisSizingMode='AUTO';mutated.push(grid.id,node.id);
 }
 return {createdNodeIds:created,mutatedNodeIds:mutated};
}
export async function restoreUploadButtonReactions(figma,node,reactionsByMain){
 const mutated=[];for(const n of node.findAllWithCriteria({types:['INSTANCE']})){const main=await n.getMainComponentAsync();const reactions=reactionsByMain[main?.id];if(reactions){await n.setReactionsAsync(reactions);mutated.push(n.id);}}return mutated;
}
export function generateUsage(stage,library,spec,example,target={fileKey:library.fileKey,pageId:library.pageId}){
 if(library.fileKey!==TARGET||target.fileKey!==TARGET||!/^\d+:\d+$/.test(target.pageId))throw Error('未授权目标');const s=resolveUpload(spec);const targets={...data.reuse,...Object.fromEntries(Object.entries(data.iconSourceMap).map(([src,id])=>[src,library.map[id]]))};const reactionsByMain={};for(const r of data.records){const id=r.reuse?.targetId||library.map[r.reuse?.sourceId];if(id&&r.reactions){const rx=structuredClone(r.reactions);for(const v of rx)for(const a of v.actions||[])if(a.destinationId)a.destinationId=targets[a.destinationId];reactionsByMain[id]=rx;}}const templates=Object.fromEntries(data.roots.filter(r=>r.properties&&r.properties['theme 主题样式']===s.theme).map(r=>[r.properties['state 上传状态'].split(' ')[0]+'/'+r.properties['state 交互状态'].split(' ')[0],library.map[r.sourceId]]));const pre=`if(figma.fileKey!==${JSON.stringify(TARGET)})throw Error('目标不符');await figma.setCurrentPageAsync(await figma.getNodeByIdAsync(${JSON.stringify(target.pageId)}));const spec=${JSON.stringify(s)};${loadUploadFonts.toString()};${collectUploadSlots.toString()};${updateUpload.toString()};${configureUploadFiles.toString()};${restoreUploadButtonReactions.toString()};const reactionsByMain=${JSON.stringify(reactionsByMain)},templates=${JSON.stringify(templates)};`;
 if(stage==='create')return pre+`const main=await figma.getNodeByIdAsync(${JSON.stringify(library.map[s.sourceId])});await loadUploadFonts(figma,main);let node=main.createInstance();figma.currentPage.appendChild(node);node=node.detachInstance();node.name='Upload 使用验证 / '+spec.theme+' / '+spec.draggable;node.x=${spec.x??2500};node.y=${spec.y??1100};const files=await configureUploadFiles(figma,node,spec,templates);const slots=collectUploadSlots(node);await updateUpload(figma,node,spec,slots);await restoreUploadButtonReactions(figma,node,reactionsByMain);return {rootId:node.id,spec,slots,createdNodeIds:[node.id,...node.findAll().map(n=>n.id)],width:node.width,height:node.height};`;
 if(stage==='update'){if(!example?.rootId)throw Error('缺少原示例标识');return pre+`const node=await figma.getNodeByIdAsync(${JSON.stringify(example.rootId)});if(!node)throw Error('示例不存在');let owner=node;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==figma.currentPage)throw Error('示例不在授权Page');const files=await configureUploadFiles(figma,node,spec,templates);const slots=${JSON.stringify(example.slots)};{const fresh=collectUploadSlots(node);for(const role of Object.keys(slots)){const kept=[];for(const slot of slots[role]){const n=await figma.getNodeByIdAsync(slot.id);let parent=n;while(parent&&parent!==node)parent=parent.parent;if(parent===node)kept.push(slot);}slots[role]=[...kept,...fresh[role].filter(s=>!kept.some(k=>k.id===s.id))];}}const result=await updateUpload(figma,node,spec,slots);result.mutatedNodeIds.push(...await restoreUploadButtonReactions(figma,node,reactionsByMain));return {...result,createdNodeIds:files.createdNodeIds,rootId:node.id,width:node.width,height:node.height};`;}
 throw Error('未知使用阶段');
}
