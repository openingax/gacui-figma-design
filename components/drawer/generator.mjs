import {readFileSync} from 'node:fs';
import {isMain} from '../../support/entry.mjs';
const data=JSON.parse(readFileSync(new URL('./build-data.json',import.meta.url)));
export function validateSpec(s={}){
 const sizes={small:300,medium:500,large:760};
 if(s.size!==undefined&&!Object.hasOwn(sizes,s.size))throw Error('未知抽屉尺寸');
 if(s.footer!==undefined&&!['left','right'].includes(s.footer))throw Error('未知底栏布局');
 if(s.closeState!==undefined&&!['normal','hover','active'].includes(s.closeState))throw Error('未知关闭外观');
 for(const k of ['title','confirm','cancel','body'])if(s[k]!==undefined&&typeof s[k]!=='string')throw Error(k+'须为字符串');
 const width=sizes[s.size??'medium'];
 if(s.viewportWidth!==undefined&&(!Number.isFinite(s.viewportWidth)||s.viewportWidth<width))throw Error('视口宽度不能小于抽屉');
 if(s.viewportHeight!==undefined&&(!Number.isFinite(s.viewportHeight)||s.viewportHeight<112))throw Error('视口高度至少112');
 return {...s,size:s.size??'medium',footer:s.footer??'right',closeState:s.closeState??'normal',viewportWidth:s.viewportWidth??1440,viewportHeight:s.viewportHeight??900};
}
// 仅 Drawer 共享组合层；原生属性与矢量来自 build-data，不建立通用渲染DSL。
// options.fontFamily/headingStyle let a blank target use PingFang; the team target keeps Noto.
// options.reactions=false: Buttons built one by one in a blank file are not variants of one set, so the
// source hover CHANGE_TO cannot be expressed there; the static design is unchanged.
export async function buildLibrary(figma,page,data,options={}){
 if(page.children.some(n=>n.name==='Drawer 抽屉'))throw Error('Drawer已存在，请回读映射后复用');
 const created=[],map={},ids=n=>[n.id,...('children'in n?n.children.flatMap(ids):[])];
 const paints=await figma.getLocalPaintStylesAsync();
 const clone=x=>JSON.parse(JSON.stringify(x)),clean=x=>JSON.stringify(x,(k,v)=>k==='boundVariables'?undefined:v);
 const family=options.fontFamily??'Noto Sans SC',font={family,style:'Regular'},heading={family,style:options.headingStyle??'Medium'};
 const labelKey=n=>{const k=Object.keys(n.componentProperties).find(k=>k.split('#')[0]==='label');if(!k)throw Error('Button缺少label属性');return k;};
 await figma.loadFontAsync(font);await figma.loadFontAsync(heading);
 async function load(n){for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);}
 const base=await figma.getNodeByIdAsync(data.buttonTargets['22709:33461']);const neutral=await figma.getNodeByIdAsync(data.buttonTargets['22709:33639']);
 for(const n of [base,neutral]){if(!n||n.type!=='COMPONENT'||!n.name.includes('state 状态=normal 默认'))throw Error('Button依赖不匹配');await load(n);}
 function node(kind,name,w,h,parent=page){const n=kind==='COMPONENT'?figma.createComponent():kind==='TEXT'?figma.createText():kind==='VECTOR'?figma.createVector():kind==='RECTANGLE'?figma.createRectangle():figma.createFrame();parent.appendChild(n);n.name=name;n.resize(w,h);if('fills'in n)n.fills=[];if('strokes'in n)n.strokes=[];if('clipsContent'in n)n.clipsContent=false;created.push(n.id);return n;}
 async function paint(n,kind,values,styleId){const source=data.styles[styleId];const matches=source?paints.filter(s=>s.name===source.name):[];if(matches.length>1||matches.length===1&&clean(matches[0].paints)!==clean(values))throw Error('样式冲突 '+source.name);if(matches.length){await n[kind==='fills'?'setFillStyleIdAsync':'setStrokeStyleIdAsync'](matches[0].id);}else n[kind]=clone(values);}
 async function surface(n,source){await paint(n,'fills',source.fills,source.fillStyleId);n.cornerRadius=source.cornerRadius?.__figmaMixed?0:source.cornerRadius??0;n.opacity=source.opacity;n.effects=clone(source.effects);}
 const strokes=[];function border(n,s){for(const k of ['strokeAlign','strokeTopWeight','strokeRightWeight','strokeBottomWeight','strokeLeftWeight'])if(k in s)n[k]=s[k];strokes.push([n,s]);}
 function remember(s,n){map[s.id]=n.id;return n;}
 const close=[];
 for(const [i,s]of data.close.children.entries()){
  const c=remember(s,node('COMPONENT',s.name,20,20));c.x=80+i*120;c.y=220;await surface(c,s);c.layoutMode='HORIZONTAL';c.primaryAxisSizingMode='AUTO';c.counterAxisSizingMode='AUTO';c.primaryAxisAlignItems='CENTER';c.counterAxisAlignItems='CENTER';c.paddingLeft=c.paddingRight=c.paddingTop=c.paddingBottom=2;c.itemSpacing=8;
  const glyph=node('FRAME','Math & Finance',16,16,c);const source=data.closeVector;const v=remember(source,node('VECTOR','Vector',source.width,source.height,glyph));await v.setVectorNetworkAsync(clone(source.vectorNetwork));v.x=source.x;v.y=source.y;v.strokeWeight=source.strokeWeight;await paint(v,'fills',source.fills,source.fillStyleId);v.constraints=clone(source.constraints);close.push(c);
 }
 const closeSet=figma.combineAsVariants(close,page);created.push(closeSet.id);closeSet.name='Drawer / 关闭控件';closeSet.x=80;closeSet.y=180;close.forEach((c,i)=>{c.x=24+i*120;c.y=24;});closeSet.resize(320,68);
 const header=remember(data.header,node('COMPONENT','Drawer / 标题栏',400,56));header.x=80;header.y=320;await surface(header,data.header);border(header,data.header);
 const title=node('TEXT','title',32,24,header);title.fontName=heading;title.fontSize=16;title.lineHeight={unit:'PIXELS',value:24};title.letterSpacing={unit:'PERCENT',value:0};title.characters='标题';title.textAutoResize='WIDTH_AND_HEIGHT';title.x=16;title.y=16;title.textAlignVertical='CENTER';title.constraints={horizontal:'MIN',vertical:'CENTER'};await paint(title,'fills',data.header.children[0].fills,'');const titleProperty=header.addComponentProperty('标题','TEXT','标题');title.componentPropertyReferences={characters:titleProperty};
 const closeInst=close[0].createInstance();header.appendChild(closeInst);closeInst.name='close';created.push(...ids(closeInst));closeInst.x=364;closeInst.y=18;closeInst.constraints={horizontal:'MAX',vertical:'CENTER'};
 const footers={};
 for(const side of ['left','right']){
  const source=side==='left'?data.footerLeft:data.footerRight;const f=remember(source,node('COMPONENT','按钮位置='+side,400,56));await surface(f,source);border(f,source);
  const group=node('FRAME','btn group',128,32,f);group.layoutMode='HORIZONTAL';group.primaryAxisSizingMode='AUTO';group.counterAxisSizingMode='AUTO';group.itemSpacing=8;group.x=side==='left'?16:256;group.y=12;group.constraints={horizontal:side==='left'?'MIN':'MAX',vertical:'CENTER'};
  for(const sn of source.children[0].children){const primary=sn.mainComponentId==='22709:33461';const b=(primary?base:neutral).createInstance();group.appendChild(b);created.push(...ids(b));b.name=primary?'confirm':'cancel';b.setProperties({[labelKey(b)]:primary?'确定':'取消'});b.layoutSizingHorizontal='HUG';b.layoutSizingVertical='HUG';
   // 保留源 Button 的悬停目标映射；不修改共享 Button 母组件。
   if(options.reactions!==false){const reactions=clone(sn.reactions).map(r=>{delete r.action;for(const a of r.actions??[])if(a.destinationId){const target=data.buttonTargets[a.destinationId];if(!target)throw Error('未映射交互目标');a.destinationId=target;}return r;});await b.setReactionsAsync(reactions);}
  }
  footers[side]=f;
 }
 const footerSet=figma.combineAsVariants(Object.values(footers),page);created.push(footerSet.id);footerSet.name='Drawer / 底栏';footerSet.x=80;footerSet.y=460;Object.values(footers).forEach((f,i)=>{f.x=24;f.y=24+i*90;});footerSet.resize(448,194);
 const overlay=remember(data.overlay,node('COMPONENT','Drawer / 蒙层',80,80));overlay.x=600;overlay.y=320;overlay.opacity=data.overlay.opacity;const rect=remember(data.overlay.children[0],node('RECTANGLE','overlay',80,80,overlay));await paint(rect,'fills',data.overlay.children[0].fills,data.overlay.children[0].fillStyleId);rect.constraints={horizontal:'SCALE',vertical:'SCALE'};
 const variants=[];
 for(const [size,width]of Object.entries(data.sizes)){
  const c=node('COMPONENT','尺寸='+size,1440,900);c.clipsContent=true;
  const mask=overlay.createInstance();c.appendChild(mask);mask.name='overlay';created.push(...ids(mask));mask.resize(1440,900);mask.constraints={horizontal:'STRETCH',vertical:'STRETCH'};
  const panel=node('FRAME','Drawer',width,900,c);panel.x=1440-width;panel.constraints={horizontal:'MAX',vertical:'STRETCH'};panel.clipsContent=true;await paint(panel,'fills',data.header.fills,data.header.fillStyleId);
  const hi=header.createInstance();panel.appendChild(hi);hi.name='header';created.push(...ids(hi));hi.resize(width,56);hi.constraints={horizontal:'STRETCH',vertical:'MIN'};
  const body=node('FRAME','content',width,788,panel);body.y=56;body.clipsContent=true;body.constraints={horizontal:'STRETCH',vertical:'STRETCH'};
  const fi=footers.right.createInstance();panel.appendChild(fi);fi.name='footer';created.push(...ids(fi));fi.resize(width,56);fi.y=844;fi.constraints={horizontal:'STRETCH',vertical:'MAX'};
  variants.push(c);
 }
 const set=figma.combineAsVariants(variants,page);created.push(set.id);set.name='Drawer 抽屉';set.description='右侧有蒙层；small=300、medium=500、large=760。共享标题、关闭三态及左右底栏。临时 Noto 字体，待苹方替换及用户验收；未实现业务关闭/提交。';set.x=80;set.y=780;variants.forEach((v,i)=>{v.x=24;v.y=24+i*960;});set.resize(1488,2868);
 // 几何完成后才提交描边，避免桌面中间轮廓残留。
 for(const [n,s]of strokes)await paint(n,'strokes',s.strokes,s.strokeStyleId);
 return {createdNodeIds:created,map,pageId:page.id,componentSetId:set.id,closeSetId:closeSet.id,headerId:header.id,titleProperty,footerSetId:footerSet.id,footerIds:Object.fromEntries(Object.entries(footers).map(([k,n])=>[k,n.id])),overlayId:overlay.id,closeIds:Object.fromEntries(['normal','hover','active'].map((k,i)=>[k,close[i].id])),variants:Object.fromEntries(Object.keys(data.sizes).map((k,i)=>[k,variants[i].id])),fontSubstitution:'Noto Sans SC Regular/Medium；规范 PingFang SC Regular/Semibold'};
}
export async function updateDrawer(figma,node,s,library){
 const ids=[],created=[];for(const t of node.findAllWithCriteria({types:['TEXT']}))for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);
 const oldId=node.id;if(node.type==='INSTANCE')node=node.detachInstance();
 ids.push(oldId,node.id);const panel=node.children.find(n=>n.name==='Drawer');if(!panel)throw Error('不是Drawer组合');
 const width={small:300,medium:500,large:760}[s.size];node.resize(s.viewportWidth,s.viewportHeight);panel.resize(width,s.viewportHeight);panel.x=s.viewportWidth-width;
 const mask=node.children.find(n=>n.name==='overlay');mask.resize(s.viewportWidth,s.viewportHeight);
 const header=panel.children.find(n=>n.name==='header');header.resize(width,56);header.x=0;header.y=0;
 // Property keys carry a per-file suffix; a blank target's keys differ from the team target's.
 const keys=n=>Object.keys(n.componentProperties),titleKey=keys(header).find(k=>k===library.titleProperty)??keys(header).find(k=>k.split('#')[0]==='标题');if(!titleKey)throw Error('Drawer标题栏缺少标题属性');
 header.setProperties({[titleKey]:s.title??'标题'});
 const title=header.findOne(n=>n.type==='TEXT'&&n.name==='title');const close=header.findOne(n=>n.type==='INSTANCE'&&n.name==='close');if(close&&s.closeState)close.swapComponent(await figma.getNodeByIdAsync(library.closeIds[s.closeState]));
 // 规范标题自然宽度。超长时报告而不偷偷缩字/省略。
 const warnings=[];if(title.width>width-68)warnings.push('标题超出安全宽度，需业务缩短标题或确认新的换行规范');
 let footer=panel.children.find(n=>n.name==='footer');if(footer.type==='INSTANCE'){footer.swapComponent(await figma.getNodeByIdAsync(library.footerIds[s.footer]));footer=footer.detachInstance();footer.name='footer';}footer.resize(width,56);footer.x=0;footer.y=s.viewportHeight-56;
 const group=footer.children.find(n=>n.name==='btn group');
 const order=s.footer==='left'?['confirm','cancel']:['cancel','confirm'];for(const [i,name]of order.entries()){const b=group.children.find(n=>n.name===name);group.insertChild(i,b);}
 for(const b of group.children){if(b.type==='INSTANCE'&&['confirm','cancel'].includes(b.name)){b.setProperties({[keys(b).find(k=>k.split('#')[0]==='label')]:s[b.name]??(b.name==='confirm'?'确定':'取消')});if(library.buttonReactions!==null){if(!library.buttonReactions?.[b.name])throw Error('缺少源按钮交互映射');await b.setReactionsAsync(library.buttonReactions[b.name]);}}}
 group.x=s.footer==='left'?16:width-16-group.width;group.y=12;if(group.width>width-32)warnings.push('按钮总宽度超出底栏，需缩短文案');
 const body=panel.children.find(n=>n.name==='content');body.resize(width,s.viewportHeight-112);body.x=0;body.y=56;
 if(s.body!==undefined){let t=body.children.find(n=>n.type==='TEXT'&&n.name==='body');if(!t){t=figma.createText();body.appendChild(t);created.push(t.id);t.name='body';t.fontName={family:'Noto Sans SC',style:'Regular'};}await figma.loadFontAsync(t.fontName);t.fontSize=14;t.lineHeight={unit:'PIXELS',value:22};t.characters=s.body;t.resize(width-32,22);t.textAutoResize='HEIGHT';t.x=16;t.y=16;t.fills=[{type:'SOLID',color:{r:0.09019608050584793,g:0.12156862765550613,b:0.14901961386203766}}];if(t.height>body.height-32)warnings.push('内容超过可视区，源未定义滚动策略');}
 function walk(n){ids.push(n.id);if('children'in n)n.children.forEach(walk);}walk(node);return {nodeId:node.id,previousId:oldId,createdNodeIds:created,mutatedNodeIds:[...new Set(ids)],warnings};
}
export function buttonReactions(){return Object.fromEntries(data.footerRight.children[0].children.map(b=>[b.mainComponentId==='22709:33461'?'confirm':'cancel',b.reactions.map(r=>({trigger:r.trigger,actions:r.actions.map(a=>({...a,destinationId:data.buttonTargets[a.destinationId]}))}))]));}
export function generate(stage,target,state={},spec={}){
 if(!target.fileKey||target.fileKey==='jNf9icrxfw8B7QkSQa9g33'||!/^\d+:\d+$/.test(target.pageId??''))throw Error('需要已授权目标文件/Page');
 state={...state,buttonReactions:buttonReactions()};
 const pre=`if(figma.fileKey!==${JSON.stringify(target.fileKey)})throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(${JSON.stringify(target.pageId)});await figma.setCurrentPageAsync(page);`;
 if(stage==='library')return pre+`const data=${JSON.stringify(data)};${buildLibrary.toString()};return await buildLibrary(figma,page,data);`;
 if(stage==='example')return pre+`const library=${JSON.stringify(state)};const spec=${JSON.stringify(validateSpec(spec))};${updateDrawer.toString()};const main=await figma.getNodeByIdAsync(library.variants[spec.size]);if(main.parent.parent!==page)throw Error('组件不在授权Page');for(const t of main.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);const instance=main.createInstance();page.appendChild(instance);instance.x=Math.max(0,...page.children.filter(n=>n!==instance).map(n=>n.x+n.width))+80;instance.y=780;instance.name='Drawer / 修改验证';const result=await updateDrawer(figma,instance,spec,library);return {...result,createdNodeIds:result.mutatedNodeIds};`;
 if(stage==='update')return pre+`const library=${JSON.stringify(state)};const spec=${JSON.stringify(validateSpec(spec))};${updateDrawer.toString()};const node=await figma.getNodeByIdAsync(${JSON.stringify(spec.nodeId)});let owner=node;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(!node||owner!==page||node.type!=='FRAME'&&node.type!=='INSTANCE')throw Error('修改目标不在授权Page');return await updateDrawer(figma,node,spec,library);`;
 throw Error('未知阶段');
}
