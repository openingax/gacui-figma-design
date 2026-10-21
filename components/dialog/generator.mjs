export function validateDialog(s) {
  for(const k of ['title','message','confirm','cancel']) if(typeof s[k]!=='string'||!s[k].trim()) throw Error('Dialog '+k+' 必须为非空文字');
  for(const k of ['closable','closeBtn','divider','fullscreen'])if(s[k]!==undefined&&typeof s[k]!=='boolean')throw Error('Dialog '+k+' 必须为布尔值');
  if(s.closable!==undefined&&s.closeBtn!==undefined&&s.closable!==s.closeBtn)throw Error('Dialog closable与closeBtn冲突');
  const theme=s.theme??(s.fullscreen?'info':'default'),closable=s.closable??s.closeBtn??!!s.fullscreen;
  if(!['default','info','warning','error','success'].includes(theme))throw Error('Dialog theme不支持');
  if(!['normal','hover','active'].includes(s.closeState??'normal')||!closable&&s.closeState&&s.closeState!=='normal')throw Error('Dialog closeState不支持');
  if(s.fullscreen&&(theme!=='info'||!closable||s.width!==undefined))throw Error('Dialog 全屏源仅支持info、带关闭且按视口宽度');
  if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<480||s.width>960))throw Error('Dialog 宽度须在480至960之间');
  return s;
}
export function dialogMainId(s,deps) {
  return s.fullscreen?deps.fullscreen[String(!!s.divider)]:deps.main[(s.theme??'default')+'/'+(s.closable??s.closeBtn??false)+'/'+!!s.divider];
}
export async function renderDialog(figma,root,s,helpers) {
  const {normalize,deps}=helpers;
  const mask=figma.createRectangle();root.appendChild(mask);mask.name='Dialog蒙层';if(root.layoutMode&&root.layoutMode!=='NONE')mask.layoutPositioning='ABSOLUTE';mask.x=0;mask.y=0;mask.resize(root.width,root.height);
  mask.fills=[{type:'SOLID',color:{r:0.27450981736183167,g:0.2980392277240753,b:0.32156863808631897}}];
  const main=await figma.getNodeByIdAsync(dialogMainId(s,deps));if(main?.type!=='COMPONENT')throw Error('Dialog依赖缺失');
  const n=main.createInstance();root.appendChild(n);n.name='确认弹窗/'+s.id;if(root.layoutMode&&root.layoutMode!=='NONE')n.layoutPositioning='ABSOLUTE';await normalize(n);
  return await updateDialog(figma,root,n,s,helpers);
}
export async function updateDialog(figma,root,n,s,helpers) {
  const {setText,buttonLabel}=helpers;
  if(helpers.deps&&(await n.getMainComponentAsync()).id!==dialogMainId(s,helpers.deps))throw Error('Dialog原位修改不可切换主变体，请另建状态画板');
  n.resize(s.fullscreen?root.width:s.width??480,s.fullscreen?root.height:n.height);n.primaryAxisSizingMode=s.fullscreen?'FIXED':'AUTO';
  const header=n.children.find(x=>x.name==='header'),content=n.children.find(x=>x.name==='content'),footer=n.children.find(x=>x.name==='footer');
  const title=header.findOne(x=>x.type==='TEXT'),label=content.findOne(x=>x.type==='TEXT');
  await setText(title,s.title);await setText(label,s.message);title.textAlignHorizontal='LEFT';
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
  n.x=(root.width-n.width)/2;n.y=(root.height-n.height)/2;
  return {id:s.id,nodeId:n.id,mainId:(await n.getMainComponentAsync()).id,title:title.characters,message:label.characters,cancel:buttons[0].findOne(x=>x.type==='TEXT').characters,confirm:buttons[1].findOne(x=>x.type==='TEXT').characters,width:n.width,height:n.height,inBounds:n.x>=0&&n.y>=0&&n.x+n.width<=root.width&&n.y+n.height<=root.height&&label.y+label.height<=content.height-content.paddingBottom,centered:Math.abs(n.x-(root.width-n.width)/2)<1&&Math.abs(n.y-(root.height-n.height)/2)<1};
}
export function verifyDialogs(specs,actual,deps) {
  const errors=[];
  if(specs.length!==actual.length)errors.push('确认弹窗数量不符');
  for(const s of specs){const a=actual.find(a=>a.id===s.id);if(!a){errors.push('确认弹窗缺失');continue;}
    for(const k of ['title','message','cancel','confirm'])if(a[k]!==s[k])errors.push('确认弹窗'+k+'不符');
    if(!a.inBounds||!a.centered)errors.push('确认弹窗越界或未居中');
    if(a.mainId!==(deps?dialogMainId(s,deps):'415:9'))errors.push('确认弹窗组件引用不符');
  }return errors;
}
