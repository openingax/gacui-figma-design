# Tooltip 文字提示

源文件jNf9icrxfw8B7QkSQa9g33，Page44907:322227、集合44917:322249。当前84组合=六主题×14位置；12方向带箭头，n/a与mouse不带箭头，禁止任意交叉。无说明板、无独立母组件；24活跃实例含22外层Tooltip和2个辅助Cursor，后者不是遗漏的Tooltip类型。

目标Page762:2，六集合和384节点映射见dependencies.json，逐组合catalog.json，可执行definition/build-data在extension-data分包。共享构建协议由scripts/component-gaps/tooltip-next.mjs断点执行；未触碰受保护节点。72矢量逐字段误差为0，节点属性回读无差异；六组组件截图已查看。

草稿示例：`{id:'tip',type:'tooltip',from:'判断',anchor:'查看说明',text:'查看关联记录',placement:'bottom-center',theme:'default'}`。anchor必须唯一匹配当前操作按钮。仅支持按钮锚点、单画板至多一个文字提示；字段图标锚点尚未提供。六主题为default/primary/success/warning/danger/light，位置以catalog为准。源位置后缀与箭头对齐按实际矢量几何，不能按名称猜测。浮层与按钮间隔4px为设计判断；mouse作为静态跟随样式，不实现鼠标事件、延时或真实悬停。

Page763:2的19状态覆盖14位置及六主题，complete=true、错误数组为空；19实例长短文字修改与恢复ID稳定、恢复原尺寸，长内容不越画板。上下左右及mouse五份真实草稿截图、浏览器右上箭头与锚点已核对。预览用data-action-label排除来源标记对锚点匹配的干扰。规范字体PingFang SC，云端Noto Sans SC仅临时替代，未宣称苹方验证；技术验证不等于用户验收。
