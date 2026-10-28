import {validateInputField,renderInputField} from '../input/family.mjs';
import {validateRadio,renderRadio} from '../radio/generator.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isMain} from '../../support/entry.mjs';

// 字段由调用者选择已验证的本地主组件，业务数量/文字不来自源样例枚举。
export function validateSpec(spec){
 if(!spec||!Array.isArray(spec.fields)||!spec.fields.length)throw Error('需要非空字段数组');
 if(typeof spec.name!=='string'||!spec.name.trim())throw Error('需要组合名称');
 if(!['VERTICAL','HORIZONTAL'].includes(spec.layout))throw Error('未知布局');
 for(const f of spec.fields)if(!/^\d+:\d+$/.test(f.componentId)||!(f.width>0)||!Number.isFinite(f.width))throw Error('字段组件或宽度无效');
 if(spec.actions&&!Array.isArray(spec.actions))throw Error('操作区需要按钮数组');
 for(const a of spec.actions||[])if(!/^\d+:\d+$/.test(a.componentId)||typeof a.text!=='string')throw Error('操作按钮无效');
 for(const key of ['fieldGap','controlsGap'])if(spec[key]!==undefined&&(!Number.isFinite(spec[key])||spec[key]<0))throw Error('间距无效');
 return spec;
}

export function cloneSnapshotValue(value){return value==null?value:JSON.parse(JSON.stringify(value));}
export function subtreeNodes(node){return [node,...(typeof node.findAll==='function'?node.findAll(()=>true):[])];}
export function captureNodeRecord(node){
 const SNAP_KEYS=['x','y','width','height','visible','layoutMode','layoutPositioning','layoutSizingHorizontal','layoutSizingVertical','primaryAxisSizingMode','counterAxisSizingMode','counterAxisAlignItems','textAlignHorizontal','textAutoResize','characters','strokeStyleId'];
 const record={id:node.id??null,parentId:node.parent?.id??null,type:node.type??null,name:node.name??null};
 for(const key of SNAP_KEYS) if(key in node) record[key]=node[key];
 if('constraints' in node&&node.constraints) record.constraints=cloneSnapshotValue(node.constraints);
 if('strokes' in node) record.strokes=cloneSnapshotValue(node.strokes);
 return record;
}
export function owningBoardOf(node){
 let board=node;
 while(board?.parent&&board.parent.type!=='PAGE')board=board.parent;
 if(!board?.parent||board.parent.type!=='PAGE')return null;
 return board;
}
export function isUnderBoardNode(node,board){
 let current=node;
 while(current){if(current.id===board?.id)return true;current=current.parent;}
 return false;
}
export function captureBoardLayout(fieldNode){
 const board=owningBoardOf(fieldNode);
 if(!board)return [];
 const records=[];
 const seen=new Set();
 let node=fieldNode;
 while(node){
  for(const child of node.parent?.children||[]){
   if(!child?.id||seen.has(child.id))continue;
   seen.add(child.id);
   records.push({id:child.id,parentId:child.parent?.id??null,name:child.name??null,x:child.x,y:child.y,width:child.width,height:child.height});
  }
  if(node===board)break;
  node=node.parent;
 }
 return records;
}
export function captureFieldSnapshot(fieldNode){
 const popup=resolveOpenPopup(fieldNode)?.popup??null;
 const popupNodes=popup?subtreeNodes(popup).filter(node=>node!==fieldNode):[];
 return {fieldId:fieldNode.id,nodes:subtreeNodes(fieldNode).map(captureNodeRecord),popupNodes:popupNodes.map(captureNodeRecord),boardLayout:captureBoardLayout(fieldNode)};
}
export function assertScopeUnprotected(snapshot,protectedIds){
 if(!protectedIds)return;
 const hit=[...snapshot.nodes,...snapshot.popupNodes].filter(node=>node.id&&protectedIds.includes(node.id));
 if(hit.length)throw Error('保护节点在编辑范围内 '+hit.map(node=>node.id).join(','));
}
export function snapshotsEqual(left,right){return JSON.stringify(left.nodes)===JSON.stringify(right.nodes)&&JSON.stringify(left.popupNodes)===JSON.stringify(right.popupNodes)&&JSON.stringify(left.boardLayout)===JSON.stringify(right.boardLayout);}
export async function assertSnapshotRestorable(figma,snapshot,context={}){
 if(!snapshot?.fieldId||!Array.isArray(snapshot.nodes)||!snapshot.nodes.length)throw Error('完整快照无效');
 if(snapshot.nodes[0].id!==snapshot.fieldId)throw Error('快照字段身份不符');
 if(context.fieldId&&context.fieldId!==snapshot.fieldId)throw Error('快照字段身份不符');
 const records=[...snapshot.nodes,...(snapshot.popupNodes||[])];
 const seen=new Set();
 for(const record of records){
  if(!record?.id)throw Error('快照节点缺少身份');
  if(seen.has(record.id))throw Error('快照节点重复 '+record.id);
  seen.add(record.id);
 }
 const field=await figma.getNodeByIdAsync(snapshot.fieldId);
 if(!field||field.id!==snapshot.fieldId)throw Error('恢复节点不存在 '+snapshot.fieldId);
 const board=context.board||owningBoardOf(field);
 if(!board||!isUnderBoardNode(field,board))throw Error('恢复节点不在指定画板 '+snapshot.fieldId);
 const liveFieldIds=new Set(subtreeNodes(field).map(node=>node.id));
 if(snapshot.nodes.length!==liveFieldIds.size||snapshot.nodes.some(record=>!liveFieldIds.has(record.id)))throw Error('快照字段集合不符');
 for(const record of snapshot.nodes){
  const node=await figma.getNodeByIdAsync(record.id);
  if(!node)throw Error('恢复节点不存在 '+record.id);
  if(node.type!==record.type)throw Error('恢复节点类型不符 '+record.id);
  if((node.parent?.id??null)!==record.parentId)throw Error('恢复节点被重挂 '+record.id);
  if(!isUnderBoardNode(node,board))throw Error('恢复节点不在指定画板 '+record.id);
  if(context.protectedIds?.includes(node.id))throw Error('保护节点在编辑范围内 '+node.id);
 }
 const popupName='多选展开/'+snapshot.nodes[0].name;
 if(snapshot.popupNodes?.length){
  if(snapshot.popupNodes[0].name!==popupName)throw Error('弹层身份不符');
  const popup=await figma.getNodeByIdAsync(snapshot.popupNodes[0].id);
  if(!popup||popup.name!==popupName)throw Error('弹层身份不符');
  const livePopupIds=new Set(subtreeNodes(popup).map(node=>node.id));
  if(snapshot.popupNodes.length!==livePopupIds.size||snapshot.popupNodes.some(record=>!livePopupIds.has(record.id)))throw Error('快照弹层集合不符');
  for(const record of snapshot.popupNodes){
   const node=await figma.getNodeByIdAsync(record.id);
   if(!node)throw Error('恢复节点不存在 '+record.id);
   if(node.type!==record.type)throw Error('恢复节点类型不符 '+record.id);
   if((node.parent?.id??null)!==record.parentId)throw Error('恢复节点被重挂 '+record.id);
   if(!isUnderBoardNode(node,board))throw Error('弹层不在指定画板 '+record.id);
   if(context.protectedIds?.includes(node.id))throw Error('保护节点在编辑范围内 '+node.id);
  }
 }
}
export async function restoreFieldSnapshot(figma,snapshot,context={}){
 await assertSnapshotRestorable(figma,snapshot,context);
 const sameNumber=(left,right)=>typeof left==='number'&&typeof right==='number'&&Math.abs(left-right)<1e-4;
 const sameValue=(left,right)=>typeof left==='number'||typeof right==='number'?sameNumber(left,right):JSON.stringify(left)===JSON.stringify(right);
 const records=[...snapshot.nodes,...(snapshot.popupNodes||[])];
 const affectedNodeIds=records.map(record=>record.id);
 const mutatedNodeIds=[];
 const mark=id=>{if(id&&!mutatedNodeIds.includes(id))mutatedNodeIds.push(id);};
 const fail=(id,key,error)=>{
  // 抛错的 setter 可能已经改了一部分，也可能完全没改成。记入 mutated 是保守范围，不证明该属性已经变成快照值。
  mark(id);
  const wrapped=Error('恢复节点 '+id+' 的 '+key+' 无法写回：'+error.message);
  wrapped.affectedNodeIds=affectedNodeIds.slice();
  wrapped.mutatedNodeIds=mutatedNodeIds.slice();
  throw wrapped;
 };
 const write=async(node,key,value,id)=>{
  if(!(key in node)||sameValue(node[key],value))return;
  try{node[key]=value;mark(id);}
  catch(error){fail(id,key,error);}
 };
 const nodes=new Map();
 for(const record of records){
  const node=await figma.getNodeByIdAsync(record.id);
  if(!node)throw Error('恢复节点不存在 '+record.id);
  nodes.set(record.id,node);
  const sizeWouldChange=typeof node.resize==='function'&&Number.isFinite(record.width)&&Number.isFinite(record.height)&&(!sameNumber(node.width,record.width)||!sameNumber(node.height,record.height));
  const textWouldChange=node.type==='TEXT'&&(
   ('characters' in record&&!sameValue(node.characters,record.characters))
   ||('textAutoResize' in record&&'textAutoResize' in node&&!sameValue(node.textAutoResize,record.textAutoResize))
   ||('textAlignHorizontal' in record&&'textAlignHorizontal' in node&&!sameValue(node.textAlignHorizontal,record.textAlignHorizontal))
   ||sizeWouldChange);
  if(textWouldChange&&typeof node.getStyledTextSegments==='function')for(const segment of node.getStyledTextSegments(['fontName']))await figma.loadFontAsync(segment.fontName);
 }
 for(const record of records){
  const node=nodes.get(record.id);
  const parent=node.parent;
  const inFlow=!!parent&&(parent.layoutMode==='HORIZONTAL'||parent.layoutMode==='VERTICAL')&&node.layoutPositioning!=='ABSOLUTE';
  const hasH='layoutSizingHorizontal' in node,hasV='layoutSizingVertical' in node;
  const sizeDiffers=typeof node.resize==='function'&&Number.isFinite(record.width)&&Number.isFinite(record.height)&&(!sameNumber(node.width,record.width)||!sameNumber(node.height,record.height));
  if(sizeDiffers){
   if(hasH)await write(node,'layoutSizingHorizontal','FIXED',record.id);
   if(hasV)await write(node,'layoutSizingVertical','FIXED',record.id);
   try{node.resize(record.width,record.height);mark(record.id);}
   catch(error){fail(record.id,'resize',error);}
  }
  if(!inFlow){if('x' in record)await write(node,'x',record.x,record.id);if('y' in record)await write(node,'y',record.y,record.id);}
  const laid=node.layoutMode==='HORIZONTAL'||node.layoutMode==='VERTICAL';
  if(laid&&'primaryAxisSizingMode' in record)await write(node,'primaryAxisSizingMode',record.primaryAxisSizingMode,record.id);
  if(laid&&'counterAxisSizingMode' in record)await write(node,'counterAxisSizingMode',record.counterAxisSizingMode,record.id);
  if(laid&&'counterAxisAlignItems' in record)await write(node,'counterAxisAlignItems',record.counterAxisAlignItems,record.id);
  if(parent?.layoutMode&&'layoutSizingHorizontal' in record)await write(node,'layoutSizingHorizontal',record.layoutSizingHorizontal,record.id);
  if(parent?.layoutMode&&'layoutSizingVertical' in record)await write(node,'layoutSizingVertical',record.layoutSizingVertical,record.id);
  if(node.type==='TEXT'){
   if('characters' in record)await write(node,'characters',record.characters,record.id);
   if('textAutoResize' in record)await write(node,'textAutoResize',record.textAutoResize,record.id);
   if('textAlignHorizontal' in record)await write(node,'textAlignHorizontal',record.textAlignHorizontal,record.id);
   if(parent?.layoutMode&&'layoutSizingHorizontal' in record)await write(node,'layoutSizingHorizontal',record.layoutSizingHorizontal,record.id);
  }
  if(node.layoutPositioning==='ABSOLUTE'&&record.constraints)await write(node,'constraints',cloneSnapshotValue(record.constraints),record.id);
  if(record.strokeStyleId&&typeof node.setStrokeStyleIdAsync==='function'&&!sameValue(node.strokeStyleId,record.strokeStyleId)){
   try{await node.setStrokeStyleIdAsync(record.strokeStyleId);mark(record.id);}
   catch(error){fail(record.id,'strokeStyleId',error);}
  }else if('strokes' in node&&record.strokes&&!sameValue(node.strokes,record.strokes))await write(node,'strokes',cloneSnapshotValue(record.strokes),record.id);
 }
 return {affectedNodeIds,mutatedNodeIds};
}
export function readProtectedTargetIds(){throw Error('请从当前授权目标回执显式提供保护集合');}

