export function buttonEqual(a,b){
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<1e-6||a===Math.fround(b);
 if(a===b)return true;if(a==null||b==null||typeof a!=='object'||typeof b!=='object')return false;
 const keys=v=>Object.keys(v).filter(k=>!(k==='boundVariables'&&Object.keys(v[k]).length===0)).sort(),ak=keys(a),bk=keys(b);
 return JSON.stringify(ak)===JSON.stringify(bk)&&ak.every(k=>buttonEqual(a[k],b[k]));
}
export async function preflightBusinessButton(figma,prepared,catalog){
 if(figma.fileKey!==catalog.fileKey)throw Error('Button目标文件不符');
 if(catalog.bindStyles){const styles=await figma.getLocalPaintStylesAsync();for(const r of [prepared.root,prepared.text,prepared.icon,...(prepared.icon?.vectors??[])].filter(Boolean))for(const k of ['fill','stroke'])if(r[k+'StyleName']){const matches=styles.filter(s=>s.name===r[k+'StyleName']);if(matches.length!==1||!buttonEqual(matches[0].paints,r.props[k==='fill'?'fills':'strokes']))throw Error('Button精确颜色样式变化');r[k+'StyleId']=matches[0].id;}}
 const main=await figma.getNodeByIdAsync(prepared.mainId);if(main?.type!=='COMPONENT'||main.parent?.id!==prepared.setId)throw Error('Button模板依赖缺失');
 if(prepared.icon){const icon=await figma.getNodeByIdAsync(prepared.icon.mainId);if(icon?.type!=='COMPONENT'||icon.parent?.id!==(prepared.icon.parentId??catalog.pageId))throw Error('Button图标依赖缺失');}
 for(const node of [main,...(prepared.icon?[await figma.getNodeByIdAsync(prepared.icon.mainId)]:[])]){let owner=node;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner?.id!==catalog.pageId)throw Error('Button依赖跨页');}
 for(const record of [prepared.root,prepared.text,prepared.icon,...(prepared.icon?.vectors??[])].filter(Boolean))for(const kind of ['fill','stroke']){const id=record[kind+'StyleId'];if(!id)continue;const style=await figma.getStyleByIdAsync(id);if(style?.type!=='PAINT'||!buttonEqual(style.paints,record.props[kind==='fill'?'fills':'strokes']))throw Error('Button精确颜色样式变化');}
 return main;
}
export async function applyButtonPaint(figma,n,record){
 n.fills=JSON.parse(JSON.stringify(record.props.fills??[]));n.strokes=JSON.parse(JSON.stringify(record.props.strokes??[]));
 if(record.fillStyleId)await n.setFillStyleIdAsync(record.fillStyleId);if(record.strokeStyleId)await n.setStrokeStyleIdAsync(record.strokeStyleId);
}
export async function applyBusinessButton(figma,n,prepared){
 const s=prepared.spec,p=prepared.root.props,t=n.children.find(n=>n.name==='按钮文字');let icon=n.children.find(n=>n.name==='按钮图标');
 if(!!t!==!!prepared.text)throw Error('Button文字结构变化');
 if(t)for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 n.layoutMode=p.layoutMode;n.resize(p.width,p.height);
 for(const k of ['layoutWrap','primaryAxisAlignItems','counterAxisAlignItems','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing','clipsContent','opacity','cornerRadius','cornerSmoothing','strokeWeight','strokeAlign','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight','effects'])if(k in p)n[k]=JSON.parse(JSON.stringify(p[k]));
 await applyButtonPaint(figma,n,prepared.root);
 if(t){const r=prepared.text.props;for(const k of ['fontSize','lineHeight','letterSpacing','textAlignHorizontal','textAlignVertical','textCase','textDecoration','paragraphIndent','paragraphSpacing','textTruncation','maxLines','constraints'])if(k in r)t[k]=JSON.parse(JSON.stringify(r[k]));t.textAutoResize=r.textAutoResize;t.characters=s.label;await applyButtonPaint(figma,t,prepared.text);}
 if(prepared.icon){const r=prepared.icon.props,main=await figma.getNodeByIdAsync(prepared.icon.mainId);if(main?.type!=='COMPONENT')throw Error('Button图标依赖失效');
  if(!icon){icon=main.createInstance();n.appendChild(icon);icon.name='按钮图标';}else if((await icon.getMainComponentAsync()).id!==main.id)icon.swapComponent(main);
  icon.visible=true;icon.resize(r.width,r.height);icon.opacity=r.opacity;icon.constraints=JSON.parse(JSON.stringify(r.constraints));icon.layoutPositioning=r.layoutPositioning;icon.layoutAlign=r.layoutAlign;icon.layoutGrow=r.layoutGrow;
  if(prepared.icon.position===0)n.insertChild(0,icon);else n.appendChild(icon);const vectors=icon.children.filter(v=>v.type==='VECTOR');if(vectors.length!==prepared.icon.vectors.length)throw Error('Button矢量结构不符');
  for(let i=0;i<vectors.length;i++)await applyButtonPaint(figma,vectors[i],prepared.icon.vectors[i]);
  if(p.layoutMode==='NONE'){icon.x=r.x;icon.y=r.y;}
 }else if(icon)icon.visible=false;
 if(p.layoutMode==='NONE'&&t){const r=prepared.text.props;t.x=r.x+(r.constraints?.horizontal==='CENTER'?(r.width-t.width)/2:0);t.y=r.y+(r.constraints?.vertical==='CENTER'?(r.height-t.height)/2:0);}
 n.primaryAxisSizingMode=p.primaryAxisSizingMode;n.counterAxisSizingMode=p.counterAxisSizingMode;
 if(s.width!==undefined){n.primaryAxisSizingMode='FIXED';n.resize(s.width,p.height);}
 if(p.layoutMode==='NONE')n.resize(p.width,p.height);
}
export async function inspectBusinessButton(n){
 const t=n.children.find(c=>c.name==='按钮文字'),icon=n.children.find(c=>c.name==='按钮图标'&&c.visible),main=icon?await icon.getMainComponentAsync():null;
 const props=x=>({x:x.x,y:x.y,width:x.width,height:x.height,fills:x.fills,strokes:x.strokes,fillStyleId:x.fillStyleId,strokeStyleId:x.strokeStyleId});
 return {nodeId:n.id,name:n.name,...props(n),layoutMode:n.layoutMode,radius:n.cornerRadius,padding:[n.paddingTop,n.paddingRight,n.paddingBottom,n.paddingLeft],gap:n.itemSpacing,
  text:t?{id:t.id,text:t.characters,fontSize:t.fontSize,lineHeight:t.lineHeight,...props(t)}:null,
  icon:icon?{id:icon.id,mainId:main?.id,position:n.children.filter(c=>c.visible).indexOf(icon),...props(icon),vectors:icon.children.filter(v=>v.type==='VECTOR').map(v=>({...props(v),regions:v.vectorNetwork.regions}))}:null,
  nodeIds:[n.id,...n.findAll(()=>true).map(c=>c.id)]};
}
export function verifyBusinessButton(prepared,a){
 const s=prepared.spec,p=prepared.root.props,errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg);};
 check(buttonEqual(a.height,p.height),'Button高度不符');check(a.layoutMode===p.layoutMode&&a.radius===p.cornerRadius,'Button布局或圆角不符');
 check(buttonEqual(a.padding,[p.paddingTop,p.paddingRight,p.paddingBottom,p.paddingLeft])&&a.gap===p.itemSpacing,'Button内边距或间距不符');
 for(const [actual,expected]of [[a,prepared.root],[a.text,prepared.text]])if(expected){check(!!actual,'Button缺少内容');if(!actual)continue;for(const kind of ['fill','stroke']){check(buttonEqual(actual[kind==='fill'?'fills':'strokes'],expected.props[kind==='fill'?'fills':'strokes']),'Button颜色不符');if(expected[kind+'StyleId'])check(actual[kind+'StyleId']===expected[kind+'StyleId'],'Button颜色样式不符');}}
 if(prepared.text)check(a.text?.text===s.label&&a.text?.fontSize===prepared.text.props.fontSize&&buttonEqual(a.text?.lineHeight,prepared.text.props.lineHeight),'Button文字不符');else check(!a.text,'Button不应含文字');
 if(prepared.icon){check(a.icon?.mainId===prepared.icon.mainId&&a.icon?.position===prepared.icon.position,'Button图标引用或位置不符：'+JSON.stringify({id:s.id,actual:a.icon?{mainId:a.icon.mainId,position:a.icon.position}:null,expected:{mainId:prepared.icon.mainId,position:prepared.icon.position}}));check(a.icon?.width===prepared.icon.props.width&&a.icon?.height===prepared.icon.props.height,'Button图标尺寸不符');check(a.icon?.vectors.length===prepared.icon.vectors.length,'Button图标矢量数量不符');for(let i=0;i<prepared.icon.vectors.length;i++){const v=a.icon?.vectors[i],r=prepared.icon.vectors[i];check(!!v&&buttonEqual(v.fills,r.props.fills)&&buttonEqual(v.strokes,r.props.strokes),'Button图标颜色不符');if(v)check(v.regions.every(region=>buttonEqual(region.fills??v.fills,r.props.fills)),'Button图标区域颜色不符');}}
 else check(!a.icon,'Button存在多余图标');
 if(s.width!==undefined)check(buttonEqual(a.width,s.width),'Button指定宽度不符');else if(p.layoutMode==='NONE')check(buttonEqual(a.width,p.width),'Button形状宽度不符');
 for(const c of [a.text,a.icon].filter(Boolean))check(c.x>=-.01&&c.y>=-.01&&c.x+c.width<=a.width+.01&&c.y+c.height<=a.height+.01,'Button内容越界');
 return errors;
}
export function removeUnusedButtonIcon(n,prepared){if(prepared.icon)return;const icon=n.children.find(c=>c.name==='按钮图标');if(icon)icon.remove();}
export async function renderBusinessButton(figma,parent,prepared,catalog){
 const main=await preflightBusinessButton(figma,prepared,catalog);for(const t of main.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 let n;try{n=main.createInstance();parent.appendChild(n);n=n.detachInstance();n.name='按钮/'+prepared.spec.id;for(const c of n.children)if(c.type==='TEXT')c.name='按钮文字';else if(c.type==='INSTANCE')c.name='按钮图标';
  await applyBusinessButton(figma,n,prepared);const errors=verifyBusinessButton(prepared,await inspectBusinessButton(n));if(errors.length)throw Error(errors.join('；'));removeUnusedButtonIcon(n,prepared);return n;
 }catch(e){if(n&&!n.removed)n.remove();throw e;}
}
export async function updateBusinessButton(figma,n,before,next,catalog){
 for(const key of ['id','size','shape','icon'])if(before.spec[key]!==next.spec[key])throw Error('Button同结构更新不能改变 '+key);
 const initial=await inspectBusinessButton(n),oldErrors=verifyBusinessButton(before,initial);if(oldErrors.length)throw Error('Button更新前状态不符：'+oldErrors.join('；'));
 await preflightBusinessButton(figma,before,catalog);await preflightBusinessButton(figma,next,catalog);
 try{await applyBusinessButton(figma,n,next);const errors=verifyBusinessButton(next,await inspectBusinessButton(n));if(errors.length)throw Error(errors.join('；'));removeUnusedButtonIcon(n,next);return await inspectBusinessButton(n);}
 catch(e){await applyBusinessButton(figma,n,before);removeUnusedButtonIcon(n,before);const restored=await inspectBusinessButton(n);if(!buttonEqual(restored,initial))throw Error('Button回滚未恢复原状态：'+e.message);throw e;}
}
