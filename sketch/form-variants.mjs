// Which existing component-set variant a form field takes, or null when the field keeps its template.
// Shared by the Figma runtime (serialized into lib) and the blank-file compiler, which builds only these variants.
export function formVariantQuery(f) {
  const filled = f.value != null && f.value !== '' && (!Array.isArray(f.value) || f.value.length > 0);
  if (['date','date-range'].includes(f.kind)) return {set:'70:2', predicates:[`mode 类型=${f.kind === 'date' ? 'date 日期,' : 'dateRange 日期区间,'}`, 'state 状态=normal', `filled 填充=${filled}`, `disabled 禁用=${!!f.disabled}`]};
  if (f.kind === 'switch') return {set:'53:85', predicates:['size 尺寸=medium', `checked 开关=${!!f.value}`, 'loading 加载=false', `disabled 禁用=${!!f.disabled}`, 'label标签=none']};
  if (f.kind === 'select') return {set:'77:76', predicates:['state 状态=normal', `multiple 多选=${!!f.multiple}`, 'prefixIcon 前置图标=false', `filled 填充=${filled}`, `disabled 禁用=${!!f.disabled}`]};
  if (f.kind === 'input' && f.disabled) return {set:'64:2', predicates:['state 状态=normal','prefixIcon 前置图标=off','clearable 清空=off','tips 提示=off','disabled 禁用=on']};
  return null;
}
