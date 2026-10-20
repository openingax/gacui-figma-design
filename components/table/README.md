# Table 表格

本包从表格页归纳表头、单元格、行、选择列与分页规则，不导入整张示例。`definition.json`列出支持范围与缺口。

```sh
node components/table/generator.mjs CONFIG_JSON TARGET_FILE_KEY PAGE_ID
```

配置格式见`verification-example.json`，它只用于组件验证，不是真实业务页面。列宽保留调用者原值；列数、行数、选中项和总数不是规范样例上限。输出为可直接交给use_figma的代码。当前组合依赖绑定到已登记的授权测试Page，迁移到别处须先生成依赖并登记新映射。

目标组件75:2。实际生成1200×242、5列3行，复用单元格、已验收Checkbox及分页。已检查长文字截断、行选中、表头半选和分页文本显示。代码拒绝重复列key、非正列宽、越界选中索引及超过现有操作单元容量的文本动作。

单选、展开、多行截断与拖拽列宽没有冒充已实现；交互和业务数据请求不属于本静态组件验证。

## 逐行操作与页面组合

工单工作台实际需要不同工单显示不同动作。`rowActions`按行提供`{labels: string[], more: boolean}`，支持0–3项文字与更多图标独立开关；长度必须等于rows。不传时保留原列级`actions`及默认更多图标行为。显式行操作单元从原母组件创建后本地化为FRAME，三项文字复制原Link子层；几何、颜色、文字样式仍来自源单元。列宽不足直接报错，不压缩文字或间距。

`asFrame: true`使`buildTable(figma,parent,config,deps)`直接生成页面组合FRAME，内部单元格与Checkbox仍复用实例；省略时仍为COMPONENT。CLI的既定授权Page限制不放宽。业务页面入口负责核对目标文件/Page/父节点，再调用同一构建函数，见`pages/work-orders/build.mjs`。

已在Figma测试：旧5列3行组合、无选择/未选/半选/全选、空数据、分页开关，以及0–3项文字×更多开关全部8组合。临时回归节点已清理，证据在`evidence/work-orders/`；真实工单页视觉检查不代替用户验收。

2026-10-14：新增`disabledRows`零基索引数组，与`selectedRows`不能重叠。复用已导入Checkbox禁用变体，表头按`rows.length-disabledRows.length`计算全选；无可选行时表头禁用。不新增元组件。业务字段条件在草图层解析，底层Table仍只接收明确的行索引与逐行动作。

文字列可配置 `wrap:true`（仅text类型），以原单元格边距和字体自动换行、按文字实际高度增高整行；表格总高随行更新。用于需要直接读全称的业务布局，不修改源组件或默认单行行为。应在内容修改后复核行高；本次完整重跑证据见docs/full-rerun-20261014.md。
