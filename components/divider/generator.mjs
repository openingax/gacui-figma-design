export function validateDivider(s) {
  if (!['horizontal','vertical'].includes(s.orientation??'horizontal')) throw Error('分割线方向无效');
  if (s.dashed!==undefined&&typeof s.dashed!=='boolean') throw Error('dashed 必须为布尔值');
  if (s.text!==undefined&&(typeof s.text!=='string'||!s.text.trim())) throw Error('文字分割线需要非空文字');
  if (s.orientation==='vertical'&&s.text!==undefined) throw Error('规范没有垂直文字分割线');
  if (!['left','center','right'].includes(s.align??'center')) throw Error('文字对齐无效');
  if(s.text===undefined&&s.align!==undefined)throw Error('无文字分割线不能指定文字对齐');
  if(s.length!==undefined&&(!Number.isFinite(s.length)||s.length<(s.text?120:1)))throw Error('分割线长度无效，文字组合至少120px');
  return s;
}
export function dividerVariant(s){
  validateDivider(s);
  const direction=(s.orientation??'horizontal')==='horizontal'?'horizontal 水平分割线':'vertical 垂直分割线';
  const aligns={left:'left 左对齐',center:'center 居中对齐',right:'right 右对齐'};
  return `布局=${direction}, 虚线=${!!s.dashed}, 文字分割线=${s.text!==undefined}, 文字对齐=${s.text===undefined?'none':aligns[s.align??'center']}`;
}
export async function updateDivider(figma,n,s){
  validateDivider(s);
  if(n.type!=='FRAME')throw Error('修改入口只接受本生成器的可编辑分割线组合');
  const lines=n.findAllWithCriteria({types:['LINE']});
  if(!lines.length||lines.some(l=>(l.dashPattern.length>0)!==!!s.dashed)||!!n.findOne(x=>x.type==='TEXT')!==(s.text!==undefined))throw Error('类型或状态不同，需重新选用对应变体');
  if((Math.abs(lines[0].rotation)>45)!==(s.orientation==='vertical'))throw Error('不能原位改变分割线方向');
  if(s.text!==undefined){const align=n.children[0].layoutGrow===0?'left':n.children.at(-1).layoutGrow===0?'right':'center';if(align!==(s.align??'center'))throw Error('不能原位改变文字对齐类型');}
  for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);
  const length=s.length??(s.text?400:40),vertical=s.orientation==='vertical';
  n.resize(vertical?1:length,vertical?length:s.text?22:1);
  const t=n.findOne(x=>x.type==='TEXT');
  if(t){t.textAutoResize='WIDTH_AND_HEIGHT';t.layoutSizingHorizontal='HUG';t.characters=s.text;const max=length-96;if(t.width>max){t.textAutoResize='HEIGHT';t.resize(max,t.height);t.layoutSizingHorizontal='FIXED';}n.counterAxisSizingMode='AUTO';}
  return n;
}
export async function renderDivider(figma,parent,s){
  validateDivider(s);
  const set=await figma.getNodeByIdAsync('486:15973');
  if(set?.type!=='COMPONENT_SET')throw Error('Divider组件依赖缺失');
  const main=set.children.find(n=>n.name===dividerVariant(s));if(!main)throw Error('Divider变体缺失');
  let n=main.createInstance();parent.appendChild(n);
  const available=(await figma.listAvailableFontsAsync()).map(f=>f.fontName);
  for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName'])){
    const font=available.find(f=>f.family==='PingFang SC'&&f.style===seg.fontName.style)||available.find(f=>f.family==='Noto Sans SC'&&f.style===seg.fontName.style);
    if(!font)throw Error('分割线规范及临时字体均不可用');await figma.loadFontAsync(font);t.setRangeFontName(seg.start,seg.end,font);
  }
  n=n.detachInstance();n.name='分割线/'+s.id;await updateDivider(figma,n,s);return n;
}
