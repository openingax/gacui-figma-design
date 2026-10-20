# Drawer 抽屉

支持指定规范中的右侧、有蒙层、展开态：小300 / 中500 / 大760；共享标题栏、底栏、蒙层；底栏左右两种排列；关闭控件默认/悬浮/点击三态。三尺寸及六组真实修改已回读、截图检查，未获用户验收。

源：[Drawer 示例](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=45854-328059)。目标：使用者自己的 Figma 目标（需配置）、使用者自己的 Figma 目标（需配置）。目标Page `202:2`。默认请显式选 medium（`203:52`），不要用组件集第一个变体推断默认值。

## 使用规则

- 面板贴右、全高。示例视口1440×900不是业务限制；支持显式视口宽高，宽不能小于面板、高至少112。
- 标题栏/底栏各56高；左右留白16；分割线1px；无阴影、无圆角。底栏按钮间隔8，上下12，按钮32高。
- **左底栏：确定→取消；右底栏：取消→确定**。这是源的真实差异，不能只改变对齐方向。
- 蒙层是 Gray8 `#464C52` × opacity `0.4000000059604645`，不是纯黑40%。
- 标题为 PingFang SC Semibold 16/24，正文与按钮为 Regular 14/22。云端实际用 Noto Sans SC Medium/Regular 临时编辑；苹方替换及桌面复核待完成。
- 标题保留源自然宽度。超出安全区时返回 warnings，不自动改省略号/换行/字号。业务应缩短文案或确认新的排版规范。
- 业务内容由AI放入 `Drawer/content` 可编辑空白槽；`body` 是已验证的多行文字便捷入口（16px内距为测试组合判断，不是源空白区域的强制业务规则）。复杂业务控件可在该槽组合现有组件。
- 源只有内部 Button 的 ON_HOVER→CHANGE_TO。已保留目标映射并回读，但未进行演示模式鼠标触发测试；关闭、取消、确定的业务行为/路由、Esc、焦点、关闭动画及滚动策略没有规范定义，不宣称已实现。

## 执行接口

`generator.mjs` 输出交给 `use_figma` 的原生 Plugin API JavaScript。Node执行只是生成代码，不写入Figma。

```js
import {generate} from './components/drawer/generator.mjs';
const target = {fileKey:'UNCONFIGURED_FIGMA_TARGET', pageId:'202:2'};
// library 为 evidence/drawer/target.json；实际使用前回读确认这些ID。
const code = generate('example', target, library, {
  size:'small', footer:'right', closeState:'normal',
  title:'工单详情', confirm:'提交审核', cancel:'取消',
  viewportWidth:1280, viewportHeight:680,
  body:'工单编号：WO20260929001\n处理说明：请核对处理结果。'
});
```

`generate('update',target,library,{nodeId,...完整配置})` 在既有组合上修改，nodeId使用上次真实返回值。省略业务文案会恢复默认标题/按钮；body省略时保留已有内容。更新时传完整配置，避免误用为局部patch。

**可编辑性边界**：标准三尺寸为本地组件，内部引用共享标题/蒙层/底栏及现有Button。`example/update` 为业务内容和精确定位将外壳及底栏本地化为 FRAME，保留标题、关闭、蒙层和Button实例；转为FRAME后外壳不再随主抽屉同步。所有本地化、文案、底栏排列、悬停恢复和文字自动增高由同一 `updateDrawer` 实现。

`library` 阶段只在授权目标空白家族Page使用；发现同名Drawer会拒绝重建。跨文件迁移须先重新授权并适配Button与样式映射，不能直接替换fileKey。

运行本地验证：`node tests/drawer.test.mjs`。该测试覆盖真实留存证据与输入边界，不代替Figma桌面或演示运行。

## 文件

- `definition.json`：规范摘要、状态和实际暴露的Figma属性。
- `build-data.json`：精确原生构建属性和共享关闭矢量；原始全量证据在 `evidence/drawer/`。
- `scripts/drawer/`：原始数据提取、组合修改和真实回读脚本。
- 分析与验证记录（内部验证资料未随公开包分发）：能力矩阵、差异、已知限制。

2026-10-15离线补充：`node scripts/drawer/offline-gallery.mjs`复用上述生成器检查19组配置、38段创建/原位修改代码，开发预览在evidence/drawer/offline/preview.html。浏览器核对19组宽度、56px首尾及底栏顺序；长标题检测为侵入关闭安全区，明确保留警告，不伪造自动省略规范。这批没有重建Figma组件，也没有完成苹方或桌面验收。
