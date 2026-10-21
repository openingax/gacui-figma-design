export async function renderComposedDialog(figma,root,s,helpers) {
  const {normalize,deps}=helpers;
  const mask=figma.createRectangle();root.appendChild(mask);mask.name='Dialog蒙层';if(root.layoutMode&&root.layoutMode!=='NONE')mask.layoutPositioning='ABSOLUTE';mask.x=0;mask.y=0;mask.resize(root.width,root.height);
  mask.fills=[{type:'SOLID',color:{r:0.27450981736183167,g:0.2980392277240753,b:0.32156863808631897}}];
  const main=await figma.getNodeByIdAsync(dialogMainId(s,deps));if(main?.type!=='COMPONENT')throw Error('Dialog依赖缺失');
  let n=main.createInstance();root.appendChild(n);n.name='确认弹窗/'+s.id;if(root.layoutMode&&root.layoutMode!=='NONE')n.layoutPositioning='ABSOLUTE';await normalize(n);
  if(s.children?.length){n=n.detachInstance();n.name+='@'+main.id;}
  return await updateComposedDialog(figma,root,n,s,helpers);
}
export async function updateComposedDialog(figma,root,n,s,helpers) {
  const {setText,buttonLabel}=helpers;
  if(n.type!=='FRAME'||n.parent!==root||!n.name.startsWith('确认弹窗/'+s.id+'@'))throw Error('仅允许修改已回读的Dialog组合副本');
  if(helpers.deps&&(n.type==='INSTANCE'?(await n.getMainComponentAsync()).id:n.name.split('@').pop())!==dialogMainId(s,helpers.deps))throw Error('Dialog原位修改不可切换主变体，请另建状态画板');
  n.resize(s.fullscreen?root.width:s.width??480,s.fullscreen?root.height:n.height);n.primaryAxisSizingMode=s.fullscreen?'FIXED':'AUTO';
  const header=n.children.find(x=>x.name==='header'),content=n.children.find(x=>x.name==='content'),footer=n.children.find(x=>x.name==='footer');
  content.layoutMode='VERTICAL';content.primaryAxisSizingMode=s.fullscreen?'FIXED':'AUTO';
  const title=header.findOne(x=>x.type==='TEXT'),label=content.children.find(x=>x.type==='TEXT');
  await setText(title,s.title);await setText(label,s.message??'');label.visible=!!s.message;title.textAlignHorizontal='LEFT';
  // 标题可能位于图标+标题子容器；按真实父级留出图标和关闭入口，避免覆盖。
  const tp=title.parent;
  if(tp!==header){tp.layoutSizingHorizontal='FILL';tp.layoutSizingVertical='HUG';}
  for(const t of [title,label]){
    const p=t.parent,others=p.children.filter(x=>x!==t&&x.visible&&x.layoutPositioning!=='ABSOLUTE');
    const width=p.width-p.paddingLeft-p.paddingRight-(p.layoutMode==='HORIZONTAL'?others.reduce((a,x)=>a+x.width,0)+p.itemSpacing*others.length:0);
    t.textTruncation='DISABLED';t.maxLines=null;t.textAutoResize='HEIGHT';t.resize(Math.max(1,width),t.height);t.layoutSizingHorizontal='FILL';t.layoutSizingVertical='HUG';
  }
  content.layoutGrow=s.fullscreen?1:0;content.layoutSizingVertical=s.fullscreen?'FILL':'HUG';
  const buttons=footer.children.filter(x=>x.type==='INSTANCE'||x.type==='FRAME');
  for(const [i,key]of ['cancel','confirm'].entries()){
    const b=footer.children.find(x=>x.name===key)??buttons[i];
    if(b.type==='INSTANCE')await buttonLabel(b,s[key]);else {const t=b.findOne(x=>x.type==='TEXT');await setText(t,s[key]);t.textAutoResize='WIDTH_AND_HEIGHT';b.primaryAxisSizingMode='AUTO';}
  }
  const close=header.findOne(x=>x.name==='closeBtn');
  if(close&&helpers.deps){const ref=await figma.getNodeByIdAsync(helpers.deps.close[s.closeState??'normal']);if(!ref||ref.type!=='COMPONENT')throw Error('Dialog关闭状态依赖缺失');close.fills=JSON.parse(JSON.stringify(ref.fills));if(ref.fillStyleId)await close.setFillStyleIdAsync(ref.fillStyleId);}
  let composition;
  if(s.children?.length){if(!helpers.updateDialogContent)throw Error('Dialog组合能力未配置');composition=await helpers.updateDialogContent(figma,content,s.children,helpers);}
  n.x=(root.width-n.width)/2;n.y=(root.height-n.height)/2;
  return {id:s.id,nodeId:n.id,mainId:(n.type==='INSTANCE'?(await n.getMainComponentAsync()).id:n.name.split('@').pop()),title:title.characters,message:label.characters,...(composition?{composition}:{}),cancel:buttons[0].findOne(x=>x.type==='TEXT').characters,confirm:buttons[1].findOne(x=>x.type==='TEXT').characters,width:n.width,height:n.height,inBounds:n.x>=0&&n.y>=0&&n.x+n.width<=root.width&&n.y+n.height<=root.height&&label.y+label.height<=content.height-content.paddingBottom,centered:Math.abs(n.x-(root.width-n.width)/2)<1&&Math.abs(n.y-(root.height-n.height)/2)<1};
}

