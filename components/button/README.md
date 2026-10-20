# Button 按钮

使用者自己的 Figma 目标（需配置）。规范事实与缺口在definition.json；源证据不进入默认知识检索。

- 四类外观：base / outline / text / ghost；三主题：primary / default / danger。
- 正常、悬停、点击、禁用四种有效状态；禁用仅与normal组合。
- 三尺寸24/32/40；七种内容布局：矩形纯文字、前图标、后图标，方形/圆形各文字或独立图标。
- 普通矩形按内容HUG；Block使用固定宽度并居中。长内容实测从84宽增至196宽，保持32高。
- 字体临时使用Noto Sans SC；源PingFang由用户桌面处理。

## 使用

现有组件优先创建实例。四外观集各12个中尺寸纯文字状态；布局集21项验证尺寸/内容，不把1008变体全部铺到画布。现有集合暴露label；单字符另用squareText。图标保留可编辑矢量，但源INSTANCE_SWAP属性尚未迁移，不承诺任意图标直接互换；新图标需有精确来源。

本地按需生成器`resolve.mjs`要求8个完整且逐字相同的源变体属性，可解析规范已有1008组合；不存在的组合拒绝。配方数据在recipes.json，按需加载，不能作为默认知识。所有组合经过离线根层/直接子层对照；实际Figma验证覆盖画布代表集及一个额外小尺寸危险active后图标组合，不能声称1008组合均经视觉验证。

```js
import {generateRequestedButton} from './components/button/resolve.mjs';
// properties必须包含definition.json中的8个精确属性及取值。
const code = generateRequestedButton(properties, stage, target, state);
```

画布验证集生成：`node components/button/generator.mjs PROFILE STAGE STATE_JSON`。PROFILE为base、outline、text、ghost、layouts。STAGE按start → nodes:N → vectors:N → finish执行；将finish输出和map合并后再执行properties绑定文本属性。目标由config/figma-pages.json取得。按需生成示范脚本为scripts/button/request-example.mjs。不要重复创建同名集合。

Loading独立为[13个静态视觉配方](../button-loading/README.md)，不冒充交互状态机。

尚未用户验收，不加✅。详细证据及差异见docs/button-analysis.md。
