import {renderMultiPopup,updateMultiOption} from '../multi-option/generator.mjs';
export function validateSelect(spec){
 for(const k of ['multiple','open','prefixIcon','disabled'])if(spec[k]!==undefined&&typeof spec[k]!=='boolean')throw Error(k+' 必须为布尔值');
 const s={...spec,multiple:!!spec.multiple,open:!!spec.open,prefixIcon:!!spec.prefixIcon,disabled:!!spec.disabled,state:spec.state??'normal',width:spec.width??320};
 if(!['normal','hover'].includes(s.state)||s.width<120||!Number.isFinite(s.width))throw Error('选择器状态或宽度无效');
 if(s.disabled&&(s.open||s.state!=='normal'))throw Error('禁用选择器没有展开或悬停态');
 if(s.multiple&&s.value!==undefined&&(!Array.isArray(s.value)||s.value.some(v=>typeof v!=='string')||new Set(s.value).size!==s.value.length))throw Error('多选值必须是不重复文字数组');
 if(!s.multiple&&s.value!==undefined&&typeof s.value!=='string')throw Error('单选值必须是文字');
 s.values=s.multiple?s.value??[]:s.value?[s.value]:[];s.filled=!!s.values.length;
 s.options=(s.options??[]).map(o=>typeof o==='string'?{label:o}:o);
 if(s.open&&!s.options.length)throw Error('展开选择器需要选项');
 const labels=new Set();for(const o of s.options){if(!o||typeof o.label!=='string'||!o.label||labels.has(o.label))throw Error('选项文字缺失或重复');labels.add(o.label);if(!['normal','hover','active'].includes(o.state??'normal'))throw Error('选项状态无效');if((o.disabled||s.values.includes(o.label))&&(o.state??'normal')!=='normal')throw Error('禁用或选中项没有额外悬停点击态');if(o.disabled&&s.values.includes(o.label))throw Error('停用选项不能新选');}
 if(s.options.length&&s.values.some(v=>!labels.has(v)))throw Error('选中值不在选项中');
 return s;
}
export async function updateSingleOption(figma,row,o,h){const body=row.layoutMode==='VERTICAL'?row.children.find(n=>n.name==='option'):row;const label=body.findOne(n=>n.type==='TEXT');await h.setText(label,o.label);label.resize(body.width-24,label.height);label.textAutoResize='HEIGHT';label.layoutSizingHorizontal='FILL';body.minHeight=36;body.primaryAxisSizingMode='FIXED';body.counterAxisSizingMode='AUTO';if(body!==row){row.primaryAxisSizingMode='AUTO';row.counterAxisSizingMode='FIXED';body.layoutSizingHorizontal='FILL';}row.name='选项/'+o.label;return row;}
export async function renderSinglePopup(figma,parent,s,deps,h){const frame=h.autoFrame(parent,'单选展开/'+s.id,'VERTICAL',s.width),rules=deps.singleRules;for(const k of ['fills','strokes','strokeWeight','strokeAlign','strokesIncludedInLayout','cornerRadius','effects','paddingTop','paddingRight','paddingBottom','paddingLeft','itemSpacing'])frame[k]=rules[k];for(const o of s.options){if(o.disabled&&o.selected)throw Error('停用选项不能新选');const state=o.disabled?'normal':o.selected?'select':o.state??'normal',name=`state 状态=${{normal:'normal 默认',hover:'hover 悬浮',active:'active 点击',select:'select 选中'}[state]}, disabled 禁用=${!!o.disabled}, divider 分割线=${!!o.divider}`;const recipe=deps.single.find(r=>r.name===name);if(!recipe)throw Error('单选项源变体缺失');let row=await h.instance(recipe.id,frame,'选项/'+o.label);row=row.detachInstance();row.resize(s.width-16,o.divider?43:36);await updateSingleOption(figma,row,o,h);}return frame;}
export async function renderSelect(figma,parent,spec,deps){
 const s=validateSelect(spec);if(figma.fileKey!==deps.fileKey)throw Error('选择器目标不符');
 const h=selectHelpers(figma);
 const name=`state 状态=${s.open?'focus 聚焦':s.state==='hover'?'hover 悬浮':'normal 默认'}, expand 展开=${s.open}, filled 填充=${s.filled}, multiple 多选=${s.multiple}, prefixIcon 前置图标=${s.prefixIcon}, disabled 禁用=${s.disabled}`;
 const recipe=deps.inputs.find(r=>r.name===name);if(!recipe)throw Error('选择器源组合缺失');const wrapper=h.autoFrame(parent,'选择器/'+s.id,'VERTICAL',s.width);wrapper.itemSpacing=8;wrapper.clipsContent=false;
 let input=await h.instance(recipe.id,wrapper,'选择输入');input=input.detachInstance();input.resize(s.width,32);if(s.open){const menu=input.children.find(c=>c.name.startsWith('item/menu'));if(!menu)throw Error('展开源菜单缺失');menu.remove();}
 if(s.multiple&&s.filled){const tags=input.findOne(n=>n.name==='tag');if(!tags?.children.length)throw Error('多选标签模板缺失');const template=tags.children[0];for(const c of [...tags.children].slice(1))c.remove();for(const [i,value]of s.values.entries()){const tag=i?template.clone():template;if(i)tags.appendChild(tag);await h.setText(tag.findOne(n=>n.type==='TEXT'),value);}tags.clipsContent=true;}
 else {const label=input.findOne(n=>n.type==='TEXT');await h.setText(label,s.filled?s.values[0]:s.placeholder??'请选择');}
 if(s.open){const options=s.options.map(o=>({...o,selected:s.values.includes(o.label)}));if(s.multiple)await renderMultiPopup(figma,wrapper,{...s,options},deps.multiRules,h);else await renderSinglePopup(figma,wrapper,{...s,options},deps,h);}
 return wrapper;
}

export function selectHelpers(figma){return {autoFrame:(p,name,dir,w)=>{const n=figma.createFrame();p.appendChild(n);n.name=name;n.layoutMode=dir;n.resize(w,1);n.primaryAxisSizingMode='AUTO';n.counterAxisSizingMode='FIXED';n.fills=[];return n;},instance:async(id,p,name)=>{const c=await figma.getNodeByIdAsync(id);if(c?.type!=='COMPONENT')throw Error('依赖不是组件');const n=c.createInstance();p.appendChild(n);n.name=name;return n;},setText:async(t,v)=>{try{await figma.loadFontAsync(t.fontName)}catch{await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});t.fontName={family:'Noto Sans SC',style:'Regular'}}t.characters=v;}};}