// 仅组合已导入的配方；修改范围限定为当前 Dialog 的脱离副本。
export async function updateDialogContent(figma,content,specs,h){
 const width=content.width-content.paddingLeft-content.paddingRight,errors=[],blocks=[];
 content.itemSpacing=16;
 const existing=content.children.filter(n=>n.name.startsWith('Dialog内容/'));
 if(existing.some(n=>!specs.some(s=>n.name==='Dialog内容/'+s.id+'/'+s.type)))throw Error('Dialog原位修改不能删除或切换内容类型');
 for(const s of specs){
  let block=existing.find(n=>n.name==='Dialog内容/'+s.id+'/'+s.type);
  if(s.type==='table'){
   const c=JSON.parse(JSON.stringify(s.config));const old=c.columns.reduce((a,c)=>a+c.width,0),available=width-(c.selection?44:0);for(const col of c.columns)col.width=col.width/old*available;
   c.name='Dialog内容/'+s.id+'/'+s.type;
   if(!block){const r=await h.buildTable(figma,content,c,s.deps);block=await figma.getNodeByIdAsync(r.componentId);}
   else {if(Math.abs(block.width-width)>.1)throw Error('Dialog表格原位修改须保持宽度');await h.updateTableContents(figma,block,c);}
   const rows=block.children.filter(n=>n.name.startsWith('row/'));
   if(rows.length!==c.rows.length)errors.push('表格行数不符');
   for(const [i,row]of rows.entries())for(const col of c.columns.filter(c=>c.kind!=='operations')){const cell=row.children.find(n=>n.name==='cell/'+col.key);if(!cell?.findAll(n=>n.type==='TEXT').some(t=>t.characters===String(c.rows[i][col.key]??'')))errors.push('表格内容不符:'+s.id+'/'+i+'/'+col.key);}
  }else{
   if(!block){block=await h.renderDescriptions(figma,content,s,h.descriptionData,{autoFrame:h.autoFrame,pick:h.pick,width});block.name='Dialog内容/'+s.id+'/'+s.type;}
   else {
    const fields=block.findAll(n=>n.type==='FRAME'&&n.name.startsWith('信息项/'));
    if(fields.length!==s.items.length||s.items.some(i=>!fields.some(n=>n.name==='信息项/'+i.id)))throw Error('Dialog字段原位修改须保持字段ID集合');
    await h.setText(block.findOne(n=>n.type==='TEXT'&&n.name==='标题'),s.title);
    for(const i of s.items){const field=fields.find(n=>n.name==='信息项/'+i.id);await h.setText(field.children.find(n=>n.name==='label'),i.label+'：');await h.setText(field.children.find(n=>n.name==='value'),i.value);}
   }
   for(const i of s.items){const f=block.findOne(n=>n.name==='信息项/'+i.id);if(!f||f.children.find(n=>n.name==='value')?.characters!==i.value)errors.push('字段内容不符:'+i.id);}
  }
  blocks.push({id:s.id,nodeId:block.id,type:s.type,width:block.width,height:block.height});
  if(block.width>width+.1||block.y+block.height>content.height-content.paddingBottom+.1)errors.push('Dialog内容越界:'+s.id);
 }
 const visible=content.children.filter(n=>n.visible&&n.layoutPositioning!=='ABSOLUTE');
 for(let i=1;i<visible.length;i++)if(visible[i].y<visible[i-1].y+visible[i-1].height)errors.push('Dialog内容重叠');
 return {blocks,errors};
}
