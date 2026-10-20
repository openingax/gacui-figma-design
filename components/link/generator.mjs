export const SIZE = {large: 'large 大尺寸', medium: 'medium 中尺寸'};
export const STATE = {normal: 'normal 默认', hover: 'hover 悬停', active: 'active 点击'};
export const STYLE = {normal: 'Brand 品牌/Brand5-Normal', hover: 'Brand 品牌/Brand4-Hover', active: 'Brand 品牌/Brand6-Click', disabled: 'Brand 品牌/Brand3-Disabled'};
const METRICS = {large: {icon: 18, gap: 12, font: 16, line: 24}, medium: {icon: 16, gap: 8, font: 14, line: 22}};

export const LINK_SOURCE = {
  fileKey: 'jNf9icrxfw8B7QkSQa9g33',
  pageId: '69043:216748',
  setId: '69043:216869',
  frameId: '25715:25129',
  demoId: '69051:220017',
  icons: {link: '75:2123', jump: '75:2074'}
};

export const LINK_IDS = {
  fileKey: 'UNCONFIGURED_FIGMA_TARGET',
  pageId: '521:2',
  componentSetId: '525:130',
  linkIconId: '523:3',
  jumpIconId: '524:2'
};

const ORDER = [
  ['69046:217023', 'large', 'normal', 1, 1, 0],
  ['69046:217020', 'large', 'hover', 1, 1, 0],
  ['69046:217017', 'large', 'active', 1, 1, 0],
  ['69046:217014', 'large', 'normal', 1, 1, 1],
  ['69046:217011', 'medium', 'normal', 1, 1, 0],
  ['69046:217008', 'medium', 'hover', 1, 1, 0],
  ['69046:217005', 'medium', 'active', 1, 1, 0],
  ['69046:217002', 'medium', 'normal', 1, 1, 1],
  ['22709:34268', 'large', 'normal', 0, 1, 0],
  ['22709:34646', 'large', 'hover', 0, 1, 0],
  ['22709:35024', 'large', 'active', 0, 1, 0],
  ['22709:35404', 'large', 'normal', 0, 1, 1],
  ['22709:34157', 'medium', 'normal', 0, 1, 0],
  ['22709:34535', 'medium', 'hover', 0, 1, 0],
  ['22709:34913', 'medium', 'active', 0, 1, 0],
  ['22709:35291', 'medium', 'normal', 0, 1, 1],
  ['22709:33935', 'large', 'normal', 1, 0, 0],
  ['22709:34313', 'large', 'hover', 1, 0, 0],
  ['22709:34691', 'large', 'active', 1, 0, 0],
  ['22709:35069', 'large', 'normal', 1, 0, 1],
  ['22709:33920', 'medium', 'normal', 1, 0, 0],
  ['22709:34298', 'medium', 'hover', 1, 0, 0],
  ['22709:34676', 'medium', 'active', 1, 0, 0],
  ['22709:35054', 'medium', 'normal', 1, 0, 1],
  ['22709:33893', 'large', 'normal', 0, 0, 0],
  ['22709:35799', 'large', 'hover', 0, 0, 0],
  ['22709:36191', 'large', 'active', 0, 0, 0],
  ['22709:36575', 'large', 'normal', 0, 0, 1],
  ['22709:33763', 'medium', 'normal', 0, 0, 0],
  ['22709:35669', 'medium', 'hover', 0, 0, 0],
  ['22709:36059', 'medium', 'active', 0, 0, 0],
  ['22709:36447', 'medium', 'normal', 0, 0, 1]
];

export const SOURCE_VARIANTS = ORDER.map(([id, size, state, prefix, suffix, disabled]) => ({
  id, size, state, prefix: !!prefix, suffix: !!suffix, disabled: !!disabled,
  prefixLayer: size === 'medium' && state === 'active' && prefix && !disabled ? 'download' : 'link'
}));

export function validateLink(spec) {
  const size = spec.size ?? 'medium';
  const state = spec.state ?? 'normal';
  if (!SIZE[size]) throw Error('链接尺寸无效');
  if (!STATE[state]) throw Error('链接状态无效');
  if (spec.disabled !== undefined && typeof spec.disabled !== 'boolean') throw Error('disabled 必须为布尔值');
  if (spec.prefix !== undefined && typeof spec.prefix !== 'boolean') throw Error('前置图标必须为布尔值');
  if (spec.suffix !== undefined && typeof spec.suffix !== 'boolean') throw Error('后置图标必须为布尔值');
  if (spec.disabled && state !== 'normal') throw Error('规范没有禁用与悬停或点击的组合');
  if (spec.text !== undefined && (typeof spec.text !== 'string' || !spec.text.trim())) throw Error('链接文案不能为空');
  if (spec.prefixIcon !== undefined && !['link', 'jump'].includes(spec.prefixIcon)) throw Error('前置图标只支持 link 或 jump');
  if (spec.suffixIcon !== undefined && !['link', 'jump'].includes(spec.suffixIcon)) throw Error('后置图标只支持 link 或 jump');
  if (spec.prefixIcon && !spec.prefix) throw Error('未显示前置图标时不能交换图标');
  if (spec.suffixIcon && !spec.suffix) throw Error('未显示后置图标时不能交换图标');
  return {id: spec.id, size, state, disabled: !!spec.disabled, prefix: !!spec.prefix, suffix: !!spec.suffix, text: spec.text, prefixIcon: spec.prefixIcon, suffixIcon: spec.suffixIcon};
}

