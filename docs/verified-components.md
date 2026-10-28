# V1.4.0 已验证组件能力

新增 Badge、Collapse、List、Progress、Statistic 的草稿语法、浏览器预览、可执行生成与检查函数。复用已技术验证实现；静态设计不包含真实业务交互，页面仍需验收。

|组件|草稿 type 与范围|边界|
|---|---|---|
|Badge|badge：medium/small、circle/round、small红点；text、anchor、offset|锚点仅已验证按钮/链接；数值不自动封顶或隐藏|
|Collapse|collapse：left/right/none、borderless、items；每项id/title/content/expanded/disabled|数量由业务决定；图片内容、抽屉和真实点击未验证|
|List|list：small/medium/large；base/multiline/meta；items、stripe/split、pagination|图片由业务提供base64/hash；真实翻页事件不包含|
|Progress|progress：line/plump/circle，四状态，percent，线性width|成功态必须100%；百分比0–100最多两位小数，窄宽度拒绝|
|Statistic|statistic：percent/text，title/value/unit，五色，趋势位置/方向及companion|静态数值与趋势图；不连接业务数据|

## Figma 目标边界

上述五项的真实构建、回读和修改恢复证据来自维护者已适配测试目标；不等于任何新文件已具有这些母组件。旧适配入口会检查当前版本依赖指纹，升级后必须重新核对，不能复用旧 ready。

空白文件路径：Badge 已接入通用构建数据，合成规划通过，尚无本版本新文件现场视觉复核；Collapse/List/Progress/Statistic 的原生嵌套、样式及父级关系迁移仍隔离，规划会明确跳过相关画板。不得关闭检查、手绘替代或宣称迁移完成。需要这些组件的高保真出稿时，使用已有完整适配目标并重新核实实际母组件及权限。

Button 扩展、DatePicker 工作台和独立 Upload 的私有测试目标验证已完成，但公开运行时仍需去除私有回执依赖并完成迁移验证，本版不启用它们。既有基础 Button、日期和抽屉 Upload 能力保留。Form 新工作台/事务批次、Form Upload 修改、Menu、Transfer 及未实现家族继续隔离；既有 Dialog 与抽屉修复保留。

## 使用示例

在工作台 children 中使用：

```json
{"id":"progress","type":"progress","from":"判断","theme":"line","status":"active","percent":37}
```

```json
{"id":"metric","type":"statistic","from":"判断","title":"完成率","value":"82.76","formal":"percent"}
```

```json
{"id":"details","type":"collapse","from":"判断","items":[{"id":"one","title":"详情","content":"业务说明","expanded":true}]}
```

```json
{"id":"records","type":"list","from":"判断","kind":"multiline","items":[{"id":"one","title":"条目","description":"业务内容"}]}
```

Badge 的 anchor 使用同页稳定路径，例如 page/actions/save；offset 必须显式提供。每次修改后检查内容、边界和所需状态。PingFang SC 优先；云端字体替代和桌面字体检查分别记录。
