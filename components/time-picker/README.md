# TimePicker 时间选择器

完整源25变体：单时间／区间输入16，时间格4（复用time-cell），区间格3，时分／时分秒弹层2。另覆盖源活跃样例的左右单元悬停／激活、当前时间提示、部分填值、确认收起与重新打开。源页面30344:105678；完整清单与证据见docs/time-picker-import-20261015.md。

`family.mjs`导出validateTimePicker、renderTimePicker、updateTimePicker。deps由`node scripts/time-picker/dependencies.mjs`从源快照及现有目标映射生成。参数：id、range、format(H:mm/H:mm:ss)、value（单时间字符串／区间双值数组）、state(normal/hover/focus)、open、disabled、width、rangeState（双normal/hover/active）、display（未填值时的当前时间提示）、columns（时间格label/state数组）。不接受禁用展开、双侧同时active或非法时间；不擅自规定跨午夜与起止大小业务规则。

默认时间列展示选中时间前后共7行，是演示数据生成策略；不是规范数量限制。可传自定义行数与四种格状态，固定视窗保持裁切。渲染为静态可编辑稿，源注释中的滚动／输入／确认动作通过显式状态表示，不实现真实键盘、滚动提交和时间业务运算。`display`与`value`分离，前者保留提示灰色。

updateTimePicker仅用于已填值、相同格式、相同展开与单元状态、默认时间列的原位内容修改；类型、样式或行数变化重新选配方。已验证时间08:15:30→23:59:59→08:15:30、宽度280→400→280；文字ID不变。长的非法时间输入拒绝，不引入任意文案。

独立草稿type:timePicker支持工作台、抽屉和状态patch。本机苹方504文本已回读；页面仍待用户验收。旧Form时间字段路径未替换，不能因此宣称旧Form已全部接入新家族。

目标组件页593:2，输入集593:18822、区间格593:10、弹层593:18916；时间格保留DatePicker页129:85。已有内容不要重复执行build。缺失目标重建时使用scripts/time-picker/build.mjs，严格按start/nodes/vectors/finish增量状态推进。
