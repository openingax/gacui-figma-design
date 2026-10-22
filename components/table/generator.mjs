import {tableExtensionDependencies} from './extension-dependencies.mjs';
import {validateTableExtensions,applyTableExtensions} from './extensions.mjs';
import{readFileSync}from'node:fs';import {componentTarget} from '../../scripts/lib/figma-target.mjs';
import {isMain} from '../../support/entry.mjs';
export function validate(config){
 const mode=validateTableExtensions(config);if(config.selectionMode)config.selection=mode!=='none';
 if(typeof config.name!=='string'||!config.name.trim())throw Error('需要表格名称');
 if(!Array.isArray(config.columns)||!config.columns.length)throw Error('至少需要一列');
 if(new Set(config.columns.map(c=>c.key)).size!==config.columns.length)throw Error('列key重复');
 for(const c of config.columns)if(!['text','textTag','tag','state','operations'].includes(c.kind)||!Number.isFinite(c.width)||c.width<=0)throw Error('列类型或宽度无效');
 for(const c of config.columns)if(c.kind==='operations'&&c.actions&&(!Array.isArray(c.actions)||c.actions.length>2))throw Error('当前操作单元只支持两项文本操作和更多图标');
 if(!Array.isArray(config.rows))throw Error('rows必须为数组');
 if(config.asFrame!==undefined&&typeof config.asFrame!=='boolean')throw Error('asFrame必须为布尔');
 if(config.rowActions!==undefined){
  if(!Array.isArray(config.rowActions)||config.rowActions.length!==config.rows.length)throw Error('rowActions必须逐行提供');
  for(const a of config.rowActions)if(!a||!Array.isArray(a.labels)||a.labels.length>3||a.labels.some(x=>typeof x!=='string'||!x.trim())||typeof a.more!=='boolean')throw Error('行操作需要0至3项文字及more布尔值');
 }

 for(const row of config.rows)for(const column of config.columns)if(column.kind!=='operations'&&row[column.key]!=null&&!['string','number','boolean'].includes(typeof row[column.key]))throw Error('单元格显示值必须先格式化为文字或标量');
 for(const c of config.columns)if(c.wrap!==undefined&&(typeof c.wrap!=='boolean'||c.kind!=='text'))throw Error('wrap仅支持文字列布尔值');
 const selected=config.selectedRows||[];if(new Set(selected).size!==selected.length||selected.some(i=>!Number.isInteger(i)||i<0||i>=config.rows.length))throw Error('选中行无效');
 const disabled=config.disabledRows||[];if(!Array.isArray(disabled)||new Set(disabled).size!==disabled.length||disabled.some(i=>!Number.isInteger(i)||i<0||i>=config.rows.length)||selected.some(i=>disabled.includes(i)))throw Error("禁选行无效或与选中行冲突");
 return config;
}
export async function buildTable(figma,page,config,deps){
 const clone=x=>JSON.parse(JSON.stringify(x)),created=[];
 if(page.findAllWithCriteria({types:['COMPONENT']}).some(n=>n.name===config.name)||page.children.some(n=>n.name===config.name))throw Error('同名表格已存在');
 for(const id of [...Object.values(deps.cells),...Object.values(deps.checkbox),deps.pagination]){const n=await figma.getNodeByIdAsync(id);if(!n||n.type!=='COMPONENT')throw Error('依赖元组件不存在');for(const t of n.findAllWithCriteria({types:['TEXT']}))for(const s of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(s.fontName);}
 const paints=await figma.getLocalPaintStylesAsync();const style=name=>{const s=paints.find(p=>p.name===name);if(!s)throw Error('缺少样式 '+name);return s.id;};
 const width=config.columns.reduce((sum,c)=>sum+c.width,0)+(config.selection?44:0),height=46+config.rows.length*44+(config.pagination?64:0);
 const table=config.asFrame?figma.createAutoLayout('VERTICAL'):figma.createComponent();created.push(table.id);page.appendChild(table);table.name=config.name;table.resize(width,height);table.layoutMode='VERTICAL';table.primaryAxisSizingMode='FIXED';table.counterAxisSizingMode='FIXED';table.itemSpacing=0;table.paddingTop=table.paddingBottom=table.paddingLeft=table.paddingRight=0;table.fills=clone(deps.surface.fills);table.strokes=clone(deps.surface.strokes);table.strokeWeight=1;table.strokeAlign='INSIDE';table.strokesIncludedInLayout=false;table.cornerRadius=8;table.clipsContent=true;await table.setFillStyleIdAsync(style('Gray 中性/Gray0-白色背景'));await table.setStrokeStyleIdAsync(style('Gray 中性/Gray4-边框'));
 const main=id=>figma.getNodeByIdAsync(id);
 async function visibleTexts(instance){const texts=instance.findAllWithCriteria({types:['TEXT']});return texts.filter(n=>{let p=n;while(p&&p!==instance){if(!p.visible)return false;p=p.parent;}return true;});}
 async function addRow(values,index,header=false){
  const row=figma.createAutoLayout('HORIZONTAL');created.push(row.id);table.appendChild(row);row.name=header?'header':`row/${index+1}`;row.resize(width,header?46:44);row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='FIXED';row.itemSpacing=0;row.paddingTop=row.paddingBottom=row.paddingLeft=row.paddingRight=0;row.fills=[];
  if(config.selection){const slot=figma.createAutoLayout('HORIZONTAL');created.push(slot.id);row.appendChild(slot);slot.name='selection';slot.resize(44,header?46:44);slot.primaryAxisSizingMode='FIXED';slot.counterAxisSizingMode='FIXED';slot.primaryAxisAlignItems='CENTER';slot.counterAxisAlignItems='CENTER';slot.fills=clone(header?deps.headerFill:deps.surface.fills);slot.strokes=clone(deps.gridStroke);slot.strokeWeight=1;slot.strokeAlign='INSIDE';slot.strokeTopWeight=0;slot.strokeLeftWeight=0;slot.strokeBottomWeight=1;slot.strokeRightWeight=1;slot.strokesIncludedInLayout=false;await slot.setFillStyleIdAsync(style(header?'Gray 中性/Gray1-浅色背景':'Gray 中性/Gray0-白色背景'));await slot.setStrokeStyleIdAsync(style('Gray 中性/Gray3-分割线'));
   const selected=config.selectedRows||[];const disabled=config.disabledRows||[];const eligible=config.rows.length-disabled.length;const state=header?(selected.length===0?'off':selected.length===eligible?'on':'mixed'):(selected.includes(index)?'on':'off');let checkMain=await main(deps.checkbox[state]);if(header?eligible===0:disabled.includes(index)){const sibling=checkMain.parent.children.find(n=>n.type==='COMPONENT'&&n.name===checkMain.name.replace('disabled 禁用=false','disabled 禁用=true'));if(!sibling)throw Error('找不到Checkbox禁用变体');checkMain=sibling;}const check=checkMain.createInstance();slot.appendChild(check);created.push(check.id);
  }
  for(const column of config.columns){let cell=(await main(deps.cells[header?'header':column.kind])).createInstance();row.appendChild(cell);created.push(cell.id);cell.name=`cell/${column.key}`;cell.resize(column.width,header?46:44);cell.layoutSizingHorizontal='FIXED';cell.layoutSizingVertical='FIXED';const texts=await visibleTexts(cell);
   if(header){if(texts[0])texts[0].characters=column.title;}
   else if(column.kind==='operations'){
    const action=config.rowActions?.[index];
    if(!action){const actions=column.actions||['管理','删除'];for(let i=0;i<Math.min(actions.length,texts.length);i++)texts[i].characters=actions[i];}
    else {
     cell=cell.detachInstance();created.push(cell.id);
     if(action.labels.length>2){const template=cell.children.find(n=>n.name==='Link 链接');const extra=template.clone();cell.insertChild(2,extra);created.push(extra.id);}
     const links=cell.children.filter(n=>n.name==='Link 链接');
     links.forEach((link,i)=>{link.visible=i<action.labels.length;if(link.visible){const t=link.findAllWithCriteria({types:['TEXT']})[0];t.characters=action.labels[i];t.textAutoResize='WIDTH_AND_HEIGHT';link.primaryAxisSizingMode='AUTO';}});
     const more=cell.children.find(n=>n.name==='系统');if(more)more.visible=action.more;
     const visible=cell.children.filter(n=>n.visible);const needed=cell.paddingLeft+cell.paddingRight+visible.reduce((s,n)=>s+n.width,0)+Math.max(0,visible.length-1)*cell.itemSpacing;
     if(needed>column.width+0.001)throw Error('操作列宽不足 '+column.key+': '+needed);
    }
   }
   else if(texts[0]){texts[0].characters=String(values[column.key]??'');texts[0].textAutoResize='NONE';texts[0].textTruncation='ENDING';}
  }
  if(!header&&config.columns.some(c=>c.wrap)){let h=44;for(const c of config.columns.filter(c=>c.wrap)){const cell=row.children.find(n=>n.name==='cell/'+c.key),t=(await visibleTexts(cell))[0];t.textTruncation='DISABLED';t.maxLines=null;t.resize(c.width-cell.paddingLeft-cell.paddingRight,22);t.textAutoResize='HEIGHT';h=Math.max(h,t.height+cell.paddingTop+cell.paddingBottom);}row.resize(width,h);for(const c of row.children)c.resize(c.width,h);}
 }
 await addRow({},-1,true);for(let i=0;i<config.rows.length;i++)await addRow(config.rows[i],i);
 if(config.pagination){const pagination=(await main(deps.pagination)).createInstance();table.appendChild(pagination);created.push(pagination.id);pagination.name='pagination';pagination.resize(width,64);const total=pagination.findAllWithCriteria({types:['TEXT']}).find(t=>t.name==='totalContent');if(total)total.characters=`共 ${config.total??config.rows.length} 项数据`;}
 table.resize(width,table.children.reduce((h,n)=>h+n.height,0));
 if(page.type==='PAGE'){table.x=Math.max(0,...page.children.filter(n=>n!==table).map(n=>n.x+n.width))+80;table.y=80;}if(table.type==='COMPONENT')table.description='依据规范单元格、Checkbox和分页组合；行列由业务数据提供，当前数据仅为组件验证样例。';
 if(config.selectionMode||config.resizableColumns||config.columns.some(c=>c.maxLines||['textTag','state'].includes(c.kind))){if(!deps.extensions)throw Error('Table扩展依赖未配置');await applyTableExtensions(figma,table,config,deps.extensions);}
 // 包含实例内部后代ID，便于完整审计。
 for(const n of [table,...table.findAll(()=>true)])if('strokes'in n){if(n.strokeStyleId)await n.setStrokeStyleIdAsync(n.strokeStyleId);else n.strokes=clone(n.strokes);}
 const ids=[table.id,...table.findAllWithCriteria({types:['FRAME','INSTANCE','TEXT','VECTOR','RECTANGLE','ELLIPSE']}).map(n=>n.id)];
 return {componentId:table.id,createdNodeIds:ids,width:table.width,height:table.height,rows:config.rows.length,columns:config.columns.length,selectedRows:config.selectedRows||[],reused:{cells:deps.cells,checkbox:deps.checkbox,pagination:deps.pagination}};
}
export function generate(config,target){
 validate(config);if(!target.fileKey||target.fileKey==='jNf9icrxfw8B7QkSQa9g33'||!/^\d+:\d+$/.test(target.pageId||''))throw Error('需要独立目标Page');
 const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
 const checkboxTarget=read('../../evidence/checkbox/target.json');const allowed=componentTarget('table');if(target.fileKey!==allowed.fileKey||target.pageId!==allowed.pageId||target.fileKey!==checkboxTarget.fileKey)throw Error('组合仅在已登记Table Page中可用；跨Page依赖必须在同文件');
 const cells=read('../../evidence/table-cell/target.json').map,pagination=read('../../evidence/pagination/target.json').map,raw=read('../../evidence/table-cell/source.raw.json');
 const deps={cells:{header:cells['46879:366290'],text:cells['46879:366074'],tag:cells['46879:366182'],state:cells['46879:366218'],operations:cells['46879:366110']},checkbox:{off:'31:2',on:'31:12',mixed:'31:6'},pagination:pagination['45617:338279'],surface:{fills:[{type:'SOLID',color:{r:1,g:1,b:1}}],strokes:raw.tree.children[0].strokes},headerFill:raw.tree.children.find(n=>n.id==='46879:366290').fills,gridStroke:raw.tree.children[0].strokes};
 // 外框Gray4与内部Gray3来自表格整体/单元格规范，保留原始浮点值。
 deps.surface.strokes=[{type:'SOLID',color:{r:0.8627451062202454,g:0.8666666746139526,b:0.8705882430076599}}];
 const extended=config.selectionMode||config.resizableColumns||config.columns.some(c=>c.maxLines||['textTag','state'].includes(c.kind));if(extended){deps.extensions=tableExtensionDependencies();deps.cells.textTag=deps.extensions.textTag;}
 const code=`${extended?applyTableExtensions.toString():''}
const target=${JSON.stringify(target)};if(figma.fileKey!==target.fileKey)throw Error('目标文件不符');const page=await figma.getNodeByIdAsync(target.pageId);if(!page||page.type!=='PAGE')throw Error('Page不存在');await figma.setCurrentPageAsync(page);const buildTable=${buildTable.toString()};return await buildTable(figma,page,${JSON.stringify(config)},${JSON.stringify(deps)});`;
 if(code.length>50000)throw Error('表格代码超过50000字符');return code;
}
if(isMain(import.meta.url)){const[configPath,fileKey,pageId]=process.argv.slice(2);process.stdout.write(generate(JSON.parse(readFileSync(configPath,'utf8')),{fileKey,pageId}));}
