import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
export function validateSpec(s){
 if(!s||typeof s.componentId!=='string'||!/^\d+:\d+$/.test(s.componentId))throw Error('需要实际组件ID');
 if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<160))throw Error('宽度至少160');
 for(const k of ['value','highlight'])if(s[k]!==undefined&&typeof s[k]!=='string')throw Error(k+'须为字符串');
 for(const k of ['tags','suggestions'])if(s[k]!==undefined&&(!Array.isArray(s[k])||!s[k].length||s[k].some(v=>typeof v!=='string')))throw Error(k+'须为字符串数组');
 if(s.customContentId&&s.suggestions!==undefined)throw Error('自定义内容和联想数组互斥');
 return s;
}
// 内容改写的单一入口。结构改写显式本地化为FRAME，标准母组件不改。
export async function updateSearch(figma,node,s){
 if(s.tags!==undefined&&(!Array.isArray(s.tags)||!s.tags.length))throw Error('标签须为非空数组');
 if(s.suggestions!==undefined&&(!Array.isArray(s.suggestions)||!s.suggestions.length))throw Error('联想须为非空数组');
 if(s.customContentId&&s.suggestions!==undefined)throw Error('内容槽互斥');
 if(s.tags!==undefined&&!node.findOne(n=>n.name==='tag'))throw Error('当前状态没有批量标签槽');
 if((s.suggestions!==undefined||s.customContentId)&&!node.findOne(n=>n.name==='item/searchPopup'))throw Error('当前状态没有弹层槽');
 if(s.customContentId){const source=await figma.getNodeByIdAsync(s.customContentId);let a=source,b=node;while(a&&a.type!=='PAGE')a=a.parent;while(b&&b.type!=='PAGE')b=b.parent;if(!source||a!==b||source.type==='PAGE'||source===node)throw Error('自定义内容须在相同授权Page');}
 const fonts=node.findAllWithCriteria({types:['TEXT']}).flatMap(t=>t.getStyledTextSegments(['fontName']).map(s=>s.fontName));
 for(const f of fonts)await figma.loadFontAsync(f);
 const previousId=node.id;
 if(node.type==='INSTANCE')node=node.detachInstance();
 const width=s.width??node.width,originalHeight=node.height;
 const popup=node.findOne(n=>n.name==='item/searchPopup');
 const input=node.findOne(n=>n.name==='searchInput')||node;
 const content=input.children.find(n=>n.name==='content');
 const clear=node.children.find(n=>n.name==='安全与警告');
 const clearRight=clear?node.width-clear.x:0;
 node.resize(width,node.height);if(input!==node)input.resize(width,input.height);
 if(content){
  content.layoutSizingHorizontal='FILL';
  const text=content.findOne(n=>n.type==='TEXT'&&n.name==='text');
  if(text&&s.value!==undefined){
   text.characters=s.value;
   const available=content.width-(clear?24:0);
   if(originalHeight>32){
    text.resize(available,22);text.textAutoResize='HEIGHT';text.layoutSizingHorizontal='FIXED';
    const h=Math.max(120,text.height+8);node.resize(width,h);if(input!==node)input.resize(width,h);content.resize(content.width,h-8);
   }else{
    text.textAutoResize='NONE';text.resize(available,22);text.textTruncation='ENDING';text.maxLines=1;text.layoutSizingHorizontal='FIXED';
   }
  }
  if(s.tags!==undefined){
   const box=content.children.find(n=>n.name==='tag');if(!box)throw Error('当前状态没有批量标签槽');
   const originals=[...box.children],template=originals[0];if(!template)throw Error('缺少标签模板');
   box.resize(Math.max(1,content.width-(clear?24:0)),24);box.layoutMode='HORIZONTAL';box.layoutWrap='WRAP';box.primaryAxisSizingMode='FIXED';box.counterAxisSizingMode='AUTO';box.counterAxisSpacing=4;
   for(const value of s.tags){const tag=template.clone();box.appendChild(tag);const t=tag.findOne(n=>n.type==='TEXT'&&n.name==='label');t.characters=value;t.textAutoResize='WIDTH_AND_HEIGHT';tag.primaryAxisSizingMode='AUTO';tag.counterAxisSizingMode='AUTO';if(tag.width>box.width){t.textAutoResize='NONE';t.resize(Math.max(1,box.width-38),20);t.textTruncation='ENDING';t.maxLines=1;tag.resize(box.width,24);tag.primaryAxisSizingMode='FIXED';}tag.layoutSizingHorizontal='HUG';}
   for(const n of originals)n.remove();
   const h=Math.max(32,box.height+8);content.resize(content.width,Math.max(24,box.height));node.resize(width,h);if(input!==node)input.resize(width,h);
  }
 }
 if(clear){clear.x=width-clearRight;clear.y=8;}
 if(popup){
  popup.resize(width,popup.height);popup.x=0;popup.y=node.height+8;
  if(s.customContentId){
   const source=await figma.getNodeByIdAsync(s.customContentId);if(!source||!('clone'in source)||source===node||source===popup)throw Error('无效自定义内容');
   for(const t of source.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
   const child=source.clone();for(const n of [...popup.children])n.remove();popup.appendChild(child);child.layoutPositioning='AUTO';child.layoutSizingHorizontal='FILL';popup.counterAxisSizingMode='AUTO';
  }else if(s.suggestions!==undefined){
   const box=popup.children[0],originals=[...box.children],template=originals[0];if(!template)throw Error('缺少联想行模板');
   const paints=await figma.getLocalPaintStylesAsync(),normal=paints.find(p=>p.name==='Gray 中性/Gray9-强调\\正文'),highlight=paints.find(p=>p.name==='Brand 品牌/Brand5-Normal');
   for(const value of s.suggestions){const row=template.clone();box.appendChild(row);row.layoutSizingHorizontal='FILL';row.counterAxisSizingMode='AUTO';const t=row.findOne(n=>n.type==='TEXT');t.characters=value;t.resize(width-28,22);t.textAutoResize='HEIGHT';t.layoutSizingHorizontal='FILL';await t.setFillStyleIdAsync(normal.id);if(s.highlight){for(let start=value.indexOf(s.highlight);start!==-1;start=value.indexOf(s.highlight,start+s.highlight.length))await t.setRangeFillStyleIdAsync(start,start+s.highlight.length,highlight.id);}}
   for(const n of originals)n.remove();box.primaryAxisSizingMode='AUTO';popup.counterAxisSizingMode='AUTO';
  }
  popup.x=0;popup.y=node.height+8;
 }
 // 修改布局后统一重绑现有描边，不改变paint内容。
 for(const n of [node,...node.findAll()])if('strokes'in n){const paints=JSON.parse(JSON.stringify(n.strokes));if(n.strokeStyleId)await n.setStrokeStyleIdAsync(n.strokeStyleId);else n.strokes=paints;}
 return {id:node.id,previousId,localized:node.type==='FRAME',width:node.width,height:node.height,popup:popup?{id:popup.id,width:popup.width,height:popup.height,x:popup.x,y:popup.y}:null};
}
export async function createSearch(figma,page,s){
 const component=await figma.getNodeByIdAsync(s.componentId);if(component?.type!=='COMPONENT')throw Error('组件不存在');
 let owner=component;while(owner&&owner.type!=='PAGE')owner=owner.parent;if(owner!==page)throw Error('组件不在授权Page');
 for(const t of component.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 const instance=component.createInstance();page.appendChild(instance);instance.name=s.name||'Search/业务内容';
 instance.x=Math.max(0,...page.children.filter(n=>n!==instance).map(n=>n.x+n.width))+80;instance.y=80;
 if(['value','tags','suggestions','width','customContentId'].some(k=>s[k]!==undefined))return await updateSearch(figma,instance,s);
 return {id:instance.id,localized:false,width:instance.width,height:instance.height};
}
export function generate(s){validateSpec(s);return `if(figma.fileKey!=='UNCONFIGURED_FIGMA_TARGET')throw Error('目标文件不符');const page=await figma.getNodeByIdAsync('169:2');await figma.setCurrentPageAsync(page);${updateSearch.toString()};${createSearch.toString()};return await createSearch(figma,page,${JSON.stringify(s)});`;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.stdout.write(generate(JSON.parse(readFileSync(process.argv[2]))));