// 内容修改策略与源尺寸模板分开：只在真实实例修改时启用，同一规则覆盖所有字段类型。
export function preflightFieldContent(node,content){
 // Upload 的入口说明和附件文件名都可能叫 tips；未完成真实换行/恢复验证前，不按名称猜测编辑目标。
 // 既有抽屉 Upload 由独立构建路径处理，不依赖此处的原位内容编辑。
 if((node.children||[]).some(child=>child.name==='上传入口')&&(content.label!==undefined||content.help!==undefined))throw Error('Upload 原位内容编辑尚未验证，已隔离；保留当前字段');
 const fieldWidth=content.width||node.width;
 // 实例内仅支持与字段同宽或省略以保留源宽；其他宽度无法可靠设置，必须在改写前拒绝，避免半截修改残留。
 if(content.controlWidth!==undefined&&Math.abs(content.controlWidth-fieldWidth)>=0.5)throw Error(`控件宽度 ${content.controlWidth} 不受支持，实例内只能与字段同宽（${fieldWidth}）或保留源宽`);
 return fieldWidth;
}

export async function prepareFieldContent(figma,node,content){
 const fieldWidth=preflightFieldContent(node,content);
 const source=content.sourceComponentId?await figma.getNodeByIdAsync(content.sourceComponentId):node.type==='INSTANCE'?await node.getMainComponentAsync():null;
 for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);
 return {source,fieldWidth};
}

