import {verifyBusinessButton} from '../components/button/business.mjs';
// 使用实际图层摘要核对业务语义；同一函数用于生成回执与离线故障注入回归。
export function verifyWorkbench(def, actual) {
  const errors = [], require = (ok, message) => { if (!ok) errors.push(message); };
  for (const b of def.buttons) {
    const found = actual.buttons.filter(n => n.name === b.layer);
    require(found.length === (b.visible ? 1 : 0), b.layer + ' 可见性不符');
    if (found[0]) {if(b.business)require(!!found[0].business&&verifyBusinessButton(b.business,found[0].business).length===0,b.layer+' 按钮实际配方或内容不符');else require(found[0].disabled === !!b.disabled, b.layer + ' 禁用状态不符');}
  }
  for (const f of def.search ?? []) if (f.value != null) require(actual.texts.some(t => t.includes(String(f.value))), f.layer + ' 查询值不符');
  for (const b of def.buttons.filter(b => b.visible && b.selectionSummary)) require(actual.texts.includes(b.selectionSummary), b.layer + ' 选择数量说明缺失');
  for (const m of def.messages ?? []) require(actual.texts.includes(m.text), m.layer + ' 操作说明缺失');
  if(def.headings) require(JSON.stringify((actual.headings??[]).map(h=>h.name).sort())===JSON.stringify(def.headings.map(h=>h.layer).sort()),'标题集合或可见性不符');
  for(const h of def.headings??[]) {
    const a=actual.headings?.find(n=>n.name===h.layer);require(!!a,'详情标题缺失');
    for(const value of [h.title,h.subtitle,h.status.label].filter(Boolean)) require(a?.texts.includes(value),'标题文字缺失：'+value);
    require(actual.tags?.some(t=>t.parent===h.layer&&t.text===h.status.label&&t.theme===h.status.theme),'标题状态标签不符');
  }
  for(const m of def.tagThemes??[]) for(const row of def.table?.config.rows??[]) require(actual.tags?.some(t=>t.parent==='cell/'+m.key&&t.text===row[m.key]&&t.theme===m.themes[row[m.key]]),'结果标签主题不符：'+row[m.key]);
  if(def.tabs?.placement==='content') require(actual.contentTabsHeight>=48,'内容页签高度不足');
  if (def.tabs) {
    require(JSON.stringify(actual.tabs?.map(t=>t.text)) === JSON.stringify(def.tabs.items), '页签集合不符');
    require(JSON.stringify(actual.tabs?.flatMap((t,i)=>t.selected?[i]:[])) === JSON.stringify([def.tabs.active]), '页签选中不符');
  }
  if (!def.table) { require(!actual.table && !actual.paginationVisible, '隐藏表格或分页仍可见'); return errors; }
  const c = def.table.config, a = actual.table;
  if (!a) return [...errors, '表格缺失'];
  require(a.rows.length === c.rows.length, '数据行数不符');
  require(!!a.headerSelection === c.selection, '表头选择列不符');
  const eligible = c.rows.length - c.disabledRows.length;
  if (a.headerSelection) {
    require(a.headerSelection.checked === (c.selectedRows.length > 0), '表头勾选不符');
    require(a.headerSelection.mixed === (c.selectedRows.length > 0 && c.selectedRows.length < eligible), '表头半选不符');
    require(a.headerSelection.disabled === (eligible === 0), '表头禁用不符');
  }
  for (const [i, row] of a.rows.entries()) {
    require(!!row.selection === c.selection, '选择列不符 ' + i);
    if (row.selection) {
      require(row.selection.checked === c.selectedRows.includes(i), '勾选不符 ' + i);
      require(row.selection.disabled === c.disabledRows.includes(i), '禁选不符 ' + i);
    }
    for (const col of c.columns) {
      const values = row.cells[col.key] ?? [];
      if(col.wrap)require(row.fits?.[col.key]===true,'长文字未完整展示 '+i+'/'+col.key);
      if (col.kind === 'operations') require(JSON.stringify(values) === JSON.stringify(c.rowActions[i]?.labels), '行操作不符 ' + i);
      else require(values.includes(String(c.rows[i]?.[col.key])), '单元格文字不符 ' + i + '/' + col.key);
    }
  }
  if (def.table.error) {
    require(actual.texts.includes(def.table.error), '遗漏失败文案');
    require(actual.retry, '遗漏重试入口');
  }
  if (!c.rows.length) require(!actual.paginationVisible, '空/失败状态仍显示分页');
  return errors;
}

