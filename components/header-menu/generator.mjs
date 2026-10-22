import {readFileSync} from 'node:fs';
import {isMain} from '../../support/entry.mjs';
const load=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
export function generate(stage,target,state={}) {
 const d=load('./definition.json'),data=load('./build-data.json');
 if(!target.fileKey||target.fileKey===d.source.fileKey||!/^\d+:\d+$/.test(target.pageId||''))throw Error('需要独立目标文件与 Page');
 const pre=`const target=${JSON.stringify(target)};if(figma.fileKey!==target.fileKey)throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(target.pageId);if(!page||page.type!=='PAGE')throw Error('Page 不存在');await figma.setCurrentPageAsync(page);`;
 let body;
 if(stage==='image'){
  const bytes=readFileSync(new URL('./logo.png',import.meta.url)).toString('base64');
  body=`const encoded=${JSON.stringify(bytes)};const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let acc=0,bits=0;const bytes=[];for(const c of encoded){if(c==='=')break;acc=(acc<<6)|alphabet.indexOf(c);bits+=6;if(bits>=8){bits-=8;bytes.push((acc>>bits)&255);}}const img=figma.createImage(new Uint8Array(bytes));return {imageHash:img.hash,createdNodeIds:[]};`;
 }else if(stage==='structure'){
  if(!state.imageHash)throw Error('缺少图片步骤返回值');
  body=`const definition=${JSON.stringify(d)};const data=${JSON.stringify({nodes:data.nodes,styles:data.styles})};const imageHash=${JSON.stringify(state.imageHash)};\n${buildStructure.toString()}\nreturn await buildStructure(figma,page,definition,data,imageHash);`;
 }else if(stage.startsWith('vector:')){
  const index=Number(stage.split(':')[1]);const entry=Object.entries(data.vectors)[index];if(!entry||!state.map?.[entry[0]])throw Error('矢量或结构映射不存在');
  const source=data.nodes.find(n=>n.sourceId===entry[0]);
  body=`const n=await figma.getNodeByIdAsync(${JSON.stringify(state.map[entry[0]])});let parent=n;while(parent&&parent.type!=='PAGE')parent=parent.parent;if(!n||n.type!=='VECTOR'||parent!==page)throw Error('矢量不在目标 Page');await n.setVectorNetworkAsync(${JSON.stringify(entry[1])});n.x=${source.props.x};n.y=${source.props.y};return {mutatedNodeIds:[n.id],width:n.width,height:n.height,fillGeometry:n.fillGeometry};`;
 }else throw Error('未知步骤');
 const code=pre+'\n'+body;if(code.length>50000)throw Error('单次代码超出50000字符');return code;
}
async function buildStructure(figma,page,definition,data,imageHash){
 if(page.findAllWithCriteria({types:['COMPONENT_SET','COMPONENT']}).some(n=>n.name===definition.name||n.name===definition.name+' ✅'))throw Error('目标 Page 已有同名组件');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const paintStyles=await figma.getLocalPaintStylesAsync();const paintMap={};const createdStyleIds=[];
 for(const [name,paints] of Object.entries(data.styles)){
  const matches=paintStyles.filter(s=>s.name===name);if(matches.length>1)throw Error('同名样式重复');
  if(matches.length&&JSON.stringify(matches[0].paints)!==JSON.stringify(paints))throw Error('同名颜色样式不符');
  if(matches.length)paintMap[name]=matches[0];
 }
 await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});await figma.loadFontAsync({family:'Noto Sans SC',style:'Medium'});
 const textStyles=await figma.getLocalTextStylesAsync(),textMap={};
 for(const record of data.nodes.filter(n=>n.type==='TEXT')){
  const name='headerMenu/临时字体/'+record.sourceTextStyle;
  if(textMap[name])continue;
  const matches=textStyles.filter(s=>s.name===name);if(matches.length)throw Error('临时字体样式已存在，需检查后复用');
 }
 for(const [name,paints] of Object.entries(data.styles))if(!paintMap[name]){const s=figma.createPaintStyle();s.name=name;s.paints=clone(paints);paintMap[name]=s;createdStyleIds.push(s.id);}
 for(const record of data.nodes.filter(n=>n.type==='TEXT')){
  const name='headerMenu/临时字体/'+record.sourceTextStyle;if(textMap[name])continue;
  const style=figma.createTextStyle();style.name=name;style.fontName={family:'Noto Sans SC',style:record.font.style};style.fontSize=record.props.fontSize;style.lineHeight=clone(record.props.lineHeight);style.letterSpacing=clone(record.props.letterSpacing);textMap[name]=style;createdStyleIds.push(style.id);
 }
 const map={},createdNodeIds=[],created=[];
 const rename={'25795:66657':'brand','25795:66660':'menu-items','25795:68840':'operations','25795:66658':'logo','I25795:68840;25709:25976':'account'};
 const geometries=['visible','opacity','blendMode','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','cornerSmoothing','constraints','effects','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','strokesIncludedInLayout'];
 for(const record of data.nodes){
  const p=record.props;let n;
  if(record.type==='COMPONENT')n=figma.createComponent();
  else if(record.type==='TEXT')n=figma.createText();
  else if(record.type==='VECTOR')n=figma.createVector();
  else if(record.type==='RECTANGLE')n=figma.createRectangle();
  else n=figma.createFrame();
  createdNodeIds.push(n.id);created.push({n,record});map[record.sourceId]=n.id;
  if(record.type==='TEXT'){
   await figma.loadFontAsync(n.fontName);
   n.fontName={family:'Noto Sans SC',style:record.font.style};
   await n.setTextStyleIdAsync(textMap['headerMenu/临时字体/'+record.sourceTextStyle].id);
  }
  if(record.parentSourceId){const parent=await figma.getNodeByIdAsync(map[record.parentSourceId]);parent.appendChild(n);}else page.appendChild(n);
  n.name=rename[record.sourceId]||record.name;
  if(record.type==='TEXT'){
   n.textAutoResize='NONE';n.characters=p.characters;
   for(const k of ['fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textCase','textDecoration','paragraphIndent','paragraphSpacing'])if(k in p)n[k]=clone(p[k]);
  }
  n.resize(p.width,p.height);
  if('layoutMode' in p){n.layoutMode=p.layoutMode;for(const k of ['layoutWrap','primaryAxisAlignItems','counterAxisAlignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','clipsContent'])if(k in p)n[k]=clone(p[k]);}
  for(const k of geometries)if(k in p&&(k!=='strokesIncludedInLayout'||n.layoutMode!=='NONE'))n[k]=clone(p[k]);
  if(record.type!=='VECTOR'&&'cornerRadius' in p)n.cornerRadius=p.cornerRadius;
  for(const kind of ['fills','strokes']){
   const name=record[kind==='fills'?'fillStyleName':'strokeStyleName'];
   if(name){if(kind==='fills')await n.setFillStyleIdAsync(paintMap[name].id);else await n.setStrokeStyleIdAsync(paintMap[name].id);}
   else n[kind]=clone(p[kind]||[]).map(paint=>paint.type==='IMAGE'?{...paint,imageHash}:paint);
  }
  n.x=p.x;n.y=p.y;
 }
 // 子节点齐备后恢复源自动布局尺寸模式；字体临时替换时文本框固定源宽高。
 for(const {n,record} of [...created].reverse()){
  const p=record.props;if(record.type==='TEXT'&&p.textAutoResize)n.textAutoResize=p.textAutoResize;if('layoutMode' in p){n.primaryAxisSizingMode=p.primaryAxisSizingMode;n.counterAxisSizingMode=p.counterAxisSizingMode;}
 }
 const component=created[0].n;
 const right=Math.max(0,...page.children.filter(n=>n!==component).map(n=>n.x+n.width));
 const set=figma.combineAsVariants([component],page);createdNodeIds.push(set.id);set.name=definition.name;set.description='按源 25795:66655 制作的本地可编辑副本；仅此1440/7项变体。临时 Noto 字体由用户桌面端处理。';set.layoutMode='NONE';component.x=24;component.y=24;set.resizeWithoutConstraints(1488,112);set.x=right+80;set.y=80;component.resize(definition.size[0],definition.size[1]);
 return {componentSetId:set.id,componentId:component.id,map,createdNodeIds,createdStyleIds,imageHash,pendingVectors:data.nodes.filter(n=>n.type==='VECTOR').map(n=>n.sourceId),fontSubstitution:'PingFang SC → Noto Sans SC；由用户桌面端处理'};
}
if(isMain(import.meta.url)){const [stage,fileKey,pageId,stateFile]=process.argv.slice(2);process.stdout.write(generate(stage,{fileKey,pageId},stateFile?JSON.parse(readFileSync(stateFile,'utf8')):{}));}
