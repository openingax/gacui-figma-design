# Layout 顶部导航依赖
源 Layout 页面中的顶部导航0513（25703:123133），不是完整 Menu 家族。71 个源节点（含隐藏图层）已盘点、转移与回读；主组件500:15989，组件集500:16068，目标页492:2。

保持源业务示例用于规范对照，组合使用时应按业务配置；这些菜单名称和默认选中不构成业务规则。源快照保留原始精度。实际颜色固化为源解析值，跨文件变量绑定未迁移。浮点回读容差0.0001，不改源数据精度。

源SF Pro私有字符在本机及云端均缺字；四个字符用源fillGeometry原路径生成可编辑矢量，原TEXT保留为隐藏子节点，不用相似图标替代。隐藏GEAP固定源宽40，其他字体按源恢复，含苹方Semibold及Roboto；少数HUG容器设置源宽度为最小宽度以适配字体度量。

构建：prepare-navigation.mjs → navigation-build.mjs KIND start/nodes:N/vectors:N/finish → navigation-finalize.mjs 恢复解析色 → 桌面工具恢复source-fonts → 源宽度适配 → restore-symbol-outlines.mjs。已有目标禁止重复执行。每步回执见 evidence/layout-header。整体Layout组合与草稿接入另行验证；不把本依赖等同Menu全家族支持。
