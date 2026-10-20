// 仅支持已导入的基础确认变体；源与目标映射见 definition 和 evidence/dialog。
export function validateDialog(s) {
  for(const k of ['title','message','confirm','cancel']) if(typeof s[k]!=='string'||!s[k].trim()) throw Error('Dialog '+k+' 必须为非空文字');
  if((s.theme??'default')!=='default'||s.closeBtn||s.divider||s.fullscreen) throw Error('Dialog 该变体尚未导入');
  if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<480||s.width>960))throw Error('Dialog 宽度须在480至960之间');
  return s;
}
export async function renderDialog(figma,root,s,helpers) {
  const {normalize,setText,buttonLabel}=helpers;
  const mask=figma.createRectangle();root.appendChild(mask);mask.name='Dialog蒙层';if(root.layoutMode&&root.layoutMode!=='NONE')mask.layoutPositioning='ABSOLUTE';mask.x=0;mask.y=0;mask.resize(root.width,root.height);
  mask.fills=[{type:'SOLID',color:{r:0.27450981736183167,g:0.2980392277240753,b:0.32156863808631897}}];
  const main=await figma.getNodeByIdAsync('415:9');if(main?.type!=='COMPONENT')throw Error('基础Dialog依赖缺失');
  const n=main.createInstance();root.appendChild(n);n.name='确认弹窗/'+s.id;if(root.layoutMode&&root.layoutMode!=='NONE')n.layoutPositioning='ABSOLUTE';await normalize(n);
  return await updateDialog(figma,root,n,s,helpers);
}
export async function updateDialog(figma,root,n,s,helpers) {
  const {setText,buttonLabel}=helpers;
  n.resize(s.width??480,n.height);n.primaryAxisSizingMode='AUTO';
  const header=n.children.find(x=>x.name==='header'),content=n.children.find(x=>x.name==='content'),footer=n.children.find(x=>x.name==='footer');
  const title=header.findOne(x=>x.type==='TEXT'),label=content.findOne(x=>x.type==='TEXT');
  await setText(title,s.title);await setText(label,s.message);
  for(const t of [title,label]){t.textAutoResize='HEIGHT';t.resize(n.width-64,t.height);t.layoutSizingHorizontal='FILL';t.layoutSizingVertical='HUG';}
  content.layoutGrow=0;content.primaryAxisSizingMode='FIXED';content.counterAxisSizingMode='AUTO';content.layoutSizingVertical='HUG';
  for(const [key,value]of [['cancel',s.cancel],['confirm',s.confirm]])await buttonLabel(footer.children.find(x=>x.name===key),value);
  n.x=(root.width-n.width)/2;n.y=(root.height-n.height)/2;
  return {id:s.id,nodeId:n.id,mainId:(await n.getMainComponentAsync()).id,title:title.characters,message:label.characters,cancel:footer.children.find(x=>x.name==='cancel').findOne(x=>x.type==='TEXT').characters,confirm:footer.children.find(x=>x.name==='confirm').findOne(x=>x.type==='TEXT').characters,width:n.width,height:n.height,inBounds:n.x>=0&&n.y>=0&&n.x+n.width<=root.width&&n.y+n.height<=root.height,centered:Math.abs(n.x-(root.width-n.width)/2)<1&&Math.abs(n.y-(root.height-n.height)/2)<1};
}
export function verifyDialogs(specs,actual) {
  const errors=[];
  if(specs.length!==actual.length)errors.push('确认弹窗数量不符');
  for(const s of specs){const a=actual.find(a=>a.id===s.id);if(!a){errors.push('确认弹窗缺失');continue;}
    for(const k of ['title','message','cancel','confirm'])if(a[k]!==s[k])errors.push('确认弹窗'+k+'不符');
    if(!a.inBounds||!a.centered)errors.push('确认弹窗越界或未居中');
    if(a.mainId!=='415:9')errors.push('确认弹窗组件引用不符');
  }return errors;
}
