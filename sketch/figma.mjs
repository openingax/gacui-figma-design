#!/usr/bin/env node
import {validateCascader,cascaderSetText,updateCascaderOption,renderCascaderMenu,renderCascader} from '../components/cascader/family.mjs';
import {validateTimePicker,renderTimePicker} from '../components/time-picker/family.mjs';
import {validateSelect,renderSelect,selectHelpers,renderSinglePopup,updateSingleOption} from '../components/select/family.mjs';
import {validateInputField,renderInputField} from '../components/input/family.mjs';
import {validateInputNumber,renderInputNumber} from '../components/input-number/generator.mjs';
import {validateCheckbox,renderCheckbox} from '../components/checkbox/family.mjs';
import {validateRadio,renderRadio} from '../components/radio/generator.mjs';
import {SIZE,STATE,STYLE,LINK_IDS,validateLink,linkVariant,linkStyleName,propertyKey,recolorIcons,updateLink,renderLink} from '../components/link/generator.mjs';
import {validateLayout,composeLayout} from '../components/layout/generator.mjs';
import {validateDivider,dividerVariant,renderDivider,updateDivider} from '../components/divider/generator.mjs';
import{renderMultiPopup,updateMultiOption,verifyMultiPopup}from'../components/multi-option/generator.mjs';
import {renderFeedback,updateFeedback,validateFeedback,verifyFeedback} from '../components/feedback/generator.mjs';
import {renderTimeline,updateTimelineItem,validateTimeline,verifyTimelines} from '../components/timeline/generator.mjs';
import {renderImageViewer,validateImageViewer,verifyImageViewers} from '../components/image-viewer/generator.mjs';
import {renderDescriptions,validateDescriptions,verifyDescriptions} from '../components/descriptions/generator.mjs';
import {renderDialog,validateDialog,verifyDialogs,updateDialog} from '../components/dialog/generator.mjs';
// 把已确认版本的草图转成 use_figma 执行代码，每次一个画板。格式见 docs/sketch-design.md 第八节。
import {readFileSync, writeFileSync} from 'node:fs';
import {loadVersions, loadChecklist} from './sketch.mjs';
import {check, nodeTitle, resolvePage} from './core.mjs';
import {verifyWorkbench, verifyForm, generationResult} from './verification.mjs';
import {sketchRuntime} from './figma-runtime.mjs';
import {buildTable, validate as validateTable} from '../components/table/generator.mjs';
import {tableDependencies} from '../pages/work-orders/build.mjs';
import {composeForm, fitFieldContent} from '../components/form/generator.mjs';
import {updateDrawer, buttonReactions} from '../components/drawer/generator.mjs';

import {targetConfig} from '../scripts/lib/figma-target.mjs';
import {isMain} from '../support/entry.mjs';
export const FILE_KEY = targetConfig().fileKey;
const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
// 组件分类页和历史页面一律不写；任务 Page 由 versions.json 的 figmaPage 指定。
const PROTECTED = [...targetConfig().pages.map(p => p.name),
  '工单工作台 [UIAgent测试]', '创建工单 [UIAgent测试]', '对账未完成 [UIAgent测试]', '工单自主出稿试用 20261013'];
const FORM_TOP = {input: 'input', textarea: 'textarea', select: 'select', date: 'datePicker', 'date-range':'datePicker', time:'timePicker', number:'inputNumber', radio:'radio', switch: 'switch', checkbox: 'checkbox'};
const LIST_WIDTH = 1192, SELECTION_WIDTH = 44;
const PLACEHOLDER = {input: '请输入', textarea: '请输入', select: '请选择', date: '请选择日期'};

function formVariant(kind, required, help) {
  const want = `required 必填=${!!required}, help 说明=${!!help}, tooltips 提示=false`;
  const v = readJson(`../evidence/form-top/${FORM_TOP[kind]}-target.json`).variants.find(x => x.name.includes(want));
  if (!v) throw Error(`表单字段 ${kind} 缺少变体 ${want}`);
  return v.id;
}

const opsWidth = actions => Math.max(88, ...actions.map(a => 32 + a.labels.join('').length * 14 + (a.labels.length - 1) * 24 + (a.more ? 40 : 0) + 8));

export function tableConfig(node, layer, rowCount, listWidth=LIST_WIDTH) {
  const ops = node.columns.filter(c => c.kind === 'operations');
  if (ops.length > 1) throw Error('表格最多一个操作列');
  if (ops.length && !node.rowActions?.length && !node.rowActionRules?.length) throw Error('表格有操作列，草图里必须写 rowActions');
  const fixed = ops.length ? opsWidth(node.rowActionRules ?? node.rowActions) : 0;
  const others = node.columns.filter(c => c.kind !== 'operations');
  const free = listWidth - (node.selection ? SELECTION_WIDTH : 0) - fixed;
  const each = Math.floor(free / others.length);
  if (each < 80) throw Error(`列太多：每列只能分到 ${each}px，请减少列或改为详情里展示`);
  const columns = node.columns.map(c => ({key: c.id, title: c.title, kind: c.kind ?? 'text', ...(c.wrap!==undefined?{wrap:c.wrap}:{}), width: c.kind === 'operations' ? fixed : each}));
  columns.find(c => c.kind !== 'operations').width += free - each * others.length;
  const rows = Array.from({length: rowCount}, (_, i) => Object.fromEntries(others.map(c => [c.id, String(node.data?.[i]?.[c.id] ?? '演示')])));
  const config = {name: layer, asFrame: true, selection: !!node.selection, pagination: false, selectedRows: node.selectedRows ?? [], disabledRows: node.disabledRows ?? [], columns, rows,
    ...(ops.length ? {rowActions: rows.map((_, i) => { const a = node.rowActions[i % node.rowActions.length]; return {labels: a.labels, more: !!a.more}; })} : {})};
  return validateTable(config);
}

