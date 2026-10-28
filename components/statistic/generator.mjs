export function validateStatistic(input){
 if(!input||typeof input!=='object')throw Error('Statistic输入必须为对象');
 const s={formal:'percent',trendPlacement:'left',color:'black',title:'统计值',value:'0',companion:'none',...input};
 if(typeof s.id!=='string'||!s.id.trim())throw Error('Statistic缺少id');
 if(!['percent','text'].includes(s.formal)||!['left','right','-'].includes(s.trendPlacement)||!['black','blue','red','orange','green'].includes(s.color)||!['none','prefix','suffix'].includes(s.companion))throw Error('Statistic未观察到该类型/状态组合');
 if(typeof s.title!=='string'||!s.title.trim())throw Error('Statistic标题必须为非空文字');
 if(typeof s.value==='number'){if(!Number.isFinite(s.value))throw Error('Statistic数值必须有限');s.value=String(s.value);}
 if(typeof s.value!=='string'||!s.value.trim()||/[\r\n]/.test(s.value))throw Error('Statistic数值必须为单行展示文字');
 s.unit??=s.formal==='percent'?'%':'USD';if(typeof s.unit!=='string'||/[\r\n]/.test(s.unit))throw Error('Statistic单位必须为单行文字');
 s.valueColor??=s.color;s.unitColor??=s.color;
 for(const k of ['valueColor','unitColor'])if(!['black','blue','red','orange','green'].includes(s[k]))throw Error('Statistic颜色必须来自源五色');
 if(s.trendPlacement==='-'){if(s.direction!=null||s.trendColor!=null)throw Error('Statistic无趋势图标时不接受方向或趋势色');s.direction=null;s.trendColor=null;}
 else{s.direction??=s.color==='green'?'down':'up';s.trendColor??=s.color;if(!['up','down'].includes(s.direction)||!['black','blue','red','orange','green'].includes(s.trendColor))throw Error('Statistic趋势方向或颜色不支持');}
 return s;
}
export function statisticSlots(n){
 const body=n.children.find(c=>c.name==='统计主体'),title=body?.children.find(c=>c.type==='TEXT'),data=body?.children.find(c=>c.name==='data'),value=data?.children.find(c=>c.name==='value')??data,number=value?.children.find(c=>c.type==='TEXT'),formal=value?.children.find(c=>c.name==='formal'),unit=formal?.children.find(c=>c.type==='TEXT'),arrow=data?.children.find(c=>c.type==='INSTANCE');
 if(!body||!title||!data||!value||!number||!formal||!unit)throw Error('Statistic语义结构缺失');return {body,title,data,value,number,formal,unit,arrow};
}
export function verifyStatistics(specs,actual,catalog){
 if(specs.length!==actual?.length)return ['Statistic数量不符'];return specs.flatMap(s=>{const a=actual.find(a=>a?.id===s.id);return a?verifyStatistic(s,a,catalog):['Statistic缺少 '+s.id];});
}
export async function renderStatistic(figma,parent,input,catalog){
 const s=validateStatistic(input);if(figma.fileKey!==catalog.fileKey)throw Error('Statistic目标文件不符');
 const row=catalog.rows.find(r=>r.formal===s.formal&&r.trendPlacement===s.trendPlacement&&r.color===s.color),main=row&&await figma.getNodeByIdAsync(row.id);
 if(main?.type!=='COMPONENT'||main.parent?.id!==catalog.setId)throw Error('Statistic母件依赖缺失');
 const chart=s.companion==='none'?null:await figma.getNodeByIdAsync(catalog.chartId);if(s.companion!=='none'&&(chart?.type!=='COMPONENT'||chart.parent?.id!==catalog.pageId))throw Error('Statistic图标搭配依赖缺失');
 if(s.trendPlacement!=='-'){const r=catalog.arrows.find(r=>r.direction===s.direction&&r.color===s.trendColor),m=r&&await figma.getNodeByIdAsync(r.outerId);if(m?.type!=='COMPONENT'||m.parent?.id!==catalog.pageId)throw Error('Statistic趋势依赖缺失');}
 figma.skipInvisibleInstanceChildren=false;for(const t of main.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 let n;try{
  n=figma.createAutoLayout('HORIZONTAL',{name:'统计/'+s.id,itemSpacing:catalog.companion.gap,counterAxisAlignItems:'CENTER',fills:[],clipsContent:false});parent.appendChild(n);
  let body=main.createInstance();n.appendChild(body);body=body.detachInstance();body.name='统计主体';
  if(chart){const c=catalog.companion,box=figma.createAutoLayout('HORIZONTAL',{name:'搭配图标',itemSpacing:0,paddingTop:c.padding,paddingBottom:c.padding,paddingLeft:c.padding,paddingRight:c.padding,cornerRadius:s.companion==='prefix'?c.prefixRadius:c.suffixRadius,fills:JSON.parse(JSON.stringify(c.paints)),clipsContent:false});n.appendChild(box);const icon=chart.createInstance();box.appendChild(icon);if(s.companion==='prefix')n.insertChild(0,box);}
  await applyStatistic(figma,n,s,catalog);return n;
 }catch(e){if(n&&!n.removed)n.remove();throw e;}
}
export async function applyStatistic(figma,n,input,catalog){
 const s=validateStatistic(input),p=statisticSlots(n);
 for(const t of [p.title,p.number,p.unit])for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 p.title.characters=s.title;p.number.characters=s.value;p.unit.characters=s.unit;p.formal.visible=!!s.unit;
 p.body.itemSpacing=s.companion==='none'?8:catalog.companion.bodyGap;
 for(const [t,color]of [[p.number,s.valueColor],[p.unit,s.unitColor]]){const v=catalog.colors[color];if(v.styleId)await t.setFillStyleIdAsync(v.styleId);else t.fills=JSON.parse(JSON.stringify(v.paints));}
 if(s.trendPlacement==='-'){if(p.arrow)throw Error('Statistic不应含趋势图标');}
 else{if(!p.arrow)throw Error('Statistic缺少趋势图标');const r=catalog.arrows.find(r=>r.direction===s.direction&&r.color===s.trendColor);const current=await p.arrow.getMainComponentAsync();if(current?.id!==r.outerId){const m=await figma.getNodeByIdAsync(r.outerId);if(m?.type!=='COMPONENT'||m.parent?.id!==catalog.pageId)throw Error('Statistic箭头母件失效');p.arrow.swapComponent(m);}}
}
export async function inspectStatistic(n){
 const p=statisticSlots(n),main=p.arrow?await p.arrow.getMainComponentAsync():null,box=n.children.find(c=>c.name==='搭配图标'),bounds=n.absoluteBoundingBox;
 const text=t=>({id:t.id,text:t.characters,color:t.fills[0]?.color,x:t.absoluteBoundingBox.x-bounds.x,y:t.absoluteBoundingBox.y-bounds.y,width:t.width,height:t.height});
 return {id:n.name.slice(3),nodeId:n.id,width:n.width,height:n.height,bodyGap:p.body.itemSpacing,title:text(p.title),value:text(p.number),unit:text(p.unit),unitVisible:p.formal.visible,arrow:main?{id:p.arrow.id,mainId:main.id,placement:p.data.children.indexOf(p.arrow)===0?'left':'right',regionColors:p.arrow.findAllWithCriteria({types:['VECTOR']}).flatMap(v=>v.vectorNetwork.regions.flatMap(r=>r.fills.map(p=>p.color)))}:null,companion:box?{position:n.children.indexOf(box)===0?'prefix':'suffix',width:box.width,height:box.height,radius:box.cornerRadius,mainId:(await box.children[0].getMainComponentAsync())?.id}:null,nodeIds:[n.id,...n.findAll(()=>true).map(c=>c.id)]};
}
export function verifyStatistic(input,a,catalog){
 const s=validateStatistic(input),errors=[],same=(a,b)=>a&&b&&['r','g','b'].every(k=>Math.abs(a[k]-b[k])<1e-6);
 if(a.id!==s.id||a.title.text!==s.title||a.value.text!==s.value||a.unit.text!==s.unit||a.unitVisible!==!!s.unit)errors.push('Statistic展示文字不符');
 for(const [t,c]of [[a.value,s.valueColor],[a.unit,s.unitColor]])if(!same(t.color,catalog.colors[c].paints[0].color))errors.push('Statistic文字颜色不符');
 if(a.bodyGap!==(s.companion==='none'?8:4))errors.push('Statistic标题间距不符');
 if(s.trendPlacement==='-'){if(a.arrow)errors.push('Statistic存在多余趋势图标');}
 else{const r=catalog.arrows.find(r=>r.direction===s.direction&&r.color===s.trendColor);if(a.arrow?.mainId!==r.outerId||a.arrow?.placement!==s.trendPlacement||!a.arrow?.regionColors.length||a.arrow.regionColors.some(c=>!same(c,catalog.colors[s.trendColor].paints[0].color)))errors.push('Statistic趋势图标或区域颜色不符');}
 if(s.companion==='none'){if(a.companion)errors.push('Statistic存在多余搭配图标');}else if(a.companion?.position!==s.companion||a.companion?.width!==48||a.companion?.height!==48||a.companion?.radius!==(s.companion==='prefix'?6:99)||a.companion?.mainId!==catalog.chartId)errors.push('Statistic搭配图标不符');
 for(const t of [a.title,a.value,...(s.unit?[a.unit]:[])])if(t.x<-.01||t.y<-.01||t.x+t.width>a.width+.01||t.y+t.height>a.height+.01)errors.push('Statistic文字越界');return errors;
}
export async function updateStatistic(figma,n,input,beforeInput,catalog){
 const before=validateStatistic(beforeInput),next=validateStatistic(input);if(['id','formal','color','trendPlacement','direction','trendColor','companion'].some(k=>before[k]!==next[k]))throw Error('Statistic原位修改只允许文字、数值色及单位色');
 const initial=await inspectStatistic(n);if(verifyStatistic(before,initial,catalog).length)throw Error('Statistic修改前状态不符');
 try{await applyStatistic(figma,n,next,catalog);const errors=verifyStatistic(next,await inspectStatistic(n),catalog);if(errors.length)throw Error(errors.join(','));}catch(error){try{await applyStatistic(figma,n,before,catalog);if(verifyStatistic(before,await inspectStatistic(n),catalog).length)throw Error('恢复校验不符');}catch(rollback){throw Error('Statistic回滚失败 '+String(rollback));}throw error;}
 const after=await inspectStatistic(n);if(JSON.stringify(initial.nodeIds)!==JSON.stringify(after.nodeIds))throw Error('Statistic原位修改节点身份变化');return {stableIds:true,actual:after};
}
