export function validatePagination(input={}) {
  const s={theme:'default',totalContent:true,pagesize:false,jumper:false,disabled:false,pageSize:10,current:1,...input};
  if(!['default','simple'].includes(s.theme))throw Error('Pagination风格无效');
  for(const k of ['totalContent','pagesize','jumper','disabled'])if(typeof s[k]!=='boolean')throw Error('Pagination '+k+'必须为布尔值');
  if(s.theme==='simple'&&s.jumper)throw Error('simple源属性仅jumper=false，内部跳页框仍可见');
  for(const k of ['total','pageSize','current'])if(!Number.isSafeInteger(s[k])||s[k]<(k==='total'?0:1))throw Error('Pagination '+k+'必须是有效整数');
  s.pageCount=Math.max(1,Math.ceil(s.total/s.pageSize));
  if(s.current>s.pageCount)throw Error('Pagination当前页超出总页数');
  if(s.theme==='default'){
    if(s.pages===undefined){if(s.pageCount>6)throw Error('超过6页时须显式提供pages页码窗口，不从规范样例推断业务规则');s.pages=Array.from({length:s.pageCount},(_,i)=>i+1);}
    if(!Array.isArray(s.pages))throw Error('Pagination pages必须为数组');
    const numbers=s.pages.filter(x=>x!=='…');
    if(!Array.isArray(s.pages)||!numbers.length||numbers.length>6||s.pages.length-numbers.length>1||numbers.some((n,i)=>!Number.isInteger(n)||n<1||n>s.pageCount||i&&n<=numbers[i-1])||!numbers.includes(s.current)||s.pages.includes('…')&&s.pages.indexOf('…')!==s.pages.length-2)throw Error('Pagination pages需包含当前页、递增且最多6个页码，省略号仅在末页前');
  }else if(s.pages!==undefined)throw Error('极简分页不显示页码窗口');
  return s;
}

export function paginationKey(s){return [s.theme,s.totalContent,s.pagesize,s.jumper,s.disabled].join('|');}

export async function updatePagination(figma,n,s) {
  const ids=[n.id,...n.findAll(()=>true).map(x=>x.id)],main=await n.getMainComponentAsync();
  const one=(root,name)=>root.findOne(x=>x.name===name),texts=root=>root.findAll(x=>x.type==='TEXT');
  for(const t of texts(n))for(const part of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(part.fontName);
  const label=(root,value)=>{const t=texts(root)[0];if(!t)throw Error('Pagination缺少文字槽');t.characters=String(value);};
  const total=one(n,'totalContent');if(total)total.characters='共 '+s.total+' 项数据';
  const select=one(n,'select');if(select)label(select,s.pageSize+' 条/页');
  const jumper=one(n,'jumper');if(jumper){label(one(jumper,'input'),s.current);const suffix=texts(jumper).find(t=>t.name.startsWith('/'));suffix.characters='/'+s.pageCount+' 页';}
  async function paints(a,b){a.fills=JSON.parse(JSON.stringify(b.fills));a.strokes=JSON.parse(JSON.stringify(b.strokes));a.strokeWeight=b.strokeWeight;if(b.fillStyleId)await a.setFillStyleIdAsync(b.fillStyleId);if(b.strokeStyleId)await a.setStrokeStyleIdAsync(b.strokeStyleId);}
  const group=one(n,s.theme==='simple'?'btnGroup':'page btn'),original=one(main,s.theme==='simple'?'btnGroup':'page btn');
  if(s.theme==='default'){
    const nums=group.children.filter(x=>texts(x).some(t=>/^\d+$/.test(t.characters))),sourceNums=original.children.filter(x=>texts(x).some(t=>/^\d+$/.test(t.characters))),values=s.pages.filter(x=>x!=='…');
    for(let i=0;i<nums.length;i++){const slot=i===nums.length-1&&s.pages.includes('…')?values.length-1:i;nums[i].visible=i<values.length-(s.pages.includes('…')?1:0)||i===nums.length-1&&s.pages.includes('…');if(!nums[i].visible)continue;label(nums[i],values[slot]);const source=sourceNums[values[slot]===s.current?0:1];await paints(nums[i],source);await paints(texts(nums[i])[0],texts(source)[0]);}
    const ellipsis=group.children.find(x=>x.findOne(y=>y.name.toLowerCase()==='ellipsis'));if(ellipsis)ellipsis.visible=s.pages.includes('…');
  }
  const disabledMain=await figma.getNodeByIdAsync(s.disabledMainId),disabledGroup=one(disabledMain,s.theme==='simple'?'btnGroup':'page btn');
  for(const [i,boundary]of [[0,s.current===1],[group.children.length-1,s.current===s.pageCount]]){const arrow=group.children[i],source=(s.disabled||boundary?disabledGroup:original).children[s.disabled||boundary?i:original.children.length-1],a=arrow.findAll(x=>x.type==='VECTOR'),b=source.findAll(x=>x.type==='VECTOR');for(let j=0;j<a.length;j++)await paints(a[j],b[j]);}
  const outer=one(n,'group');
  if(total&&total.visible&&total.x+total.width+16>outer.x)throw Error('分页总数与操作区重叠，请增加容器宽度');
  return {mutatedNodeIds:ids,stableIds:JSON.stringify(ids)===JSON.stringify([n.id,...n.findAll(()=>true).map(x=>x.id)])};
}

export async function renderPagination(figma,parent,s,width){
  const main=await figma.getNodeByIdAsync(s.mainId);for(const t of main.findAll(x=>x.type==='TEXT'))for(const p of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(p.fontName);
  const n=main.createInstance();parent.appendChild(n);n.name='分页';n.resize(width,64);n.layoutMode='HORIZONTAL';n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';n.primaryAxisAlignItems=s.totalContent?'SPACE_BETWEEN':'MAX';n.counterAxisAlignItems='CENTER';n.paddingLeft=n.paddingRight=24;await updatePagination(figma,n,s);return n;
}

export async function inspectPagination(n){
  if(!n)return null;const texts=n.findAll(x=>x.type==='TEXT').filter(t=>{for(let p=t;p&&p!==n;p=p.parent)if(!p.visible)return false;return true;});
  return {id:n.id,mainId:(await n.getMainComponentAsync()).id,texts:texts.map(t=>t.characters),fits:texts.every(t=>t.width>0&&t.absoluteBoundingBox.x+t.width<=n.absoluteBoundingBox.x+n.width),height:n.height};
}

export function verifyPagination(s,a){const expected=[...(s.totalContent?['共 '+s.total+' 项数据']:[]),...(s.pagesize?[s.pageSize+' 条/页']:[]),...(s.theme==='simple'||s.jumper?[String(s.current),'/'+s.pageCount+' 页']:[]),...(s.pages??[]).filter(x=>x!=='…').map(String)];return !a||a.mainId!==s.mainId||a.height!==64||!a.fits||expected.some(t=>!a.texts.includes(t))?['分页配置或内容不符']:[];}
