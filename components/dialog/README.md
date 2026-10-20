# Dialog 基础确认（部分支持）

源：[B端整理 / Dialog](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=42005-300106)，只读。目标：使用者自己的 Figma 目标（需配置）。

**仅支持20个主变体中的1个**：default、无关闭、无分割线、双按钮；其余19个、关闭3态、全屏有/无分割线仍未实现。完整源目录、活跃类型/尺寸在 `evidence/dialog/coverage.json`，不能称Dialog全家族已导入。

规范事实：基础宽480，示例宽960；圆角9，外边距32；标题16/24，正文14/22；正文上16/下24，按钮间距8。蒙层样例是RGB(70,76,82)不透明实色，按原值保留，没有猜成40%透明。原始精度保存在build-data和带校验的source.raw.json。样例高度222不是业务固定高度：长正文采用原HEIGHT文字及自动布局随内容增高；超过视口判为不完整。源常规标题截断，本批业务标题允许换行，属于设计判断。

草图入口：页面children放`dialog`，提供`id/title/message/cancel/confirm/from`；`visible:false`默认隐藏，在状态patch中`visible:true`。可修改title/message/cancel/confirm，width范围480–960；每画板最多一个。未支持主题/关闭/分割线/全屏配置会拒绝。

```json
{"id":"confirm-dialog","type":"dialog","title":"确认停用巡检计划？","message":"停用后保留历史记录。","cancel":"取消","confirm":"确认停用","visible":false,"from":"需求:停用确认"}
```

`sketch/sketch.mjs check/render`和`sketch/figma.mjs plan/code`共用入口；`generator.mjs`的renderDialog/updateDialog共用内容布局，verifyDialogs检查文字、主组件引用及居中/视口边界。原位修改前先核实节点及人工改动，加载当前字体再调用updateDialog。helpers沿用sketchRuntime的normalize/setText/buttonLabel。目标ID固定，仅适用于登记测试文件，不可直接迁移新文件。

构建能力：已存精确build-data，通用 `scripts/lib/figma-build.mjs dialog start|nodes:0|nodes:1|finish FILE PAGE STATE_JSON` 生成Plugin API代码；每次将返回mapDelta合并进STATE_JSON后续做。finish后运行 `node scripts/dialog/finalize.mjs PAGE COMPONENT`，原样交给use_figma，将底栏接回现有Button。不要在现有目标重复导入。临时文字样式使用Dialog前缀，防止覆盖历史同名但已被用户替换为苹方的样式。

已验证两个原业务确认态、原位文案修改、底层内容不变、最终入口重跑与截图。云端Noto Sans SC暂代苹方。仅静态可编辑设计：按钮点击、请求、取消导航、停用成功/失败链未实现或验证；用户/UI未验收。

2026-10-20 说明板（内部验证资料未随公开包分发）核对：20主变体=5主题×关闭×分割线。无分割线变体容器内边距32、内容区 padding 16/0/24/0；有分割线变体三区72/114/80、各区 padding 24/32。说明板写“内容区下留白20px”，与全部20个源变体的 padding 24 不符，按源24保留，待UI确认。主题决定语义图标与主操作强调色（警告/错误主操作同步橙/红），默认主题无图标；展示底板不是遮罩。
