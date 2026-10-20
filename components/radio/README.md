# Radio 单选

来源：[B端整理 Radio](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=43606-304677)。目标：使用者自己的 Figma 目标（需配置）。技术验证通过，用户验收待定。

## 覆盖

| 用途 | 来源 | 实现 |
|---|---|---|
| 圆形元件五态 | 43606:305577，5变体 | radio-unit |
| 带文字单选五态 | 43606:305593，5变体 | radio-single |
| 普通单选组 | 43606:305609，7变体 | 同一生成器按 options 组合；源2–8项全部验证 |
| 描边、默认填充、品牌填充按钮 | 43606:304792，20变体 | radio-button，保留左右独立边框 |
| 描边和默认填充分组 | 43606:304883，14变体 | 同一生成器组合；源2–8项全部验证 |
| 品牌填充分组 | 活跃实例43611:307287 | 复用品牌按钮；不能因母组件脱离集合而忽略 |

五态为未选默认、未选悬停、已选默认、未选禁用、已选禁用；没有已选悬停或禁用悬停。源51变体归纳为30基础变体＋21数量组合，不是51种业务规则。数量可扩展，已实测9项。源演示同时展示多个选中状态，不代表业务组可以多选。

## 使用

```js
import {renderRadio} from './generator.mjs';
await renderRadio(figma, parent, {
  id:'scope', kind:'buttonGroup', variant:'primary-filled',
  options:[{id:'mine',label:'我的记录'},{id:'all',label:'全部记录'}], value:'mine'
}, dependencies);
```

kind 支持 single/group/buttonGroup。single 使用 label/checked；组使用 options/value，value 是唯一选项 id 或 null。variant 支持 outline/default-filled/primary-filled。disabled 可作用于整组或单项；hover 仅允许未选且未禁用项。width 可约束可用宽度，文案放不下时报错，不裁字。普通组间距16；按钮分组自动按最长文案等分，最小槽宽74；填充组外边距2、项间距4。

可传第五参数 existing 原位修改：选项 id 与数量必须不变；支持文字、状态、外观与宽度修改。删除或新增业务项需要显式重新组织，不能默默替换整个旧组。描边选中边框左右位置由实际选中项推导；禁用选中不作蓝色边框锚点，这是组合设计判断，保留源单元样式。

草稿使用 `type:radio` 加同名参数，支持工作台、抽屉正文和状态补丁；低保真预览表示选中/禁用，业务点击是静态示意。旧 Form 内置 radio 字段是历史实现，本入口不声称已替换其全部调用。

基础包通过 `node scripts/radio/build.mjs radio-single start|nodes|vectors|finish` 分批构建，依赖映射见 dependencies.json，已有目标不得重复导入。源实例内部已本地化为可编辑层，未迁移 TEXT/INSTANCE_SWAP 属性；文字按实例内唯一 label 图层编辑。创建/修改先加载字体，云端缺苹方临时用 Noto，最终桌面恢复苹方后再验。

验证与剩余边界见 本批记录（内部验证资料未随公开包分发）。
