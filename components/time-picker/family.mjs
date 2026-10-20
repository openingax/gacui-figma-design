export function validateTimePicker(spec){
 const s={...spec,range:!!spec.range,open:!!spec.open,disabled:!!spec.disabled,format:spec.format??'H:mm:ss',state:spec.state??'normal',width:spec.width??280,rangeState:spec.rangeState??['normal','normal']};
 for(const k of ['range','open','disabled'])if(spec[k]!==undefined&&typeof spec[k]!=='boolean')throw Error(k+'必须为布尔值');
 if(!['H:mm','H:mm:ss'].includes(s.format)||!['normal','hover','focus'].includes(s.state)||!Number.isFinite(s.width)||s.width<200)throw Error('时间格式、状态或宽度无效');
 if(s.disabled&&(s.open||s.state!=='normal'||s.rangeState.some(x=>x!=='normal')))throw Error('禁用时间没有激活展开态');
 const valid=v=>typeof v==='string'&&(v===''||new RegExp(s.format==='H:mm'?'^(?:[01]?\\d|2[0-3]):[0-5]\\d$':'^(?:[01]?\\d|2[0-3]):[0-5]\\d:[0-5]\\d$').test(v));
 s.values=s.range?(spec.value??['','']):[spec.value??''];if(!Array.isArray(s.values)||s.values.length!==(s.range?2:1)||!s.values.every(valid))throw Error('时间值不符合格式');
 if(!Array.isArray(s.rangeState)||s.rangeState.length!==2||s.rangeState.some(x=>!['normal','hover','active'].includes(x))||s.rangeState.filter(x=>x==='active').length>1)throw Error('区间单元状态无效');
 if(!s.range&&s.rangeState.some(x=>x!=='normal'))throw Error('单时间没有区间单元状态');
 s.filled=s.values.some(Boolean);s.state=s.open?'focus':s.state;
 if(spec.display!==undefined&&(!Array.isArray(spec.display)||spec.display.length!==s.values.length||!spec.display.every(valid)))throw Error('提示时间格式或数量不符');
 const parts=s.format==='H:mm'?2:3;const current=s.values[s.rangeState[1]==='active'?1:0]||s.display?.[s.rangeState[1]==='active'?1:0]||s.values.find(Boolean)||('00:00'+(parts===3?':00':''));
 s.columns=spec.columns??current.split(':').map((v,i)=>Array.from({length:7},(_,j)=>({label:String((Number(v)-3+j+(i?60:24))%(i?60:24)).padStart(2,'0'),state:j===3?'active':'normal'})));
 if(!Array.isArray(s.columns)||s.columns.length!==parts||s.columns.some(c=>!Array.isArray(c)||!c.length||c.some(x=>!x||typeof x.label!=='string'||!['normal','hover','active','disabled'].includes(x.state??'normal'))))throw Error('时间列数据或状态无效');
 return s;
}
export async function renderTimePicker(figma,parent,spec,deps){
 const s=validateTimePicker(spec);if(figma.fileKey!==deps.fileKey)throw Error('目标不符');
 const make=async(id,p,name)=>{const c=await figma.getNodeByIdAsync(id);if(c?.type!=='COMPONENT')throw Error('时间依赖缺失');const n=c.createInstance();p.appendChild(n);n.name=name;return n;};
 const set=async(t,text)=>{for(const q of t.getStyledTextSegments(['fontName'])){try{await figma.loadFontAsync(q.fontName)}catch{const f={family:'Noto Sans SC',style:q.fontName.style};await figma.loadFontAsync(f);t.fontName=f;}}t.characters=text;};
 const name=`format 格式=${s.range?'timeRange 时间区间':'time 时间'}, state 状态=${{normal:'normal 默认',hover:'hover 悬浮',focus:'focus 聚焦'}[s.state]}, filled 填充=${s.filled}, disabled 禁用=${s.disabled}`;
 const recipe=deps.inputs.find(x=>x.name===name);if(!recipe)throw Error('时间输入源状态不存在');const wrap=figma.createAutoLayout('VERTICAL');parent.appendChild(wrap);wrap.name='时间选择器/'+s.id;wrap.itemSpacing=8;wrap.fills=[];wrap.clipsContent=false;
 let input=(await make(recipe.id,wrap,'时间输入')).detachInstance();input.resize(s.width,32);
 if(s.range){const range=input.children.find(x=>x.name==='range');const old=range.children.filter(x=>x.type==='FRAME');for(let i=0;i<2;i++){const state=s.rangeState[i],r=deps.ranges.find(x=>x.name===`hover 悬浮=${state==='hover'}, active 点击=${state==='active'}`);const idx=range.children.indexOf(old[i]),n=await make(r.id,range,i?'结束时间':'开始时间');range.insertChild(idx,n);n.resize(old[i].width,24);n.layoutGrow=1;old[i].remove();const t=n.findOne(x=>x.type==='TEXT');await set(t,s.display?.[i]??s.values[i]??'');if(!s.values[i]&&!s.display?.[i])await set(t,i?'结束时间':'开始时间');t.fills=s.disabled?t.fills:s.values[i]?deps.valueFill:deps.placeholderFill;if(s.disabled)t.fills=deps.disabledFill;}}
 else await set(input.findOne(x=>x.type==='TEXT'),s.display?.[0]??(s.values[0]||'请选择时间'));
 if(s.open){const r=deps.popups.find(x=>x.name.startsWith('format 格式='+s.format+' '));let pop=(await make(r.id,wrap,'时间弹层')).detachInstance();pop.resize(s.width,290);const cols=pop.findAll(x=>x.type==='FRAME'&&x.name==='times-columns');for(let i=0;i<cols.length;i++){const col=cols[i];for(const c of [...col.children])c.remove();col.clipsContent=true;for(const v of s.columns[i]){const state=v.state??'normal',r=deps.cells.find(x=>x.name===`hover 悬浮=${state==='hover'}, active 选中高亮=${state==='active'}, disabled 禁用=${state==='disabled'}`);const c=await make(r.id,col,'时间格/'+v.label);c.resize(col.width,24);c.layoutSizingHorizontal='FILL';await set(c.findOne(x=>x.type==='TEXT'),v.label);}}}
 return wrap;
}