/** 草图路径 → Figma 图层名和类型；同一页面里重名时加上 id 区分。 */
function layerMap(page) {
  const map = new Map(), used = new Set();
  const name = (base, id) => { const n = used.has(base) ? `${base}·${id}` : base; used.add(n); return n; };
  for (const node of page.children ?? []) {
    const path = `${page.id}/${node.id}`;
    if (node.type === 'table') map.set(path, {layer: name('表格/' + nodeTitle(node), node.id), type: 'table'});
    else map.set(path, {layer: null, type: 'node'});
    for (const f of node.fields ?? []) {
      const context = node.type === 'search' ? 'search' : 'form';
      map.set(`${path}/${f.id}`, {layer: name((context === 'search' ? '筛选/' : '字段/') + f.label, f.id), type: 'field', field: {...f, context}});
    }
    for (const b of node.buttons ?? []) map.set(`${path}/${b.id}`, {layer: name('按钮/' + b.label, b.id), type: 'button'});
  }
  for (const v of map.values()) if (v.field) v.field.layer = v.layer;
  return map;
}

function nodeNotes(page) {
  return (page.children ?? []).flatMap(n => n.type === 'note' ? [`说明：${n.text}`] : n.type === 'gap' ? [`缺口：${n.need}（本轮：${n.handling ?? '待定'}）`] : []);
}

function workbenchDef(page, layers) {
  if(page.children?.some(n=>n.type==='upload'&&n.visible!==false))throw Error('独立Upload仅支持离线开发预览，Figma草稿接入未验证');
  if(page.children?.some(n=>n.type==='transfer'&&n.visible!==false))throw Error('Transfer仅支持离线开发预览，Figma导入与验证未完成');
  const of = type => (page.children ?? []).filter(n => n.type === type && n.visible !== false);
  for (const type of ['form']) if (of(type).length) throw Error(`工作台页面里的 ${type} 本轮不支持生成 Figma`);
  for (const type of ['search', 'table', 'tabs']) if (of(type).length > 1) throw Error(`工作台页面最多一个 ${type}`);
  const [search] = of('search'), [table] = of('table'), [tabs] = of('tabs');
  for (const f of search?.fields ?? []) if (!['input', 'select', 'date-range'].includes(f.kind)) throw Error(`查询区字段 ${f.label}：Figma 出稿暂不支持 ${f.kind}，可改为 date-range 或写成缺口`);
  const contentWidth=page.layout?(page.layout==='top'?1336:1136):1192;
  for(const d of of('divider'))if(d.orientation!=='vertical'&&(d.length??contentWidth)>contentWidth)throw Error('分割线超过工作台正文宽度');
  const tableLayer = table && layers.get(`${page.id}/${table.id}`).layer;
  return {
    tabs: tabs ? {items: tabs.items, active: tabs.active ?? 0, placement: tabs.placement ?? 'navigation'} : {items: [page.title], active: 0},
    pageTitle: page.title,
    ...(page.layout?{layout:page.layout,contentWidth}:{}),
    feedbacks: of('feedback').map(validateFeedback),
    cascaders: of('cascader').length?of('cascader').map(validateCascader):undefined,
    timePickers: of('timePicker').map(validateTimePicker),
    selectFields: of('selectField').map(validateSelect),
    inputFields: of('inputField').map(validateInputField),
    numbers: of('number').map(validateInputNumber),
    checkboxes: of('checkbox').map(validateCheckbox),
    radios: of('radio').map(validateRadio),
    links: of('link').map(validateLink),
    dividers: of('divider').map(validateDivider),
    blocks: !(of('cascader').length||of('timePicker').length||of('selectField').length||of('inputField').length||of('number').length||of('checkbox').length||of('divider').length||of('link').length||of('radio').length)?undefined:(page.children??[]).filter(n=>n.visible!==false&&!['note','gap','dialog'].includes(n.type)).map(n=>({id:n.id,type:n.type,layer:layers.get(`${page.id}/${n.id}`)?.layer,buttons:(n.buttons??[]).filter(b=>b.visible!==false).map(b=>layers.get(`${page.id}/${n.id}/${b.id}`).layer),navigation:n.type==='tabs'&&(n.placement??'navigation')==='navigation'})),
    timelines: of('timeline').map(validateTimeline),
    imageViewers: of('imageViewer').map(validateImageViewer),
    descriptions: of('descriptions').map(validateDescriptions),
    headings: of('heading').map(n=>({layer:'详情标题/'+n.id,title:n.title,subtitle:n.subtitle,status:n.status})),
    tagThemes: table?.columns.filter(c=>c.kind==='tag' && c.themes).map(c=>({key:c.id,themes:c.themes})) ?? [],
    messages: of('actions').filter(n => n.message).map(n => ({layer:'操作说明/'+n.id, text:n.message})),
    menuLeaf: page.menu ? page.menu.split('/').pop().trim() : page.title,
    search: search ? search.fields.map(f => ({...f, context: 'search', layer: layers.get(`${page.id}/${search.id}/${f.id}`).layer})) : null,
    buttons: page.children.filter(n => n.type === 'actions').flatMap(n => n.buttons.map(b => ({label: b.label, primary: !!b.primary, disabled: !!b.disabled, selectionSummary: b.selectionSummary, visible: n.visible !== false && b.visible !== false, layer: layers.get(`${page.id}/${n.id}/${b.id}`).layer}))),
    table: table ? {pagination: !!table.pagination, feedback: table.feedback, emptyText: table.emptyText, error: table.error, retryLabel: table.retryLabel, loading: table.loading, config: tableConfig(table, tableLayer, table.renderRows ?? Math.min(table.rows ?? 10, 10),contentWidth)} : null,
  };
}

