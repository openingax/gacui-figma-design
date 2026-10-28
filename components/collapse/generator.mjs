import {validateLink} from '../link/generator.mjs';
export function validateCollapse(input){
 const s={placement:'left',borderless:false,...input};
 if(!['left','right','none'].includes(s.placement)||typeof s.borderless!=='boolean')throw Error('Collapse 图标位置或边框类型无效');
 if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<=0))throw Error('Collapse 宽度必须为正数');
 if(!Array.isArray(s.items)||!s.items.length)throw Error('Collapse 需要至少一个面板；数量不限制为2/4/6/8');
 const ids=new Set();s.items=s.items.map(item=>{if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw Error('Collapse 面板ID必须唯一');ids.add(item.id);if(typeof item.title!=='string'||!item.title.trim())throw Error('Collapse 标题不能为空');
  const p={expanded:false,disabled:false,hover:false,...item};for(const k of ['expanded','disabled','hover'])if(typeof p[k]!=='boolean')throw Error('Collapse '+k+' 必须为布尔值');if(s.placement==='none'&&p.hover)throw Error('无箭头面板没有箭头悬浮状态');
  if(p.actions!==undefined&&(!Array.isArray(p.actions)||p.actions.some(a=>!a||typeof a.id!=='string'||!a.id||typeof a.text!=='string'||!a.text.trim())||new Set(p.actions.map(a=>a.id)).size!==p.actions.length))throw Error('标题操作需要唯一ID和非空文案');
  for(const a of p.actions??[]){if(a.size&&a.size!=='medium'||a.prefix||a.suffix)throw Error('标题操作当前使用规范中的号无图标文字链接');validateLink(a);}
  if(typeof p.content!=='string'&&!Array.isArray(p.content))throw Error('Collapse 内容必须是文本或自定义内容块');
  if(Array.isArray(p.content)){if(!p.content.length)throw Error('自定义内容块不能为空');for(const b of p.content){if(!b||!['text','list','image'].includes(b.type))throw Error('自定义内容只支持文本、业务列表和图片');if(b.type==='text'&&(typeof b.text!=='string'||!b.text.trim()))throw Error('内容文本不能为空');if(b.type==='list'&&(!Array.isArray(b.items)||!b.items.length||b.items.some(t=>typeof t!=='string'||!t.trim())))throw Error('业务列表需要非空文本项');if(b.type==='image'&&(typeof b.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.base64)||typeof b.alt!=='string'||!b.alt.trim()||!Number.isFinite(b.ratio)||b.ratio<=0))throw Error('图片需要已提供的base64数据、说明及宽高比');}}
  return p;
 });return s;
}
export async function renderCollapse(figma,parent,s,h){
 const width=s.width??h.width??800,deps=h.collapseDeps;
 const recipe=deps.roots.find(r=>r.placement===s.placement&&r.borderless===s.borderless);if(!recipe)throw Error('Collapse 根结构缺失');
 const mainIds=s.items.map(p=>deps.panels.find(r=>r.placement===s.placement&&r.borderless===s.borderless&&r.expanded===p.expanded&&r.disabled===p.disabled)?.id);if(mainIds.some(id=>!id))throw Error('Collapse 状态依赖缺失');
 const mains=[];for(const id of mainIds){const n=await figma.getNodeByIdAsync(id);if(n?.type!=='COMPONENT'||n.parent?.parent?.id!==deps.pageId)throw Error('Collapse 母组件位置变化');mains.push(n);}
 const root=figma.createFrame();parent.appendChild(root);try{root.name='折叠面板/'+s.id;root.resize(width,1);root.layoutMode='VERTICAL';root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode='FIXED';root.itemSpacing=0;root.fills=[];root.clipsContent=recipe.clipsContent;root.cornerRadius=recipe.cornerRadius;
 const paints=await figma.getLocalPaintStylesAsync();if(recipe.strokeStyleName){const matches=paints.filter(p=>p.name===recipe.strokeStyleName);if(matches.length!==1)throw Error('Collapse 描边样式缺失或重名');await root.setStrokeStyleIdAsync(matches[0].id);}else root.strokes=[];root.strokeWeight=recipe.strokeWeight;root.strokeAlign=recipe.strokeAlign;root.strokesIncludedInLayout=recipe.strokesIncludedInLayout;
  for(let index=0;index<s.items.length;index++){
   const p=s.items[index],main=mains[index];for(const t of main.findAllWithCriteria({types:['TEXT']}))for(const segment of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(segment.fontName);let panel=main.createInstance();root.appendChild(panel);await h.normalize(panel);panel.resize(width,panel.height);panel.layoutSizingHorizontal='FILL';
   const titleKey=Object.keys(panel.componentProperties).find(k=>k.split('#')[0]==='Title');if(!titleKey)throw Error('标题属性缺失');panel.setProperties({[titleKey]:p.title});
   if(p.actions?.length||Array.isArray(p.content)){panel=panel.detachInstance();}
   panel.name='折叠项/'+p.id;
   const header=panel.children.find(n=>n.name==='header');if(!header)throw Error('标题区缺失');
   const arrow=header.children.find(n=>n.type==='INSTANCE'&&n.name==='.master/item/expandIcon');if(arrow)arrow.setProperties({'hover 悬浮':String(p.hover)});
   if(p.actions?.length){panel.fills=JSON.parse(JSON.stringify(deps.headerSlot.panelFills));const slot=figma.createFrame();header.appendChild(slot);slot.name='标题右侧操作';slot.layoutMode='HORIZONTAL';slot.primaryAxisSizingMode='AUTO';slot.counterAxisSizingMode='AUTO';slot.itemSpacing=deps.headerSlot.gap;slot.fills=[];slot.strokes=[];for(const action of p.actions){const link=await h.renderLink(figma,slot,{...action,size:'medium',prefix:false,suffix:false});link.cornerRadius=deps.headerSlot.linkCornerRadius;}}
   if(p.expanded){let content=panel.children.find(n=>n.name==='item/content');if(!content)throw Error('展开内容缺失');
    if(typeof p.content==='string'){const key=Object.keys(content.componentProperties).find(k=>k.split('#')[0]==='Content');if(!key)throw Error('正文属性缺失');await h.normalize(content);content.setProperties({[key]:p.content});}
    else{content=content.detachInstance();const body=content.children[0],prototype=body.findOne(n=>n.type==='TEXT');if(!prototype)throw Error('正文样式缺失');await h.normalize(body);const template=prototype.clone();body.appendChild(template);for(const n of [...body.children])if(n!==template)n.remove();body.layoutMode='VERTICAL';body.itemSpacing=8;body.primaryAxisSizingMode='AUTO';body.counterAxisSizingMode='FIXED';
     for(const block of p.content){if(block.type==='image'){const n=figma.createRectangle();body.appendChild(n);n.name='业务图片/'+block.alt;const image=figma.createImage(figma.base64Decode(block.base64));const available=width-body.paddingLeft-body.paddingRight;n.resize(available,available/block.ratio);n.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FILL'}];n.strokes=[];n.layoutSizingHorizontal='FILL';}
      else{const values=block.type==='list'?block.items.map(t=>'• '+t):[block.text];for(const text of values){const n=template.clone();body.appendChild(n);n.name=block.type==='list'?'业务列表项':'业务说明';n.characters=text;n.resize(width-body.paddingLeft-body.paddingRight,22);n.textAutoResize='HEIGHT';n.layoutSizingHorizontal='FILL';}}
     }template.remove();
    }
   }
   const title=header.findOne(n=>n.type==='TEXT'&&n.name==='title');if(!title||title.width<=0)throw Error('操作栏挤占标题，请调整宽度或操作文案');
   for(const n of panel.findAllWithCriteria({types:['TEXT']}))if(n.x<-.01||n.y<-.01||n.x+n.width>n.parent.width+.01||n.y+n.height>n.parent.height+.01)throw Error('Collapse 文字越界');
  }
  return root;
 }catch(e){root.remove();throw e;}
}
export async function updateCollapse(figma,root,input,h){
 const before=validateCollapse(h.beforeSpec),next=validateCollapse(input);
 const signature=s=>JSON.stringify({id:s.id,placement:s.placement,borderless:s.borderless,width:s.width,items:s.items.map(p=>({id:p.id,expanded:p.expanded,disabled:p.disabled,hover:p.hover,actions:(p.actions??[]).map(a=>({...a,text:undefined})),content:typeof p.content==='string'?'text':p.content.map(b=>b.type==='text'?{type:b.type}:b.type==='list'?{type:b.type,count:b.items.length}:b)}))});
 if(signature(before)!==signature(next))throw Error('Collapse 结构或状态变化需生成对应状态画板；原位入口用于同结构内容修改');
 if(root.name!=='折叠面板/'+before.id||root.children.length!==before.items.length)throw Error('Collapse 根结构变化');
 const texts=root.findAllWithCriteria({types:['TEXT']}),instances=root.findAllWithCriteria({types:['INSTANCE']});
 for(const t of texts)for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 const savedTexts=texts.map(n=>({n,text:n.characters})),savedInstances=instances.map(n=>({n,props:Object.fromEntries(Object.entries(n.componentProperties).map(([k,v])=>[k,v.value]))}));
 try{
  for(let i=0;i<next.items.length;i++){
   const p=next.items[i],panel=root.children[i];if(panel.name!=='折叠项/'+p.id)throw Error('面板身份变化');const header=panel.children.find(n=>n.name==='header'),title=header?.findOne(n=>n.type==='TEXT'&&n.name==='title');if(!title)throw Error('标题槽缺失');
   if(panel.type==='INSTANCE'){const key=Object.keys(panel.componentProperties).find(k=>k.split('#')[0]==='Title');if(!key)throw Error('标题属性缺失');panel.setProperties({[key]:p.title});}else title.characters=p.title;
   const slot=header.children.find(n=>n.name==='标题右侧操作');for(const action of p.actions??[]){const node=slot?.children.find(n=>n.name==='链接/'+action.id);if(!node)throw Error('操作槽缺失');await h.updateLink(figma,node,{...action,size:'medium',prefix:false,suffix:false});}
   if(p.expanded){const content=panel.children.find(n=>n.name==='item/content');if(!content)throw Error('正文槽缺失');if(typeof p.content==='string'){const key=Object.keys(content.componentProperties).find(k=>k.split('#')[0]==='Content');if(!key)throw Error('正文属性缺失');content.setProperties({[key]:p.content});}else{const editable=content.children[0].children.filter(n=>n.type==='TEXT'),values=p.content.flatMap(b=>b.type==='image'?[]:b.type==='list'?b.items.map(t=>'• '+t):[b.text]);if(editable.length!==values.length)throw Error('自定义文字槽变化');editable.forEach((n,j)=>{n.characters=values[j];});}}
  }
  for(const n of root.findAll(n=>'width'in n&&'height'in n)){const p=n.parent;if(n.x<-.01||n.y<-.01||n.x+n.width>p.width+.01||n.y+n.height>p.height+.01)throw Error('Collapse 更新导致内容越界');}
  return {mutatedNodeIds:[root.id,...texts.map(n=>n.id),...instances.map(n=>n.id)]};
 }catch(error){
  const failures=[];for(const {n,props}of savedInstances)try{n.setProperties(props);}catch(e){failures.push({id:n.id,error:String(e)});}for(const {n,text}of savedTexts)try{n.characters=text;}catch(e){failures.push({id:n.id,error:String(e)});}
  if(failures.length)throw Error('Collapse 回滚失败 '+JSON.stringify(failures)+'; 原始错误 '+String(error));throw error;
 }
}
export async function inspectCollapse(root){
 const items=[];
 for(const panel of root.children){const header=panel.children.find(n=>n.name==='header'),content=panel.children.find(n=>n.name==='item/content'),slot=header?.children.find(n=>n.name==='标题右侧操作'),arrow=header?.children.find(n=>n.type==='INSTANCE'&&n.name==='.master/item/expandIcon');items.push({id:panel.name.slice(4),title:header?.findOne(n=>n.type==='TEXT'&&n.name==='title')?.characters,disabled:panel.type==='INSTANCE'?panel.componentProperties['disabled 禁用']?.value==='true':!!header?.findOne(n=>n.type==='TEXT'&&n.name==='title')?.fills?.some(p=>p.type==='SOLID'&&Math.abs(p.color.r-151/255)<1e-6&&Math.abs(p.color.g-154/255)<1e-6&&Math.abs(p.color.b-157/255)<1e-6),actions:(slot?.children??[]).map(n=>({id:n.name.slice(3),text:n.findAllWithCriteria({types:['TEXT']}).map(t=>t.characters).join('')})),content:content?.findAllWithCriteria({types:['TEXT']}).map(n=>n.characters)??[],images:content?.findAllWithCriteria({types:['RECTANGLE']}).filter(n=>n.name.startsWith('业务图片/')).map(n=>n.name.slice(5))??[],expanded:!!content,hover:arrow?.componentProperties['hover 悬浮']?.value==='true',fits:panel.x>=-.01&&panel.y>=-.01&&panel.x+panel.width<=root.width+.01&&panel.y+panel.height<=root.height+.01});}
 return {id:root.name.slice(5),width:root.width,height:root.height,items};
}
export function verifyCollapses(specs,actual){
 const errors=[];if(specs.length!==actual.length)errors.push('Collapse 可见数量不符');
 for(const s of specs){const a=actual.find(a=>a.id===s.id);if(!a||a.items.length!==s.items.length){errors.push('Collapse 面板数量不符');continue;}s.items.forEach((p,i)=>{const q=a.items[i],texts=!p.expanded?[]:typeof p.content==='string'?[p.content]:p.content.flatMap(b=>b.type==='image'?[]:b.type==='list'?b.items.map(t=>'• '+t):[b.text]),images=p.expanded&&Array.isArray(p.content)?p.content.filter(b=>b.type==='image').map(b=>b.alt):[];if(q.id!==p.id||q.title!==p.title||q.disabled!==p.disabled||q.expanded!==p.expanded||q.hover!==p.hover||!q.fits||JSON.stringify(q.content)!==JSON.stringify(texts)||JSON.stringify(q.images)!==JSON.stringify(images)||JSON.stringify(q.actions)!==JSON.stringify((p.actions??[]).map(a=>({id:a.id,text:a.text}))))errors.push('Collapse 内容、状态、操作或布局不符 '+p.id);});}
 return errors;
}
