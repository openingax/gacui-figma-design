import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// 此函数被原样嵌入 use_figma，不依赖 Node.js 或外部变量。
export async function buildCheckbox(figma, definition, target) {
  if (!target.fileKey || target.fileKey === definition.source.fileKey || figma.fileKey !== target.fileKey) {
    throw new Error('目标文件未明确指定、与当前文件不符，或指向只读规范');
  }
  const page = await figma.getNodeByIdAsync(target.pageId);
  if (!page || page.type !== 'PAGE' || page.parent !== figma.root) throw new Error('目标 Page 不存在');
  await figma.setCurrentPageAsync(page);
  const duplicate = page.findAllWithCriteria({ types: ['COMPONENT_SET'] })
    .some(n => n.name === definition.name || n.name === definition.name + ' ✅');
  if (duplicate) throw new Error('目标 Page 已存在同名组件集，拒绝重复生成');
  if (definition.variants.length !== 7 || new Set(definition.variants.map(v => v.name)).size !== 7) {
    throw new Error('Checkbox 必须恰好有 7 个不同状态');
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    return value;
  };
  const equal = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const localStyles = await figma.getLocalPaintStylesAsync();
  const styles = {};
  // 在创建任何内容之前检查所有同名样式；不修改已有样式。
  for (const [name, paints] of Object.entries(definition.styles)) {
    const matches = localStyles.filter(s => s.name === name);
    if (matches.length > 1 || (matches.length === 1 && !equal(matches[0].paints, paints))) {
      throw new Error('同名样式重复或颜色不一致：' + name);
    }
    if (matches.length) styles[name] = matches[0];
  }
  const createdNodeIds = [], createdStyleIds = [];
  const right = Math.max(0, ...page.children.map(n => n.x + n.width));
  for (const [name, paints] of Object.entries(definition.styles)) {
    if (!styles[name]) {
      const style = figma.createPaintStyle();
      style.name = name;
      style.paints = clone(paints);
      styles[name] = style;
      createdStyleIds.push(style.id);
    }
  }
  async function applyPaint(node, property, spec) {
    if (spec.style) {
      if (property === 'fills') await node.setFillStyleIdAsync(styles[spec.style].id);
      else await node.setStrokeStyleIdAsync(styles[spec.style].id);
    } else node[property] = clone(spec.paints);
  }
  const components = [];
  for (const variant of definition.variants) {
    const component = figma.createComponent();
    createdNodeIds.push(component.id);
    page.appendChild(component);
    component.name = variant.name;
    component.resize(variant.width, variant.height);
    component.layoutMode = 'NONE'; // 元组件固定几何，组合排版由上层负责。
    component.fills = [];
    component.strokes = [];
    component.clipsContent = false;
    for (const layer of variant.layers) {
      const node = layer.type === 'VECTOR' ? figma.createVector() : figma.createRectangle();
      createdNodeIds.push(node.id);
      component.appendChild(node);
      node.name = layer.name;
      if (layer.type === 'VECTOR') {
        const network = clone(definition.geometries[layer.geometry].vectorNetwork);
        for (const region of network.regions) {
          region.fillStyleId = '';
          region.fills = clone(layer.fills.paints);
        }
        await node.setVectorNetworkAsync(network);
        // 不 resize 矢量、不写节点级 cornerRadius；包围盒交由真实 Figma 计算。
      } else {
        node.resize(layer.width, layer.height);
        node.cornerRadius = layer.cornerRadius;
      }
      for (const key of ['x','y','strokeWeight','strokeAlign','strokeCap','strokeJoin','strokeMiterLimit','dashPattern','cornerSmoothing','constraints','opacity','blendMode','visible']) {
        if (key in layer) node[key] = clone(layer[key]);
      }
      await applyPaint(node, 'fills', layer.fills);
      await applyPaint(node, 'strokes', layer.strokes);
    }
    components.push(component);
  }
  const set = figma.combineAsVariants(components, page);
  createdNodeIds.push(set.id);
  set.name = definition.name; // 未经用户验收不加 ✅。
  set.description = '16×16 Checkbox 元组件。文字与分组由业务页面组合；仅支持规范中的七种状态。';
  set.layoutMode = 'NONE';
  // 仅展示位置为本地判断；不改变组件内部原始几何。
  components.forEach((c,i) => { c.x = 16 + i * 40; c.y = 16; });
  set.resizeWithoutConstraints(16 + components.length * 40, 48);
  set.x = right + 80;
  set.y = 80;
  return { pageId: page.id, componentSetId: set.id, createdNodeIds, mutatedNodeIds: [], createdStyleIds,
    variants: components.map(c => ({ id:c.id, name:c.name, width:c.width, height:c.height })),
    pendingVerification: ['真实 Figma 回读矢量包围盒、样式绑定与 fillGeometry', '逐状态截图和放大对照', '用户验收'] };
}

export function generateCode(definition, target) {
  if (!target?.fileKey || !/^\d+:\d+$/.test(target.pageId || '')) throw new Error('需要明确的目标 fileKey 和 Page ID');
  if (target.fileKey === definition.source.fileKey) throw new Error('规范源文件只读');
  const code = `const definition = ${JSON.stringify(definition)};\nconst target = ${JSON.stringify(target)};\nconst buildCheckbox = ${buildCheckbox.toString()};\nreturn await buildCheckbox(figma, definition, target);\n`;
  if (code.length > 50000) throw new Error('生成代码超过 use_figma 50000 字符限制');
  return code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [fileKey, pageId] = process.argv.slice(2);
  const definition = JSON.parse(readFileSync(new URL('./definition.json', import.meta.url), 'utf8'));
  process.stdout.write(generateCode(definition, { fileKey, pageId }));
}