// 原位内容修改仅用于同一格式、填充和激活状态；跨状态重新选源配方。
export async function updateTimePicker(figma,root,spec){
 const s=validateTimePicker(spec),input=root.children.find(n=>n.name==='时间输入');if(!input)throw Error('不是时间选择器组合');const labels=s.range?input.findOne(n=>n.name==='range').children.filter(n=>n.type==='INSTANCE').map(n=>n.findOne(t=>t.type==='TEXT')):[input.findOne(n=>n.type==='TEXT')];if(labels.length!==s.values.length)throw Error('不能原位切换时间类型');
 if(!s.values.every(Boolean)||s.display||spec.columns||labels.some(n=>!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(n.characters)))throw Error('原位修改仅支持已填值、默认时间列；其他状态重新生成');
 const edits=labels.map((n,i)=>[n,s.display?.[i]??(s.values[i]||(s.range?(i?'结束时间':'开始时间'):'请选择时间'))]);
 const pop=root.children.find(n=>n.name==='时间弹层');if(!!pop!==s.open)throw Error('不能原位切换展开状态');if(pop){const cols=pop.findAll(n=>n.type==='FRAME'&&n.name==='times-columns');if(cols.length!==s.columns.length)throw Error('不能原位切换格式');for(let i=0;i<cols.length;i++){const ts=cols[i].findAll(n=>n.type==='TEXT');if(ts.length!==s.columns[i].length)throw Error('不能原位切换行数');for(let j=0;j<ts.length;j++){const cell=cols[i].children[j],expected=s.columns[i][j].state??'normal';if(cell.type==='INSTANCE'&&cell.mainComponent.name!==`hover 悬浮=${expected==='hover'}, active 选中高亮=${expected==='active'}, disabled 禁用=${expected==='disabled'}`)throw Error('原位修改不切换时间格状态');}for(let j=0;j<ts.length;j++)edits.push([ts[j],s.columns[i][j].label]);}}
 for(const [n,text]of edits){try{await figma.loadFontAsync(n.fontName)}catch{const f={family:'Noto Sans SC',style:'Regular'};await figma.loadFontAsync(f);n.fontName=f;}n.characters=text;}return edits.map(([n])=>n.id);
}
