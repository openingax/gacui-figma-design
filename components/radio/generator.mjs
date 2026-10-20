export function validateRadio(spec) {
  const kind=spec.kind??'group',variant=spec.variant??'outline';
  if(!['single','group','buttonGroup'].includes(kind))throw Error('未知单选类型');
  if(!['outline','default-filled','primary-filled'].includes(variant))throw Error('未知单选按钮外观');
  let options=kind==='single'?[{id:spec.id??'item',label:spec.label??'单选项',disabled:spec.disabled,hover:spec.hover}]:spec.options;
  if(!Array.isArray(options)||!options.length)throw Error('单选选项不能为空');
  if(spec.disabled!==undefined&&typeof spec.disabled!=='boolean')throw Error('disabled 必须为布尔值');
  if(spec.disabled)options=options.map(o=>({...o,disabled:true}));
  const ids=new Set();for(const o of options){if(typeof o.id!=='string'||!o.id||ids.has(o.id)||typeof o.label!=='string'||!o.label.trim())throw Error('单选选项需要唯一 id 和非空文案');ids.add(o.id);for(const k of ['disabled','hover'])if(o[k]!==undefined&&typeof o[k]!=='boolean')throw Error(k+' 必须为布尔值');}
  const value=kind==='single'?(spec.checked?options[0].id:null):(spec.value??null);
  if(value!==null&&!ids.has(value))throw Error('单选值不在选项中');
  for(const o of options)if(o.hover&&(o.disabled||o.id===value))throw Error('规范没有已选或禁用悬停组合');
  if(spec.checked!==undefined&&typeof spec.checked!=='boolean')throw Error('checked 必须为布尔值');
  if(spec.width!==undefined&&(!Number.isFinite(spec.width)||spec.width<=0))throw Error('单选宽度无效');
  return {...spec,kind,variant,options,value};
}

export async function renderRadio(figma,parent,spec,deps,existing=null) {
  const s=validateRadio(spec),created=[];
  if(figma.fileKey!==deps.fileKey)throw Error('Radio 只允许授权目标文件');
  if(existing&&(existing.parent!==parent||existing.type!=='FRAME'||existing.children.length!==s.options.length||s.options.some(o=>!existing.children.some(n=>n.name==='单选项/'+o.id))))throw Error('原位修改需要保持选项 id 和数量');
  const make=async(id,old)=>{const c=await figma.getNodeByIdAsync(id);if(c?.type!=='COMPONENT')throw Error('Radio 母组件缺失');const n=old??c.createInstance();if(old){if(old.mainComponent.id!==c.id)old.swapComponent(c);}else created.push(n.id);for(const t of n.findAll(x=>x.type==='TEXT')){for(const seg of t.getStyledTextSegments(['fontName'])){try{await figma.loadFontAsync(seg.fontName);}catch{await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});t.setRangeFontName(seg.start,seg.end,{family:'Noto Sans SC',style:'Regular'});}}}return n;};
  const group=existing??figma.createFrame();if(!existing)parent.appendChild(group);group.name='单选/'+s.id;group.layoutMode='HORIZONTAL';group.primaryAxisSizingMode='AUTO';group.counterAxisSizingMode='AUTO';group.counterAxisAlignItems='CENTER';group.fills=[];group.strokes=[];group.cornerRadius=0;group.paddingLeft=group.paddingRight=group.paddingTop=group.paddingBottom=0;group.clipsContent=false;group.itemSpacing=s.kind==='buttonGroup'?(s.variant==='outline'?0:4):16;created.push(group.id);
  const filled=s.kind==='buttonGroup'&&s.variant!=='outline';
  if(filled){group.paddingLeft=group.paddingRight=group.paddingTop=group.paddingBottom=2;group.cornerRadius=3;group.fills=JSON.parse(JSON.stringify(deps.groupFills[s.variant]));}
  const names={outline:'outline描边','default-filled':'default-filled默认填充','primary-filled':'primary-filled品牌填充'};
  const selected=s.options.findIndex(o=>o.id===s.value&&!o.disabled);
  const items=[];
  for(const [i,o] of s.options.entries()){
    const checked=o.id===s.value,disabled=!!o.disabled,state=o.hover?'hover悬停':checked&&s.kind==='buttonGroup'?'select已选':'normal默认';
    const position=i===s.options.length-1||selected>=0&&i>selected?'right to seleted 选中右边':'left to selected 选中左边';
    const name=s.kind==='buttonGroup'?`variants 类型=${names[s.variant]}, state 状态=${state}, disabled 禁用=${disabled}, position 位置=${s.variant==='outline'?position:'/'}`:`checked 已选=${checked}, state 状态=${state}, disable 禁用=${disabled}`;
    const n=await make((s.kind==='buttonGroup'?deps.button:deps.single)[name],existing?.children.find(n=>n.name==='单选项/'+o.id));if(!existing)group.appendChild(n);n.name='单选项/'+o.id;
    const label=n.findOne(t=>t.type==='TEXT'&&t.name==='label');label.characters=o.label;label.textAutoResize='WIDTH_AND_HEIGHT';
    if(s.kind==='buttonGroup'){
      n.topLeftRadius=n.bottomLeftRadius=filled?2:i===0?3:0;n.topRightRadius=n.bottomRightRadius=filled?2:i===s.options.length-1?3:0;
      items.push({n,label});
    }
  }
  if(s.kind==='buttonGroup'){
    const min=Math.max(74,...items.map(x=>x.label.width+32)),padding=filled?4:0,gaps=group.itemSpacing*(items.length-1);
    const slot=s.width===undefined?min:(s.width-padding-gaps)/items.length;
    if(slot<min)throw Error('单选按钮文案超出分配宽度');
    for(const {n}of items){n.resize(slot,n.height);n.layoutGrow=1;}
    group.resize(slot*items.length+padding+gaps,filled?32:32);group.primaryAxisSizingMode='FIXED';for(const {n}of items)n.layoutSizingHorizontal='FILL';
  }else if(s.width!==undefined&&group.width>s.width)throw Error('单选组超出分配宽度');
  return group;
}