export function linkVariant(spec) {
  const item = validateLink(spec);
  return `size 尺寸=${SIZE[item.size]}, state 状态=${STATE[item.state]}, prefixIcon 前置图标=${item.prefix}, suffixIcon 后置图标=${item.suffix}, disabled 禁用=${item.disabled}`;
}

export function linkStyleName(spec) {
  const item = validateLink(spec);
  return STYLE[item.disabled ? 'disabled' : item.state];
}

export function linkMetrics(spec) {
  return METRICS[validateLink(spec).size];
}

export function propertyKey(definitions, name) {
  return Object.keys(definitions).find((key) => key.startsWith(name + '#'));
}

export async function updateLink(figma, node, spec) {
  const item = validateLink(spec);
  if (node.type !== 'INSTANCE') throw Error('修改入口只接受 Link 组件实例');
  const current = node.variantProperties ?? {};
  if (current['size 尺寸'] !== SIZE[item.size] || current['state 状态'] !== STATE[item.state] || current['prefixIcon 前置图标'] !== String(item.prefix) || current['suffixIcon 后置图标'] !== String(item.suffix) || current['disabled 禁用'] !== String(item.disabled)) throw Error('尺寸、状态或图标槽位不同，需重新选用对应变体');
  const definitions = node.mainComponent.parent.componentPropertyDefinitions;
  const textKey = propertyKey(definitions, 'text 文案');
  const prefixKey = propertyKey(definitions, 'prefixIcon instance 前置图标实例');
  const suffixKey = propertyKey(definitions, 'suffixIcon Instance');
  if (!textKey || !prefixKey || !suffixKey) throw Error('Link 的文字或图标交换属性缺失');
  const props = {};
  if (item.text !== undefined) props[textKey] = item.text;
  const icons = {link: LINK_IDS.linkIconId, jump: LINK_IDS.jumpIconId};
  if (item.prefixIcon) props[prefixKey] = icons[item.prefixIcon];
  if (item.suffixIcon) props[suffixKey] = icons[item.suffixIcon];
  if (Object.keys(props).length) {
    for (const text of node.findAllWithCriteria({types: ['TEXT']}))
      for (const segment of text.getStyledTextSegments(['fontName'])) await figma.loadFontAsync(segment.fontName);
    node.setProperties(props);
  }
  if (item.prefixIcon || item.suffixIcon) await recolorIcons(figma, node, linkStyleName(item));
  return node;
}

export async function recolorIcons(figma, node, styleName) {
  const paints = await figma.getLocalPaintStylesAsync();
  const matches = paints.filter((style) => style.name === styleName);
  if (matches.length !== 1) throw Error('颜色样式缺失或重名 ' + styleName);
  for (const icon of node.findAllWithCriteria({types: ['INSTANCE']})) {
    const vector = icon.findOne((child) => child.type === 'VECTOR');
    if (vector) await vector.setFillStyleIdAsync(matches[0].id);
  }
}

export async function renderLink(figma, parent, spec) {
  const item = validateLink(spec);
  if (!LINK_IDS.componentSetId) throw Error('Link 组件依赖缺失');
  const set = await figma.getNodeByIdAsync(LINK_IDS.componentSetId);
  if (set?.type !== 'COMPONENT_SET' || set.parent?.id !== LINK_IDS.pageId) throw Error('Link 组件依赖缺失');
  const main = set.children.find((child) => child.name === linkVariant(item));
  if (!main) throw Error('Link 变体缺失');
  const node = main.createInstance();
  parent.appendChild(node);
  node.name = '链接/' + item.id;
  for (const text of node.findAllWithCriteria({types: ['TEXT']})) {
    for (const segment of text.getStyledTextSegments(['fontName'])) {
      try { await figma.loadFontAsync(segment.fontName); }
      catch (error) {
        if (segment.fontName.family !== 'PingFang SC') throw error;
        const fallback = {family: 'Noto Sans SC', style: segment.fontName.style};
        await figma.loadFontAsync(fallback);
        text.setRangeFontName(segment.start, segment.end, fallback);
      }
    }
  }
  await updateLink(figma, node, item);
  return node;
}
