import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function generate(kind,stage,target,state={}){
 const base=new URL('../../components/'+kind+'/',import.meta.url);const data=JSON.parse(readFileSync(new URL('build-data.json',base),'utf8'));const definition=JSON.parse(readFileSync(new URL('definition.json',base),'utf8'));
 return generateFromData(data,definition,stage,target,state);
}
// 允许按已验证的组件规则选择构建范围，节点写入行为保持同一实现。
export function generateFromData(data,definition,stage,target,state={}){
 if(!target.fileKey||target.fileKey===definition.source.fileKey||!/^\d+:\d+$/.test(target.pageId||''))throw Error('目标无效');
 const allowed=new Set(['COMPONENT_SET','COMPONENT','FRAME','INSTANCE','TEXT','VECTOR','RECTANGLE','ELLIPSE','LINE']);for(const n of data.nodes){if(!allowed.has(n.type))throw Error('尚未验证的节点类型 '+n.type);if((n.props.fills||[]).some(p=>p.type==='IMAGE'))throw Error('图片需使用已验证的资产转移适配');}
 const range=stage.match(/^nodes-range:(\d+):(\d+)$/);let rangeNodes,rangeState;
 if(range){const offset=Number(range[1]),count=Number(range[2]),all=data.nodes.filter(n=>n.type!=='COMPONENT_SET');if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(count)||count<1||offset+count>all.length)throw Error('节点范围无效');rangeNodes=all.slice(offset,offset+count);const needed=new Set(rangeNodes.flatMap(n=>[n.sourceId,n.parentSourceId]));rangeState={paintMap:state.paintMap??{},map:Object.fromEntries(Object.entries(state.map??{}).filter(([id])=>needed.has(id)))};}
 const pre=`const target=${JSON.stringify(target)};if(figma.fileKey!==target.fileKey)throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(target.pageId);if(!page||page.type!=='PAGE')throw Error('Page不存在');await figma.setCurrentPageAsync(page);const state=${JSON.stringify(stage==='finish'||stage.startsWith('vectors:')?{}:(rangeState??state))};`;
 let code;
 if(stage==='start')code=`const definition=${JSON.stringify({name:definition.name,source:definition.source})};const styles=${JSON.stringify(data.styles)};${start.toString()};return await start(figma,page,definition,styles);`;
 else if(stage.startsWith('nodes:')||range){
  const i=Number(stage.split(':')[1]);const nodes=rangeNodes??data.nodes.filter(n=>n.type!=='COMPONENT_SET').slice(i*8,i*8+8);if(!nodes.length)throw Error('空批次');
  code=`const nodes=${JSON.stringify(nodes)};const rootId=${JSON.stringify(data.rootId)};${buildNodes.toString()};return await buildNodes(figma,page,nodes,rootId,state);`;
 }else if(stage.startsWith('vectors:')){
  const i=Number(stage.split(':')[1]);let batches=[],batch=[],size=0;
  for(const [id,network]of Object.entries(data.vectors)){const len=JSON.stringify(network).length;if(size+len>31000&&batch.length){batches.push(batch);batch=[];size=0;}batch.push({sourceId:id,network});size+=len;}if(batch.length)batches.push(batch);
  const selected=batches[i];if(!selected)throw Error('空矢量批次');
  const records=selected.map(v=>{const p=data.nodes.find(n=>n.sourceId===v.sourceId).props;return {...v,targetId:state.map[v.sourceId],props:{x:p.x,y:p.y}};});
  code=`const records=${JSON.stringify(records)};const ids=[];for(const r of records){const n=await figma.getNodeByIdAsync(r.targetId);if(!n||n.type!=='VECTOR')throw Error('矢量缺失');let owner=n;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==page)throw Error('矢量不在授权Page');await n.setVectorNetworkAsync(r.network);n.x=r.props.x;n.y=r.props.y;ids.push(n.id);}return {mutatedNodeIds:ids};`;
 }else if(stage==='finish'){
  const keys=['x','y','relativeTransform','width','height','layoutMode','primaryAxisSizingMode','counterAxisSizingMode','layoutSizingHorizontal','layoutSizingVertical','layoutGrow','layoutAlign','layoutPositioning','textAutoResize'];
  const rows=data.nodes.map(n=>[state.map[n.sourceId]||null,n.type,...keys.map(k=>n.props[k]??null)]);
  const strokeRows=data.nodes.filter(n=>n.type!=='COMPONENT_SET').map(n=>[state.map[n.sourceId],n.strokeStyleName||null,n.strokeStyleName?null:(n.props.strokes||[])]);
  code=`const definition=${JSON.stringify({name:definition.name,displayLayout:definition.displayLayout})};const keys=${JSON.stringify(keys)};const rows=${JSON.stringify(rows)};const records=rows.map(r=>({sourceId:r[0],type:r[1],props:Object.fromEntries(keys.map((k,i)=>[k,r[i+2]]).filter(([k,v])=>v!==null))}));const localState={map:Object.fromEntries(rows.filter(r=>r[0]).map(r=>[r[0],r[0]]))};${restoreTransform.toString()};${finish.toString()};${applyFinalStrokes.toString()};const result=await finish(figma,page,definition,records,null,localState);await applyFinalStrokes(figma,page,${JSON.stringify(strokeRows)});return {...result,strokeFinalized:true};`;
 }
 else if(stage==='plan')return JSON.stringify({nodeBatches:Math.ceil(data.nodes.filter(n=>n.type!=='COMPONENT_SET').length/8),vectors:Object.keys(data.vectors).length});
 else throw Error('未知阶段');
 const out=pre+'\n'+code;if(out.length>50000)throw Error('代码超出50000字符 '+out.length);return out;
}
export async function start(figma,page,definition,styles){
 if(page.findAllWithCriteria({types:['COMPONENT_SET','COMPONENT']}).some(n=>n.name===definition.name||n.name===definition.name+' ✅'))throw Error('同名组件已存在');
 const paintMap={},textMap={},createdStyleIds=[];const paints=await figma.getLocalPaintStylesAsync();
 for(const [name,value]of Object.entries(styles)){const matches=paints.filter(s=>s.name===name);if(matches.length>1||matches.length&&JSON.stringify(matches[0].paints)!==JSON.stringify(value))throw Error('颜色样式冲突 '+name);if(matches.length)paintMap[name]=matches[0].id;}
 await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});await figma.loadFontAsync({family:'Noto Sans SC',style:'Medium'});
 for(const [name,value]of Object.entries(styles))if(!paintMap[name]){const s=figma.createPaintStyle();s.name=name;s.paints=value;paintMap[name]=s.id;createdStyleIds.push(s.id);}
 return {map:{},paintMap,textMap,createdNodeIds:[],createdStyleIds};
}
export async function buildNodes(figma,page,records,rootId,state){
 const clone=x=>JSON.parse(JSON.stringify(x));const ids=[],newStyles=[];
 // 全批次先确认父级与尚未创建的源节点，避免静默重复。
 for(const r of records)if(state.map[r.sourceId])throw Error('源节点已生成，不可重复运行该批次');
 const styles=await figma.getLocalTextStylesAsync();
 for(const r of records){
  const p=r.props;let n;
  if(r.type==='COMPONENT')n=figma.createComponent();else if(r.type==='TEXT')n=figma.createText();else if(r.type==='VECTOR')n=figma.createVector();else if(r.type==='RECTANGLE')n=figma.createRectangle();else if(r.type==='ELLIPSE')n=figma.createEllipse();else if(r.type==='LINE')n=figma.createLine();else n=figma.createFrame();
  ids.push(n.id);
  if(r.type==='TEXT'){
   const font={family:'Noto Sans SC',style:r.font.style==='Medium'||r.font.style==='Semibold'?'Medium':'Regular'};await figma.loadFontAsync(n.fontName);await figma.loadFontAsync(font);n.fontName=font;
   const name='UIAgent/临时字体/'+font.family+'/'+r.textStyle+'/'+font.style+'/'+p.fontSize+'/'+JSON.stringify(p.lineHeight);
   let style=styles.find(s=>s.name===name);
   if(style&&style.fontName!==figma.mixed&&(style.fontName.family!==font.family||style.fontName.style!==font.style))throw Error('临时文字样式字体冲突 '+name);
   if(!style){style=figma.createTextStyle();style.name=name;style.fontName=font;style.fontSize=p.fontSize;style.lineHeight=clone(p.lineHeight);style.letterSpacing=clone(p.letterSpacing);styles.push(style);newStyles.push(style.id);}
   await n.setTextStyleIdAsync(style.id);n.textAutoResize='NONE';n.characters=p.characters;
  }
  const parentId=state.map[r.parentSourceId];const parent=parentId?await figma.getNodeByIdAsync(parentId):page;
  if(r.parentSourceId&&r.parentSourceId!==rootId&&!parentId)throw Error('父节点未创建');let owner=parent;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==page)throw Error('父节点不在授权Page');parent.appendChild(n);n.name=r.name;
  n.resize(p.width,p.height);
  if('layoutMode'in p){n.layoutMode=p.layoutMode;for(const k of ['layoutWrap','primaryAxisAlignItems','counterAxisAlignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','clipsContent'])if(k in p)n[k]=clone(p[k]);}
  for(const k of ['rotation','visible','opacity','blendMode','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','cornerSmoothing','constraints','effects','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','strokesIncludedInLayout'])if(k in p&&(k!=='strokesIncludedInLayout'||n.layoutMode!=='NONE'))n[k]=clone(p[k]);
  if(r.type!=='VECTOR'){if('cornerRadius'in p)n.cornerRadius=p.cornerRadius;for(const k of ['topLeftRadius','topRightRadius','bottomLeftRadius','bottomRightRadius'])if(k in p)n[k]=p[k];}
  if(r.type==='TEXT')for(const k of ['fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textCase','textDecoration','paragraphIndent','paragraphSpacing','textTruncation','maxLines'])if(k in p)n[k]=clone(p[k]);
  for(const kind of ['fills','strokes']){
   // 桌面实测：先写描边再恢复HUG/尺寸会留下不均匀轮廓。最终几何稳定后统一提交。
   if(kind==='strokes'){n.strokes=[];continue;}
   const styleName=r[kind==='fills'?'fillStyleName':'strokeStyleName'];
   if(styleName){if(kind==='fills')await n.setFillStyleIdAsync(state.paintMap[styleName]);else await n.setStrokeStyleIdAsync(state.paintMap[styleName]);}
   else n[kind]=clone(p[kind]||[]);
  }
  n.x=p.x;n.y=p.y;state.map[r.sourceId]=n.id;
 }
 return {mapDelta:Object.fromEntries(records.map(r=>[r.sourceId,state.map[r.sourceId]])),createdNodeIds:ids,createdStyleIds:newStyles};
}
export async function applyFinalStrokes(figma,page,rows){
 const styles=await figma.getLocalPaintStylesAsync();const nodes=[];
 for(const [id,name,paints]of rows){const n=await figma.getNodeByIdAsync(id);let owner=n;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==page)throw Error('描边节点不在目标Page');const matches=name?styles.filter(s=>s.name===name):[];if(name&&matches.length!==1)throw Error('描边样式缺失或重名 '+name);nodes.push({n,style:matches[0],paints});}
 for(const {n,style,paints}of nodes){if(n.type==='TEXT')for(const s of n.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);if(style)await n.setStrokeStyleIdAsync(style.id);else n.strokes=JSON.parse(JSON.stringify(paints));}
 return nodes.map(x=>x.n.id);
}
// 旋转角度无法表达镜像；布局完成后恢复完整线性变换。
export function restoreTransform(node,matrix,preservePosition=false){
 if(!matrix)return;
 const auto=node.parent&&node.parent.layoutMode&&node.parent.layoutMode!=='NONE'&&node.layoutPositioning!=='ABSOLUTE';
 const next=matrix.map(row=>[...row]);
 if(preservePosition||auto){next[0][2]=node.relativeTransform[0][2];next[1][2]=node.relativeTransform[1][2];}
 node.relativeTransform=next;
}
export async function finish(figma,page,definition,records,rootId,state){
 if(page.findAllWithCriteria({types:['COMPONENT_SET']}).some(n=>n.name===definition.name||n.name===definition.name+' ✅'))throw Error('同名组件集已存在，拒绝重复finish');
 const components=[];const ids=[];
 for(const r of records){if(r.type==='COMPONENT'){components.push(await figma.getNodeByIdAsync(state.map[r.sourceId]));}}
 const set=figma.combineAsVariants(components,page);set.name=definition.name;set.description='按指定规范数据生成；临时 Noto 字体由用户桌面端处理。';set.layoutMode='NONE';
 let right=0,bottom=0;
 for(const r of records.filter(n=>n.type==='COMPONENT')){const n=await figma.getNodeByIdAsync(state.map[r.sourceId]);n.x=records[0].type==='COMPONENT_SET'?r.props.x:24;n.y=records[0].type==='COMPONENT_SET'?r.props.y:24;right=Math.max(right,n.x+r.props.width);bottom=Math.max(bottom,n.y+r.props.height);}
 if(definition.displayLayout){const d=definition.displayLayout,maxW=Math.max(d.minCellWidth||0,...records.filter(r=>r.type==='COMPONENT').map(r=>r.props.width)),maxH=Math.max(d.minCellHeight||0,...records.filter(r=>r.type==='COMPONENT').map(r=>r.props.height));right=0;bottom=0;components.forEach((c,i)=>{c.x=d.padding+(i%d.columns)*(maxW+d.gap);c.y=d.padding+Math.floor(i/d.columns)*(maxH+d.gap);right=Math.max(right,c.x+maxW);bottom=Math.max(bottom,c.y+maxH);});}
 set.resizeWithoutConstraints(right+24,bottom+24);
 set.x=Math.max(0,...page.children.filter(n=>n!==set).map(n=>n.x+n.width))+80;set.y=80;
 // 所有父子关系确定后恢复尺寸及布局，避免归组过程挤压组件。
 for(const r of [...records].reverse()){
  if(r.type==='COMPONENT_SET')continue;const n=await figma.getNodeByIdAsync(state.map[r.sourceId]);const p=r.props;
  if(r.type==='TEXT')for(const segment of n.getStyledTextSegments(['fontName']))await figma.loadFontAsync(segment.fontName);
  if(r.type!=='VECTOR')n.resize(p.width,p.height);
  if(p.layoutMode&&p.layoutMode!=='NONE'){n.primaryAxisSizingMode=p.primaryAxisSizingMode;n.counterAxisSizingMode=p.counterAxisSizingMode;}
  if(r.type!=='COMPONENT')for(const k of ['layoutGrow','layoutAlign','layoutPositioning'])if(k in p)n[k]=p[k];
  ids.push(n.id);
 }
 for(const r of records){if(r.type==='COMPONENT_SET')continue;const n=await figma.getNodeByIdAsync(state.map[r.sourceId]),p=r.props;
  if(n.parent.type!=='PAGE'&&n.parent.type!=='COMPONENT_SET'&&'layoutMode'in n.parent&&n.parent.layoutMode!=='NONE'){
   if(p.layoutPositioning!=='ABSOLUTE'){if(p.layoutSizingHorizontal==='FILL')n.layoutSizingHorizontal='FILL';if(p.layoutSizingVertical==='FILL')n.layoutSizingVertical='FILL';}
  }
  if(p.layoutPositioning==='ABSOLUTE'){n.x=p.x;n.y=p.y;}
  if(r.type==='TEXT'&&p.textAutoResize){n.textAutoResize=p.textAutoResize;if(p.textAutoResize!=='WIDTH_AND_HEIGHT'&&p.layoutSizingHorizontal==='FILL'&&n.parent.layoutMode!=='NONE'&&p.layoutPositioning!=='ABSOLUTE')n.layoutSizingHorizontal='FILL';}
 }
 for(const r of records){if(r.type==='COMPONENT_SET')continue;const n=await figma.getNodeByIdAsync(state.map[r.sourceId]);restoreTransform(n,r.props.relativeTransform,r.type==='COMPONENT');}
 return {componentSetId:set.id,createdNodeIds:[set.id],mutatedNodeIds:ids,fontSubstitution:'Noto Sans SC，用户桌面处理'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const [kind,stage,fileKey,pageId,statePath]=process.argv.slice(2);process.stdout.write(generate(kind,stage,{fileKey,pageId},statePath?JSON.parse(readFileSync(statePath,'utf8')):{}));}
