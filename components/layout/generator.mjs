export const SPACINGS = Object.freeze([2,4,8,12,16,24,32,40,48,64,96]);
export function validateSpacing(value){if(!SPACINGS.includes(value))throw Error('间距不在规范十一档中');return value;}
export function applySpacing(frame,value){validateSpacing(value);if(!['HORIZONTAL','VERTICAL'].includes(frame.layoutMode))throw Error('仅自动布局容器可设置间距');frame.itemSpacing=value;return frame;}
export function applyLayoutGrid(frame, sourceId, rules) {
  const rule=rules.nodes[sourceId];
  if(!rule?.layoutGrids?.length)throw Error('必须指定有栅格的源节点');
  if(!('layoutGrids' in frame))throw Error('节点不支持栅格');
  frame.layoutGrids=JSON.parse(JSON.stringify(rule.layoutGrids));
  return frame;
}
export function validateLayout(spec) {
  if(!['side','top','combined'].includes(spec.mode))throw Error('布局类型无效');
  if(!Number.isFinite(spec.width)||!Number.isFinite(spec.height)||spec.width<=240||spec.height<=136)throw Error('布局视口不足以容纳导航、正文和页脚');
  return spec;
}
// 导航和正文由调用方提供真实节点；Layout 只组合源规范的几何，不生成示例菜单。
export function composeLayout(figma,parent,spec,slots) {
  validateLayout(spec);
  if(!slots.content||(spec.mode!=='side'&&!slots.header)||(spec.mode!=='top'&&!slots.sidebar))throw Error('缺少布局所需的导航或正文节点');
  const frame=(p,name,dir,w,h)=>{const n=figma.createFrame();p.appendChild(n);n.name=name;n.layoutMode=dir;n.resize(w,h);n.primaryAxisSizingMode=n.counterAxisSizingMode='FIXED';n.fills=[];n.itemSpacing=0;n.clipsContent=false;return n;};
  const root=frame(parent,spec.name??'Layout/'+spec.mode,spec.mode==='side'?'HORIZONTAL':'VERTICAL',spec.width,spec.height);
  root.fills=[{type:'SOLID',color:{r:0.95686274766922,g:0.9647058844566345,b:0.9725490212440491}}];root.clipsContent=spec.mode!=='combined';
  const top=spec.mode==='side'?0:64,side=spec.mode==='top'?0:200;
  if(top){root.appendChild(slots.header);slots.header.resize(spec.width,64);slots.header.layoutGrow=0;slots.header.layoutAlign='STRETCH';}
  const body=spec.mode==='combined'?frame(root,'sider','HORIZONTAL',spec.width,spec.height-top):root;
  if(body!==root){body.layoutGrow=1;body.layoutAlign='STRETCH';body.clipsContent=true;}
  if(side){body.appendChild(slots.sidebar);slots.sidebar.resize(200,slots.sidebar.height);slots.sidebar.layoutGrow=0;}
  const content=frame(body,'content','VERTICAL',spec.width-side,spec.height-top);content.layoutGrow=1;content.layoutAlign='STRETCH';content.paddingLeft=content.paddingRight=content.paddingTop=20;
  content.appendChild(slots.content);slots.content.resize(spec.width-side-40,spec.height-top-72);slots.content.layoutGrow=1;slots.content.layoutAlign='STRETCH';
  const footer=slots.footer??frame(content,'footer','HORIZONTAL',spec.width-side-40,52);if(footer.parent!==content)content.appendChild(footer);
  footer.resize(spec.width-side-40,52);footer.layoutMode='HORIZONTAL';footer.primaryAxisSizingMode='FIXED';footer.counterAxisSizingMode='FIXED';footer.primaryAxisAlignItems=footer.counterAxisAlignItems='CENTER';footer.paddingLeft=footer.paddingRight=footer.paddingTop=footer.paddingBottom=16;footer.itemSpacing=10;footer.layoutGrow=0;footer.layoutAlign='STRETCH';
  return {root,body,content,footer};
}
