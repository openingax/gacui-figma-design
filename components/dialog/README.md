# Dialog 对话框

当前20主变体、关闭3态及全屏2种组合已完成技术验证；独立 `dialog` 草稿节点和线框预览已接通，完整参数见下方扩展说明。用户未验收。

## 基础确认与共用入口

源：[B端整理 / Dialog](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=42005-300106)，只读。目标：[基础确认组件](https://www.figma.com/design/UNCONFIGURED_FIGMA_TARGET/?node-id=415-9)。

默认组合是default、无关闭、无分割线、双按钮；其余当前组合已接通。完整源目录、活跃类型/尺寸与技术验证状态在 `evidence/dialog/coverage.json`；库外组合不补造。

规范事实：基础宽480，示例宽960；圆角9，外边距32；标题16/24，正文14/22；正文上16/下24，按钮间距8。蒙层样例是RGB(70,76,82)不透明实色，按原值保留，没有猜成40%透明。原始精度保存在build-data和带校验的source.raw.json。样例高度222不是业务固定高度：长正文采用原HEIGHT文字及自动布局随内容增高；超过视口判为不完整。源常规标题截断，本批业务标题允许换行，属于设计判断。

草图入口：页面children放`dialog`，提供`id/title/message/cancel/confirm/from`；`visible:false`默认隐藏，在状态patch中`visible:true`。可修改title/message/cancel/confirm，width范围480–960；每画板最多一个。可配置theme/closable/divider/fullscreen/closeState；仅拒绝下方列明的库外组合。

```json
{"id":"confirm-dialog","type":"dialog","title":"确认停用巡检计划？","message":"停用后保留历史记录。","cancel":"取消","confirm":"确认停用","visible":false,"from":"需求:停用确认"}
```

`sketch/sketch.mjs check/render`和`sketch/figma.mjs plan/code`共用入口；`generator.mjs`的renderDialog/updateDialog共用内容布局，verifyDialogs检查文字、主组件引用及居中/视口边界。原位修改前先核实节点及人工改动，加载当前字体再调用updateDialog。helpers沿用sketchRuntime的normalize/setText/buttonLabel。目标ID固定，仅适用于登记测试文件，不可直接迁移新文件。

构建能力：已存精确build-data，通用 `scripts/lib/figma-build.mjs dialog start|nodes:0|nodes:1|finish FILE PAGE STATE_JSON` 生成Plugin API代码；每次将返回mapDelta合并进STATE_JSON后续做。finish后运行 `node scripts/dialog/finalize.mjs PAGE COMPONENT`，原样交给use_figma，将底栏接回现有Button。不要在现有目标重复导入。临时文字样式使用Dialog前缀，防止覆盖历史同名但已被用户替换为苹方的样式。

已验证两个原业务确认态、原位文案修改、底层内容不变、最终入口重跑与截图。云端Noto Sans SC暂代苹方。仅静态可编辑设计：按钮点击、请求、取消导航、停用成功/失败链未实现或验证；用户/UI未验收。

2026-10-20 说明板（内部验证资料）核对：20主变体=5主题×关闭×分割线。无分割线变体容器内边距32、内容区 padding 16/0/24/0；有分割线变体三区72/114/80、各区 padding 24/32。说明板写“内容区下留白20px”，与全部20个源变体的 padding 24 不符，按源24保留，待UI确认。主题决定语义图标与主操作强调色（警告/错误主操作同步橙/红），默认主题无图标；展示底板不是遮罩。

## 当前扩展范围与验证

现在覆盖源20个主变体（5主题×关闭×分割线）、关闭按钮3态及2种全屏样例。默认组合继续引用受保护 `415:9`；扩展集合 `731:20699`、关闭 `731:20709`、全屏 `731:20742`，全部在原Page `415:2`，没有替换旧组件。

`dialog`新增 `theme: default|info|warning|error|success`、`closable`、`divider`、`fullscreen`、`closeState: normal|hover|active`。`closeBtn`作为兼容别名，与closable冲突时报错。普通默认default/无关闭；全屏默认info/带关闭。全屏源仅提供info且带关闭，不支持其他主题、隐藏关闭或固定width，明确拒绝这些配置。关闭状态为静态设计状态，无真实点击行为。全屏填满当前画板为设计判断；标题左对齐并允许换行。

精确构建数据分包在本目录 `dialog-family/`（19态）、`dialog-close/`、`dialog-fullscreen/`；原 `build-data.json`保留基础变体并登记扩展包。执行器 `scripts/component-gaps/dialog-build.mjs` 使用共享figma-build协议；此次状态与逐批回执在 `evidence/component-gaps-20261020/`，不要对已构建范围重跑。依赖映射见 `dependencies.json`。新变体内的源INSTANCE被展开为FRAME保留样式，整体Dialog仍为可复用主组件；它们不承诺独立按钮交换属性。原基础变体保留原Button实例。

普通宽480–960；正文下留白按源24。主题图标及警告橙/错误红来自源，未以文字推断。原位文案更新共用updateDialog；切换主变体明确拒绝，另建状态画板。超出画板或正文溢出会判不完整。

303新增节点已核对尺寸、布局、样式绑定；33矢量逐字段核对，样式映射正确，目标API数值差异最高4.77e-7，原始源精度未改。3个真实草稿画板回执complete=true，长短文案往返ID稳定；全部24新增状态通过生成检查。截图已检查，修正全屏标题拉伸居中问题。用户/UI验收及桌面苹方验证仍未完成，`complete=false`。
