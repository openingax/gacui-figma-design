import {validateTimePicker,renderTimePicker,updateTimePicker} from '../time-picker/family.mjs';
export function validateTimeRangeGroup(input){
 const s={min:0,format:'H:mm',width:420,inputWidth:280,disabled:false,addLabel:'新增时段',removeLabel:'删除',...input};
 if(typeof s.title!=='string'||!s.title.trim()||!Array.isArray(s.items))throw Error('时段组需要标题与items');
 if(!Number.isInteger(s.min)||s.min<0||s.max!==undefined&&(!Number.isInteger(s.max)||s.max<s.min)||s.items.length<s.min||s.max!==undefined&&s.items.length>s.max)throw Error('时段数量超出min/max');
 if(typeof s.disabled!=='boolean'||!Number.isFinite(s.width)||s.width<s.inputWidth+80||typeof s.addLabel!=='string'||!s.addLabel.trim()||typeof s.removeLabel!=='string'||!s.removeLabel.trim())throw Error('时段组宽度、禁用或操作文案无效');
 const ids=new Set();s.items=s.items.map(i=>{if(!i||!/^[-\w]+$/.test(i.id??'')||ids.has(i.id))throw Error('时段需要唯一稳定id');ids.add(i.id);if(i.disabled!==undefined&&typeof i.disabled!=='boolean')throw Error('时段禁用须为布尔值');if(i.open||i.columns||i.display||i.range===false)throw Error('时段组只使用收起的区间输入，展开请用独立timePicker');const v=validateTimePicker({id:i.id,value:i.value,range:true,format:s.format,width:s.inputWidth,disabled:s.disabled||!!i.disabled});return {id:i.id,value:v.values,disabled:v.disabled};});return s;
}
export function changeTimeRangeGroup(input,action){
 const s=validateTimeRangeGroup(input);if(s.disabled)throw Error('禁用时段组不可增删');
 if(action.type==='add'){if(s.max!==undefined&&s.items.length>=s.max)throw Error('已达到时段上限');s.items.push(action.item);}
 else if(action.type==='remove'){const row=s.items.find(i=>i.id===action.id);if(!row||row.disabled||s.items.length<=s.min)throw Error('时段不存在、禁用或已达到下限');s.items=s.items.filter(i=>i.id!==action.id);}
 else throw Error('时段动作仅支持add/remove');return validateTimeRangeGroup(s);
}
export async function renderTimeRangeGroup(figma,parent,input,deps){
 const s=validateTimeRangeGroup(input),root=figma.createAutoLayout('VERTICAL');parent.appendChild(root);root.name='时段组/'+s.id;root.fills=[];root.itemSpacing=16;root.resize(s.width,1);root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode='FIXED';await updateTimeRangeGroup(figma,root,s,deps);return root;
}
export async function updateTimeRangeGroup(figma,root,input,deps,previous){
 const s=validateTimeRangeGroup(input);if(root.type!=='FRAME'||root.name!=='时段组/'+s.id)throw Error('只允许修改时段组副本');
 const prior=previous?validateTimeRangeGroup(previous):null;
 if(prior&&(prior.format!==s.format||prior.inputWidth!==s.inputWidth||prior.width!==s.width))throw Error('原位时段修改须保持格式和宽度');
 const oldRows=root.children.filter(n=>n.name.startsWith('时段/'));if(oldRows.length&&!prior)throw Error('修改前须提供回读对应的原始spec');
 if(prior&&(oldRows.length!==prior.items.length||prior.items.some(i=>!oldRows.some(n=>n.name==='时段/'+i.id))))throw Error('时段组已被人工改动，先回读');
 const set=async(t,v)=>{for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);t.characters=v;};
 const ids=()=>[root.id,...root.findAll(()=>true).map(n=>n.id)];const before=ids();
 const main=await figma.getNodeByIdAsync(deps.button);if(main?.type!=='COMPONENT')throw Error('时段按钮依赖缺失');
 const button=async(owner,name,label,disabled)=>{let n=owner.children.find(n=>n.name===name);const m=disabled?main.parent.children.find(c=>c.type==='COMPONENT'&&c.name===main.name.replace('disabled 禁用=false','disabled 禁用=true')):main;if(!m)throw Error('缺少源按钮禁用态');if(!n){n=m.createInstance();owner.appendChild(n);n.name=name;}else if((await n.getMainComponentAsync()).id!==m.id)n.swapComponent(m);const t=n.findOne(n=>n.type==='TEXT');await set(t,label);t.textAutoResize='WIDTH_AND_HEIGHT';n.primaryAxisSizingMode='AUTO';return n;};
 let title=root.children.find(n=>n.name==='标题');if(!title){title=figma.createText();root.appendChild(title);title.name='标题';await figma.loadFontAsync(deps.title.fontName);title.fontName=deps.title.fontName;for(const k of ['fontSize','lineHeight','letterSpacing','fills'])title[k]=deps.title[k];}await set(title,s.title);title.textAutoResize='HEIGHT';title.resize(s.width,22);title.layoutSizingVertical='HUG';
 for(const [idx,item]of s.items.entries()){
  let row=oldRows.find(n=>n.name==='时段/'+item.id);if(!row){row=figma.createAutoLayout('HORIZONTAL');root.appendChild(row);row.name='时段/'+item.id;row.fills=[];row.itemSpacing=16;row.counterAxisAlignItems='CENTER';row.resize(s.width,32);row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';}root.insertChild(idx+1,row);
  const spec={...item,range:true,format:s.format,width:s.inputWidth};const picker=row.children.find(n=>n.name==='时间选择器/'+item.id),old=prior?.items.find(i=>i.id===item.id);
  if(picker&&old&&old.disabled===item.disabled&&old.value.every(Boolean)&&item.value.every(Boolean))await (deps.updatePicker??updateTimePicker)(figma,picker,spec);
  else if(!picker||!old||JSON.stringify(old)!==JSON.stringify(item)){if(picker)picker.remove();const n=await renderTimePicker(figma,row,spec,deps.time);row.insertChild(0,n);}
  const b=await button(row,'删除/'+item.id,s.removeLabel,s.disabled||item.disabled||s.items.length<=s.min);if(s.inputWidth+16+b.width>s.width)throw Error('时段行操作文案超出宽度');
 }
 for(const row of oldRows)if(!s.items.some(i=>row.name==='时段/'+i.id))row.remove();
 const add=await button(root,'新增时段',s.addLabel,s.disabled||s.max!==undefined&&s.items.length>=s.max);root.appendChild(add);
 const after=ids();return {nodeId:root.id,createdNodeIds:after.filter(id=>!before.includes(id)),removedNodeIds:before.filter(id=>!after.includes(id)),mutatedNodeIds:after,rows:root.children.filter(n=>n.name.startsWith('时段/')).map(n=>({id:n.name.slice(3),nodeId:n.id})),height:root.height};
}
export async function inspectTimeRangeGroup(figma,root,input){
 const s=validateTimeRangeGroup(input),errors=[],rows=[];
 if(!root||root.name!=='时段组/'+s.id)return {errors:['时段组缺失'],rows};
 for(const item of s.items){const row=root.children.find(n=>n.name==='时段/'+item.id);if(!row){errors.push('时段缺失:'+item.id);continue;}const picker=row.children.find(n=>n.name==='时间选择器/'+item.id),range=picker?.findOne(n=>n.name==='range');const values=range?.children.filter(n=>n.type==='INSTANCE').map(n=>n.findOne(t=>t.type==='TEXT').characters)??[];const wanted=item.value.map((v,i)=>v||(i?'结束时间':'开始时间'));if(JSON.stringify(values)!==JSON.stringify(wanted))errors.push('时段值不符:'+item.id);const del=row.children.find(n=>n.name==='删除/'+item.id),off=!!del&&(await del.getMainComponentAsync()).name.includes('disabled 禁用=true');if(off!==(s.disabled||item.disabled||s.items.length<=s.min))errors.push('删除禁用不符:'+item.id);if(row.width>s.width+.1||row.children.some(n=>n.x+n.width>row.width+.1))errors.push('时段越界:'+item.id);rows.push({id:item.id,nodeId:row.id,pickerId:picker?.id,values,deleteDisabled:off});}
 const add=root.children.find(n=>n.name==='新增时段');if(!add||(await add.getMainComponentAsync()).name.includes('disabled 禁用=true')!==(s.disabled||s.max!==undefined&&s.items.length>=s.max))errors.push('新增禁用不符');if(root.children.filter(n=>n.name.startsWith('时段/')).length!==s.items.length)errors.push('时段行数不符');return {nodeId:root.id,rows,errors};
}