// 共用排版规则：已有内容按快照恢复；新建范围失败时移除本次根节点。
export async function applyFieldContent(figma,node,content,options,source,fieldWidth,state){
 const previousId=node.id;
 // 外置标签的源CENTER约束不能在实例中覆盖；适配长内容时显式本地化，再用同一排版规则。
 if(node.type==='INSTANCE'&&node.findAllWithCriteria({types:['TEXT']}).some(t=>t.name==='title'&&t.parent?.name==='label'&&t.parent.layoutPositioning==='ABSOLUTE')){state.started=true;node=node.detachInstance();state.detached=true;}
 if(content.width){state.started=true;node.resize(content.width,node.height);}
 const texts=node.findAllWithCriteria({types:['TEXT']});
 const title=texts.find(t=>t.name==='title'&&t.parent?.name==='label');
 if(title&&title.parent.layoutPositioning!=='ABSOLUTE'&&source){
  const sourceTitle=source.findAllWithCriteria({types:['TEXT']}).find(t=>t.name==='title'&&t.parent?.name==='label');
  const owner=title.parent.parent,sourceOwner=sourceTitle?.parent.parent;
  // 默认保留控件源宽。实例里把控件改成FIXED会回到母组件宽度、resize不生效，所以与字段同宽时用FILL；其他宽度做不到就报错，不静默保留源宽。
  for(const control of owner.children.filter(c=>c.id!==title.parent.id&&c.name!=='item/form/help'&&c.name!=='item/form/help/medium')){const original=sourceOwner?.children.find(c=>c.name===control.name);if(!original)continue;const want=content.controlWidth??original.width;
   state.started=true;if(content.controlWidth!==undefined&&Math.abs(want-fieldWidth)<0.5)control.layoutSizingHorizontal='FILL';else{control.layoutSizingHorizontal='FIXED';control.resize(want,original.height);}
   if(Math.abs(control.width-want)>0.5)throw Error(`控件 ${control.name} 无法设为 ${want} 宽（实际 ${control.width}），实例内只能与字段同宽或保留源宽`);}
 }
 if(title&&content.label!==undefined){state.started=true;title.characters=content.label;const label=title.parent;if(label.layoutPositioning==='ABSOLUTE')label.constraints={horizontal:'MIN',vertical:'MIN'};const labelWidth=label.layoutPositioning==='ABSOLUTE'?label.width:fieldWidth;label.resize(labelWidth,label.height);label.primaryAxisSizingMode='FIXED';label.counterAxisSizingMode='AUTO';const other=label.children.filter(n=>n.id!==title.id&&n.visible);const available=labelWidth-label.paddingLeft-label.paddingRight-other.reduce((s,n)=>s+n.width,0)-label.itemSpacing*other.length;
  // 外置标签保持源的右对齐并占满标签区。顶部标签：源为HUG，一行放得下时保持HUG；放不下才换行。源标题文字为RIGHT，换行后会贴右，顶部标签改为LEFT（设计判断，与创建工单页一致）。
  const wrap=()=>{title.textAutoResize='HEIGHT';title.resize(Math.max(1,available),title.height);title.layoutSizingHorizontal='FILL';};
  if(label.layoutPositioning==='ABSOLUTE')wrap();else{title.textAlignHorizontal='LEFT';title.textAutoResize='WIDTH_AND_HEIGHT';title.layoutSizingHorizontal='HUG';if(title.width>available+0.01)wrap();}
  if(options.faultInjection==='after-title-write')throw Error('验证注入：标题写入后失败');}
 const help=texts.find(t=>t.name==='help');
 if(help&&content.help!==undefined){state.started=true;help.characters=content.help;const owner=help.parent;owner.resize(fieldWidth,owner.height);owner.primaryAxisSizingMode='FIXED';owner.counterAxisSizingMode='AUTO';help.textAutoResize='HEIGHT';help.resize(fieldWidth-owner.paddingLeft-owner.paddingRight,help.height);help.layoutSizingHorizontal='FILL';}
 // 含label+control的内层纵向容器也必须随长标题增长；控件本身的32/54高度保持不变。
 for(const n of [...node.findAll(n=>'layoutMode'in n&&n.layoutMode==='VERTICAL')].reverse())if(n.children.some(c=>c.name==='label')){state.started=true;n.primaryAxisSizingMode='AUTO';}
 if(title?.parent.layoutPositioning==='ABSOLUTE'){const label=title.parent,owner=label.parent;
  // 回缩以源控件高度为下限，不能把上一次长标题撑出的高度作为新的最小值。
  const sourceTitle=source?.findAllWithCriteria({types:['TEXT']}).find(t=>t.name==='title'&&t.parent?.name==='label');
  const baseHeight=sourceTitle?.parent.parent.height??owner.height;
  state.started=true;label.y=5;owner.counterAxisAlignItems='MIN';owner.counterAxisSizingMode='FIXED';owner.layoutSizingVertical='FIXED';owner.resize(owner.width,Math.max(baseHeight,5+label.height+(owner.paddingBottom||0)));label.y=5;
  for(const c of owner.children.filter(c=>c.id!==label.id&&c.layoutPositioning==='ABSOLUTE')){c.constraints={horizontal:'MIN',vertical:'MIN'};const original=source?.findAll(n=>n.name===c.name)[0];if(original){c.x=original.x;c.y=original.y;}}
 }
 if(node.layoutMode==='VERTICAL'){state.started=true;node.primaryAxisSizingMode='AUTO';}
 for(const n of [node,...node.findAll(()=>true)])if('strokes'in n){state.started=true;if(n.strokeStyleId)await n.setStrokeStyleIdAsync(n.strokeStyleId);else n.strokes=JSON.parse(JSON.stringify(n.strokes));}
 return {id:node.id,previousId,localized:node.id!==previousId,width:node.width,height:node.height,titleId:title?.id,helpId:help?.id,popup:null,transactionRollbackAttempted:false,transactionRollbackExecuted:false};
}

