# Timeline 垂直日志（部分导入）

完整规范盘点在evidence/timeline/coverage.json：主布局12态，垂直四类各4态，水平三类各6态。当前只接入垂直左对齐/同侧一种主布局，以及对应default/primary × 普通/末项4态。右对齐、交错、水平、图标/自定义语义颜色等未导入，不是完整时间线家族支持。

源Page73586:226339，源结构source.json、说明文字配方description-source.json，目标Page425:2。原8px圆点、2px连接线、16px间隔和文字属性保留；内容区域变宽、完整换行与日志倒序由本场景设计判断，数量不受源8条示例限制。源内容实例展开为可编辑组合，源库只读；目标四个基础主件可复用。

`timeline`节点：`items:[{id,time,actor,action,detail,color?:default|primary}]`，`visible`、`layout:vertical`、`align:left`。输入顺序就是展示顺序，不把样例顺序/颜色当业务规则。末项自动无连接线；单条也为末项。空数组只给文字“暂无操作日志”，反馈视觉不因此已支持。

generator.mjs提供renderTimeline、updateTimelineItem（原位更新且行高/线长同步）、verifyTimelines。标准草图和Figma入口已接通。文字可编辑，云端Noto为临时替代，规范仍PingFang SC。静态设计，不读取真实审计日志。

[只读规范来源](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=73586-226339)。
