// 本模块只使用真实盘点/导入的主组件；不包含历史目标 ID 或业务基线。
export async function composeNative(figma,req){
 if(figma.fileKey!==req.fileKey)throw Error('目标文件不符');
 const masters={};
 for(const [role,b] of Object.entries(req.bindings)){
  const n=b.fileKey===req.fileKey&&b.origin!=='library'?await figma.getNodeByIdAsync(b.id):await figma.importComponentByKeyAsync(b.key);
  if(!n||n.type!=='COMPONENT')throw Error('主组件不可用：'+role);
  if((b.fileKey!==req.fileKey||b.origin==='library')&&n.key!==b.key)throw Error('导入组件身份不符');
  for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);
  masters[role]=n;
 }
 for(const item of req.layout.items)for(const [name,value] of Object.entries(item.text??{})){
  const texts=masters[item.role].findAllWithCriteria({types:['TEXT']}).filter(t=>t.name===name);
  if(texts.length!==1||typeof value!=='string')throw Error('文字层缺失/重名：'+name);
 }
 const pageName='GACUI · '+req.sessionId;
 let page,pageCreated=false;
 if(req.pageId){page=await figma.getNodeByIdAsync(req.pageId);if(!page||page.type!=='PAGE'||page.name!==pageName)throw Error('原接入Page不符，请重新核验');}
 else{const matches=figma.root.children.filter(p=>p.name===pageName);if(matches.length>1)throw Error('接入Page重名');pageCreated=!matches.length;page=matches[0]??figma.createPage();page.name=pageName;}
 await figma.setCurrentPageAsync(page);
 const name='GACUI · '+req.sessionId+' · '+req.layout.id;
 const matches=page.children.filter(n=>n.name===name);if(matches.length>1)throw Error('画板重名');
 let frame=matches[0],created=false;
 if(!frame){
  frame=figma.createAutoLayout(req.layout.direction);page.appendChild(frame);frame.name=name;frame.fills=[];frame.itemSpacing=req.layout.gap;
  frame.x=Math.max(80,...page.children.filter(n=>n!==frame).map(n=>n.x+n.width+80));frame.y=80;
  frame.primaryAxisSizingMode='AUTO';frame.counterAxisSizingMode='AUTO';
  for(const [index,item] of req.layout.items.entries()){
   const n=masters[item.role].createInstance();frame.appendChild(n);n.name=item.role+' · '+index;
   for(const [name,value] of Object.entries(item.text??{})){const t=n.findAllWithCriteria({types:['TEXT']}).find(t=>t.name===name);for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);t.characters=value;}
  }
  created=true;
 }
 if(frame.type!=='FRAME'||frame.children.length!==req.layout.items.length||frame.layoutMode!==req.layout.direction||frame.itemSpacing!==req.layout.gap)throw Error('现有画板结构已变化，先回读再修改');
 const instances=[],fontFamilies=new Set();
 for(const [index,item] of req.layout.items.entries()){
  const n=frame.children[index];if(n.type!=='INSTANCE'||n.name!==item.role+' · '+index)throw Error('实例位置或角色不符');
  const main=await n.getMainComponentAsync();if(!main||main.id!==masters[item.role].id)throw Error('主组件引用不符');
  for(const [name,value] of Object.entries(item.text??{})){const found=n.findAllWithCriteria({types:['TEXT']}).filter(t=>t.name===name);if(found.length!==1||found[0].characters!==value)throw Error('已有文字与预期不同，先回读再原位修改');}
  for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fontFamilies.add(s.fontName.family);
  instances.push({role:item.role,id:n.id,type:n.type,componentId:main.id,componentKey:main.key,width:n.width,height:n.height,textLayers:n.findAllWithCriteria({types:['TEXT']}).map(t=>({id:t.id,name:t.name,text:t.characters}))});
 }
 return {status:'verified',sessionId:req.sessionId,fileKey:figma.fileKey,pageId:page.id,frameId:frame.id,created,instances,fontFamilies:[...fontFamilies],width:frame.width,height:frame.height,createdNodeIds:[...(pageCreated?[page.id]:[]),...(created?[frame.id,...frame.findAll(()=>true).map(n=>n.id)]:[])]};
}
export async function editNativeText(figma,req){
 if(figma.fileKey!==req.fileKey)throw Error('目标文件不符');
 const page=await figma.getNodeByIdAsync(req.pageId);if(!page||page.type!=='PAGE'||page.name!=='GACUI · '+req.sessionId)throw Error('接入Page不符');await figma.setCurrentPageAsync(page);
 const changes=[];
 for(const edit of req.edits){
  const n=await figma.getNodeByIdAsync(edit.instanceId);let root=n;while(root?.parent&&root.parent!==page)root=root.parent;
  if(!n||n.type!=='INSTANCE'||root?.parent!==page||!root.name.startsWith('GACUI · '+req.sessionId+' · '))throw Error('修改节点不属于本次接入');
  const matches=n.findAllWithCriteria({types:['TEXT']}).filter(t=>t.name===edit.layer);if(matches.length!==1)throw Error('文字层缺失或重名');const t=matches[0];
  if(t.characters!==edit.before&&t.characters!==edit.after)throw Error('文字已被其他人修改，未覆盖');
  for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);changes.push({t,after:edit.after});
 }
 const changed=[];for(const {t,after} of changes){if(t.characters!==after){t.characters=after;changed.push(t.id);}}
 return {fileKey:figma.fileKey,pageId:page.id,changed,readback:changes.map(({t})=>({id:t.id,text:t.characters}))};
}
