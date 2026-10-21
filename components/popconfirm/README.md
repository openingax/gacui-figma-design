# Popconfirm 气泡确认框

源Page45434:322799、集合45451:329278当前28组合，无独立母组件。完整盘点含30外层气泡实例及嵌套按钮/图标；辅助info-circle不单列为气泡类型。六位置×四主题带箭头共24；另外默认/警告/危险无箭头placement=n/a，无图标无箭头的源placement却为top-center。保留这四个无箭头组合，不补造笛卡尔积。源拼写top-rignt/bottom-rignt在API规范化为top-right/bottom-right，源名称/ID保留。说明板见evidence/spec-guides-20261020/Popconfirm.md。

目标Page769:2，七集合映射见dependencies.json，28变体/417节点属性一致、21矢量逐字段误差0。definition/build-data位于extension-data七包，共享构建脚本popconfirm-next.mjs按断点执行。七组截图已核对；内部按钮/图标实例展开为本地FRAME，外层仍为独立母组件实例。受保护节点未改删。

草稿明确选择`type:'popconfirm'`才会生成，不替代Dialog。需要anchor唯一触发项文字、title、description、cancel、confirm；placement/theme/showArrow严格按catalog匹配。theme为default/warning/danger/n/a，最后一个表示无图标。每画板最多一个，不实现点击确认、删除、关闭或自动触发。间隔4px、锚点文字中心对齐箭头为页面判断；超出画板或锚点不唯一显式报错，不能悄悄改方向。

Page770:2共28真实状态，complete=true、错误数组空；28实例长标题/描述/按钮文案往返ID及原尺寸稳定。上下、靠左、无图标无箭头真实页面截图及浏览器锚点已检查。预览先计算全文提示可见性再定位浮层，避免表格高度变化导致偏移。当前输入支持可编辑静态状态，不承诺服务端删除行为。

规范字体PingFang SC，云端Noto Sans SC临时替代；技术验证不等于用户验收。证据在evidence/component-gaps-20261020/popconfirm-*，complete保持false。
