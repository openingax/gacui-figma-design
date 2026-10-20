import {resolveUpload} from '../components/upload/compose.mjs';
import {validateTransfer} from '../components/transfer/family.mjs';
import {validateCascader} from '../components/cascader/family.mjs';
import {validateTimePicker} from '../components/time-picker/family.mjs';
import {validateSelect} from '../components/select/family.mjs';
import {validateInputField} from '../components/input/family.mjs';
import {validateInputNumber} from '../components/input-number/generator.mjs';
import {validateCheckbox} from '../components/checkbox/family.mjs';
import {validateRadio} from '../components/radio/generator.mjs';
import {validateLink} from '../components/link/generator.mjs';
import {validateDivider} from '../components/divider/generator.mjs';
import {validateFeedback} from '../components/feedback/generator.mjs';
import {validateTimeline} from '../components/timeline/generator.mjs';
import {validateImageViewer} from '../components/image-viewer/generator.mjs';
import {validateDescriptions} from '../components/descriptions/generator.mjs';
import {validateDialog} from '../components/dialog/generator.mjs';
// 草图格式的纯函数；renderHtml显式内联validateDialog并移除模块import，Node与预览共享校验。
export const NODE_TITLES = {upload:'上传（开发预览）',transfer:'穿梭框（开发预览）',cascader:'级联选择器',timePicker:'时间选择器',selectField:'选择器',inputField:'输入框',number:'数字输入',checkbox:'多选',radio: '单选',link: '链接',divider:'分割线',feedback:'反馈',timeline:'日志时间线',imageViewer:'图片查看器', descriptions:'基本信息',dialog:'确认弹窗', heading: '详情标题', search: '查询区', actions: '操作栏', tabs: '页签', table: '表格', form: '表单', note: '说明', gap: '缺口'};
export const FIELD_KINDS = {
  search: ['input', 'select', 'date', 'date-range'],
  form: ['input', 'textarea', 'select', 'date', 'date-range', 'switch', 'checkbox', 'upload', 'time', 'number', 'radio'],
};
export const COLUMN_KINDS = ['text', 'tag', 'operations'];
export const FRAMES = ['workbench', 'drawer'];
export const DECISIONS = ['已明确', '已确认', '按推荐', '待决策', '本轮不做'];
export const PATCH_PROPS = ['draggable','interaction','filename','helperText','fileSize','uploadDate','buttonLabel','progress','files','source','target','tree','search','retainSource','pagination','sourceQuery','targetQuery','filterPolicy','viewportHeight','sourceTitle','targetTitle','columnWidth','range','format','rangeState','columns','display','multiple','family','limit','prepend','append','tips','theme','increase','decrease','placeholder','indeterminate','variant','label','checked','hover','width','size','state','prefix','suffix','prefixIcon','suffixIcon','orientation','dashed','text','align','length','rows', 'emptyText', 'selected', 'loading', 'error', 'value', 'disabled', 'note', 'visible', 'selection', 'selectedRows', 'disabledRows', 'disabledWhen', 'rowActions', 'rowActionRules', 'data', 'retryLabel', 'fileStates', 'active', 'message', 'title', 'status', 'confirm', 'cancel', 'items', 'open', 'feedback', 'emptyFeedback', 'options', 'kind', 'action'];
// 已知属性名：预览、检查或组件代码会读取的键。表外的键不会生效，先只警告（#8），确认无误报后再考虑拦截。
const TOP_KEYS = ['format','task','pages','states','questions','decisions','gaps','judgments','demo'];
const PAGE_KEYS = ['id','title','frame','children','over','layout','menu','width','from','type'];
const STATE_KEYS = ['id','page','title','codes','patch','from'];
const QUESTION_KEYS = ['id','code','node','ask','recommend','answer','from'];
const DECISION_KEYS = ['code','decision','from','text'];
const GAP_KEYS = ['id','need','component','handling','acceptedFrom','from'];
export const SKETCH_KEYS = [...PATCH_PROPS,'id','type','title','from','need','handling','component','acceptedFrom','text','subtitle','footer','fields','buttons','columns','children','opens','primary','required','help','max','min','placeholder','wrap','cols','columnCount','actions','actor','content','date','detail','disabledLabel','enableWhenSelected','fullscreen','gallery','groups','height','highlight','icon','images','mode','name','key','pageSize','renderRows','selectionSummary','sourcePage','targetPage','span','suggestions','tags','time','topLabel','unavailable','values','viewportWidth','visibleWhen','demo','menu','layout'];
const editDistance = (a, b) => {
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) { const next = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = next; }
  }
  return row[b.length];
};
const closest = (key, known) => {
  const lower = key.toLowerCase();
  let best = null, score = Infinity;
  for (const k of known) {
    const d = k.toLowerCase() === lower ? 0 : editDistance(lower, k.toLowerCase());
    if (d < score) { best = k; score = d; }
  }
  return score <= (key.length >= 6 ? 2 : 1) ? best : null;
};
/** 列出没有任何代码会读取的属性名；只作提示，不改变检查结果。 */
export function unknownKeys(sketch) {
  const warnings = [];
  const scan = (where, obj, list) => {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
    const known = new Set(list);
    for (const key of Object.keys(obj)) if (!known.has(key)) {
      const hint = closest(key, known);
      warnings.push(`${where}：未知属性 ${key}${hint ? `，是否应为 ${hint}` : ''}；预览和检查都不会读取它`);
    }
  };
  scan('草稿', sketch, TOP_KEYS);
  for (const page of sketch?.pages ?? []) {
    scan(`页面 ${page.id}`, page, PAGE_KEYS);
    for (const node of page.children ?? []) {
      const where = `${page.id}/${node.id}`;
      scan(where, node, SKETCH_KEYS);
      for (const list of CHILD_LISTS) for (const child of Array.isArray(node[list]) ? node[list] : []) scan(`${where}/${child?.id}`, child, SKETCH_KEYS);
    }
  }
  for (const s of sketch?.states ?? []) scan(`状态 ${s.id}`, s, STATE_KEYS);
  for (const q of sketch?.questions ?? []) scan(`问题 ${q.id}`, q, QUESTION_KEYS);
  for (const d of sketch?.decisions ?? []) scan(`结论 ${d.code}`, d, DECISION_KEYS);
  for (const g of sketch?.gaps ?? []) scan(`缺口 ${g.id ?? g.need}`, g, GAP_KEYS);
  return warnings;
}
const FROM = /^(需求|产品)(:.+)?$|^(推荐|判断|演示)$/;
const ID = /^[A-Za-z0-9_-]+$/;
const CHILD_LISTS = ['fields', 'buttons', 'columns'];