export async function fitFieldContent(figma,node,content,options={}){
 preflightFieldContent(node,content);
 resolveOpenPopup(node);
 const {source,fieldWidth}=await prepareFieldContent(figma,node,content);
 const snapshot=captureFieldSnapshot(node);
 if(options.protectedIds)assertScopeUnprotected(snapshot,options.protectedIds);
 const state={started:false,detached:false};
 try{
  const result=await applyFieldContent(figma,node,content,options,source,fieldWidth,state);
  state.started=true;result.popup=anchorOpenPopup(await figma.getNodeByIdAsync(result.id)??node);
  return result;
 }catch(error){
  if(!state.started){error.transactionRollbackAttempted=false;error.transactionRollbackExecuted=false;throw error;}
  error.transactionRollbackAttempted=true;
  error.fullSnapshot=snapshot;
  if(state.detached){error.transactionRollbackExecuted=false;error.restoreError='detach 后身份已变化，不能自动回滚';throw error;}
  try{
   await restoreFieldSnapshot(figma,snapshot,{board:owningBoardOf(node),protectedIds:options.protectedIds||[],fieldId:snapshot.fieldId});
   const live=await figma.getNodeByIdAsync(snapshot.fieldId);
   if(!live||live.id!==snapshot.fieldId)throw Error('恢复后字段身份不符');
   if(!snapshotsEqual(snapshot,captureFieldSnapshot(live)))throw Error('自动恢复未完成');
   error.transactionRollbackExecuted=true;
   error.restoreError=null;
  }catch(restoreErr){
   error.transactionRollbackExecuted=false;
   error.restoreError=String(restoreErr);
  }
  throw error;
 }
}