function drawerDef(page, layers, overName) {
  if(page.children?.some(n=>n.type==='upload'&&n.visible!==false))throw Error('独立Upload仅支持离线开发预览，Figma草稿接入未验证');
  if(page.children?.some(n=>n.type==='transfer'&&n.visible!==false))throw Error('Transfer仅支持离线开发预览，Figma导入与验证未完成');
  for (const n of page.children ?? []) if (!['form', 'actions', 'note', 'gap', 'dialog','feedback','divider','link','radio','checkbox','number','inputField','selectField','timePicker','cascader'].includes(n.type)) throw Error(`抽屉里的 ${n.type} 本轮不支持生成 Figma`);
  const width = page.width ?? 500, formWidth = width - 48;
  const size = width <= 300 ? 'small' : width <= 500 ? 'medium' : 'large';
  const rows = [], groups = [], dividers = [], links = [], radios = [], checkboxes = [], cascaders = [], timePickers = [], selectFields = [], inputFields = [], numbers = [], feedbacks = [], inserts = [];
  for (const form of page.children.filter(n => ['form','feedback','divider','link','radio','checkbox','number','inputField','selectField','timePicker','cascader'].includes(n.type) && n.visible !== false)) {
    if(form.type==='feedback'){const item={...validateFeedback(form),beforeRow:rows.length};feedbacks.push(item);inserts.push({type:'feedback',...item});continue;}
    if(form.type==='cascader'){const item={...validateCascader(form),beforeRow:rows.length};cascaders.push(item);inserts.push({type:'cascader',...item});continue;}
    if(form.type==='timePicker'){const item={...validateTimePicker(form),beforeRow:rows.length};timePickers.push(item);inserts.push({type:'timePicker',...item});continue;}
    if(form.type==='selectField'){const item={...validateSelect(form),beforeRow:rows.length};selectFields.push(item);inserts.push({type:'selectField',...item});continue;}
    if(form.type==='inputField'){const item={...validateInputField(form),beforeRow:rows.length};inputFields.push(item);inserts.push({type:'inputField',...item});continue;}
    if(form.type==='number'){const item={...validateInputNumber(form),beforeRow:rows.length};numbers.push(item);inserts.push({type:'number',...item});continue;}
    if(form.type==='checkbox'){const item={...validateCheckbox(form),beforeRow:rows.length};checkboxes.push(item);inserts.push({type:'checkbox',...item});continue;}
    if(form.type==='radio'){const item={...validateRadio(form),beforeRow:rows.length};radios.push(item);inserts.push({type:'radio',...item});continue;}
    if(form.type==='link'){const item={...validateLink(form),beforeRow:rows.length};links.push(item);inserts.push({type:'link',...item});continue;}
    if(form.type==='divider'){validateDivider(form);if((form.orientation??'horizontal')==='horizontal'&&(form.length??formWidth)>formWidth)throw Error('分割线超过抽屉正文宽度');const item={...form,beforeRow:rows.length,length:form.length??(form.orientation==='vertical'?40:formWidth)};dividers.push(item);inserts.push({type:'divider',...item});continue;}
    if (form.title && !form.fields.some(f=>f.label===form.title) && form.fields.some(f => f.visible !== false)) groups.push({title:form.title, layer:'分组/'+form.id, beforeRow:rows.length});
    let pending = null;
    for (const f of form.fields) {
      if (f.visible === false) continue;
      const d = {...f, context:'form', layer:layers.get(`${page.id}/${form.id}/${f.id}`).layer};
      d.placeholder ??= PLACEHOLDER[f.kind];
      const wide = form.cols !== 2 || ['textarea', 'upload'].includes(f.kind);
      if (wide) { if (pending) { rows.push([pending]); pending = null; } d.width = formWidth; rows.push([d]); }
      else if (pending) { d.width = pending.width; rows.push([pending, d]); pending = null; }
      else { d.width = (formWidth - 24) / 2; pending = d; }
    }
    if (pending) rows.push([pending]);
  }
  for (const row of rows) for (const d of row) if (d.kind !== 'upload') d.variant = formVariant(d.kind, d.required, d.help);
  const footer = page.children.filter(n => n.type === 'actions' && n.footer).flatMap(n => n.buttons.filter(b => b.visible !== false).map(b => ({...b, layer:layers.get(`${page.id}/${n.id}/${b.id}`).layer})));
  if (page.children.some(n => n.type === 'actions' && !n.footer)) throw Error('抽屉正文里的按钮本轮不支持，底栏按钮请写 footer: true');
  return {title: page.title, width, size, formWidth, rows, groups, dividers, links, radios, checkboxes, cascaders:cascaders.length?cascaders:undefined, timePickers,selectFields,inputFields,numbers, feedbacks:feedbacks.length?feedbacks:undefined, inserts, buttons:footer, over: overName,
    confirm: footer.find(b => b.primary)?.label ?? null, cancel: footer.find(b => !b.primary)?.label ?? null};
}

