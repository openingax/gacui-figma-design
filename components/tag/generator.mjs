export function validateTag(s={}) {
  const out={variant:'outline',shape:'square',closable:false,icon:false,disabled:false,closeState:'normal',...s};
  if(typeof out.label!=='string'||!out.label.trim())throw Error('Tag需要非空label');
  if(!['default','primary','success','warning','danger'].includes(out.theme))throw Error('Tag主题必须显式配置');
  if(!['dark','light','outline','light-outline'].includes(out.variant)||!['square','round'].includes(out.shape))throw Error('Tag类型或形状不在当前组件库');
  for(const k of ['closable','icon','disabled'])if(typeof out[k]!=='boolean')throw Error('Tag '+k+'必须为布尔值');
  if(out.size!==undefined&&out.size!=='large')throw Error('Tag仅支持当前large，medium已废弃');
  if(!['normal','hover'].includes(out.closeState)||out.closeState==='hover'&&(!out.closable||out.disabled))throw Error('Tag关闭悬浮态仅适用于可关闭且未禁用标签');
  if(out.iconName!==undefined||out.iconId!==undefined)throw Error('Tag当前只支持规范默认图标，不支持任意图标交换');
  return out;
}

export function tagKey(s) {return [s.variant,s.theme,s.shape,s.closable,s.icon,s.disabled].join('|');}

// 仅修改实例文字与关闭态；不切换母组件，不改变节点身份。
export async function updateTag(figma,n,s) {
  const before=[n.id,...n.findAll(()=>true).map(x=>x.id)];
  const label=n.findAll(x=>x.type==='TEXT'&&x.name==='label')[0];
  if(!label)throw Error('Tag缺少label');
  for(const segment of label.getStyledTextSegments(['fontName']))await figma.loadFontAsync(segment.fontName);
  label.characters=s.label;label.textAutoResize='WIDTH_AND_HEIGHT';
  if(label.parent!==n&&label.parent.layoutMode==='HORIZONTAL')label.parent.primaryAxisSizingMode='AUTO';
  n.primaryAxisSizingMode='AUTO';
  if(s.closeId){const close=n.findAll(x=>x.name==='item/tag-closeBtn')[0],main=await figma.getNodeByIdAsync(s.closeId);if(!close||!main)throw Error('Tag关闭态依赖缺失');const targets=close.findAll(x=>x.type==='VECTOR'),sources=main.findAll(x=>x.type==='VECTOR');if(targets.length!==sources.length)throw Error('Tag关闭矢量结构不一致');for(let i=0;i<targets.length;i++){targets[i].fills=JSON.parse(JSON.stringify(sources[i].fills));if(sources[i].fillStyleId)await targets[i].setFillStyleIdAsync(sources[i].fillStyleId);}}
  return {mutatedNodeIds:before,stableIds:JSON.stringify(before)===JSON.stringify([n.id,...n.findAll(()=>true).map(x=>x.id)])};
}

export async function renderTag(figma,parent,s) {
  const main=await figma.getNodeByIdAsync(s.mainId);if(!main||main.type!=='COMPONENT')throw Error('Tag母组件不存在');
  for(const t of main.findAll(x=>x.type==='TEXT'))for(const part of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(part.fontName);
  const n=main.createInstance();parent.appendChild(n);n.name='状态标签';await updateTag(figma,n,s);return n;
}