// 仅供 composeForm 适配本次新根节点中已登记的新实例。
export async function fitCreatedFieldContent(figma,node,content,root,created,protectedIds=[]){
 if(!created.includes(root.id)||!created.includes(node.id))throw Error('新建字段缺少本次创建身份');
 let parent=node;while(parent&&parent.id!==root.id)parent=parent.parent;
 if(!parent)throw Error('新建字段不属于本次容器');
 if([root,...subtreeNodes(node)].some(n=>protectedIds.includes(n.id)))throw Error('新建字段命中保护节点');
 const {source,fieldWidth}=await prepareFieldContent(figma,node,content);
 return applyFieldContent(figma,node,content,{},source,fieldWidth,{started:false,detached:false});
}

export function resolveOpenPopup(fieldNode){
 const pureTranslation=node=>{const matrices=[node?.absoluteTransform,node?.relativeTransform].filter(Boolean);return matrices.every(t=>Array.isArray(t)&&t.length>=2&&Math.abs(t[0][0]-1)<1e-4&&Math.abs(t[0][1])<1e-4&&Math.abs(t[1][0])<1e-4&&Math.abs(t[1][1]-1)<1e-4);};
 if(!fieldNode?.name)return null;
 let board=fieldNode;
 while(board?.parent&&board.parent.type!=='PAGE')board=board.parent;
 if(!board?.parent||board.parent.type!=='PAGE'||typeof board.findAll!=='function')return null;
 const popupName='多选展开/'+fieldNode.name;
 const matches=board.findAll(n=>n!==fieldNode&&n.name===popupName);
 if(!matches.length)return null;
 if(matches.length>1)throw Error('同名弹层重复 '+popupName);
 const popup=matches[0];
 const boxes=[fieldNode,...(typeof fieldNode.findAll==='function'?fieldNode.findAll(n=>n?.children?.some(c=>c.name==='label')):[])];
 const box=boxes.find(n=>n.children?.some(c=>c.name==='label'));
 const control=box?.children.find(c=>c.name!=='label'&&c.name!=='item/form/help'&&c.name!=='item/form/help/medium');
 const area=control?.absoluteBoundingBox,origin=popup.parent?.absoluteBoundingBox;
 if(!area||!origin||!popup.parent)throw Error('弹层父级坐标不可用');
 if(!pureTranslation(popup.parent))throw Error('弹层父级变换不支持');
 return {popup,x:area.x-origin.x,y:area.y-origin.y+control.height+4};
}
export function anchorOpenPopup(fieldNode){
 const target=resolveOpenPopup(fieldNode);
 if(!target)return null;
 const {popup,x,y}=target;
 const previous={id:popup.id,x:popup.x,y:popup.y,width:popup.width,height:popup.height};
 popup.x=x;
 popup.y=y;
 return {id:popup.id,previous,x:popup.x,y:popup.y};
}

