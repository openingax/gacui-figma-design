export function validateCheckbox(spec) {
  const kind=spec.kind??'group';if(!['single','group'].includes(kind))throw Error('未知多选类型');
  let options=kind==='single'?[{id:spec.id??'item',label:spec.label??'多选项',checked:spec.checked,indeterminate:spec.indeterminate,disabled:spec.disabled,hover:spec.hover}]:spec.options;
  if(!Array.isArray(options)||!options.length)throw Error('多选选项不能为空');
  if(spec.disabled!==undefined&&typeof spec.disabled!=='boolean')throw Error('disabled 必须为布尔值');
  if(spec.disabled)options=options.map(o=>({...o,disabled:true}));
  const ids=new Set();for(const o of options){if(typeof o.id!=='string'||!o.id||ids.has(o.id)||typeof o.label!=='string'||!o.label.trim())throw Error('多选选项需要唯一 id 和文案');ids.add(o.id);for(const k of ['checked','indeterminate','disabled','hover'])if(o[k]!==undefined&&typeof o[k]!=='boolean')throw Error(k+' 必须为布尔值');if(o.indeterminate&&!o.checked)throw Error('半选必须 checked=true，与规范一致');if(o.hover&&(o.disabled||o.checked||o.indeterminate))throw Error('规范没有已选、半选或禁用悬停');}
  if(spec.width!==undefined&&(!Number.isFinite(spec.width)||spec.width<=0))throw Error('多选宽度无效');
  return {...spec,kind,options};
}

export async function renderCheckbox(figma,parent,spec,deps,existing=null){
  const s=validateCheckbox(spec);if(figma.fileKey!==deps.fileKey)throw Error('Checkbox 只允许授权目标');
  if(existing&&(existing.parent!==parent||existing.type!=='FRAME'||existing.children.length!==s.options.length||s.options.some(o=>!existing.children.some(n=>n.name==='多选项/'+o.id))))throw Error('原位修改需要保持选项 id 与数量');
  let font={family:'PingFang SC',style:'Regular'};try{await figma.loadFontAsync(font)}catch{font={family:'Noto Sans SC',style:'Regular'};await figma.loadFontAsync(font)}
  const group=existing??figma.createFrame();if(!existing)parent.appendChild(group);group.name='多选/'+s.id;group.layoutMode='HORIZONTAL';group.primaryAxisSizingMode='AUTO';group.counterAxisSizingMode='AUTO';group.itemSpacing=16;group.fills=[];group.strokes=[];group.clipsContent=false;
  for(const o of s.options){const variant=`checked 已选=${!!o.checked}, state 状态=${o.hover?'hover 悬停':'normal 默认'}, disabled 禁用=${!!o.disabled}, indeterminate 半选=${!!o.indeterminate}`,master=await figma.getNodeByIdAsync(deps.units[variant]);if(master?.type!=='COMPONENT')throw Error('已验收 Checkbox 元件缺失');
    let item=existing?.children.find(n=>n.name==='多选项/'+o.id),box,label;
    if(item){box=item.findOne(n=>n.type==='INSTANCE');label=item.findOne(n=>n.type==='TEXT');if(box.mainComponent.id!==master.id)box.swapComponent(master);await figma.loadFontAsync(label.fontName);}
    else {item=figma.createFrame();group.appendChild(item);item.name='多选项/'+o.id;item.layoutMode='HORIZONTAL';item.primaryAxisSizingMode='AUTO';item.counterAxisSizingMode='AUTO';item.itemSpacing=8;item.fills=[];item.strokes=[];item.clipsContent=false;const wrap=figma.createFrame();item.appendChild(wrap);wrap.name='checkbox';wrap.layoutMode='HORIZONTAL';wrap.primaryAxisSizingMode='AUTO';wrap.counterAxisSizingMode='AUTO';wrap.paddingTop=3;wrap.itemSpacing=10;wrap.fills=[];wrap.strokes=[];box=master.createInstance();wrap.appendChild(box);label=figma.createText();item.appendChild(label);label.name='label';label.fontName=font;label.fontSize=14;label.lineHeight={unit:'PIXELS',value:22};label.letterSpacing={unit:'PERCENT',value:0};label.textAutoResize='WIDTH_AND_HEIGHT';}
    label.characters=o.label;label.fills=JSON.parse(JSON.stringify(o.disabled?deps.disabledFills:deps.normalFills));
  }
  if(s.width!==undefined&&group.width>s.width)throw Error('多选组超出分配宽度');return group;
}
