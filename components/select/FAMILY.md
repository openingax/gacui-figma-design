# Select 完整家族调用

源页面30450:105768含72个展示变体：32输入、单选/多选各10选项状态、单选/多选各10菜单数量样例。菜单数量是数据，不是20个独立功能。活跃Focus另保留。复用旧24输入及单选10态，新增8展开输入、7多选行；现有组件ID不变。

`renderSelect(figma,parent,spec,deps)` 和 `validateSelect(spec)` 位于family.mjs。deps由`node scripts/select/dependencies.mjs`从已存源数据与目标映射生成。参数：id、multiple、open、prefixIcon、disabled、state(normal/hover)、width、value(单选字符串/多选数组)、placeholder、options（字符串或label/disabled/divider/state对象）。展开自动选focus源配方。选中、禁用不额外叠加hover/active；禁用不得展开或选入值。数据无数量上限，已测1–11项与7标签。

从准确母组件创建可编辑Frame，展开菜单用同一套单选/多选生成器。已有Form的弹层同用该生成器。独立草稿`type:selectField`支持工作台、抽屉及状态patch。相同选项状态改长文字调用updateSingleOption/updateMultiOption，保留文字ID；改变状态重新选择源配方。不是可点击的运行时控件，不承诺源TEXT/INSTANCE_SWAP绑定迁移。

目标输入集77:76、单选项67:88、多选项440:17。不要重复构建已有内容。迁移变体到原组件集后必须重新赋源variant name，Figma移动会自动重写属性；merged-variants证据验证32与10组合均可读。

苹方验证与视觉证据见docs/select-family-20261015.md。技术通过，用户页面验收待定。
