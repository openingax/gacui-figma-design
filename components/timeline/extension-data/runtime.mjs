// Private extension runtime. Only copied validation/output nodes are changed.
export function validateTimelineExtended(s) {
 const layout=s.layout??'vertical',align=s.align??(layout==='vertical'?'left':'top'),mode=s.mode??'same';
 if(!['vertical','horizontal'].includes(layout)||!(layout==='vertical'?['left','right','alternate']:['top','bottom','alternate']).includes(align)||!['same','alternate'].includes(mode))throw Error('时间线布局组合不在当前组件库');
 if(!Array.isArray(s.items))throw Error('时间线需要items');
 const ids=new Set();for(const i of s.items){if(typeof i.id!=='string'||!i.id||ids.has(i.id)||!['time','actor','action','detail'].every(k=>typeof i[k]==='string')||!i.time||!i.actor||!i.action||!['default','primary','success','warning','danger'].includes(i.color??'default')||![undefined,'loading','custom'].includes(i.icon))throw Error('时间线条目需要唯一id、完整文案及当前颜色/图标');ids.add(i.id);}
 if(s.icon!==undefined)throw Error('时间线图标请逐项配置');return s;
}
export async function renderTimelineExtended(figma,parent,s,h){
 if(s.layout==='horizontal'&&s.items.length&&(h.width??1192)/s.items.length<120)throw Error('水平时间线每项至少需要120px，请加宽画板或使用垂直布局');
 const {deps}=h,key=[s.layout??'vertical',s.align??((s.layout??'vertical')==='vertical'?'left':'top'),s.mode??'same'].join('|');
 const main=await figma.getNodeByIdAsync(deps.layouts[key]);if(!main||main.type!=='COMPONENT')throw Error('时间线目标依赖缺失');
 const fonts=main.findAllWithCriteria({types:['TEXT']}).flatMap(t=>t.getStyledTextSegments(['fontName']).map(x=>x.fontName));await Promise.all([...new Map(fonts.map(f=>[JSON.stringify(f),f])).values()].map(f=>figma.loadFontAsync(f)));
 const block=h.autoFrame(parent,'日志时间线/'+s.id,(s.layout??'vertical')==='horizontal'?'HORIZONTAL':'VERTICAL',h.width??1192);block.itemSpacing=0;
 if(!s.items.length){await h.text(block,'空日志','暂无操作日志');return block;}
 // The first two source items express alternating layout; item count is business data.
 for(let i=0;i<s.items.length;i++){const source=main.children[(s.align==='alternate'?i%2:0)],n=source.clone();block.appendChild(n);n.name='日志项/'+s.items[i].id;const texts=n.findAllWithCriteria({types:['TEXT']}),date=texts.find(t=>/^\d{4}-\d{2}-\d{2}$/.test(t.characters)),title=texts.find(t=>t!==date);if(!date||!title)throw Error('时间线文本槽位不完整');date.name='date';title.name='title';const detail=title.clone();title.parent.appendChild(detail);detail.name='日志说明';}
 await updateTimelineExtended(figma,block,s,h);return block;
}
export async function updateTimelineExtended(figma,block,s,h){
 const horizontal=s.layout==='horizontal',mode=s.mode??'same',align=s.align??(horizontal?'top':'left'),width=h.width??1192,rows=block.children.filter(n=>n.name.startsWith('日志项/'));
 if(horizontal&&rows.length&&width/rows.length<120)throw Error('水平时间线每项至少需要120px，请加宽画板或使用垂直布局');
 if(rows.length!==s.items.length||rows.some((r,i)=>r.name!=='日志项/'+s.items[i].id))throw Error('时间线结构修改需保持条目id及顺序');
 const styles=await figma.getLocalPaintStylesAsync(),names={default:'Gray 中性/Gray4-边框',primary:'Brand 品牌/Brand5-Normal',success:'Success 成功/Success5-Normal',warning:'Warning 警告/Warning5-Normal',danger:'Error 错误/Error5-Normal'};
 const prepared=[];
 for(const [i,n] of rows.entries()){
  const item=s.items[i],w=horizontal?width/rows.length:width,side=align==='alternate'?(i%2?(horizontal?'bottom':'right'):(horizontal?'top':'left')):align;
  const dot=n.findOne(x=>x.name==='dot'),title=n.findOne(x=>x.type==='TEXT'&&x.name==='title'),date=n.findOne(x=>x.type==='TEXT'&&x.name==='date'),detail=n.findOne(x=>x.type==='TEXT'&&x.name==='日志说明');
  if(!dot||!title||!date||!detail)throw Error('时间线副本槽位缺失');
  // Reparent text inside this newly created copy; stable text IDs survive content edits.
  for(const t of [title,date,detail]){await Promise.all(t.getStyledTextSegments(['fontName']).map(x=>figma.loadFontAsync(x.fontName)));if(t.parent!==n)n.appendChild(t);}
  n.layoutMode='NONE';n.layoutGrow=0;n.clipsContent=false;
  const textWidth=horizontal?Math.max(40,w-80):mode==='alternate'||align==='alternate'?(w-40)/2:w-24;
  title.fontSize=16;title.lineHeight={unit:'PIXELS',value:24};date.fontSize=mode==='alternate'?16:14;date.lineHeight={unit:'PIXELS',value:mode==='alternate'?24:22};detail.fontSize=12;detail.lineHeight={unit:'PIXELS',value:20};
  for(const [t,v] of [[title,item.actor+' · '+item.action],[date,item.time],[detail,item.detail]]){await h.setText(t,v);t.textAutoResize='HEIGHT';t.resize(textWidth,t.height);t.textAutoResize='HEIGHT';}
  detail.fontSize=12;detail.lineHeight={unit:'PIXELS',value:20};
  const lineNodes=n.findAll(x=>x.type==='RECTANGLE'&&(['divider','divider/horizontal','连接线前','连接线后'].includes(x.name)));
  // Keep the original dot and exact connector geometries, moving them out of empty source wrappers.
  if(dot.parent!==n)n.appendChild(dot);for(const l of lineNodes)if(l.parent!==n)n.appendChild(l);
  for(const c of [...n.children])if(![dot,title,date,detail,...lineNodes].includes(c)&&!c.name.startsWith('Timeline图标'))c.visible=false;
  let icon=n.children.find(c=>c.name.startsWith('Timeline图标'));
  if(item.icon){if(icon?.type==='FRAME'&&icon.name!=='Timeline图标/'+item.icon)throw Error('原位修改保持图标类型不变');if(!icon){const m=await figma.getNodeByIdAsync(h.deps.icons[item.icon]);if(!m||m.type!=='COMPONENT')throw Error('图标依赖缺失');icon=m.createInstance();n.appendChild(icon);}if(icon.type==='INSTANCE')icon=icon.detachInstance();icon.name='Timeline图标/'+item.icon;icon.visible=true;dot.visible=false;}else {if(icon)icon.visible=false;dot.visible=true;}
  const style=styles.find(x=>x.name===names[item.color??'default']);if(!style)throw Error('缺少时间线语义颜色样式');await dot.setStrokeStyleIdAsync(style.id);
  if(icon?.visible){const solid=style.paints.find(p=>p.type==='SOLID');if(!solid)throw Error('时间线语义样式缺少纯色');const paint=p=>p.type==='SOLID'?{...p,color:solid.color}:p.type.startsWith('GRADIENT_')?{...p,gradientStops:p.gradientStops.map(stop=>({...stop,color:{...solid.color,a:stop.color.a}}))}:p;for(const v of icon.findAll(x=>x.type==='VECTOR')){for(const field of ['fills','strokes'])if(Array.isArray(v[field])&&v[field].length)v[field]=v[field].map(paint);const net=v.vectorNetwork;if(net.regions?.some(r=>r.fills?.length)){const x=v.x,y=v.y;await v.setVectorNetworkAsync({...net,regions:net.regions.map(r=>({...r,fills:r.fills?.map(paint)??[]}))});v.x=x;v.y=y;}}}
  const marker=icon?.visible?icon:dot,bodyHeight=title.height+detail.height,dateHeight=date.height;
  prepared.push({n,i,w,side,dot,marker,title,date,detail,lineNodes,bodyHeight,dateHeight,textWidth});
 }
 if(horizontal){
  // All dot centers share the same baseline even when upper/lower text wraps.
  const above=Math.max(0,...prepared.map(r=>mode==='alternate'?(r.side==='top'?r.dateHeight:r.bodyHeight):r.side==='bottom'?r.bodyHeight+r.dateHeight:0));
  const lineY=above?above+16:4;
  const height=lineY+16+Math.max(...prepared.map(r=>mode==='alternate'?(r.side==='top'?r.bodyHeight:r.dateHeight):r.side==='top'?r.bodyHeight+r.dateHeight:0));
  for(const r of prepared){const {n,w,i,title,date,detail,bodyHeight,dateHeight,lineNodes,marker}=r,x=64;
   n.resizeWithoutConstraints(w,height);marker.x=x+(8-marker.width)/2;marker.y=lineY-marker.height/2;
   const bodyAbove=r.side==='bottom';title.x=date.x=detail.x=x;
   title.y=bodyAbove?lineY-16-bodyHeight-(mode==='same'?dateHeight:0):lineY+16;
   detail.y=title.y+title.height;
   date.y=mode==='alternate'?(bodyAbove?lineY+16:lineY-16-dateHeight):(bodyAbove?detail.y+detail.height:detail.y+detail.height);
   const sorted=[...lineNodes].sort((a,b)=>a.x-b.x);for(const [j,l]of sorted.entries()){l.name=j===0?'连接线前':'连接线后';l.visible=j===0?i>0:i<rows.length-1;l.resize(j===0?56:Math.max(1,w-80),2);l.x=j===0?0:80;l.y=lineY-1;}
  }
 }else for(const r of prepared){const {n,w,i,side,title,date,detail,bodyHeight,dateHeight,lineNodes,marker,textWidth}=r,split=mode==='alternate',center=split||align==='alternate',x=center?(w-8)/2:side==='right'?w-8:0;
  const bodyLeft=side==='right',bodyX=bodyLeft?(center?0:0):x+24,dateX=split?(bodyLeft?x+24:0):bodyX;
  title.textAlignHorizontal=detail.textAlignHorizontal=bodyLeft?'RIGHT':'LEFT';date.textAlignHorizontal=split?(bodyLeft?'LEFT':'RIGHT'):(bodyLeft?'RIGHT':'LEFT');
  title.x=detail.x=bodyX;date.x=dateX;title.y=0;detail.y=title.height;date.y=split?0:bodyHeight;
  const height=Math.max(bodyHeight+(split?0:dateHeight),split?dateHeight:0,24)+30;n.resizeWithoutConstraints(w,height);marker.x=x+(8-marker.width)/2;marker.y=12-marker.height/2;
  for(const l of lineNodes){l.name='divider';l.visible=i<rows.length-1;l.resize(2,Math.max(1,height-24));l.x=x+3;l.y=24;}
 }
 block.resizeWithoutConstraints(width,block.height);block.primaryAxisSizingMode=horizontal?'FIXED':'AUTO';block.counterAxisSizingMode=horizontal?'AUTO':'FIXED';return block;
}
