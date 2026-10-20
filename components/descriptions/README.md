# 详情只读信息组合

此目录复用规范详情模板的组合结构，并非名为 Descriptions 的源组件家族。来源、完整结构比对在 evidence/descriptions；选用 Template/25696:22964 的分组标题、标签和值，保留原始颜色、字体与间距。

草图节点：`{id:"basic",type:"descriptions",title:"基本信息",columnCount:2,from:"需求:原文",items:[{id:"station",label:"场站",value:"演示场站",from:"演示"}]}`。支持1或2列，item.span=2跨列，items整体状态覆盖，visible控制整个区块。文本只读，禁止用Form冒充。

构建：generator.mjs 的 renderDescriptions；build-data.json 为源角色配方。标准 `sketch/figma.mjs code` 自动接入。字段稳定命名支持原位修改。标签宽126、长值完整换行是页面设计判断；该实现仅覆盖选定详情组合，不代表Template全家族支持。云端字体临时Noto，规范仍为PingFang SC。

[只读规范来源](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=63959-213876)。