function expectedWorkbench(def) {
  return [...def.tabs.items, ...(def.messages ?? []).map(m=>m.text), ...(def.headings??[]).flatMap(h=>[h.title,h.subtitle,h.status.label].filter(Boolean)), ...(def.search ?? []).flatMap(f => [f.label, f.value == null ? null : String(f.value)].filter(Boolean)),
    ...def.buttons.filter(b => b.visible).flatMap(b => [b.label, b.selectionSummary].filter(Boolean)),
    ...(def.table?.config.columns.map(c => c.title) ?? []),
    ...(def.table?.config.rows.flatMap(row => Object.values(row).map(String)) ?? []),
    ...(def.table?.config.rowActions?.flatMap(a => a.labels) ?? []),
    ...(def.table?.error ? [def.table.error, def.table.retryLabel || '重试'] : [])];
}

function unexpressed(page, patches = {}) {
  const issues = [];
  for (const n of page.children ?? []) {
    if (page.frame==='workbench') for(const b of n.buttons??[]) if(b.loading) issues.push(`${page.id}/${n.id}/${b.id}：工作台按钮加载态未支持`);
    if (n.type === 'table' && n.rows > 10) issues.push(`${page.id}/${n.id}：超过10行，当前画板仅展示前10条`);
    if (n.type === 'table' && n.rowActions?.some(a => a.when) && !n.rowActionRules) issues.push(`${page.id}/${n.id}：自然语言when未执行，仅按样例行序分配操作`);
    for (const f of n.fields ?? []) if (n.type === 'search' && ((f.kind === 'date-range' && f.value != null) || f.error || f.disabled || f.visible === false)) issues.push(`${page.id}/${n.id}/${f.id}：查询字段值或状态未支持`);
  }
  const allowed = {cascader:['visible','multiple','open','prefixIcon','disabled','state','width','columnWidth','value','columns','note'],timePicker:['visible','range','open','disabled','format','state','value','display','rangeState','columns','width','note'],selectField:['visible','multiple','open','prefixIcon','value','options','state','disabled','width','placeholder','note'],inputField:['visible','family','variant','value','placeholder','tips','prepend','append','width','limit','note'],number:['visible','theme','state','value','disabled','width','placeholder','increase','decrease','note'],checkbox:['visible','kind','options','checked','indeterminate','hover','disabled','width','label','note'],radio:['visible','kind','variant','options','value','checked','hover','disabled','width','label','note'],link:['visible','text','size','state','disabled','prefix','suffix','prefixIcon','suffixIcon','note'],divider:['visible','orientation','dashed','text','align','length','note'],feedback:['visible','message','kind','action','note'],timeline:['visible','items','note'],imageViewer:['visible','items','open','note','emptyFeedback'],descriptions:['visible','items','title','note'],dialog:['visible','title','message','confirm','cancel','note'], heading:['title','status','visible','note'], table: ['feedback','rows','emptyText','selected','selectedRows','disabledRows','disabledWhen','selection','rowActions','rowActionRules','data','error','retryLabel','note','visible','loading'], actions:['visible','note','message'], tabs:['note','active','visible'], gap:['note'], note:['note'], button:['visible','disabled','note','loading'], field:['value','note','visible','disabled','error','fileStates','open','options']};
  for (const [path, props] of Object.entries(patches)) {
    const [, id, child] = path.split('/'), n = page.children.find(n => n.id === id);
    const kind = child ? n?.buttons?.some(b => b.id === child) ? 'button' : 'field' : n?.type;
    for (const key of Object.keys(props)) if (!(allowed[kind] ?? []).includes(key)) issues.push(`${path}：${key} 未表达`);
    if (kind === 'gap' && Object.keys(props).some(k => k !== 'note')) issues.push(`${path}：缺口不能作为真实图层修改`);
  }
  return issues;
}

