import {validateRadio} from '../components/radio/generator.mjs';

// 调用方传入已解析可见性的Form；工作台与抽屉共用相同字段排版和配方。
export function prepareFormFields(form, {pageId, formWidth, layers, placeholders, formVariant}) {
  const rows = [], groups = [];
  if (form.title && !form.fields.some(f=>f.label===form.title) && form.fields.some(f => f.visible !== false)) groups.push({title:form.title, layer:'分组/'+form.id, beforeRow:rows.length});
  let pending = null;
  for (const f of form.fields) {
    if (f.visible === false) continue;
    const d = {...f, context:'form', layer:layers.get(`${pageId}/${form.id}/${f.id}`).layer};
    d.placeholder ??= placeholders[f.kind];
    const wide = form.cols !== 2 || ['textarea', 'upload'].includes(f.kind);
    if (wide) { if (pending) { rows.push([pending]); pending = null; } d.width = formWidth; rows.push([d]); }
    else if (pending) { d.width = pending.width; rows.push([pending, d]); pending = null; }
    else { d.width = (formWidth - 24) / 2; pending = d; }
  }
  if (pending) rows.push([pending]);
  for (const row of rows) for (const d of row) {
    if (d.kind === 'upload') continue;
    d.variant = formVariant(d.kind, d.required, d.help);
    if (d.kind === 'radioButton') {
      d.radioSpec = validateRadio({
        id:d.id, kind:'buttonGroup', variant:'default-filled', width:d.width,
        disabled:d.disabled ?? false, value:d.value ?? null,
        options:d.options.map(o => typeof o === 'string' ? {id:o,label:o} : {...o,id:o.label}),
      });
    }
    if (d.kind === 'password') {
      const filled = !!d.value || !!d.disabled;
      d.inputSpec = {
        id:d.id, family:'input-password',
        variant:'state 状态=' + (filled ? 'filled 填充' : 'normal 默认') +
          ', prefixIcon 前置图标=off, browse 浏览=off, tips 提示=off, disabled 禁用=' + (d.disabled ? 'on' : 'off'),
        width:d.width,
        ...(d.value != null ? {value:d.value} : {}),
        ...(!filled ? {placeholder:d.placeholder ?? '请输入密码'} : {}),
      };
      if (d.disabled && !d.value) d.inputSpec.value = '';
    }
  }
  return {rows, groups};
}
