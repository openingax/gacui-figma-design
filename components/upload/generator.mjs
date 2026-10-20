import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
const data=JSON.parse(fs.readFileSync(new URL('./build-data.json',import.meta.url)));
export const TARGET='UNCONFIGURED_FIGMA_TARGET';
export async function buildRecords(figma,page,records,state){
 const copy=x=>JSON.parse(JSON.stringify(x));const made=[],map={...state.map},pending=[];
 for(const r of records){
  if(map[r.sourceId])throw Error('批次已执行 '+r.sourceId);
  const p=r.props;let n;
  if(r.reuse){const id=r.reuse.targetId||map[r.reuse.sourceId];const c=await figma.getNodeByIdAsync(id);if(!c||c.type!=='COMPONENT')throw Error('依赖缺失 '+id);for(const t of c.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);n=c.createInstance();const texts=n.findAllWithCriteria({types:['TEXT']});if(texts.length!==r.reuse.texts.length)throw Error('复用文本槽数量变化 '+r.sourceId);for(let i=0;i<texts.length;i++){for(const seg of texts[i].getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);texts[i].characters=r.reuse.texts[i].characters;}}
  else if(r.type==='COMPONENT')n=figma.createComponent();else if(r.type==='TEXT')n=figma.createText();else if(r.type==='VECTOR')n=figma.createVector();else if(r.type==='RECTANGLE')n=figma.createRectangle();else n=figma.createFrame();
  if(r.type==='TEXT'){const f={family:'Noto Sans SC',style:['Semibold','Medium','Bold'].includes(r.font.style)?'Medium':'Regular'};await figma.loadFontAsync(f);n.fontName=f;n.characters=p.characters;}
  const parent=r.parentSourceId?await figma.getNodeByIdAsync(map[r.parentSourceId]):page;if(!parent)throw Error('父级缺失');parent.appendChild(n);n.name=r.name;
  if(!r.reuse){n.resize(p.width,p.height);if('layoutMode'in p){n.layoutMode=p.layoutMode;for(const k of ['layoutWrap','primaryAxisAlignItems','counterAxisAlignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','counterAxisSpacing','clipsContent'])if(k in p)n[k]=copy(p[k]);}}
  const common=['rotation','visible','opacity','blendMode','isMask','maskType','constraints','effects','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','cornerSmoothing','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'];
  for(const k of common)if(k in p&&k in n)n[k]=copy(p[k]);
  if('strokesIncludedInLayout'in p&&'layoutMode'in n&&n.layoutMode!=='NONE')n.strokesIncludedInLayout=p.strokesIncludedInLayout;
  if(r.type!=='VECTOR')for(const k of ['cornerRadius','topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])if(k in p&&k in n)n[k]=p[k];
  if(r.type==='TEXT')for(const k of ['fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textCase','textDecoration','paragraphIndent','paragraphSpacing','textTruncation','maxLines'])if(k in p)n[k]=copy(p[k]);
  if(r.network){const network=copy(r.network);for(const region of network.regions||[])if(region.fillStyleId)delete region.fillStyleId;await n.setVectorNetworkAsync(network);}
  const paints=copy(p.fills||[]);for(const paint of paints)if(paint.type==='IMAGE'){if(!state.images[paint.imageHash]||!figma.getImageByHash(state.images[paint.imageHash]))throw Error('图片尚未导入或缺少持久引用');paint.imageHash=state.images[paint.imageHash];}
  if(r.fillStyleName)await n.setFillStyleIdAsync(state.paintMap[r.fillStyleName]);else n.fills=paints;
  n.strokes=[];n.x=p.x;n.y=p.y;if(!r.parentSourceId){n.x=80;n.y=400+Object.keys(map).length*2;}
  map[r.sourceId]=n.id;made.push(n.id);if(r.reuse)made.push(...n.findAll().map(c=>c.id));pending.push([r,n]);
 }
 return {mapDelta:Object.fromEntries(records.map(r=>[r.sourceId,map[r.sourceId]])),createdNodeIds:made};
}
export async function finishGroup(figma,page,records,rootIds,group,state,reactionTargets){
 const ids=[],components=[];
 for(const id of rootIds){const n=await figma.getNodeByIdAsync(state.map[id]);if(!n||n.type!=='COMPONENT')throw Error('根组件缺失');components.push(n);}
 const existed=!!state.existingSet;const set=existed?await figma.getNodeByIdAsync(state.existingSet):figma.combineAsVariants(components,page);set.name='Upload / '+group;set.layoutMode='NONE';set.description='来源于指定 Upload 规范；静态可编辑，临时 Noto Sans SC；业务内容可修改，待用户验收。';
 // 先恢复底层尺寸，再恢复共享布局，最后提交描边。
 const nodes=new Map();for(const r of records){const n=await figma.getNodeByIdAsync(state.map[r.sourceId]);nodes.set(r.sourceId,n);if(n.type==='TEXT')for(const seg of n.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);}
 for(const r of [...records].reverse()){const n=nodes.get(r.sourceId),p=r.props;if(p.layoutMode&&p.layoutMode!=='NONE'){n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';}if(n.type!=='VECTOR')n.resizeWithoutConstraints(p.width,p.height);if(p.layoutMode&&p.layoutMode!=='NONE'){n.primaryAxisSizingMode=p.primaryAxisSizingMode;n.counterAxisSizingMode=p.counterAxisSizingMode;}if(r.parentSourceId){if('layoutPositioning'in p)n.layoutPositioning=p.layoutPositioning;for(const k of ['layoutGrow','layoutAlign'])if(k in p)n[k]=p[k];}ids.push(n.id);}
 for(const r of records){const n=nodes.get(r.sourceId),p=r.props;if(r.parentSourceId&&n.parent.layoutMode&&n.parent.layoutMode!=='NONE'&&p.layoutPositioning!=='ABSOLUTE'){if(p.layoutSizingHorizontal==='FILL')n.layoutSizingHorizontal='FILL';if(p.layoutSizingVertical==='FILL')n.layoutSizingVertical='FILL';}if(n.type==='TEXT'){n.textAutoResize=p.textAutoResize;if(p.layoutSizingHorizontal==='FILL'&&n.parent.layoutMode!=='NONE')n.layoutSizingHorizontal='FILL';}if(r.parentSourceId&&(n.parent.layoutMode==='NONE'||p.layoutPositioning==='ABSOLUTE')){n.x=p.x;n.y=p.y;}}
 for(const r of records){const n=nodes.get(r.sourceId),p=r.props;if(r.strokeStyleName)await n.setStrokeStyleIdAsync(state.paintMap[r.strokeStyleName]);else n.strokes=JSON.parse(JSON.stringify(p.strokes||[]));if(r.reactions){const rs=JSON.parse(JSON.stringify(r.reactions));for(const rx of rs)for(const a of rx.actions||[])if(a.destinationId){const dst=reactionTargets[a.destinationId];if(!dst)throw Error('缺少交互映射 '+a.destinationId);a.destinationId=dst;}await n.setReactionsAsync(rs);}}
 const pad=32,gap=64,cols=group.includes('flow')?3:4,maxW=Math.max(...components.map(c=>c.width)),maxH=Math.max(...components.map(c=>c.height));components.forEach((c,i)=>{c.x=pad+(i%cols)*(maxW+gap);c.y=pad+Math.floor(i/cols)*(maxH+gap);});set.resizeWithoutConstraints(pad*2+Math.min(cols,components.length)*maxW+(Math.min(cols,components.length)-1)*gap,pad*2+Math.ceil(components.length/cols)*maxH+(Math.ceil(components.length/cols)-1)*gap);set.x=80;if(!existed)set.y=state.nextY??360;
 return {componentSetId:set.id,group,roots:components.map((n,i)=>({sourceId:rootIds[i],id:n.id,width:n.width,height:n.height})),createdNodeIds:existed?[]:[set.id],mutatedNodeIds:ids,nextY:set.y+set.height+180};
}
function groupRecords(group){const selected=new Set(data.groups[group]);const result=[];for(const r of data.records)if(selected.has(r.sourceId)||selected.has(r.parentSourceId)){selected.add(r.sourceId);result.push(r);}return result;}
export function batches(group){const out=[];let batch=[];for(const r of groupRecords(group)){if(JSON.stringify([...batch,r]).length>33000&&batch.length){out.push(batch);batch=[];}batch.push(r);}if(batch.length)out.push(batch);return out;}
export function generate(stage,state={},arg){
 if(state.fileKey&&state.fileKey!==TARGET)throw Error('未授权目标');
 const pre=`if(figma.fileKey!==${JSON.stringify(TARGET)})throw Error('目标文件不符');`;
 if(stage==='start')return pre+`if(figma.root.children.some(p=>p.name==='Upload 上传'))throw Error('Upload页已存在，先读取状态');const styles=${JSON.stringify(data.styles)};const existing=await figma.getLocalPaintStylesAsync(),paintMap={},createdStyleIds=[];for(const [name,paints]of Object.entries(styles)){const a=existing.filter(s=>s.name===name);if(a.length>1||a.length&&JSON.stringify(a[0].paints)!==JSON.stringify(paints))throw Error('样式冲突 '+name);if(a.length)paintMap[name]=a[0].id;else {const s=figma.createPaintStyle();s.name=name;s.paints=paints;paintMap[name]=s.id;createdStyleIds.push(s.id);}}const page=figma.createPage();page.name='Upload 上传';await figma.setCurrentPageAsync(page);return {fileKey:figma.fileKey,pageId:page.id,map:{},images:{},paintMap,nextY:360,createdNodeIds:[page.id],createdStyleIds};`;
 const context=pre+`const page=await figma.getNodeByIdAsync(${JSON.stringify(state.pageId)});if(!page||page.type!=='PAGE'||page.name!=='Upload 上传')throw Error('目标Page不符');await figma.setCurrentPageAsync(page);`;
 if(stage==='asset'){
  const bytes=fs.readFileSync(new URL('./assets/'+arg+'.png',import.meta.url));let acc=0,bits=0,packed='';for(const b of bytes){acc=(acc<<8)|b;bits+=8;while(bits>=15){bits-=15;packed+=String.fromCharCode(((acc>>>bits)&32767)+256);}}if(bits)packed+=String.fromCharCode((acc<<(15-bits)&32767)+256);
  return context+`const s=${JSON.stringify(packed)},bytes=new Uint8Array(${bytes.length});let acc=0,bits=0,j=0;for(const c of s){acc=(acc<<15)|(c.charCodeAt(0)-256);bits+=15;while(bits>=8&&j<bytes.length){bits-=8;bytes[j++]=(acc>>>bits)&255;}}const image=figma.createImage(bytes);const name='Upload / 原始图片 / '+${JSON.stringify(arg)};let holder=page.children.find(n=>n.name===name);const created=[];if(!holder){holder=figma.createComponent();page.appendChild(holder);holder.name=name;holder.resize(112,112);holder.x=2500;holder.y=360+page.children.filter(n=>n.name.startsWith('Upload / 原始图片 /')).length*160;created.push(holder.id);}holder.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FIT'}];return {sourceHash:${JSON.stringify(arg)},hash:image.hash,bytes:bytes.length,createdNodeIds:created,mutatedNodeIds:[holder.id]};`;
 }
 if(stage==='nodes'){const {group,index}=arg,allRecords=batches(group)[index];if(!allRecords)throw Error('空批次');const records=allRecords.filter(r=>!state.map[r.sourceId]);const needed=new Set(records.flatMap(r=>[r.sourceId,r.parentSourceId,r.reuse?.sourceId]));const map=Object.fromEntries(Object.entries(state.map).filter(([k])=>needed.has(k)));return context+`const records=${JSON.stringify(records)},state=${JSON.stringify({map,paintMap:state.paintMap,images:state.images})};${buildRecords.toString()};return await buildRecords(figma,page,records,state);`;}
 if(stage==='vectors'){
  const records=groupRecords(arg).filter(r=>r.network&&state.map[r.sourceId]);return context+`const rows=${JSON.stringify(records.map(r=>({id:state.map[r.sourceId],network:r.network,x:r.props.x,y:r.props.y})))};const ids=[];for(const r of rows){const n=await figma.getNodeByIdAsync(r.id);for(const region of r.network.regions||[])if(region.fillStyleId)delete region.fillStyleId;await n.setVectorNetworkAsync(r.network);n.x=r.x;n.y=r.y;ids.push(n.id);}return {mutatedNodeIds:ids};`;
 }
 if(stage==='finish'){
  const records=groupRecords(arg);const keys=['width','height','layoutMode','primaryAxisSizingMode','counterAxisSizingMode','layoutPositioning','layoutGrow','layoutAlign','layoutSizingHorizontal','layoutSizingVertical','textAutoResize','x','y'];
  const rows=records.map(r=>[state.map[r.sourceId],r.parentSourceId?1:0,...keys.map(k=>r.props[k]??null),r.strokeStyleName??null,r.strokeStyleName?[]:r.props.strokes||[],r.reactions??null]);
  const values=rows[0].map(()=>[]),lookup=rows[0].map(()=>new Map());const packed=rows.map(row=>row.map((v,i)=>{const k=JSON.stringify(v);if(!lookup[i].has(k)){lookup[i].set(k,values[i].length);values[i].push(v);}return lookup[i].get(k);}));
  const allTargets={...data.reuse,...Object.fromEntries(Object.entries(data.iconSourceMap).map(([src,id])=>[src,state.map[id]]))};const neededTargets=new Set(records.flatMap(r=>(r.reactions||[]).flatMap(rx=>(rx.actions||[]).map(a=>a.destinationId))));const targets=Object.fromEntries(Object.entries(allTargets).filter(([id])=>neededTargets.has(id)));
  return context+`const keys=${JSON.stringify(keys)},values=${JSON.stringify(values)},packed=${JSON.stringify(packed)};const rows=packed.map(r=>r.map((v,i)=>values[i][v]));const records=rows.map(r=>({sourceId:r[0],parentSourceId:r[1]?'nested':null,props:{...Object.fromEntries(keys.map((k,i)=>[k,r[i+2]]).filter(([k,v])=>v!==null)),strokes:r[${keys.length+3}]},strokeStyleName:r[${keys.length+2}],reactions:r[${keys.length+4}]}));const state={map:Object.fromEntries(rows.map(r=>[r[0],r[0]])),paintMap:${JSON.stringify(state.paintMap)},nextY:${state.groups?.[arg]?.nextY?state.groups[arg].nextY-180-(0):state.nextY},existingSet:${JSON.stringify(state.groups?.[arg]?.componentSetId)}};${finishGroup.toString()};return await finishGroup(figma,page,records,${JSON.stringify(data.groups[arg].map(id=>state.map[id]))},${JSON.stringify(arg)},state,${JSON.stringify(targets)});`;
 }

 throw Error('未知阶段');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [stage,statePath,arg]=process.argv.slice(2);process.stdout.write(generate(stage,statePath?JSON.parse(fs.readFileSync(statePath)): {},arg?JSON.parse(arg):undefined));}