export const nodeTitle = node => node.title ?? NODE_TITLES[node.type] ?? node.type;
const childTitle = child => child.label ?? child.title ?? child.id;

/** 路径 → {kind, label, item}；路径形如 list、list/search、list/search/timeout。 */
export function indexPaths(sketch) {
  const paths = new Map();
  for (const page of sketch.pages ?? []) {
    paths.set(page.id, {kind: 'page', label: page.title, item: page});
    for (const node of page.children ?? []) {
      const nodePath = `${page.id}/${node.id}`;
      const nodeLabel = `${page.title} › ${nodeTitle(node)}`;
      paths.set(nodePath, {kind: 'node', label: nodeLabel, item: node});
      for (const list of CHILD_LISTS) for (const child of (list==='columns'&&['cascader','timePicker'].includes(node.type)?[]:node[list]??[]))
        paths.set(`${nodePath}/${child.id}`, {kind: list, label: `${nodeLabel} › ${childTitle(child)}`, item: child});
    }
  }
  return paths;
}

/** 草图里出现的结构决定哪些边界状态清单项必须有结论。 */
export function requiredCodes(sketch) {
  const codes = new Set(['G1', 'G2']);
  const add = (...list) => list.forEach(code => codes.add(code));
  const pages = sketch.pages ?? [];
  if (pages.length > 1) add('N3');
  for (const page of pages) {
    if (page.frame === 'workbench') add('N1', 'N2');
    for (const node of page.children ?? []) {
      if (node.type === 'search') add('L1', 'L2', 'L3', 'L4');
      if (node.type === 'table') {
        add('L5', 'L6', 'L7', 'L9', 'L14', 'L15');
        if (node.pagination) add('L8');
        if (node.selection) add('L10', 'L11');
        if ((node.columns ?? []).some(c => c.kind === 'operations')) add('L12', 'L13');
      }
      if (node.type === 'form') {
        add('F1', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11');
        if (page.frame === 'drawer') add('F2', 'F12', 'F13', 'F14');
      }
      for (const field of node.fields ?? []) {
        if (field.kind === 'upload') add('U1', 'U2', 'U3', 'U4', 'U5');
        if (field.kind === 'select') add('S1', 'S2', 'S3');
        if (field.kind?.startsWith('date')) add('S4');
      }
      if ((node.buttons ?? []).some(b => b.opens)) add('N3');
    }
  }
  return [...codes].sort((a, b) => a[0].localeCompare(b[0]) || a.slice(1) - b.slice(1));
}

/**
 * 校验草图。checklist 是 Map(编号 → {topic, ask, recommend})。
 * final=true 用于“确认出稿”前：不允许还有待决策项或未回答的问题。
 */
export function check(sketch, checklist, {final = false} = {}) {
  const errors = [];
  const err = (where, message) => errors.push(`${where}：${message}`);
  const from = (where, value) => value !== undefined && !FROM.test(value) && err(where, `来源“${value}”无效，只能是 需求:<位置>、产品:<问题或对话>、推荐、判断、演示`);
  const pageIds = new Set();
  if (sketch.format !== 1) err('format', '必须为 1');
  if (!sketch.pages?.length) err('pages', '至少需要一个页面');
  for (const page of sketch.pages ?? []) {
    if (!ID.test(page.id ?? '')) err(`页面 ${page.title}`, 'id 只能用字母、数字、- 和 _');
    if (pageIds.has(page.id)) err(`页面 ${page.id}`, 'id 重复');
    pageIds.add(page.id);
    if (!page.title) err(`页面 ${page.id}`, '缺少 title');
    if (!FRAMES.includes(page.frame)) err(`页面 ${page.id}`, `frame 只能是 ${FRAMES.join(' / ')}`);
    if(page.layout!==undefined&&(page.frame!=='workbench'||!['side','top','combined'].includes(page.layout)))err('页面 '+page.id,'layout 仅支持工作台 side / top / combined');
    const nodeIds = new Set();
    for (const node of page.children ?? []) {
      const where = `${page.id}/${node.id}`;
      if (!ID.test(node.id ?? '')) err(where, 'id 只能用字母、数字、- 和 _');
      if (nodeIds.has(node.id)) err(where, 'id 重复');
      nodeIds.add(node.id);
      if (!NODE_TITLES[node.type]) err(where, `类型“${node.type}”不在草图词汇内；没有对应已导入组件的结构请写成 gap`);
      if(node.type==='upload'){try{resolveUpload(node);}catch(e){err(where,e.message);}}
      if(node.type==='transfer'){try{validateTransfer(node);}catch(e){err(where,e.message);}}
      if(node.type==='feedback'){try{validateFeedback(node);}catch(e){err(where,e.message);}}
      if(node.type==='cascader'){try{validateCascader(node);}catch(e){err(where,e.message);}}
      if(node.type==='timePicker'){try{validateTimePicker(node);}catch(e){err(where,e.message);}}
      if(node.type==='selectField'){try{validateSelect(node);}catch(e){err(where,e.message);}}
      if(node.type==='inputField'){try{validateInputField(node);}catch(e){err(where,e.message);}}
      if(node.type==='number'){try{validateInputNumber(node);}catch(e){err(where,e.message);}}
      if(node.type==='checkbox'){try{validateCheckbox(node);}catch(e){err(where,e.message);}}
      if(node.type==='radio'){try{validateRadio(node);}catch(e){err(where,e.message);}}
      if(node.type==='link'){try{validateLink(node);}catch(e){err(where,e.message);}}
      if(node.type==='divider'){try{validateDivider(node);}catch(e){err(where,e.message);}}
      if(node.type==='timeline'){try{validateTimeline(node);}catch(e){err(where,e.message);}}
      if(node.type==='imageViewer'){try{validateImageViewer(node);}catch(e){err(where,e.message);}}
      if(node.type==='descriptions'){try{validateDescriptions(node);}catch(e){err(where,e.message);}}
      if(node.type==='dialog') {try{validateDialog(node);}catch(e){err(where,e.message);}}
      if(node.type==='table'&&node.feedback){try{validateFeedback({id:'table',kind:node.error?'error':'empty',message:node.error||node.emptyText||'暂无数据',action:node.error?(node.retryLabel||'重试'):node.feedback.action,variant:node.feedback.variant});}catch(e){err(where,e.message);}}
      if (node.type === 'gap' && !node.need) err(where, 'gap 必须写明 need（需要什么）');
      if (node.type === 'note' && !node.text) err(where, 'note 缺少 text');
      if (node.type === 'tabs' && !node.items?.length) err(where, 'tabs 缺少 items');
      if (['search', 'form'].includes(node.type) && !node.fields?.length) err(where, `${node.type} 缺少 fields`);
      if (node.type === 'table' && !node.columns?.length) err(where, 'table 缺少 columns');
      if (node.type === 'actions' && !node.buttons?.length) err(where, 'actions 缺少 buttons');
      if (node.type === 'table') {
        for (const key of ['selectedRows', 'disabledRows']) if (node[key] !== undefined && (!Array.isArray(node[key]) || new Set(node[key]).size !== node[key].length || node[key].some(i => !Number.isInteger(i) || i < 0 || i >= (node.rows ?? 10)))) err(where, key + ' 必须为有效且不重复的行索引');
        if (node.rows !== undefined && (!Number.isInteger(node.rows) || node.rows < 0)) err(where, 'rows 必须为非负整数');
        if (node.disabledWhen && (!node.disabledWhen.field || !Object.hasOwn(node.disabledWhen, 'equals'))) err(where, 'disabledWhen 需要field和equals');
      }
      from(where, node.from);
      for (const list of CHILD_LISTS) {
        const childIds = new Set();
        for (const child of (list==='columns'&&['cascader','timePicker'].includes(node.type)?[]:node[list]??[])) {
          const at = `${where}/${child.id}`;
          if (!ID.test(child.id ?? '')) err(at, 'id 只能用字母、数字、- 和 _');
          if (childIds.has(child.id)) err(at, 'id 重复');
          childIds.add(child.id);
          if (list === 'fields' && !FIELD_KINDS[node.type]?.includes(child.kind)) err(at, `${node.type} 里的字段 kind 只能是 ${(FIELD_KINDS[node.type] ?? []).join(' / ')}`);
          if (list === 'columns' && !COLUMN_KINDS.includes(child.kind ?? 'text')) err(at, `列 kind 只能是 ${COLUMN_KINDS.join(' / ')}`);
          if(list==='columns'&&child.wrap!==undefined&&(typeof child.wrap!=='boolean'||(child.kind??'text')!=='text'))err(at,'wrap仅支持文字列布尔值');
          if (list !== 'columns' && !child.label) err(at, '缺少 label');
          if (list === 'columns' && !child.title) err(at, '缺少 title');
          from(at, child.from);
        }
      }
    }
  }
  for (const page of sketch.pages ?? []) {
    if (page.over !== undefined && (!pageIds.has(page.over) || page.over === page.id)) err(`页面 ${page.id}`, `over 指向不存在的页面 ${page.over}`);
    for (const node of page.children ?? []) for (const b of node.buttons ?? [])
      if (b.opens !== undefined && !pageIds.has(b.opens)) err(`${page.id}/${node.id}/${b.id}`, `opens 指向不存在的页面 ${b.opens}`);
  }

  for (const page of sketch.pages ?? []) {
    const seen = new Set(); let current=page;
    while(current?.over) {
      if(seen.has(current.id)) {err('页面 '+page.id,'over 不能循环引用');break;}
      seen.add(current.id);current=sketch.pages.find(p=>p.id===current.over);
    }
  }
  const paths = indexPaths(sketch);
  const stateIds = new Set();
  for (const state of sketch.states ?? []) {
    const where = `状态 ${state.id}`;
    if (!state.id || stateIds.has(state.id)) err(where, 'id 缺失或重复');
    stateIds.add(state.id);
    if (!pageIds.has(state.page)) err(where, `page 指向不存在的页面 ${state.page}`);
    if (!state.title) err(where, '缺少 title');
    for (const code of state.codes ?? []) if (!checklist.has(code)) err(where, `清单里没有 ${code}`);
    for (const [path, props] of Object.entries(state.patch ?? {})) {
      if (!paths.has(path)) err(where, `patch 路径 ${path} 不存在`);
      else if (!path.startsWith(`${state.page}/`)) err(where, `patch 路径 ${path} 不属于页面 ${state.page}`);
      for (const prop of Object.keys(props)) if (!PATCH_PROPS.includes(prop)) err(where, `patch 不支持 ${prop}，可用：${PATCH_PROPS.join('、')}`);
    }
  }

  const questions = new Map();
  for (const q of sketch.questions ?? []) {
    const where = `问题 ${q.id}`;
    if (!q.id || questions.has(q.id)) err(where, 'id 缺失或重复');
    questions.set(q.id, q);
    if (!q.ask) err(where, '缺少 ask');
    if (!q.recommend) err(where, '必须附推荐答案 recommend');
    if (q.code && !checklist.has(q.code)) err(where, `清单里没有 ${q.code}`);
    if (q.node && !paths.has(q.node)) err(where, `node 路径 ${q.node} 不存在`);
  }

  const decided = new Map();
  for (const d of sketch.decisions ?? []) {
    const where = `结论 ${d.code}`;
    if (!checklist.has(d.code)) err(where, '清单里没有这个编号');
    if (decided.has(d.code)) err(where, '重复');
    decided.set(d.code, d);
    if (!DECISIONS.includes(d.decision)) err(where, `decision 只能是 ${DECISIONS.join(' / ')}`);
    if (d.decision === '已明确' && !d.from?.startsWith('需求')) err(where, '“已明确”必须写需求出处 from: 需求:<位置>');
    if (d.decision === '已确认' && !d.from?.startsWith('产品')) err(where, '“已确认”必须写 from: 产品:<问题编号或对话>');
    if (d.decision === '本轮不做' && !d.from) err(where, '“本轮不做”必须写 from：推荐（清单默认）、产品:<…> 或 需求:<…>');
    from(where, d.from);
    if (d.decision === '按推荐' && d.from !== '推荐') err(where, '“按推荐”的 from 必须是 推荐');
    if (['已明确', '已确认', '按推荐'].includes(d.decision) && !d.text) err(where, '缺少结论内容 text');
    if (d.decision === '待决策' && ![...questions.values()].some(q => q.code === d.code && q.answer == null)) err(where, '“待决策”必须有一个未回答、code 相同的问题');
  }
  const missing = requiredCodes(sketch).filter(code => !decided.has(code)).map(code => ({code, ...checklist.get(code)}));

  for (const g of sketch.gaps ?? []) if (!g.need || !g.handling) err(`缺口 ${g.id}`, '必须写 need（需要什么）和 handling（本轮怎么处理）');

  const pending = [
    ...[...decided.values()].filter(d => d.decision === '待决策').map(d => `结论 ${d.code} 仍待决策`),
    ...[...questions.values()].filter(q => q.answer == null).map(q => `问题 ${q.id} 未回答`),
  ];
  if (final) pending.forEach(p => errors.push(`确认出稿前：${p}`));
  return {errors, missing, pending, warnings: unknownKeys(sketch)};
}

/** 把草图摊平成 路径 → {label, value}，供版本对比使用。 */
export function flatten(sketch) {
  const out = new Map();
  const put = (key, label, value) => out.set(key, {label, value: JSON.stringify(value)});
  const {pages, states, decisions, questions, gaps, judgments, ...metadata} = sketch;
  put('draft:metadata', '草稿说明', {...metadata, pages: (pages ?? []).map(p => p.id)});
  const paths = indexPaths(sketch);
  for (const [path, {kind, label, item}] of paths) {
    const {children, fields, buttons, columns, ...rest} = item;
    if (kind === 'page') rest.children = (children ?? []).map(n => n.id);
    if (kind === 'node') for (const [k, v] of Object.entries({fields, buttons, columns})) if (v) rest[k] = v.map(c => c.id);
    put(path, label, rest);
  }
  for (const s of sketch.states ?? []) put(`state:${s.id}`, `状态 ${s.title}`, s);
  for (const d of sketch.decisions ?? []) put(`decision:${d.code}`, `${d.code} 结论`, d);
  for (const q of sketch.questions ?? []) put(`question:${q.id}`, `问题 ${q.id}`, q);
  for (const g of sketch.gaps ?? []) put(`gap:${g.id}`, `缺口 ${g.need}`, g);
  for (const j of sketch.judgments ?? []) put(`judgment:${j}`, `设计判断：${j}`, j);
  return out;
}

export function diff(before, after) {
  const a = flatten(before), b = flatten(after);
  const result = {added: [], removed: [], changed: []};
  for (const [key, entry] of b) if (!a.has(key)) result.added.push({key, label: entry.label});
  for (const [key, entry] of a) if (!b.has(key)) result.removed.push({key, label: entry.label});
  for (const [key, entry] of b) {
    if (!a.has(key) || a.get(key).value === entry.value) continue;
    const old = JSON.parse(a.get(key).value), now = JSON.parse(entry.value);
    const props = [...new Set([...Object.keys(old ?? {}), ...Object.keys(now ?? {})])]
      .filter(p => JSON.stringify(old?.[p]) !== JSON.stringify(now?.[p]))
      .flatMap(p => {
        // 子项列表只记 id：增删已单独列出，这里只在剩余子项的顺序变化时报告。
        if (['children', 'fields', 'buttons', 'columns'].includes(p) && Array.isArray(old?.[p]) && Array.isArray(now?.[p])) {
          const kept = old[p].filter(id => now[p].includes(id));
          return JSON.stringify(kept) === JSON.stringify(now[p].filter(id => old[p].includes(id))) ? [] : ['顺序'];
        }
        return typeof (old?.[p] ?? now?.[p]) === 'object' ? [p] : [`${p}：${old?.[p] ?? '无'} → ${now?.[p] ?? '无'}`];
      });
    if (props.length) result.changed.push({key, label: entry.label, props});
  }
  return result;
}

export function diffSummary(d) {
  const parts = [];
  if (d.added.length) parts.push(`新增 ${d.added.map(x => x.label).join('、')}`);
  if (d.removed.length) parts.push(`删除 ${d.removed.map(x => x.label).join('、')}`);
  if (d.changed.length) parts.push(`修改 ${d.changed.map(x => `${x.label}（${x.props.join('；')}）`).join('、')}`);
  return parts.join('；') || '无变化';
}


// 默认和状态使用同一解析规则；浏览器预览与Figma计划共享，不解释自然语言when。
export function resolvePage(page, patch = {}) {
  const out = JSON.parse(JSON.stringify(page));
  for (const n of out.children ?? []) {
    Object.assign(n, patch[`${page.id}/${n.id}`] ?? {});
    for (const list of ['fields', 'buttons', 'columns']) for (const c of n[list] ?? [])
      Object.assign(c, patch[`${page.id}/${n.id}/${c.id}`] ?? {});
    if(n.type==='upload')resolveUpload(n);
    if(n.type==='transfer')validateTransfer(n);
    if(n.type==='feedback')validateFeedback(n);
    if(n.type==='selectField')validateSelect(n);
    if(n.type==='cascader')validateCascader(n);
    if(n.type==='timePicker')validateTimePicker(n);
    if(n.type==='inputField')validateInputField(n);
    if(n.type==='number')validateInputNumber(n);
    if(n.type==='checkbox')validateCheckbox(n);
    if(n.type==='radio')validateRadio(n);
    if(n.type==='link')validateLink(n);
    if(n.type==='divider')validateDivider(n);
    if(n.type==='timeline')validateTimeline(n);
    if(n.type==='imageViewer')validateImageViewer(n);
    if(n.type==='descriptions')validateDescriptions(n);
    if(n.type==='dialog')validateDialog(n);
    if (n.type === 'heading' && (!n.title || !n.status?.label || !['default','primary','success','warning','danger'].includes(n.status.theme))) throw Error(`标题 ${n.id} 需要title和有效status`);
    if (n.type === 'tabs' && (!Number.isInteger(n.active ?? 0) || (n.active ?? 0) < 0 || (n.active ?? 0) >= n.items.length)) throw Error(`页签 ${n.id} active 索引无效`);
    if (n.type !== 'table') continue;
    if(n.feedback)validateFeedback({id:'table',kind:n.error?'error':'empty',message:n.error||n.emptyText||'暂无数据',action:n.error?(n.retryLabel||'重试'):n.feedback.action,variant:n.feedback.variant});
    const count = n.error ? 0 : Math.min(n.rows ?? 10, 10);
    for (const key of ['selectedRows', 'disabledRows']) if (n[key] !== undefined && (!Array.isArray(n[key]) || new Set(n[key]).size !== n[key].length || n[key].some(i => !Number.isInteger(i) || i < 0 || i >= (n.rows ?? 10)))) throw Error(`表格 ${n.id} ${key} 行索引无效`);
    const data = Array.from({length: count}, (_, i) => n.data?.[i] ?? {});
    const matches = (row, rule) => {
      if (!rule?.field || !Object.hasOwn(rule, 'equals') || !n.columns.some(c => c.id === rule.field)) throw Error(`表格 ${n.id} 条件需要有效field和equals`);
      return row[rule.field] === rule.equals;
    };
    const disabled = n.disabledWhen ? data.flatMap((r, i) => matches(r, n.disabledWhen) ? [i] : []) : (n.disabledRows ?? []).filter(i => i < count);
    const eligible = data.flatMap((_, i) => disabled.includes(i) ? [] : [i]);
    let selected = n.selectedRows ?? [];
    if (n.selected === 'all') selected = eligible;
    else if (n.selected === 'partial') selected = eligible.slice(0, 1);
    else if (n.selected === 'none') selected = [];
    if (!n.error && n.selectedRows?.some(i => disabled.includes(i))) throw Error(`表格 ${n.id} 显式选中包含禁选行`);
    n.selectedRows = n.selection ? selected.filter(i => i < count && !disabled.includes(i)) : [];
    n.disabledRows = disabled;
    n.renderRows = count;
    if (n.rowActionRules) n.rowActions = data.map(row => {
      const rule = n.rowActionRules.find(a => !a.match || matches(row, a.match));
      if (!rule) throw Error(`表格 ${n.id} 行操作规则未覆盖数据`);
      return {labels: rule.labels, more: !!rule.more};
    });
  }
  for (const n of out.children ?? []) for (const b of n.buttons ?? []) {
    if (!b.enableWhenSelected) continue;
    const rule = b.enableWhenSelected, table = out.children.find(t => t.id === rule.table && t.type === 'table');
    if (rule.field && (!table?.columns.some(c => c.id === rule.field) || !Object.hasOwn(rule, 'equals'))) throw Error(`按钮 ${b.id} 选择条件字段无效`);
    if (!table) throw Error(`按钮 ${b.id} 的选择条件表格不存在`);
    const eligible = table.selectedRows.filter(i => !rule.field || table.data?.[i]?.[rule.field] === rule.equals);
    b.disabled = table.visible === false || !eligible.length;
    b.selectionSummary = table.selectedRows.length ? `已选 ${table.selectedRows.length} 条，可处理 ${eligible.length} 条，跳过 ${table.selectedRows.length - eligible.length} 条` : null;
  }
  const fields = new Map(out.children.flatMap(n => (n.fields ?? []).map(f => [`${out.id}/${n.id}/${f.id}`, f])));
  for (const f of fields.values()) {
    if (f.visibleWhen) {
      const source = fields.get(f.visibleWhen.field);
      const rule=f.visibleWhen, hasEquals=Object.hasOwn(rule,'equals'), hasOneOf=Object.hasOwn(rule,'oneOf');
      if (!source || hasEquals===hasOneOf) throw Error(`字段 ${f.id} 的显示条件需要有效源字段，且 equals / oneOf 只能指定一个`);
      if (hasOneOf && (!Array.isArray(rule.oneOf) || !rule.oneOf.length || new Set(rule.oneOf).size!==rule.oneOf.length || rule.oneOf.some(v=>!['string','number','boolean'].includes(typeof v) || (typeof v==='number' && !Number.isFinite(v))))) throw Error(`字段 ${f.id} 的 oneOf 必须为非空、不重复的简单值数组`);
      const matched=hasEquals ? source.value===rule.equals : rule.oneOf.includes(source.value);
      f.visible = f.visible !== false && matched;
    }
    if (f.kind === 'date-range' && f.value != null) {
      const values = Array.isArray(f.value) ? f.value : String(f.value).split(/\s+至\s+/);
      if (values.length !== 2 || values.some(v => typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))) throw Error(`字段 ${f.id} 日期区间需要两个 YYYY-MM-DD 值`);
      f.value = values;
    }
    if(f.open!==undefined&&(f.kind!=='select'||!f.multiple||typeof f.open!=='boolean'))throw Error('仅多选Select支持布尔open');
    if(f.open&&f.disabled)throw Error('只读多选不可展开');
    if(f.open&&!f.options?.length)throw Error('展开多选需要非空options');
    if (f.kind === 'switch' && f.value != null && typeof f.value !== 'boolean') throw Error(`字段 ${f.id} 开关值必须为布尔值`);
    if ((f.multiple || f.kind === 'checkbox') && f.value != null && !Array.isArray(f.value)) throw Error(`字段 ${f.id} 多选值必须为数组`);
    if (f.kind === 'number' && f.value != null && typeof f.value !== 'number') throw Error(`字段 ${f.id} 数字值必须为数值`);
    if (f.fileStates && Object.entries(f.fileStates).some(([name,state])=>!Array.isArray(f.value)||!f.value.includes(name)||!['success','fail'].includes(state))) throw Error(`字段 ${f.id} 文件状态无效`);
    if (f.options) {
      const options = f.options.map(o => typeof o === 'string' ? {label:o} : o);
      if (options.some(o => !o.label) || new Set(options.map(o => o.label)).size !== options.length) throw Error(`字段 ${f.id} 选项无效`);
      const values = f.value == null ? [] : Array.isArray(f.value) ? f.value : [f.value];
      if (values.some(v => !options.some(o => o.label === v && !o.disabled))) throw Error(`字段 ${f.id} 包含不存在或禁用的选项`);
    }
  }
  return out;
}
