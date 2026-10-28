export function validateBadge(input){
 const s={size:'medium',shape:'circle',dot:false,...input};
 if(!['small','medium'].includes(s.size)||!['circle','round'].includes(s.shape)||typeof s.dot!=='boolean'||s.dot&&(s.size!=='small'||s.shape!=='circle'))throw Error('Badge仅支持当前五个真实变体');
 if(typeof s.anchor!=='string'||!s.anchor.trim())throw Error('Badge需要稳定草稿锚点路径');
 if(!Array.isArray(s.offset)||s.offset.length!==2||s.offset.some(n=>typeof n!=='number'||!Number.isFinite(n)))throw Error('Badge需要明确的二维偏移');
 if(s.dot&&s.text!==undefined)throw Error('红点没有文本槽');
 if(!s.dot&&(typeof s.text!=='string'||!s.text.trim()))throw Error('内容Badge需要非空文本，不自动推断封顶阈值');
 return s;
}
export function badgeKey(s){return [s.size,s.shape,s.dot].join('|');}
export async function positionBadge(n,s,anchor){
 const a=anchor.absoluteBoundingBox,r=n.parent.absoluteBoundingBox;if(!a||!r)throw Error('Badge锚点几何缺失');
 n.x=a.x-r.x+a.width+s.offset[0];n.y=a.y-r.y+s.offset[1];
 if(n.x<0||n.y<0||n.x+n.width>n.parent.width||n.y+n.height>n.parent.height)throw Error('Badge超出画板，调整锚点或偏移');
 const b=n.absoluteBoundingBox;
 for(const other of anchor.parent?.children??[]){if(other===anchor||other.visible===false)continue;const o=other.absoluteBoundingBox;if(o&&b.x<o.x+o.width&&b.x+b.width>o.x&&b.y<o.y+o.height&&b.y+b.height>o.y)throw Error('Badge遮挡相邻内容，调整显式偏移或页面布局');}
}
export async function updateBadge(figma,n,s,anchor){
 const main=await n.getMainComponentAsync();if(main?.id!==s.mainId)throw Error('Badge原位修改不能改变变体，使用独立状态画板');
 const texts=n.findAllWithCriteria({types:['TEXT']});if(texts.length!==(s.dot?0:1))throw Error('Badge文本槽变化');
 const before={x:n.x,y:n.y,text:texts[0]?.characters};for(const t of texts)for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 try{if(texts.length)texts[0].characters=s.text;await positionBadge(n,s,anchor);}catch(e){if(texts.length)texts[0].characters=before.text;n.x=before.x;n.y=before.y;throw e;}
 return {mutatedNodeIds:[n.id,...texts.map(t=>t.id)]};
}
export async function renderBadge(figma,root,s){
 const anchors=root.findAll(n=>n.name===s.anchorLayer);if(anchors.length!==1)throw Error('Badge锚点必须唯一存在');
 const main=await figma.getNodeByIdAsync(s.mainId);if(main?.type!=='COMPONENT')throw Error('Badge依赖缺失');
 for(const t of main.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 const n=main.createInstance();root.appendChild(n);if(root.layoutMode!=='NONE')n.layoutPositioning='ABSOLUTE';n.name='徽标/'+s.id;
 try{await updateBadge(figma,n,s,anchors[0]);}catch(e){n.remove();throw e;}return n;
}
export async function inspectBadge(n,s,anchor){const a=anchor.absoluteBoundingBox,r=n.parent.absoluteBoundingBox;return {id:n.id,mainId:(await n.getMainComponentAsync()).id,text:n.findAllWithCriteria({types:['TEXT']}).map(t=>t.characters).join(''),width:n.width,height:n.height,offset:[n.x-(a.x-r.x+a.width),n.y-(a.y-r.y)],fits:n.x>=0&&n.y>=0&&n.x+n.width<=n.parent.width&&n.y+n.height<=n.parent.height};}
export function verifyBadge(s,a){return !a||a.mainId!==s.mainId||a.text!==(s.dot?'':s.text)||!a.fits||a.offset.some((v,i)=>Math.abs(v-s.offset[i])>.01)?['Badge内容、依赖或锚点位置不符']:[];}