export function serializedFitFieldContent(){
 return [cloneSnapshotValue,subtreeNodes,captureNodeRecord,owningBoardOf,isUnderBoardNode,captureBoardLayout,captureFieldSnapshot,assertScopeUnprotected,snapshotsEqual,assertSnapshotRestorable,restoreFieldSnapshot,resolveOpenPopup,anchorOpenPopup,preflightFieldContent,prepareFieldContent,applyFieldContent,fitFieldContent].map(fn=>fn.toString()).join('\n');
}
// 按前缀无损分组，只压缩重复字符，不减少保护成员。
export function protectedIdsExpression(ids){
 const groups={};for(const id of ids){if(!/^\d+:\d+$/.test(id))throw Error('保护ID格式');const [p,n]=id.split(':');(groups[p]??=[]).push(Number(n));}
 return 'Object.entries('+JSON.stringify(groups)+').flatMap(([p,ns])=>ns.map(n=>p+":"+n))';
}
// 新建画板失败只清理本次创建对象；绝不清理既有根节点。
export async function createFormBoard(figma,req,lib,render){
 if(figma.fileKey!==req.fileKey||req.protectedPages.includes(req.pageName))throw Error('新建表单目标不符');
 const pages=figma.root.children.filter(p=>p.name===req.pageName);
 if(pages.length>1)throw Error('同名Page不唯一');
 const before=new Set((pages[0]?.children??[]).map(n=>n.id));
 try{return await render(figma,req,lib);}catch(error){
  const page=figma.root.children.find(p=>p.name===req.pageName),removed=[];
  for(const node of [...(page?.children??[])])if(!before.has(node.id)){
   try{removed.push(...subtreeNodes(node).map(n=>n.id));node.remove();}catch(cleanup){error.cleanupError=String(cleanup);}
  }
  error.removedNodeIds=removed;
  throw error;
 }
}
export function formCreationSource(){
 return [subtreeNodes,preflightFieldContent,prepareFieldContent,applyFieldContent,fitCreatedFieldContent,composeForm,createFormBoard].map(fn=>fn.toString()).join('\n');
}
export function formCreationSources(){
 return {creation:{source:formCreationSource(),names:['composeForm','createFormBoard']},input:{source:[validateInputField,renderInputField].map(f=>f.toString()).join('\n'),names:['validateInputField','renderInputField']},radio:{source:[validateRadio,renderRadio].map(f=>f.toString()).join('\n'),names:['validateRadio','renderRadio']}};
}
export function serializedFormCreation(part='creation'){
 const group=formCreationSources()[part];if(!group)throw Error('未知Form构建依赖');
 const artifact=JSON.parse(readFileSync(new URL('./creation-runtime.json',import.meta.url),'utf8')).groups[part];
 const hash=createHash('sha256').update(group.source).digest('hex');
 if(artifact.sourceHash!==hash)throw Error('Form构建缓存过期，请运行 scripts/form/compile-creation.mjs');
 return artifact.code;
}
export function serializedSnapshotCompare(){
 return [cloneSnapshotValue,subtreeNodes,captureNodeRecord,owningBoardOf,isUnderBoardNode,captureBoardLayout,captureFieldSnapshot,snapshotsEqual,resolveOpenPopup].map(fn=>fn.toString()).join('\n');
}
export function serializedFieldRestore(){
 return [cloneSnapshotValue,subtreeNodes,owningBoardOf,isUnderBoardNode,assertSnapshotRestorable,restoreFieldSnapshot].map(fn=>fn.toString()).join('\n');
}

