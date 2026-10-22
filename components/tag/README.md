# Tag 标签

当前支持规范组件集的320个主变体：4外观（dark/light/outline/light-outline）×5主题（default/primary/success/warning/danger）×2形状（square/round）×可关闭×默认图标×禁用；另有12个large关闭控件（6主题×normal/hover）。Tag高24px，关闭入口16px。medium历史游离类型已排除并在入口拒绝。

`heading.status`可配置`{label,theme,variant,shape,icon,closable,disabled,closeState}`，默认outline/square/无图标/不可关闭/可用。表格tag列保留显式`themes:{业务值:主题}`映射，并可通过`tag:{variant,shape,icon,closable,disabled,closeState}`设置列内标签外观；漏配展示值主题会报错，不猜业务颜色。关闭hover只允许可关闭且未禁用；dark彩色主题使用White关闭控件，其余按当前主题。

使用`validateTag`校验，出稿计划从`catalog.json`选取已存在母组件，`renderTag`创建实例，`updateTag`原位修改语义label。默认图标只支持当前规范图标，`iconName/iconId`明确拒绝；源TEXT/INSTANCE_SWAP属性不等于已接通任意图标交换。关闭、添加或选择的业务事件仍由页面业务决定，本能力只表达静态状态。

保留原20个基础组件ID与54:47集合。旧`build-data.json`与definition的properties/states描述基础包；完整当前范围见currentProperties/currentStates及11个`extension-data`包，全部使用共享figma-build分批构建。`dependencies.json`记录全部映射；恢复应回读，不能重建已有节点。

本轮1516新增节点属性、332矢量逐字段复核通过；11组截图及真实草稿截图已查看。验证Page747:2 / 画板747:3回执complete=true，11实例长短文案往返ID与原宽度保持。表格3主题关闭hover精确填充回读一致；预览浏览器已查看。云端Noto Sans SC为临时替代，桌面苹方未验证，用户未验收，coverage.complete=false。

证据和验证边界见导入记录（内部验证资料）。
