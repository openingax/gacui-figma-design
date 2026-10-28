# Button 按钮

V1.5.0纳入业务入口。四外观base/outline/text/ghost、三主题primary/default/danger、三尺寸24/32/40、七种现行布局及normal/hover/active/disabled有效组合。Loading为13个medium矩形静态配方；历史dash明确拒绝。普通矩形按内容适应宽度，指定width时居中；单行内容容纳不下则拒绝，不缩字或裁切。

工作台和抽屉底栏actions.buttons支持appearance、theme、size、shape、icon、iconName、state、disabled、loading、loadingTone、width、label。保留既有primary默认映射。图标限有精确来源的download、chevron-down、search。Loading text/default需明确normal或dark-text；不支持的组合在生成前拒绝。抽屉底栏按实际按钮高度、上下留白和描边调整正文；超宽报错并清理本次新建抽屉，不留下半成品。

先按docs/portable-figma.md规划；39项精确资产按图标→模板的依赖顺序按需初始化，不要求全量创建。asset-code必须传此前真实回执文件，重复执行复用已验证资产。默认business-catalog只存编译符号，不能当成用户文件中的真实节点。直接使用buttonTargetCatalog(fileKey,pageId,receipts,paintMap)、prepareButtonForTarget及共享renderBusinessButton/updateBusinessButton；同结构更新需提供before/next，size/shape/icon结构改变应重新规划，不能假称原位支持。

源码既有验证覆盖87业务用例往返、23工作台/抽屉画板及预览、超窄失败恢复、资产复用与保护摘要；公开包另有生成/入口/安装升级验证。静态设计不等于业务点击或Loading动画，字体替代与页面用户验收须单列。规范PingFang SC优先，云端缺失时Noto Sans SC替代必须明示。
