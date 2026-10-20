export function validateDescriptions(s) {
 if(!s.title||!Array.isArray(s.items)||!s.items.length)throw Error('基本信息需要标题和非空items');
 if(![1,2].includes(s.columnCount??2))throw Error('基本信息仅支持1或2列');
 const ids=new Set();for(const i of s.items){if(!i.id||ids.has(i.id)||!i.label||typeof i.value!=='string')throw Error('基本信息项需要唯一id、label与文字value');ids.add(i.id);if(i.span!==undefined&&![1,2].includes(i.span))throw Error('基本信息span仅支持1或2');}return s;
}
export async function renderDescriptions(figma,parent,s,data,h) {
 const {pick}=h, width=h.width??1192, columns=s.columnCount??2;
 const autoFrame=(parent,name,dir,width)=>{const n=h.autoFrame(parent,name,dir,width);if(dir==='HORIZONTAL'){n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='AUTO';}return n;};
 const block=autoFrame(parent,'基本信息/'+s.id,'VERTICAL',width);block.itemSpacing=data.gap;
 async function tx(owner,name,value,recipe,w){const t=figma.createText();owner.appendChild(t);t.name=name;t.fontName=await pick(recipe.fontName);t.fontSize=recipe.fontSize;t.lineHeight=recipe.lineHeight;t.letterSpacing=recipe.letterSpacing;t.fills=recipe.fills;t.characters=value;t.textAutoResize='HEIGHT';t.resize(w,20);t.layoutSizingVertical='HUG';return t;}
 const head=autoFrame(block,'分组标题','HORIZONTAL',width);head.itemSpacing=data.headingGap;head.counterAxisAlignItems='CENTER';
 const bar=figma.createRectangle();head.appendChild(bar);bar.name='标题标记';bar.resize(data.bar.width,data.bar.height);bar.fills=data.bar.fills;
 await tx(head,'标题',s.title,data.title,width-data.bar.width-data.headingGap);
 let row,used=columns;
 for(const item of s.items){const span=Math.min(item.span??1,columns);if(used+span>columns){row=autoFrame(block,'信息行/'+item.id,'HORIZONTAL',width);row.itemSpacing=data.columnGap;used=0;}const w=(width-data.columnGap*(columns-1))/columns*span+data.columnGap*(span-1);const field=autoFrame(row,'信息项/'+item.id,'HORIZONTAL',w);field.itemSpacing=0;field.counterAxisAlignItems='MIN';const label=await tx(field,'label',item.label+'：',data.label,126);await tx(field,'value',item.value,data.value,w-label.width);used+=span;}
 return block;
}
export function verifyDescriptions(specs,actual){const errors=[];if(specs.length!==actual.length)errors.push('基本信息数量或可见性不符');for(const s of specs){const a=actual.find(n=>n.id===s.id);if(!a){errors.push('基本信息缺失');continue;}if(a.title!==s.title)errors.push('基本信息标题不符');if(JSON.stringify(a.items.map(i=>({id:i.id,label:i.label,value:i.value})))!==JSON.stringify(s.items.map(i=>({id:i.id,label:i.label+'：',value:i.value}))))errors.push('基本信息字段集合、顺序或内容不符');if(a.items.some(i=>!i.fits))errors.push('基本信息文字越界');}return errors;}
