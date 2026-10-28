// 单个Button资产迁移；仅修改本次创建的wrapper，不写历史组件或保护节点。
export async function initializeButtonAsset(figma,request,initializeAsset,buildNodes,restoreTransform,applyFinalStrokes){
 const {asset,fileKey,pageId}=request,marker='GACUI / '+asset.key+' / '+asset.hash;
 if(figma.fileKey!==fileKey||fileKey==='jNf9icrxfw8B7QkSQa9g33')throw Error('Button目标无效');
 const page=await figma.getNodeByIdAsync(pageId);if(page?.type!=='PAGE')throw Error('Button组件页不存在');
 await figma.setCurrentPageAsync(page);
 // Loading蓝色母件含源隐藏矩形，计数与回执必须包含实例隐藏子层。
 figma.skipInvisibleInstanceChildren=false;
 const matches=page.children.filter(n=>n.name===marker||n.name.startsWith(marker+' /'));
 if(matches.length){const w=matches[0],root=w.children[0];if(matches.length!==1||w.name!==marker||root?.type!=='COMPONENT'||w.findAll(()=>true).length!==asset.nodeCount)throw Error('Button资产未完成或结构变化，先回读');
  for(const slot of asset.slots){const n=root.children[slot.index];if(n?.type!=='INSTANCE'||(await n.getMainComponentAsync())?.id!==slot.mainId)throw Error('Button图标映射已变化');}
  return {status:'reused',fileKey,pageId,key:asset.key,hash:asset.hash,rootId:root.id,wrapperId:w.id,type:root.type,nodeCount:asset.nodeCount,createdNodeIds:[]};}
 const mains=new Map();
 // 所有外部依赖必须在首次写前验证；绝不按名称全页猜测图标。
 for(const slot of asset.slots){const m=await figma.getNodeByIdAsync(slot.mainId),w=await figma.getNodeByIdAsync(slot.wrapperId);if(m?.type!=='COMPONENT'||m.parent!==w||w.parent!==page||w.name!==slot.marker)throw Error('Button图标依赖未初始化或越界');mains.set(slot.sourceId,m);}
 const flat={...asset,hash:asset.hash+' / building',nodeCount:asset.data.nodes.length,button:false};
 const receipt=await initializeAsset(figma,{fileKey,pageId,asset:flat},buildNodes,restoreTransform,applyFinalStrokes);
 const root=await figma.getNodeByIdAsync(receipt.rootId),wrapper=await figma.getNodeByIdAsync(receipt.wrapperId),createdNodeIds=[...receipt.createdNodeIds],removedNodeIds=[];
 for(const slot of asset.slots){const old=root.children[slot.index];if(old?.name!==slot.name)throw Error('Button槽位置变化');
  const n=mains.get(slot.sourceId).createInstance();root.insertChild(slot.index,n);n.name=old.name;n.resize(old.width,old.height);
  for(const k of ['layoutPositioning','layoutAlign','layoutGrow','constraints','opacity','visible'])n[k]=old[k];n.x=old.x;n.y=old.y;
  n.layoutSizingHorizontal=old.layoutSizingHorizontal;n.layoutSizingVertical=old.layoutSizingVertical;
  createdNodeIds.push(n.id,...n.findAll(()=>true).map(c=>c.id));removedNodeIds.push(old.id);old.remove();
  const vectors=n.children.filter(v=>v.type==='VECTOR');if(vectors.length!==slot.paints.length)throw Error('Button图标子层不匹配');
  for(let i=0;i<vectors.length;i++){const v=vectors[i],p=slot.paints[i];v.fills=p.fills;v.strokes=p.strokes;
   if(p.fillStyleName)await v.setFillStyleIdAsync(request.paintMap[p.fillStyleName]);if(p.strokeStyleName)await v.setStrokeStyleIdAsync(request.paintMap[p.strokeStyleName]);}
  if(slot.propertyName){const prop=root.addComponentProperty(slot.propertyName,'INSTANCE_SWAP',slot.mainId);n.componentPropertyReferences={...n.componentPropertyReferences,mainComponent:prop};}
 }
 for(const t of root.children.filter(n=>n.type==='TEXT')){for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);const p=root.addComponentProperty('label','TEXT',t.characters);t.componentPropertyReferences={...t.componentPropertyReferences,characters:p};}
 if(wrapper.findAll(()=>true).length!==asset.nodeCount)throw Error('Button最终子树数量不符');
 wrapper.name=marker;
 return {...receipt,hash:asset.hash,nodeCount:asset.nodeCount,createdNodeIds,removedNodeIds};
}
