export function validateInputNumber(spec){
  const theme=spec.theme??'row',state=spec.state??'normal';
  if(!['row','column'].includes(theme)||!['normal','hover','focus'].includes(state))throw Error('数字输入框类型或状态不在规范中');
  if(spec.disabled!==undefined&&typeof spec.disabled!=='boolean')throw Error('disabled 必须为布尔值');
  if(spec.disabled&&state!=='normal')throw Error('禁用数字输入框仅有默认态');
  if(spec.value!=null&&(typeof spec.value!=='number'||!Number.isFinite(spec.value)))throw Error('数值必须为有限数字或 null');
  if(spec.placeholder!==undefined&&(typeof spec.placeholder!=='string'||!spec.placeholder.trim()))throw Error('占位文案不能为空');
  if(spec.width!==undefined&&(!Number.isFinite(spec.width)||spec.width<(theme==='row'?144:96)))throw Error('宽度小于规范默认宽度');
  for(const key of ['increase','decrease'])if(spec[key]!==undefined){const c=spec[key];if(!c||typeof c!=='object'||Array.isArray(c))throw Error('调整按钮需要状态对象');if(theme!=='column'||!['hover','focus'].includes(state))throw Error('调整按钮独立状态只用于右侧控件可见时');if(!['normal','hover','active'].includes(c.state??'normal')||c.disabled!==undefined&&typeof c.disabled!=='boolean')throw Error('调整按钮状态无效');if(c.disabled&&(c.state??'normal')!=='normal')throw Error('禁用调整按钮没有悬停或点击态');}
  return {...spec,theme,state,filled:spec.value!=null};
}

export async function renderInputNumber(figma,parent,spec,deps,existing=null){
  const s=validateInputNumber(spec);if(figma.fileKey!==deps.fileKey)throw Error('数字输入框目标不符');
  const name=`theme 主题=${s.theme==='row'?'row 双侧调整':'column 右侧调整'}, size 尺寸=medium 中, state 状态=${{normal:'normal 默认',hover:'hover 悬浮',focus:'focus 聚焦'}[s.state]}, disabled 禁用=${!!s.disabled}, filled 填充=${s.filled}`;
  const c=await figma.getNodeByIdAsync(deps.variants[name]);if(c?.type!=='COMPONENT')throw Error('数字输入框母组件缺失');
  if(existing&&(existing.type!=='INSTANCE'||existing.parent!==parent))throw Error('原位修改需要当前父级下的数字输入框实例');
  const n=existing??c.createInstance();if(existing&&n.mainComponent.id!==c.id)n.swapComponent(c);if(!existing)parent.appendChild(n);n.name='数字输入/'+s.id;
  const label=n.findOne(t=>t.type==='TEXT'&&t.name==='label');try{await figma.loadFontAsync(label.fontName)}catch{await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});label.fontName={family:'Noto Sans SC',style:'Regular'}}
  label.characters=s.filled?String(s.value):(s.placeholder??'请输入');n.resize(s.width??c.width,c.height);
  // 控件母组件已精确导入。仅复制源状态的 paint，不重绘箭头或改变几何。
  async function paint(to,from){for(const key of ['fills','strokes']){const sid=key==='fills'?'fillStyleId':'strokeStyleId';if(from[sid])await to[key==='fills'?'setFillStyleIdAsync':'setStrokeStyleIdAsync'](from[sid]);else to[key]=JSON.parse(JSON.stringify(from[key]));}if('children'in to)for(let i=0;i<to.children.length;i++)await paint(to.children[i],from.children[i]);}
  if(s.theme==='column'&&['hover','focus'].includes(s.state)){
    const controls=n.findOne(x=>x.name==='controls');for(const [i,key]of ['increase','decrease'].entries()){const o=s[key]??{},state=`state 状态=${{normal:'normal 默认',hover:'hover 悬浮',active:'active 点击'}[o.state??'normal']}, disabled 禁用=${!!o.disabled}`;const master=await figma.getNodeByIdAsync(deps[key][state]);await paint(controls.children[i],master);}
  }
  return n;
}
