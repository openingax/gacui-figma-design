import {readFileSync} from 'node:fs';
import {buildTable,validate} from '../../components/table/generator.mjs';
import {isMain} from '../../support/entry.mjs';
export async function buildPage(figma,spec,buildTable,deps){
 if(figma.fileKey!==spec.fileKey||spec.fileKey!=='UNCONFIGURED_FIGMA_TARGET')throw Error('仅允许授权测试文件');
 const page=await figma.getNodeByIdAsync(spec.pageId);if(page?.type!=='PAGE'||page.name!==spec.pageName)throw Error('目标Page不符');
 await figma.setCurrentPageAsync(page);
 const root=await figma.getNodeByIdAsync(spec.rootId);if(root?.parent!==page||root.children.length)throw Error('页面已包含内容，请回读后修改');
 const clone=x=>JSON.parse(JSON.stringify(x));
 const ids=['36:5','43:5','43:25','43:9','36:23','36:31','36:35','36:39','47:57','56:2','72:35','107:86','107:124','107:139','55:27'];
 const originals=await Promise.all(ids.map(id=>figma.getNodeByIdAsync(id)));
 if(originals.some(n=>!n))throw Error('依赖缺失');
 const nodes=Object.fromEntries(ids.map((id,i)=>[id,originals[i]]));
 const fonts=new Map();for(const n of originals)for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))fonts.set(JSON.stringify(s.fontName),s.fontName);
 await Promise.all([...fonts.values()].map(f=>figma.loadFontAsync(f)));
 await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});
 const paints=await figma.getLocalPaintStylesAsync(),texts=await figma.getLocalTextStylesAsync();
 const style=name=>{const s=paints.find(s=>s.name===name);if(!s)throw Error('样式缺失 '+name);return s;};
 const C={white:'Gray 中性/Gray0-白色背景',bg:'Gray 中性/Gray1-浅色背景',border:'Gray 中性/Gray4-边框',line:'Gray 中性/Gray3-分割线',body:'Gray 中性/Gray9-强调\\正文',secondary:'Gray 中性/Gray6-提示',blue:'Brand 品牌/Brand5-Normal',light:'Brand 品牌/Brand1-Light'};
 const textStyle=texts.find(s=>s.fontName.family==='Noto Sans SC'&&s.fontSize===14);if(!textStyle)throw Error('缺少临时字体样式');
 const vars={},variableWarnings=[];
 for(const [v,key]of Object.entries({8:'5405046a0b16f5a9cdaeaa5829c972f5c4f6d9b5',16:'73bd5dafb2bbf2f3b201dead6fc8f03e7a0a2353',24:'f3ae02140ed7eaa325edfdaf7325c9f5a37b91ce'})){
  try{const variable=await figma.variables.importVariableByKeyAsync(key);const values=Object.values(variable.valuesByMode);if(values.some(x=>x!==Number(v)))throw Error('变量值与规范不符');vars[v]=variable;}catch(e){variableWarnings.push(String(e));}
 }
 function gap(n,v){n.itemSpacing=v;if(vars[v])n.setBoundVariable('itemSpacing',vars[v]);}
 function padding(n,v){for(const k of ['paddingLeft','paddingRight','paddingTop','paddingBottom']){n[k]=v;if(vars[v])n.setBoundVariable(k,vars[v]);}}
 async function fill(n,name){await n.setFillStyleIdAsync(style(name).id);}
 function frame(parent,name,dir,w,h){const n=figma.createAutoLayout(dir);parent.appendChild(n);n.name=name;n.resize(w,h);n.primaryAxisSizingMode='FIXED';n.counterAxisSizingMode='FIXED';n.fills=[];n.clipsContent=false;padding(n,0);gap(n,0);return n;}
 async function text(parent,value,color=C.body){const t=figma.createText();await t.setTextStyleIdAsync(textStyle.id);t.characters=value;t.textAutoResize='WIDTH_AND_HEIGHT';await fill(t,color);parent.appendChild(t);return t;}
 function inst(id,parent,name){const n=nodes[id].createInstance();parent.appendChild(n);n.name=name;return n;}
 async function button(parent,label,id='107:124'){const n=inst(id,parent,label);const k=Object.entries(n.componentProperties).find(([k,v])=>v.type==='TEXT');if(!k)throw Error('缺少按钮文字属性');n.setProperties({[k[0]]:label});n.primaryAxisSizingMode='AUTO';return n;}
 async function colorTree(n,color){for(const x of [n,...('findAll'in n?n.findAll(()=>true):[])])if(x.type==='TEXT'||x.type==='VECTOR')await fill(x,color);}
 const sections={};
 // Header: 原始导航作为起点；业务菜单与操作文字需要结构适配，因此仅将本页新实例本地化。
 let header=inst('36:5',root,'顶部导航');header=header.detachInstance();sections.header=header.id;
 // 保留规范品牌区的Logo、图片裁剪和可见性，不按业务截图省略品牌资产。
 const brand=header.findOne(n=>n.name==='brand');brand.primaryAxisSizingMode='AUTO';
 const menus=header.findOne(n=>n.name==='menu-items');const labels=['首页','充电','换电','运维','能源','SaaS','选址'];
 for(let i=0;i<menus.children.length;i++){const item=menus.children[i];item.fills=[];item.primaryAxisSizingMode='AUTO';item.findOne(n=>n.type==='TEXT').characters=labels[i];for(const c of [...item.children])if(c.name.startsWith('chevron'))c.remove();if([2,4,5].includes(i))item.appendChild(nodes['36:23'].clone());if(i===3)await fill(item,C.blue);}
 const operations=header.findOne(n=>n.name==='operations');for(const c of [...operations.children])c.remove();operations.primaryAxisSizingMode='AUTO';gap(operations,24);
 for(const [id,label]of [['36:31','设置'],['36:35','TAO'],['36:39','退出']]){const item=frame(operations,label,'HORIZONTAL',60,32);item.primaryAxisSizingMode='AUTO';item.counterAxisAlignItems='CENTER';gap(item,8);item.appendChild(nodes[id].clone());await text(item,label,C.white);}
 // 主体容器。
 const body=frame(root,'页面主体','HORIZONTAL',1440,868);await fill(body,C.bg);
 let sidebar=inst('43:5',body,'运维菜单');sidebar=sidebar.detachInstance();sidebar.resize(184,868);sidebar.primaryAxisAlignItems='MIN';sections.sidebar=sidebar.id;
 const content=sidebar.findOne(n=>n.name==='content'),menu=content.children[0];
 for(const c of [...menu.children])c.remove();menu.resize(184,328);menu.primaryAxisSizingMode='AUTO';content.primaryAxisSizingMode='AUTO';gap(menu,8);
 sidebar.findOne(n=>n.name==='.master/item normalMenu/menuOperations').visible=false;
 const sideLabels=['工单工作台','工单统计','人员管理','工单定时触发','场站监控','故障管理','运维统计'];
 for(let i=0;i<sideLabels.length;i++){const item=nodes['43:25'].clone();menu.appendChild(item);item.name=sideLabels[i];item.findOne(n=>n.type==='TEXT').characters=sideLabels[i];item.cornerRadius=4;const arrow=item.findOne(n=>n.name==='chevron-down');arrow.visible=i===4||i===5;
  // 后四项复用规范的Note图标；前3项保留源菜单图标，未从截图重绘矢量。
  if(i>=3){const prefix=item.findOne(n=>n.name==='prefix content'),old=prefix.children[0],icon=nodes['43:9'].findOne(n=>n.name==='充电模块左侧导航/Note/16').clone();prefix.insertChild(0,icon);old.remove();}
  if(i===0){await fill(item,C.light);await colorTree(item,C.blue);}else {await fill(item,C.white);await colorTree(item,C.body);}
 }
 const main=frame(body,'工作区','VERTICAL',1256,868);main.paddingLeft=main.paddingRight=16;main.paddingBottom=16;
 const tabs=frame(main,'页签区','HORIZONTAL',1224,60);tabs.counterAxisAlignItems='CENTER';const tab=inst('47:57',tabs,'工单工作台标签');tab.findOne(n=>n.type==='TEXT').characters='工单工作台';tab.primaryAxisSizingMode='AUTO';sections.tab=tab.id;
 const query=frame(main,'查询条件','VERTICAL',1224,160);await fill(query,C.white);query.cornerRadius=8;padding(query,16);gap(query,16);sections.query=query.id;
 for(let r=0;r<3;r++){const row=frame(query,'查询行/'+(r+1),'HORIZONTAL',1192,32);gap(row,24);
  for(let c=0;c<3;c++){const f=spec.filters[r*3+c];if(!f){const actions=frame(row,'查询操作','HORIZONTAL',1144/3,32);gap(actions,8);await button(actions,'查询','107:86');await button(actions,'重置');const expand=await button(actions,'展开查询条件','107:139');expand.primaryAxisSizingMode='AUTO';const arrow=nodes['36:23'].clone();actions.appendChild(arrow);await colorTree(arrow,C.blue);actions.counterAxisAlignItems='CENTER';continue;}
   const n=inst(f.kind==='input'?'56:2':'72:35',row,'筛选/'+f.label);n.resize(1144/3,32);
   if(f.kind==='input'){n.findOne(x=>x.type==='TEXT'&&x.name==='输入框标题').characters=f.label;n.findOne(x=>x.type==='TEXT'&&x.name==='请输入').characters=f.placeholder;}
   else{const t=n.findOne(x=>x.type==='TEXT');t.characters=f.label+'    '+f.value;t.setRangeFills(0,f.label.length,clone(style(C.secondary).paints));}
  }
 }
 const spacer=frame(main,'区块间距','VERTICAL',1224,16);
 const list=frame(main,'工单结果','VERTICAL',1224,616);await fill(list,C.white);list.cornerRadius=8;list.paddingLeft=list.paddingRight=list.paddingTop=16;sections.list=list.id;
 const toolbar=frame(list,'列表工具栏','HORIZONTAL',1192,32);toolbar.primaryAxisAlignItems='SPACE_BETWEEN';
 const actions=frame(toolbar,'主要操作','HORIZONTAL',266,32);actions.primaryAxisSizingMode='AUTO';gap(actions,16);await button(actions,'创建工单','107:86');await button(actions,'批量操作');await button(actions,'导出');
 const settings=frame(toolbar,'列设置','HORIZONTAL',32,32);settings.counterAxisAlignItems='CENTER';settings.primaryAxisAlignItems='CENTER';settings.cornerRadius=4;await settings.setStrokeStyleIdAsync(style(C.border).id);settings.strokeWeight=1;const gear=nodes['36:31'].clone();settings.appendChild(gear);await colorTree(gear,C.body);
 frame(list,'工具栏下间距','VERTICAL',1192,16);
 const tableResult=await buildTable(figma,list,spec.table,deps);sections.table=tableResult.componentId;
 // 分页数量是页面内容；先复用主组件，再仅将本页实例本地化，以调整源样例的页码数和总数位置。
 let pagination=inst('55:27',list,'工单分页');pagination=pagination.detachInstance();pagination.resize(1192,64);pagination.paddingLeft=pagination.paddingRight=0;pagination.primaryAxisAlignItems='MAX';sections.pagination=pagination.id;
 const group=pagination.findOne(n=>n.name==='group');group.primaryAxisSizingMode='AUTO';gap(group,8);
 const total=await text(group,'共21 条');group.insertChild(0,total);
 const pageButtons=group.findOne(n=>n.name==='page btn'),buttons=[...pageButtons.children];
 for(const b of buttons.slice(1,-1))b.remove();
 // 模板取已移除节点会失效，因此从源未修改的分页取得。
 const sourceButtons=nodes['55:27'].findOne(n=>n.name==='page btn');
 for(let i=1;i<=9;i++){const n=sourceButtons.children[2].clone();pageButtons.insertChild(i,n);n.name='页码/'+i;const t=n.findOne(n=>n.type==='TEXT');t.characters=String(i);await fill(n,i===2?C.blue:C.bg);await fill(t,i===2?C.white:C.body);}
 pageButtons.primaryAxisSizingMode='AUTO';
 const size=group.findOne(n=>n.name==='select');group.appendChild(size);const originalJumper=group.findOne(n=>n.name==='jumper');group.appendChild(originalJumper);size.resize(96,32);size.findOne(n=>n.type==='TEXT').characters='10条/页';
 const jumper=group.findOne(n=>n.name==='jumper');jumper.resize(106,32);gap(jumper,8);jumper.primaryAxisSizingMode='AUTO';const jumpTexts=jumper.findAllWithCriteria({types:['TEXT']});jumpTexts.find(t=>t.name==='placeholder').characters='5';jumpTexts.find(t=>t.name==='/20 页').characters='页';
 // 最终文字布局完成后重提描边，沿用已验证时序。
 for(const n of [root,...root.findAll(()=>true)])if('strokes'in n){if(n.strokeStyleId)await n.setStrokeStyleIdAsync(n.strokeStyleId);else n.strokes=clone(n.strokes);}
 const all=[root,...root.findAll(()=>true)];
 return {pageId:page.id,rootId:root.id,sections,createdNodeIds:all.filter(n=>n!==root).map(n=>n.id),mutatedNodeIds:[root.id],table:tableResult,variableWarnings,spacingVariables:Object.values(vars).map(v=>({id:v.id,name:v.name})),fonts:[...new Set(root.findAllWithCriteria({types:['TEXT']}).map(n=>n.fontName.family))],bounds:root.children.map(n=>({name:n.name,x:n.x,y:n.y,w:n.width,h:n.height}))};
}
export function tableDependencies(){
 const raw=JSON.parse(readFileSync(new URL('../../components/table-cell/build-data.json',import.meta.url),'utf8'));
 const props=id=>raw.nodes.find(n=>n.sourceId===id).props;
 const deps={cells:{header:'67:32',text:'67:11',tag:'67:20',state:'67:28',operations:'67:13'},checkbox:{off:'31:2',on:'31:12',mixed:'31:6'},pagination:'55:2',surface:{fills:props('46879:366074').fills,strokes:props('46879:366074').strokes},headerFill:props('46879:366290').fills,gridStroke:props('46879:366074').strokes};
 return deps;
}
export function generate(spec){
 validate(spec.table);const deps=tableDependencies();
 return `${buildTable.toString()}\n${buildPage.toString()}\nreturn await buildPage(figma,${JSON.stringify(spec)},buildTable,${JSON.stringify(deps)});`;
}
if(isMain(import.meta.url))process.stdout.write(generate(JSON.parse(readFileSync(new URL('spec.json',import.meta.url),'utf8'))));
