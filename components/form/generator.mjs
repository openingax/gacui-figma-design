import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

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

// 内容修改策略与源尺寸模板分开：只在真实实例修改时启用，同一规则覆盖所有字段类型。
export async function fitFieldContent(figma,node,content){
 const source=content.sourceComponentId?await figma.getNodeByIdAsync(content.sourceComponentId):node.type==='INSTANCE'?await node.getMainComponentAsync():null;
 for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);
 const previousId=node.id;
 // 外置标签的源CENTER约束不能在实例中覆盖；适配长内容时显式本地化，再用同一排版规则。
 if(node.type==='INSTANCE'&&node.findAllWithCriteria({types:['TEXT']}).some(t=>t.name==='title'&&t.parent?.name==='label'&&t.parent.layoutPositioning==='ABSOLUTE'))node=node.detachInstance();
 if(content.width)node.resize(content.width,node.height);
 const texts=node.findAllWithCriteria({types:['TEXT']});
 const title=texts.find(t=>t.name==='title'&&t.parent?.name==='label');
 if(title&&title.parent.layoutPositioning!=='ABSOLUTE'&&source){
  const sourceTitle=source.findAllWithCriteria({types:['TEXT']}).find(t=>t.name==='title'&&t.parent?.name==='label');
  const owner=title.parent.parent,sourceOwner=sourceTitle?.parent.parent;
  // 默认保留控件源宽。实例里把控件改成FIXED会回到母组件宽度、resize不生效，所以与字段同宽时用FILL；其他宽度做不到就报错，不静默保留源宽。
  for(const control of owner.children.filter(c=>c!==title.parent&&c.name!=='item/form/help'&&c.name!=='item/form/help/medium')){const original=sourceOwner?.children.find(c=>c.name===control.name);if(!original)continue;const want=content.controlWidth??original.width;
   if(content.controlWidth!==undefined&&Math.abs(want-node.width)<0.5)control.layoutSizingHorizontal='FILL';else{control.layoutSizingHorizontal='FIXED';control.resize(want,original.height);}
   if(Math.abs(control.width-want)>0.5)throw Error(`控件 ${control.name} 无法设为 ${want} 宽（实际 ${control.width}），实例内只能与字段同宽或保留源宽`);}
 }
 if(title&&content.label!==undefined){title.characters=content.label;const label=title.parent;if(label.layoutPositioning==='ABSOLUTE')label.constraints={horizontal:'MIN',vertical:'MIN'};label.resize(label.layoutPositioning==='ABSOLUTE'?label.width:node.width,label.height);label.primaryAxisSizingMode='FIXED';label.counterAxisSizingMode='AUTO';const other=label.children.filter(n=>n!==title&&n.visible);const available=label.width-label.paddingLeft-label.paddingRight-other.reduce((s,n)=>s+n.width,0)-label.itemSpacing*other.length;
  // 外置标签保持源的右对齐并占满标签区。顶部标签：源为HUG，一行放得下时保持HUG；放不下才换行。源标题文字为RIGHT，换行后会贴右，顶部标签改为LEFT（设计判断，与创建工单页一致）。
  const wrap=()=>{title.textAutoResize='HEIGHT';title.resize(Math.max(1,available),title.height);title.layoutSizingHorizontal='FILL';};
  if(label.layoutPositioning==='ABSOLUTE')wrap();else{title.textAlignHorizontal='LEFT';title.textAutoResize='WIDTH_AND_HEIGHT';title.layoutSizingHorizontal='HUG';if(title.width>available+0.01)wrap();}}
 const help=texts.find(t=>t.name==='help');
 if(help&&content.help!==undefined){help.characters=content.help;const owner=help.parent;owner.resize(node.width,owner.height);owner.primaryAxisSizingMode='FIXED';owner.counterAxisSizingMode='AUTO';help.textAutoResize='HEIGHT';help.resize(node.width-owner.paddingLeft-owner.paddingRight,help.height);help.layoutSizingHorizontal='FILL';}
 // 含label+control的内层纵向容器也必须随长标题增长；控件本身的32/54高度保持不变。
 for(const n of [...node.findAll(n=>'layoutMode'in n&&n.layoutMode==='VERTICAL')].reverse())if(n.children.some(c=>c.name==='label'))n.primaryAxisSizingMode='AUTO';
 if(title?.parent.layoutPositioning==='ABSOLUTE'){const label=title.parent,owner=label.parent;label.y=5;owner.counterAxisAlignItems='MIN';owner.counterAxisSizingMode='FIXED';owner.layoutSizingVertical='FIXED';owner.resize(owner.width,Math.max(owner.height,5+label.height+(owner.paddingBottom||0)));label.y=5;
  for(const c of owner.children.filter(c=>c!==label&&c.layoutPositioning==='ABSOLUTE')){c.constraints={horizontal:'MIN',vertical:'MIN'};const original=source?.findAll(n=>n.name===c.name)[0];if(original){c.x=original.x;c.y=original.y;}}
 }
 if(node.layoutMode==='VERTICAL')node.primaryAxisSizingMode='AUTO';
 for(const n of [node,...node.findAll(()=>true)])if('strokes'in n){if(n.strokeStyleId)await n.setStrokeStyleIdAsync(n.strokeStyleId);else n.strokes=JSON.parse(JSON.stringify(n.strokes));}
 return {id:node.id,previousId,localized:node.id!==previousId,width:node.width,height:node.height,titleId:title?.id,helpId:help?.id};
}