export async function composeForm(figma,page,spec,created,protectedIds=[]){
 async function fonts(node){for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);}
 function collect(node){created.push(node.id);if('findAll'in node)created.push(...node.findAll(()=>true).map(n=>n.id));}
 function frame(name,direction,width){const n=figma.createFrame();created.push(n.id);n.name=name;n.layoutMode=direction;n.fills=[];n.clipsContent=false;n.resize(width,1);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode=direction==='VERTICAL'?'FIXED':'AUTO';return n;}
 const mainNodes=new Map();for(const id of [...spec.fields.map(f=>f.componentId),...(spec.actions||[]).map(a=>a.componentId)]){const m=await figma.getNodeByIdAsync(id);if(m?.type!=='COMPONENT')throw Error('主组件不存在 '+id);await fonts(m);mainNodes.set(id,m);}
 const root=spec.asComponent?figma.createComponent():figma.createFrame();created.push(root.id);
 try{
 page.appendChild(root);root.name=spec.name;root.fills=[];root.clipsContent=false;root.layoutMode=spec.layout;root.resize(spec.width||spec.fields[0].width,1);root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode=spec.layout==='VERTICAL'?'FIXED':'AUTO';root.itemSpacing=(spec.actions||[]).length?(spec.controlsGap??8):(spec.fieldGap??0);
 const group=(spec.actions||[]).length?frame('form',spec.layout,spec.width||spec.fields[0].width):root;
 if(group!==root)root.appendChild(group);group.itemSpacing=spec.fieldGap??0;
 const fields=[];
 for(const f of spec.fields){
  let owner=group;
  if(f.topLabel!==undefined){owner=frame('顶部标签字段', 'VERTICAL',f.width);group.appendChild(owner);owner.itemSpacing=0;
   const template=await figma.getNodeByIdAsync(spec.labelTemplateId);if(!template)throw Error('标签模板缺失');await fonts(template);const label=template.clone();owner.appendChild(label);collect(label);label.resize(f.width,30);label.layoutSizingHorizontal='FILL';
   const t=label.findAllWithCriteria({types:['TEXT']}).find(t=>t.name==='title');t.componentPropertyReferences={};t.characters=f.topLabel;
  }
  const n=mainNodes.get(f.componentId).createInstance();owner.appendChild(n);collect(n);n.resize(f.width,n.height);n.name=f.name||n.name;
  if(f.properties)n.setProperties(f.properties);
  if(f.content){const adapted=await fitCreatedFieldContent(figma,n,{sourceComponentId:f.componentId,...f.content},root,created,protectedIds);fields.push(adapted.id);if(adapted.localized)collect(await figma.getNodeByIdAsync(adapted.id));}else fields.push(n.id);
 }
 let controls=null;
 if((spec.actions||[]).length){controls=frame('controls','HORIZONTAL',136);root.appendChild(controls);controls.itemSpacing=16;controls.counterAxisSizingMode='AUTO';for(const action of spec.actions){const n=mainNodes.get(action.componentId).createInstance();controls.appendChild(n);collect(n);const t=n.findAllWithCriteria({types:['TEXT']})[0];if(t)t.characters=action.text;n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';}}
 if(spec.layout==='VERTICAL'){if(group!==root)group.layoutSizingHorizontal='FILL';if(controls)controls.layoutSizingHorizontal='FILL';}
 // 本地实例中保留样式绑定；所有resize完成后提交描边，避免旧轮廓缓存。
 for(const n of root.findAll(()=>true)){if(!('strokes'in n))continue;const style=n.strokeStyleId,paints=n.strokes;if(style)await n.setStrokeStyleIdAsync(style);else n.strokes=JSON.parse(JSON.stringify(paints));}
 root.x=spec.x??80;root.y=spec.y??1100;
 return {id:root.id,name:root.name,width:root.width,height:root.height,fields,controlsId:controls?.id??null};
 }catch(error){
  // 可移除根节点只由上文新建，不能使用调用者传入的节点。
  const removedNodeIds=subtreeNodes(root).map(n=>n.id);
  try{root.remove();error.removedNodeIds=removedNodeIds;}catch(cleanup){error.cleanupError=String(cleanup);}
  throw error;
 }
}

export function generate(spec){
 validateSpec(spec);
 return `if(figma.fileKey!=='UNCONFIGURED_FIGMA_TARGET')throw Error('目标文件不符');const page=await figma.getNodeByIdAsync('112:92');await figma.setCurrentPageAsync(page);const spec=${JSON.stringify(spec)};if(page.children.some(n=>n.name===spec.name))throw Error('同名组合已存在');${serializedFormCreation()};const ids=[];const result=await composeForm(figma,page,spec,ids);return {...result,createdNodeIds:ids};`;
}
if(isMain(import.meta.url))process.stdout.write(generate(JSON.parse(readFileSync(process.argv[2],'utf8'))));
