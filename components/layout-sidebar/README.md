# Layout 侧栏依赖
源实例25703:122875，原始150节点完整保存（含隐藏）；12个布尔内部节点以6个原始fillGeometry矢量轮廓替代，构建138节点全部回读。GROUP转FRAME保留几何；三条退化直线的路径坐标被Figma归一化，已恢复对应原点偏移，保持画布上的轮廓位置，源逻辑边界见vector-normalization.json。

主组件500:16072，组件集500:16212，目标页492:2。颜色按源解析值保存，变量绑定不迁移；苹方Regular/Medium/Semibold已恢复。原侧栏2168高是展示样例，不限定业务菜单数量；Layout示例在视口裁切。该依赖不是完整Menu家族，不能因此标记Menu完成。

构建、修改、精度和字体说明参见相邻layout-header README。源码及构建数据没有省略源业务条目；业务组合时必须重新选择内容。证据在evidence/layout-sidebar。