export async function composeForm(figma,page,spec,created){
 async function fonts(node){for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);}
 function collect(node){created.push(node.id);if('findAll'in node)created.push(...node.findAll(()=>true).map(n=>n.id));}
 function frame(name,direction,width){const n=figma.createFrame();created.push(n.id);n.name=name;n.layoutMode=direction;n.fills=[];n.clipsContent=false;n.resize(width,1);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode=direction==='VERTICAL'?'FIXED':'AUTO';return n;}
 const mainNodes=new Map();for(const id of [...spec.fields.map(f=>f.componentId),...(spec.actions||[]).map(a=>a.componentId)]){const m=await figma.getNodeByIdAsync(id);if(m?.type!=='COMPONENT')throw Error('主组件不存在 '+id);await fonts(m);mainNodes.set(id,m);}
 const root=spec.asComponent?figma.createComponent():figma.createFrame();created.push(root.id);page.appendChild(root);root.name=spec.name;root.fills=[];root.clipsContent=false;root.layoutMode=spec.layout;root.resize(spec.width||spec.fields[0].width,1);root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode=spec.layout==='VERTICAL'?'FIXED':'AUTO';root.itemSpacing=(spec.actions||[]).length?(spec.controlsGap??8):(spec.fieldGap??0);
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
  if(f.content){const adapted=await fitFieldContent(figma,n,{sourceComponentId:f.componentId,...f.content});fields.push(adapted.id);if(adapted.localized)collect(await figma.getNodeByIdAsync(adapted.id));}else fields.push(n.id);
 }
 let controls=null;
 if((spec.actions||[]).length){controls=frame('controls','HORIZONTAL',136);root.appendChild(controls);controls.itemSpacing=16;controls.counterAxisSizingMode='AUTO';for(const action of spec.actions){const n=mainNodes.get(action.componentId).createInstance();controls.appendChild(n);collect(n);const t=n.findAllWithCriteria({types:['TEXT']})[0];if(t)t.characters=action.text;n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';}}
 if(spec.layout==='VERTICAL'){if(group!==root)group.layoutSizingHorizontal='FILL';if(controls)controls.layoutSizingHorizontal='FILL';}
 // 本地实例中保留样式绑定；所有resize完成后提交描边，避免旧轮廓缓存。
 for(const n of root.findAll(()=>true)){if(!('strokes'in n))continue;const style=n.strokeStyleId,paints=n.strokes;if(style)await n.setStrokeStyleIdAsync(style);else n.strokes=JSON.parse(JSON.stringify(paints));}
 root.x=spec.x??80;root.y=spec.y??1100;
 return {id:root.id,name:root.name,width:root.width,height:root.height,fields,controlsId:controls?.id??null};
}

export function generate(spec){
 validateSpec(spec);
 return `if(figma.fileKey!=='UNCONFIGURED_FIGMA_TARGET')throw Error('目标文件不符');const page=await figma.getNodeByIdAsync('112:92');await figma.setCurrentPageAsync(page);const spec=${JSON.stringify(spec)};if(page.children.some(n=>n.name===spec.name))throw Error('同名组合已存在');${fitFieldContent.toString()};${composeForm.toString()};const ids=[];const result=await composeForm(figma,page,spec,ids);return {...result,createdNodeIds:ids};`;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(generate(JSON.parse(readFileSync(process.argv[2],'utf8'))));