/** 已确认版本 → 按生成顺序排列的画板：先工作台，再抽屉，最后各个状态。 */
export function plan(dir) {
  const bundle = loadVersions(dir);
  if (!bundle.confirmed) throw Error('草图还没有确认版本（versions.json 的 confirmed），不能生成 Figma');
  if (!bundle.figmaPage) throw Error('versions.json 缺少 figmaPage（本任务的 Figma Page 名称）');
  const version = bundle.versions.find(v => v.v === bundle.confirmed);
  if (!version) throw Error(`没有确认的版本 v${bundle.confirmed}`);
  const sketch = version.data, result = check(sketch, loadChecklist(), {final: true});
  if (result.errors.length || result.missing.length) throw Error(`v${version.v} 未通过确认出稿检查，请先运行 check --final：${[...result.errors, ...result.missing.map(m => m.code + ' 没有结论')].join('；')}`);
  const v = version.v, title = t => `${t} · v${v}`;
  const pages = [...sketch.pages.filter(p => p.frame === 'workbench'), ...sketch.pages.filter(p => p.frame === 'drawer')];
  const byId = Object.fromEntries(sketch.pages.map(p => [p.id, p]));
  const allGaps = (sketch.gaps ?? []).map(g => `缺口：${g.need}${g.component ? `（${g.component}）` : ''}，本轮：${g.handling}`);
  const boards = [];
  for (const page of pages) {
    const layers = layerMap(page);
    const def = page.frame === 'workbench' ? workbenchDef(resolvePage(page), layers) : drawerDef(resolvePage(page), layers, page.over ? title(byId[page.over].title) : null);
    const expect = page.frame === 'workbench' ? expectedWorkbench(def) : [page.title, ...def.groups.map(g=>g.title), ...def.rows.flat().map(f => f.label), ...def.buttons.map(b=>b.label)];
    const notes = [`草图 v${v} · ${page.title}（默认）`, ...(page.frame === 'workbench' ? [page.layout?'导航使用Layout原规范示例，菜单内容与选中项待按业务配置':'顶部导航和侧栏其余菜单沿用工单页基线，未按本需求调整'] : []),
      ...(def.table && !(byId[page.id].children.find(n => n.type === 'table').data) ? ['表格内容为演示占位，不代表业务数据'] : []),
      ...(sketch.demo ? [`演示数据：${sketch.demo}`] : []), ...nodeNotes(page), ...(boards.length ? [] : allGaps)];
    boards.push({unmetRequirements: [...allGaps, ...nodeNotes(page).filter(n => n.startsWith('缺口：')), ...unexpressed(page)], id: page.id, kind: page.frame, name: title(page.title), def, notes, expectTexts: expect, layers});
  }
  for (const st of sketch.states ?? []) {
    const page = byId[st.page], base = boards.find(b => b.id === page.id);
    const patches = Object.entries(st.patch ?? {}).map(([path, props]) => {
      const l = base.layers.get(path);
      if (!l?.layer) return {layer: path, type: 'node', props};
      return {layer: l.layer, type: l.type, field: l.field, props};
    });
    const drawer = page.frame === 'drawer' ? drawerDef(resolvePage(page, st.patch), base.layers, base.def.over) : null;
    const resolved = page.frame === 'workbench' ? workbenchDef(resolvePage(page, st.patch), base.layers) : null;
    boards.push({unmetRequirements: [...base.unmetRequirements, ...((resolved || drawer) ? unexpressed(resolvePage(page, st.patch), st.patch) : [])], id: st.id, kind: 'state', name: title(`${st.id} ${st.title}`), def: {base: base.name, inDrawer: page.frame === 'drawer', patches: drawer ? [] : patches, workbench: resolved, drawer},
      notes: [`草图 v${v} · ${page.title} · 状态 ${st.id} ${st.title}${st.codes?.length ? `（${st.codes.join(' ')}）` : ''}`, ...Object.entries(st.patch??{}).filter(([,p])=>p.note).map(([path,p])=>`${path}：${p.note}`)],
      expectTexts: resolved ? expectedWorkbench(resolved) : drawer ? [drawer.title, ...drawer.groups.map(g=>g.title), ...drawer.rows.flat().map(f=>f.label), ...drawer.buttons.map(b=>b.label)] : Object.values(st.patch ?? {}).flatMap(p => [p.error, p.emptyText, ...(Array.isArray(p.value) ? p.value : typeof p.value === 'string' ? [p.value] : [])].filter(Boolean))});
  }
  return {version: v, pageName: bundle.figmaPage, boards: boards.map((b, slot) => { const {layers, ...rest} = b; const st=sketch.states?.find(s=>s.id===b.id); const pg=resolvePage(byId[st?.page??b.id],st?.patch??{}); const dialogs=pg.children.filter(n=>n.type==='dialog'&&n.visible!==false).map(validateDialog); if(dialogs.length>1)throw Error('每张画板最多一个确认弹窗'); return {...rest, slot,dialogs}; })};
}

// 仅序列化本画板使用的构建分支，避免详情扩展把无关表单代码挤过工具长度上限。
export function runtimeSource(drawer) {
 const src=sketchRuntime.toString(), work=src.indexOf('  async function buildWorkbench('), form=src.indexOf('  async function buildDrawer('), state=src.indexOf('  async function buildState(');
 if(!(work>0&&form>work&&state>form))throw Error('运行时构建分支边界变化');
 const formHelpers=src.indexOf('  async function detach(');
 if(formHelpers<0||formHelpers>work)throw Error('表单辅助边界变化');
 if(drawer)return src.slice(0,work)+src.slice(form);
 const workbench=src.slice(0,formHelpers)+src.slice(work,form)+src.slice(state),a=workbench.indexOf('  const form = board.def.drawer'),b=workbench.indexOf('  if(def?.timelines?.length)snapshot.timelines');
 if(a<0||b<a)throw Error('表单回读边界变化');
 return workbench.slice(0,a)+'  const form = null;\n'+workbench.slice(b);
}

