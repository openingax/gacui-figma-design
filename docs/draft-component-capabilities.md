# 当前草稿组件入口与边界

适用于V1.2.1。下列完成项指技术验证，不代表用户验收；线框和Figma设计均为静态表达，不提供真实业务事件。

## 本次完成的入口

| 组件 | 草稿入口 | 线框与当前边界 |
|---|---|---|
| Dialog | 独立 `type:"dialog"` | 20常规组合、关闭3态、2全屏组合；全屏仅info带关闭，单画板至多一个 |
| Tag | `heading.status`、表格 `kind:"tag"` 列的 `tag` 配置 | 标题/单元格标签；非独立tag节点；medium和任意自定义图标拒绝 |
| Pagination | `table.pagination` 对象 | default/simple及禁用等24源组合；非独立分页节点，无真实翻页 |
| Tabs | 独立 `type:"tabs"` | 顶部2–8项、左侧8项与源图标配置；不补造左侧其他数量 |
| Message | 独立 `type:"message"` | 10组合；页面顶部全局提示，单画板至多一个，无自动消失事件 |
| Loading | 独立 `type:"loading"` | 三尺寸×纯图形/图文/纯文案；区域加载示意，不代表所有控件均支持loading |
| Tooltip | 独立 `type:"tooltip"` | 84组合；anchor匹配操作按钮，单画板至多一个；字段图标锚点未提供 |
| Steps | 独立 `type:"steps"` | 横/竖与当前主题、状态组合；按items表达内容，不执行流程导航 |
| Popconfirm | 独立 `type:"popconfirm"` | 28组合、操作按钮锚点；单画板至多一个，不执行确认操作 |
| Notification | 独立 `type:"notification"` | 10组合、标题/描述/底部操作；单画板至多一个；当前源无关闭按钮，拒绝配置关闭 |
| Alert | 独立 `type:"feedback", kind:"alert"` | 工作台52当前组合；拒绝无关闭及库外组合；抽屉新Alert入口未开放 |
| Table | 独立 `type:"table"` | 单选/多选/展开、多行截断、文字标签、状态映射及静态列宽；不实现拖拽/真实选择事件 |
| ImageViewer | 独立 `type:"imageViewer"` | 20当前变体，图库、三比例、失败大图、关闭三态；左右切换只有normal，无真实切换/下载 |
| 查询区DatePicker | `search` 查询项的date类型 | 空值/已填日期输入；本轮不引入额外查询类型 |

上述入口在 `sketch/core.mjs` 中校验，`sketch/preview.js` 渲染线框，`sketch/figma.mjs` 生成静态可编辑Figma代码。具体参数与组合限制以各组件README和校验器为准。验证证据索引见任务记录（内部验证资料）。

## 未完成与保留范围

- Timeline支持12种布局、5种语义颜色、loading/custom图标、空态，以及固定条目ID/数量/顺序/图标的原位文案和颜色修改。详见[Timeline说明](timeline.md)。技术验证通过，用户验收独立。
- Menu、Badge、Collapse、List、Progress、Statistic的本任务扩展尚未执行；既有局部页面组合不等于家族覆盖。
- Button的INSTANCE_SWAP和颜色绑定补齐未完成；不据此关闭历史已验证按钮入口。dash作为废弃类型拒绝。
- Upload已有表单上传字段；独立upload线框属于开发预览，其Figma入口尚未完成，不作为此次可交付能力。
- Transfer、Rate、Skeleton、Swiper、Watermark继续暂缓；开发预览或历史源码存在不等于可以出稿。
- Empty保留三个来源，当前真实页面技术验证范围为compact；旧error＋重试反馈不等于新Alert节点，也不改变其抽屉限制。

未完成扩展不随本版本分发。维护及发布流程见[维护说明](maintenance.md)；字体替代、演示素材和用户验收边界保留。

三项新增组合和明确限制见[业务组合说明](business-compositions.md)。
