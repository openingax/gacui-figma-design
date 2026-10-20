// 纯数据生成器。预览策略必须显式传入；不宣称静态源稿证明了业务交互。
export function validateTransfer(spec){
 const s={...spec,tree:spec.tree??false,search:spec.search??false,retainSource:spec.retainSource??false};
 for(const k of ['tree','search','retainSource'])if(typeof s[k]!=='boolean')throw Error(k+'必须是布尔值');
 if(!Array.isArray(s.source)||!Array.isArray(s.target))throw Error('Transfer必须提供source和target数组');
 const normalize=(items,side)=>{const ids=new Set();let previous=-1;return items.map(o=>{
  if(!o||typeof o.id!=='string'||!o.id||ids.has(o.id)||typeof o.label!=='string'||!o.label)throw Error(side+'项目ID或文字缺失/重复');ids.add(o.id);
  for(const k of ['disabled','checked'])if(o[k]!==undefined&&typeof o[k]!=='boolean')throw Error(k+'必须是布尔值');
  if(o.disabled&&o.checked)throw Error('禁用项不能处于可移动选中态');
  if(!s.tree&&o.checked&&o.state==='hover')throw Error('源列表项没有已选加悬停的独立组合');
  if(!['normal','hover'].includes(o.state??'normal')||o.disabled&&o.state==='hover')throw Error('列表项状态无效');
  const depth=o.depth??0;if(!Number.isInteger(depth)||depth<0||!s.tree&&depth!==0||depth>previous+1)throw Error('树层级必须连续且从0开始');previous=depth;
  return {...o,depth,checked:o.checked??false,disabled:o.disabled??false,state:o.state??'normal'};
 });};
 s.source=normalize(s.source,'源');s.target=normalize(s.target,'目标');
 const src=new Map(s.source.map(o=>[o.id,o]));for(const o of s.target)if(src.has(o.id)){if(!s.retainSource)throw Error('非保留模式不允许两侧同ID');if(src.get(o.id).label!==o.label)throw Error('同ID文案不一致');}
 if(s.retainSource){const targetIds=new Set(s.target.map(o=>o.id));if(s.target.some(o=>!src.has(o.id)))throw Error('保留模式的目标项必须存在于源列表');if(s.source.some(o=>targetIds.has(o.id)&&o.checked))throw Error('已在目标中的源项不能再次选中');}
 if(s.tree&&s.pagination)throw Error('规范没有树加分页组合');
 if(s.pagination!==undefined&&s.pagination!==false){const p=s.pagination;if(!p||!Number.isInteger(p.pageSize)||p.pageSize<1||!Number.isInteger(p.sourcePage)||p.sourcePage<1||!Number.isInteger(p.targetPage)||p.targetPage<1)throw Error('分页必须明确pageSize和两侧页码');s.pagination={...p};}
 for(const side of ['source','target']){const q=s[side+'Query']??'';if(typeof q!=='string'||q&&!s.search)throw Error('查询只用于搜索模式');s[side+'Query']=q;}
 if((s.sourceQuery||s.targetQuery)&&s.filterPolicy!=='label-includes')throw Error('查询预览须明确filterPolicy=label-includes（演示策略）');
 for(const side of ['source','target'])if(s.pagination){const query=s[side+'Query'],count=s[side].filter(o=>!query||o.label.includes(query)).length;if(s.pagination[side+'Page']>Math.max(1,Math.ceil(count/s.pagination.pageSize)))throw Error(side+'页码超过筛选后页数');}
 if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<448))throw Error('开发预览宽度至少448');
 if(s.viewportHeight!==undefined&&(!Number.isFinite(s.viewportHeight)||s.viewportHeight<64))throw Error('内容视口高度至少64');
 return s;
}
export function transferModel(spec,catalog){
 const s=validateTransfer(spec),recipe=catalog.recipes.find(r=>r.tree===s.tree&&r.search===s.search&&r.pagination===!!s.pagination&&r.sourceEmpty===(s.source.length===0)&&r.targetEmpty===(s.target.length===0));
 // 双空态源中没有独立主组合；开发预览明确记录，不能静默认作源支持。
 const gaps=recipe?[]:['源快照未提供该主组合；只显示开发草稿，不能生成Figma'];
 const targetIds=new Set(s.target.map(o=>o.id));
 const side=name=>{const items=s[name],query=s[name+'Query'],filtered=query?items.filter(o=>o.label.includes(query)):items;const totalPages=s.pagination?Math.max(1,Math.ceil(filtered.length/s.pagination.pageSize)):1,page=s.pagination?s.pagination[name+'Page']:1;if(page>totalPages)throw Error(name+'页码超过筛选后页数');
  const visible=s.pagination?filtered.slice((page-1)*s.pagination.pageSize,page*s.pagination.pageSize):filtered;
  return {items:visible.map(o=>({...o,unavailable:o.disabled||(name==='source'&&s.retainSource&&targetIds.has(o.id))})),count:items.length,matched:filtered.length,selected:items.filter(o=>o.checked).length,page,totalPages,query,contentHeight:visible.length?catalog.rowHeight*visible.length+catalog.rowGap*(visible.length-1):0};};
 const source=side('source'),target=side('target');
 return {spec:s,source,target,recipe,width:s.width??recipe?.width??448,height:recipe?.height??239,viewportHeight:s.viewportHeight??176,rowHeight:catalog.rowHeight,rowGap:catalog.rowGap,controlState:source.selected?(target.selected?'Checked':'leftChecked'):(target.selected?'rightChecked':'Default'),gaps,validation:'offline-only'};
}
export function moveTransfer(spec,direction,policy){
 const s=validateTransfer(spec);
 if(s.tree)throw Error('树移动的父子联动未确定；不能套用平面移动策略');
 if(!['right','left'].includes(direction)||policy?.order!=='append'||policy?.selection!=='clear-moved')throw Error('演示移动必须明确方向、append顺序和clear-moved策略');
 const from=direction==='right'?'source':'target',to=direction==='right'?'target':'source',ids=new Set(s[from].filter(o=>o.checked&&!o.disabled).map(o=>o.id)),dest=new Set(s[to].map(o=>o.id));
 const moving=s[from].filter(o=>ids.has(o.id)&&!dest.has(o.id)).map(o=>({...o,checked:false,state:'normal'}));
 const result={...s,[from]:s[from].filter(o=>s.retainSource&&from==='source'||!ids.has(o.id)).map(o=>ids.has(o.id)?{...o,checked:false}:o),[to]:[...s[to].map(o=>ids.has(o.id)?{...o,checked:false}:o),...moving]};
 if(result.pagination)result.pagination={...result.pagination,sourcePage:1,targetPage:1};
 return validateTransfer(result);
}
export function transferHtml(model,escape){
 const panel=(name,title)=>{const side=model[name];return `<section class="transfer-panel"><header>${escape(title)} <span>${side.selected}/${side.count} 项</span></header>${model.spec.search?`<div class="transfer-search">⌕ ${escape(side.query||'请输入搜索内容')}</div>`:''}<div class="transfer-items" style="height:${model.viewportHeight}px">${side.items.length?side.items.map(o=>`<div class="transfer-row ${o.checked?'selected':''} ${o.state} ${o.unavailable?'disabled':''}" style="padding-left:${8+o.depth*16}px" data-item="${escape(o.id)}"><span>${o.checked?'☑':'☐'}</span><span class="transfer-label">${escape(o.label)}</span></div>`).join(''):'<div class="transfer-empty">暂无数据</div>'}</div>${model.spec.pagination?`<footer>第 ${side.page}/${side.totalPages} 页 · 匹配 ${side.matched} 项</footer>`:''}</section>`;};
 return `<div class="transfer-development">离线开发预览 · Figma 导入未完成${model.gaps.length?' · '+escape(model.gaps.join('；')):''}</div><div class="sketch-transfer" style="width:${model.width}px">${panel('source',model.spec.sourceTitle??'源列表')}<div class="transfer-controls"><span class="${model.source.selected?'enabled':''}">›</span><span class="${model.target.selected?'enabled':''}">‹</span></div>${panel('target',model.spec.targetTitle??'目标列表')}</div>`;
}