export function code(dir, boardId) {
  const target=targetConfig();if(!target.fileKey||!target.sourceFileKey||target.fileKey===target.sourceFileKey||target.adapterVerified!==true)throw Error('Figma 目标和组件映射尚未适配验证；见 docs/figma-adapter.md');
  const p = plan(dir), board = p.boards.find(b => b.id === boardId);
  if (!board) throw Error(`没有画板 ${boardId}，可用：${p.boards.map(b => b.id).join('、')}`);
  const req = {fileKey: FILE_KEY, pageName: p.pageName, protectedPages: PROTECTED, version: p.version, board};
  if(req.board.def.workbench||req.board.def.drawer)req.board={...board,def:{...board.def,patches:[]}};
  // 来源信息仍保留在草稿及方案卡；执行载荷中的表单字段不读取该展示元数据。
  const payloadDrawer=req.board.def.drawer??(req.board.kind==='drawer'?req.board.def:null);
  if(payloadDrawer){const trimmed={...payloadDrawer,rows:payloadDrawer.rows.map(row=>row.map(({from,...field})=>field))};req.board={...req.board,def:req.board.def.drawer?{...req.board.def,drawer:trimmed}:trimmed};}
  let fns = '', lib = '{}';
  if ((board.def.workbench??(board.kind==='workbench'?board.def:null))?.table) { fns = buildTable.toString(); lib = `{buildTable, tableDeps: ${JSON.stringify(tableDependencies())}}`; }
  if (board.kind === 'drawer' || board.def.drawer) {
    fns = [fitFieldContent, composeForm, updateDrawer].map(f => f.toString()).join('\n');
    const {variants, titleProperty, footerIds, closeIds} = readJson('../evidence/drawer/target.json');
    lib = `{composeForm, fitFieldContent, updateDrawer, drawer: ${JSON.stringify({variants, titleProperty, footerIds, closeIds, buttonReactions: buttonReactions()})}}`;
  }
  const fd=board.def.drawer??(board.kind==='drawer'?board.def:null);
  if(fd?.rows.flat().some(f=>f.open)){fns+='\n'+renderMultiPopup.toString()+'\n'+updateMultiOption.toString()+'\n'+verifyMultiPopup.toString();lib=lib.slice(0,-1)+',renderMultiPopup,verifyMultiPopup,multiRules:'+JSON.stringify(Object.fromEntries(['fills','strokes','strokeWeight','cornerRadius','effects'].map(k=>[k,readJson('../evidence/select/open-rules.json')[1].children[1][k]])))+',focusRules:'+JSON.stringify(Object.fromEntries(['strokes','effects'].map(k=>[k,readJson('../evidence/select/open-rules.json')[1].children[0][k]])))+'}';}
  const wd=board.def.workbench??(board.kind==='workbench'?board.def:null);
  if(fd?.feedbacks?.length||wd?.table?.feedback||wd?.feedbacks?.length||wd?.imageViewers?.some(s=>s.emptyFeedback)){fns+='\n'+renderFeedback.toString()+'\n'+updateFeedback.toString()+'\n'+verifyFeedback.toString();lib=lib.slice(0,-1)+',renderFeedback,verifyFeedback}';}
  if(wd?.dividers?.length||fd?.dividers?.length){fns+='\n'+[validateDivider,dividerVariant,updateDivider,renderDivider].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderDivider}';}
  if(wd?.cascaders?.length||fd?.cascaders?.length){const used=[...(wd?.cascaders??[]),...(fd?.cascaders??[])],deps=readJson('../components/cascader/dependencies.json');deps.inputs=deps.inputs.filter(r=>used.some(s=>r.name.includes('state 状态='+({normal:'normal 默认',hover:'hover 悬浮',focus:'focus 聚焦'}[s.state]))&&r.name.includes('multiple 多选='+s.multiple)&&r.name.includes('filled 填充='+s.filled)&&r.name.includes('prefixIcon 前置图标='+s.prefixIcon)&&r.name.includes('disabled 禁用='+s.disabled)));for(const key of Object.keys(deps.rows))deps.rows[key]=deps.rows[key].filter(r=>{const p=Object.fromEntries(r.name.split(',').map(x=>x.trim().split('=')));return used.some(s=>s.open&&s.multiple===key.startsWith('multi')&&s.columns.some((c,i)=>c.options.some(o=>(o.branch??c.branch??i<s.columns.length-1)===key.endsWith('Parent')&&p['state 状态'].startsWith((o.state??'normal')+' ')&&p['disable 禁用']===String(!!o.disabled)&&p['divider 分割线']===String(!!o.divider)&&(!s.multiple||p['indeterminate 半选']===String(!!o.indeterminate)))))});fns+='\n'+[validateCascader,cascaderSetText,updateCascaderOption,renderCascaderMenu,renderCascader].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderCascader,cascaderDeps:'+JSON.stringify(deps)+'}';}
  if(wd?.timePickers?.length||fd?.timePickers?.length){const deps=readJson('../components/time-picker/dependencies.json'),used=[...(wd?.timePickers??[]),...(fd?.timePickers??[])];deps.inputs=deps.inputs.filter(r=>used.some(s=>r.name.includes('format 格式='+(s.range?'timeRange 时间区间':'time 时间'))&&r.name.includes('filled 填充='+s.filled)&&r.name.includes('disabled 禁用='+s.disabled)));fns+='\n'+[validateTimePicker,renderTimePicker].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderTimePicker,timePickerDeps:'+JSON.stringify(deps)+'}';}
  if(wd?.selectFields?.length||fd?.selectFields?.length){const used=[...(wd?.selectFields??[]),...(fd?.selectFields??[])],deps=readJson('../components/select/family-dependencies.json');deps.inputs=deps.inputs.filter(r=>used.some(s=>r.name.includes('multiple 多选='+s.multiple)&&r.name.includes('expand 展开='+s.open)&&r.name.includes('filled 填充='+s.filled)&&r.name.includes('prefixIcon 前置图标='+s.prefixIcon)&&r.name.includes('disabled 禁用='+s.disabled)));delete deps.multi;if(!used.some(s=>!s.multiple&&s.open)){deps.single=[];delete deps.singleRules;}fns+='\n'+[validateSelect,selectHelpers,renderSelect,...(used.some(s=>!s.multiple&&s.open)?[updateSingleOption,renderSinglePopup]:[])].map(f=>f.toString()).join('\n');if(used.some(s=>s.multiple&&s.open)&&!fns.includes('function renderMultiPopup('))fns+='\n'+[updateMultiOption,renderMultiPopup].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderSelect,selectDeps:'+JSON.stringify(deps)+'}';}
  if(wd?.inputFields?.length||fd?.inputFields?.length){const used=[...(wd?.inputFields??[]),...(fd?.inputFields??[])],deps=readJson('../components/input/family-dependencies.json');deps.families=Object.fromEntries(Object.entries(deps.families).map(([k,rows])=>[k,rows.filter(r=>used.some(s=>s.family===k&&s.variant===r.name))]));fns+='\n'+[validateInputField,renderInputField].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderInputField,inputFieldDeps:'+JSON.stringify(deps)+'}';}
  if(wd?.numbers?.length||fd?.numbers?.length){fns+='\n'+[validateInputNumber,renderInputNumber].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderInputNumber,numberDeps:'+JSON.stringify(readJson('../components/input-number/dependencies.json'))+'}';}
  if(wd?.checkboxes?.length||fd?.checkboxes?.length){fns+='\n'+[validateCheckbox,renderCheckbox].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderCheckbox,checkboxDeps:'+JSON.stringify(readJson('../components/checkbox/dependencies.json'))+'}';}
  if(wd?.radios?.length||fd?.radios?.length){
    const used=[...(wd?.radios??[]),...(fd?.radios??[])],deps=readJson('../components/radio/dependencies.json');
    const appearances={'outline':'outline描边','default-filled':'default-filled默认填充','primary-filled':'primary-filled品牌填充'};
    deps.button=Object.fromEntries(Object.entries(deps.button).filter(([name])=>used.some(s=>s.kind==='buttonGroup'&&name.includes('variants 类型='+appearances[s.variant]))));
    if(!used.some(s=>s.kind!=='buttonGroup'))deps.single={};
    fns+='\n'+[validateRadio,renderRadio].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderRadio,radioDeps:'+JSON.stringify(deps)+'}';
  }
  if(wd?.links?.length||fd?.links?.length){fns+='\nconst SIZE='+JSON.stringify(SIZE)+';const STATE='+JSON.stringify(STATE)+';const STYLE='+JSON.stringify(STYLE)+';const LINK_IDS='+JSON.stringify(LINK_IDS)+';\n'+[validateLink,linkVariant,linkStyleName,propertyKey,recolorIcons,updateLink,renderLink].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',renderLink}';}
  if(wd?.layout){fns+='\n'+[validateLayout,composeLayout].map(f=>f.toString()).join('\n');lib=lib.slice(0,-1)+',composeLayout}';}
  if(wd?.timelines?.length){fns+='\n'+renderTimeline.toString()+'\n'+updateTimelineItem.toString()+'\n'+verifyTimelines.toString();lib=lib.slice(0,-1)+',renderTimeline,verifyTimelines}';}
  if(wd?.imageViewers?.length){fns+='\n'+renderImageViewer.toString()+'\n'+verifyImageViewers.toString();lib=lib.slice(0,-1)+',renderImageViewer,verifyImageViewers}';}
  if(wd?.descriptions?.length){fns+='\n'+renderDescriptions.toString()+'\n'+verifyDescriptions.toString();lib=lib.slice(0,-1)+',renderDescriptions,verifyDescriptions,descriptionData:'+JSON.stringify(readJson('../components/descriptions/build-data.json'))+'}';}
  if(board.dialogs.length) {fns+='\n'+renderDialog.toString()+'\n'+updateDialog.toString()+'\n'+verifyDialogs.toString();lib=lib.slice(0,-1)+',renderDialog,verifyDialogs}';}
  lib=lib.replace(/^\{,/,'{');
  let runtime=runtimeSource(board.kind==='drawer'||!!board.def.drawer);
  if(!fd?.feedbacks?.length)runtime=runtime.replaceAll("d.type==='feedback'?lib.renderFeedback:",'').replaceAll("d.type==='feedback'?{autoFrame,normalize,setText,instance,buttonLabel,width:def.formWidth}:",'').replace("form?.feedbacks?.length||",'').replace("...(form?.feedbacks??[]),",'').replace("form?root.children.find(n=>n.name.startsWith('抽屉 / ')):root",'root');
  if(!wd?.cascaders?.length&&!fd?.cascaders?.length)runtime=runtime.replace(/        \/\/ CASCADER_START[\s\S]*?        \/\/ CASCADER_END\n/,'');
  if(!fd?.cascaders?.length)runtime=runtime.replaceAll("d.type==='cascader'?lib.renderCascader:",'').replaceAll("d.type==='cascader'?lib.cascaderDeps:",'');
  if(!wd?.timePickers?.length&&!fd?.timePickers?.length)runtime=runtime.replace(/        \/\/ TIMEPICKER_START[\s\S]*?        \/\/ TIMEPICKER_END\n/,'');
  if(!fd?.timePickers?.length)runtime=runtime.replaceAll("d.type==='timePicker'?lib.renderTimePicker:",'').replaceAll("d.type==='timePicker'?lib.timePickerDeps:",'');
  if(!wd?.selectFields?.length&&!fd?.selectFields?.length)runtime=runtime.replace(/        \/\/ SELECTFIELD_START[\s\S]*?        \/\/ SELECTFIELD_END\n/,'');
  if(!fd?.selectFields?.length)runtime=runtime.replaceAll("d.type==='selectField'?lib.renderSelect:",'').replaceAll("d.type==='selectField'?lib.selectDeps:",'');
  if(!wd?.inputFields?.length&&!fd?.inputFields?.length)runtime=runtime.replace(/        \/\/ INPUTFIELD_START[\s\S]*?        \/\/ INPUTFIELD_END\n/,'');
  if(!fd?.inputFields?.length)runtime=runtime.replaceAll("d.type==='inputField'?lib.renderInputField:",'').replaceAll("d.type==='inputField'?lib.inputFieldDeps:",'');
  if(!wd?.numbers?.length&&!fd?.numbers?.length)runtime=runtime.replace(/        \/\/ NUMBER_START[\s\S]*?        \/\/ NUMBER_END\n/,'').replace(/^.*if\(\(def\?\?form\)\?\.numbers\?\.length\).*\n/gm,'');
  if(!fd?.numbers?.length)runtime=runtime.replaceAll("d.type==='number'?lib.renderInputNumber:",'').replaceAll("d.type==='number'?lib.numberDeps:",'');
  if(!wd?.checkboxes?.length&&!fd?.checkboxes?.length)runtime=runtime.replace(/        \/\/ CHECKBOX_START[\s\S]*?        \/\/ CHECKBOX_END\n/,'').replace(/^.*if\(\(def\?\?form\)\?\.checkboxes\?\.length\).*\n/gm,'');
  if(!fd?.checkboxes?.length)runtime=runtime.replaceAll("d.type==='checkbox'?lib.renderCheckbox:",'').replaceAll("d.type==='checkbox'?lib.checkboxDeps:lib.radioDeps",'lib.radioDeps');
  if(!wd?.radios?.length&&!fd?.radios?.length)runtime=runtime.replace(/^.*if\(\(def\?\?form\)\?\.radios\?\.length\).*\n/gm,'');
  if(!wd?.layout)runtime=runtime.replace(/    \/\/ LAYOUT_SHELL_START[\s\S]*?    \/\/ LAYOUT_SHELL_END\n/,'').replace(/      \/\/ LAYOUT_FONT_START[\s\S]*?      \/\/ LAYOUT_FONT_END\n/,'').replace(', preservedFontRoots = new Set()','');
  if(!wd?.dividers?.length&&!wd?.links?.length&&!wd?.radios?.length&&!wd?.checkboxes?.length&&!wd?.numbers?.length&&!wd?.inputFields?.length&&!wd?.selectFields?.length&&!wd?.timePickers?.length&&!wd?.cascaders?.length)runtime=runtime.replace(/    \/\/ DIVIDER_ORDER_START[\s\S]*?    \/\/ DIVIDER_ORDER_END\n/,'');
  if(!fd?.inserts?.length)runtime=runtime.replace(/^.*for\(const d of def.inserts.*\n/gm,'');
  if(fd&&!fd.rows.flat().some(f=>f.kind==='upload'))runtime=runtime.replace(/  async function uploadFiles\([\s\S]*?(?=  async function formValue)/,'').replace(/      \/\/ DRAWER_UPLOAD_START[\s\S]*?      \/\/ DRAWER_UPLOAD_END\n/,'');
  if(fd)runtime=runtime.replace(/  async function setFieldValue\([\s\S]*?(?=  async function detach)/,'');
  if(fd&&!fd.rows.flat().some(f=>f.open))runtime=runtime.replace(/    \/\/ DRAWER_POPUP_START[\s\S]*?    \/\/ DRAWER_POPUP_END\n/,'');
  const generated = `${fns.replace(/^\s*\/\/[^\n]*$/gm,'').replace(/^[ \t]+/gm,'')}\n${(board.kind === 'drawer' || board.def.drawer ? verifyForm : verifyWorkbench).toString().replace(/^[ \t]+/gm,'')}\n${generationResult.toString().replace(/^[ \t]+/gm,'')}\n${runtime.replace(/^\s*\/\/[^\n]*$/gm, '').replace(/^[ \t]+/gm, '')}\nreturn await sketchRuntime(figma, ${JSON.stringify(req)}, ${lib});`;
  const out = generated.replace(/\n{2,}/g,'\n');
  if (out.length > 50000) throw Error(`生成代码 ${out.length} 字符，超过 use_figma 上限 50000`);
  return out;
}

function main([command, dir, ...rest]) {
  const outIndex = rest.indexOf('--out');
  const out = outIndex >= 0 ? rest.splice(outIndex, 2)[1] : null;
  if (command === 'plan' && dir) {
    const p = plan(dir);
    console.log(`Page：${p.pageName}；确认版本 v${p.version}。按顺序生成：`);
    for (const b of p.boards) console.log(`- ${b.id}\t${b.name}${b.unmetRequirements.length ? ' [不完整：'+b.unmetRequirements.length+'项需求缺口]' : ''}`);
    return 0;
  }
  if (command === 'code' && dir && rest[0]) {
    const text = code(dir, rest[0]);
    if (out) { writeFileSync(out, text); console.log(`已写入 ${out}（${text.length} 字符）`); } else process.stdout.write(text);
    return 0;
  }
  console.log(`用法：
  node sketch/figma.mjs plan <草图目录>                      列出要生成的画板和顺序
  node sketch/figma.mjs code <草图目录> <画板> [--out 文件]   输出交给 use_figma 的代码`);
  return 2;
}

if (isMain(import.meta.url)) {
  try { process.exitCode = main(process.argv.slice(2)); }
  catch (e) { console.error(e.message); process.exitCode = 1; }
}