export function generationResult({missingTexts = [], brokenInstances = [], unsupported = [], semanticErrors = []}) {
  const complete = ![missingTexts, brokenInstances, unsupported, semanticErrors].some(a => a.length);
  return {status: complete ? 'created' : 'incomplete', created: true, complete, validation: complete ? 'passed' : 'failed'};
}

export function verifyForm(def, actual) {
  const errors = [], require = (ok,message) => {if(!ok) errors.push(message);};
  if(def.groups) require(JSON.stringify(actual.groups)===JSON.stringify(def.groups.map(g=>({name:g.layer,text:g.title}))), '分组标题集合或顺序不符');
  require(JSON.stringify([...(actual.fieldNames??[])].sort())===JSON.stringify(def.rows.flat().map(f=>f.layer).sort()),'字段集合或条件可见性不符');
  for(const f of def.rows.flat()) {
    const a = actual.fields.find(n=>n.name===f.layer);
    require(a?.count===1, f.layer+' 字段缺失或重复'); if(!a) continue;
    for(const value of [f.label,f.help,f.error].filter(Boolean)) require(a.texts.some(t=>t.includes(value)),f.layer+' 文字缺失：'+value);
    if(f.disabled&&['textarea','time','number','radio'].includes(f.kind))require(a.readonlyVisual===true,f.layer+' 禁用视觉未匹配规范');
    if(f.kind==='switch') require(a.checked===String(!!f.value),f.layer+' 开关状态不符');
    else if(['radio','checkbox'].includes(f.kind)) {
      const expected=f.kind==='radio'?(f.value==null?[]:[f.value]):f.value??[];
      require(JSON.stringify([...(a.selected??[])].sort())===JSON.stringify([...expected].sort()),f.layer+' 选中项不符');
      for(const o of f.options??[]) require(a.texts.includes(typeof o==='string'?o:o.label),f.layer+' 选项丢失');
    } else if(f.value!=null) for(const value of Array.isArray(f.value)?f.value:[f.value]) require(a.texts.includes(String(value)),f.layer+' 值丢失：'+value);
    if(f.kind==='number') require(a.controlName==='InputNumber数字输入框',f.layer+' 数字控件类型错误');
    if(f.kind==='time') require(a.controlName==='TimePicker-input 时间选择输入框',f.layer+' 时间控件类型错误');
    if(f.kind==='upload') for(const [i,name] of (Array.isArray(f.value)?f.value:[]).entries()) {
      const file=a.uploads?.find(n=>n.name==='附件/'+i), fail=f.fileStates?.[name]==='fail';
      require(file?.variant?.includes('state 上传状态='+(fail?'fail':'success')),f.layer+' 文件状态不符：'+name);
      if(fail && !f.disabled) require(file?.retry,f.layer+' 重试入口缺失：'+name);
    }
    if(f.kind==='date-range') require(a.mode==='dateRange 日期区间',f.layer+' 错误日期控件类型');
  }
  for(const b of def.buttons) {
    const matches=actual.buttons.filter(n=>n.name===b.layer);
    require(matches.length===1,b.layer+' 按钮缺失或重复');
    if(matches[0]&&b.business){require(!!matches[0].business&&verifyBusinessButton(b.business,matches[0].business).length===0,b.layer+' 按钮实际配方或内容不符');}
    else if(matches[0]) { require(!!matches[0].loading===!!b.loading,b.layer+' 加载状态不符'); if(!b.loading) require(matches[0].disabled===!!b.disabled,b.layer+' 按钮禁用不符'); }
  }
  return errors;
}
