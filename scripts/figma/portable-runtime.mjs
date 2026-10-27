// Serialized with the existing precise node builder. One bounded asset per call.
export async function initializeAsset(figma, request, buildNodes, restoreTransform, applyFinalStrokes) {
  const {fileKey,pageId,asset}=request;
  if(figma.fileKey!==fileKey||fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('目标文件不符或规范源只读');
  const page=await figma.getNodeByIdAsync(pageId);if(page?.type!=='PAGE')throw Error('组件Page不存在');
  await figma.setCurrentPageAsync(page);
  const marker='GACUI / '+asset.key+' / '+asset.hash;
  const existing=page.children.filter(n=>n.name===marker||n.name===marker+' / building');
  if(existing.length){
    if(existing.length!==1||existing[0].name!==marker)throw Error('初始化未完成或重名，请先回读本批次，不能重复创建');
    const wrapper=existing[0],nodes=[wrapper,...wrapper.findAll(()=>true)],root=wrapper.children[0];
    if(root?.type!==asset.type||nodes.length!==asset.nodeCount+1)throw Error('已初始化组件结构已变化，请回读');
    return {status:'reused',fileKey,pageId,key:asset.key,hash:asset.hash,rootId:root.id,wrapperId:wrapper.id,type:root.type,createdNodeIds:[],nodeCount:nodes.length-1};
  }
  const fonts=(await figma.listAvailableFontsAsync()).map(x=>x.fontName);
  const fontFamily=['PingFang SC','Noto Sans SC'].find(f=>['Regular','Medium'].every(s=>fonts.some(n=>n.family===f&&n.style===s)));
  if(!fontFamily)throw Error('规范字体和允许替代字体不可用');
  const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>k==='boundVariables'||k==='fillStyleId'?undefined:v));
  const canonical=x=>JSON.stringify(clean(x));
  const paints=await figma.getLocalPaintStylesAsync(),paintMap={};
  for(const [name,value] of Object.entries(asset.data.styles)){
    const matches=paints.filter(s=>s.name===name);if(matches.length>1||matches.length&&canonical(matches[0].paints)!==canonical(value))throw Error('颜色样式冲突 '+name);
    if(matches.length)paintMap[name]=matches[0].id;
  }
  const createdStyleIds=[];
  for(const [name,value] of Object.entries(asset.data.styles))if(!paintMap[name]){const s=figma.createPaintStyle();s.name=name;s.paints=clean(value);paintMap[name]=s.id;createdStyleIds.push(s.id);}
  const wrapper=figma.createFrame();page.appendChild(wrapper);wrapper.name=marker+' / building';wrapper.fills=[];wrapper.clipsContent=false;
  wrapper.x=Math.max(0,...page.children.filter(n=>n!==wrapper).map(n=>n.x+n.width))+80;wrapper.y=80;
  const state={map:{},paintMap,fontFamily,textStyleNamespace:'GACUI/portable/'+asset.hash};
  // Synthetic parent maps every root into this owned wrapper. The precise builder remains shared.
  const records=asset.data.nodes.map(n=>({...n,props:clean(n.props),parentSourceId:n.sourceId===asset.sourceId?'portable-parent':n.parentSourceId}));
  state.map['portable-parent']=wrapper.id;
  const result=await buildNodes(figma,page,records,null,state);
  for(const [sourceId,network] of Object.entries(asset.data.vectors)){
    const n=await figma.getNodeByIdAsync(state.map[sourceId]);await n.setVectorNetworkAsync(clean(network));
  }
  // Descendants first, then parents: HUG/FILL and vector transforms use the same precision as imports.
  for(const r of [...records].reverse()){
    const n=await figma.getNodeByIdAsync(state.map[r.sourceId]),p=r.props;
    for(const k of ['layoutPositioning','layoutAlign','layoutGrow'])if(k in p)n[k]=p[k];
    n.resize(p.width,p.height);
    for(const k of ['primaryAxisSizingMode','counterAxisSizingMode'])if(k in p)n[k]=p[k];
    for(const k of ['layoutSizingHorizontal','layoutSizingVertical'])if(k in p&&n.parent?.layoutMode&&n.parent.layoutMode!=='NONE')n[k]=p[k];
    if(r.type==='TEXT'&&p.textAutoResize)n.textAutoResize=p.textAutoResize;
    n.x=p.x;n.y=p.y;
    restoreTransform(n,p.relativeTransform,r.sourceId===asset.sourceId);
  }
  const root=await figma.getNodeByIdAsync(state.map[asset.sourceId]);root.x=root.y=0;
  if(asset.button){const key=root.addComponentProperty('label','TEXT','按钮');for(const t of root.findAllWithCriteria({types:['TEXT']})){for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);t.componentPropertyReferences={characters:key};}}
  await applyFinalStrokes(figma,page,records.map(r=>[state.map[r.sourceId],r.strokeStyleName??null,clean(r.props.strokes??[])]));
  wrapper.resize(root.width,root.height);wrapper.name=marker;
  return {status:'created',fileKey,pageId,key:asset.key,hash:asset.hash,rootId:root.id,wrapperId:wrapper.id,type:root.type,nodeCount:records.length,fontFallback:fontFamily==='PingFang SC'?null:fontFamily,createdNodeIds:[wrapper.id,...result.createdNodeIds],createdStyleIds:[...createdStyleIds,...result.createdStyleIds]};
}
