# UI Agent 组件入口

默认只检索本目录下的README和definition.json；精确生成时再读build-data和资产。evidence、tests和过程文档不进默认组件知识。选用已有精确变体或实际defaultVariant，不用children[0]推断默认状态。

| 类别 | 入口 | 本轮范围 |
|---|---|---|
| Layout | [布局基础](layout/README.md) | 11档间距、12列栅格与三种导航组合已技术验证；用户验收待定，不计完成 |
| Divider | [分割线](divider/README.md) | 源十态、草稿位置与抽屉复用已技术验证；用户验收待定，不计完成 |
| Radio | [单选](radio/README.md) | 30个基础变体、21个源分组与活跃品牌填充已覆盖；草稿和苹方已验证，等待验收 |
| Link | [链接](link/README.md) | 32个源变体、文字/图标交换、工作台/抽屉草稿及苹方已验证；等待用户验收 |
| Button | [button](button/README.md)、[loading](button-loading/README.md) | 外观状态、尺寸/布局、按需配方和Loading；未验收 |
| Checkbox | [多选框](checkbox/README.md) | 复用已验收7元状态，文字7态、参数化分组、草稿与苹方已验证；家族待验收 |
| 顶部导航 | [header-menu](header-menu/README.md) | 指定1440/7项变体 |
| 充电侧栏 | [charging-sidebar](charging-sidebar/README.md) | 指定订单管理展开变体 |
| Tabs | [tabs](tabs/README.md) | 24状态 |
| Pagination | [pagination](pagination/README.md) | 五类配置 |
| Table | [table](table/README.md)、[cell](table-cell/README.md) | 单元格＋数据驱动组合，复用Checkbox/分页 |
| Form | [家族归纳](form/README.md)、[field](form-field/README.md)、[help](form-help/README.md) | 8基础字段＋4提示；88顶部字段状态＋7校验＋34布局组合；可编辑静态设计，未验收 |
| Input | [input](input/README.md)、[focus](input-focus/README.md) | 118源状态＋活跃Focus；草稿与苹方已技术验证，用户验收待定 |
| DatePicker | [家族覆盖](datepicker/README.md)、[input](date-input/README.md)、[panel](date-panel/README.md) | 六类完整静态组合、24输入状态、40基础状态；未用户验收 |
| Select | [select](select/README.md)、[option](select-option/README.md)、[focus](select-focus/README.md) | 72源变体对应52独立状态＋20数量配方；草稿与苹方已验证，用户验收待定 |
| Search | [搜索家族](search/README.md)、[操作区](search-action/README.md)、[弹层](search-popup/README.md) | 46源态＋4活跃扩展＋9操作区＋1弹层；50态真实修改，未验收 |
| Dialog | [基础确认](dialog/README.md) | 部分支持：1/20主变体，无关闭/分割线双按钮；表单取消与详情停用入口，未验收 |
| Drawer | [抽屉家族](drawer/README.md) | 右侧有蒙层；三尺寸、双底栏、关闭三态；六组原稿修改，未验收 |
| Upload | [上传家族](upload/README.md) | 7 种形态、62 主变体、图片卡五态、上传入口四态；内容与批量数量可配置，未验收 |
| Switch | [switch](switch/README.md) | 20状态 |
| Tag | [tag](tag/README.md) | 20基础外观/主题组合 |

除Checkbox外均未获用户验收，不加✅。实际回读、字体与微小几何差异见本轮报告（内部验证资料未随公开包分发）。未支持的扩展不能通过猜测或笛卡尔积补齐。

详情基本信息已接通[只读信息组合](descriptions/README.md)：复用Template中标题＋标签/值结构（不是独立Descriptions家族），支持两列/跨列、长内容和状态隐藏。

[ImageViewer部分导入](image-viewer/README.md)：非图库缩略图3态、单图主布局；只读附件与大图草图入口已接通。其余类型/状态见完整覆盖清单。

[Timeline部分导入](timeline/README.md)：垂直左对齐同侧布局和对应四态；日志字段、动态行高、末项规则及草图入口已接通。其它主布局/子项见完整覆盖清单。

[反馈部分导入](feedback/README.md)：三个发布Empty来源，compact已接通列表/记录/附件空态；Alert仅danger图标标题1/52，页面失败＋重试已接通。隐藏关闭为业务组合判断，其余51态未支持；未用户验收。

[只读状态补充](readonly-states/README.md)：多行、时间、数字、单选所需7个禁用变体已接通。
[多选选项](multi-option/README.md)：10/10源选项态、停用Checkbox一致化、参数化弹层和草稿已验证；用户验收待定。

全库后续补齐以 42家族持续覆盖清单（内部验证资料未随公开包分发） 为准，部分实现不计完成。

[InputNumber 数字输入框](input-number/README.md)：24源变体、独立调整状态、工作台／抽屉／状态草稿、苹方与镜像已验证；用户验收待定。

[Input完整家族](input/FAMILY.md)：118源变体加独立Focus，复用基础母组件；密码、多行、标签、草稿与苹方已验证，用户验收待定。

[Select完整家族](select/FAMILY.md)：32输入、单／多选各10选项态、20数量配方，草稿及苹方已验证；待用户验收。

[TimePicker完整家族](time-picker/README.md)：25源变体、4种用途与左右时间单元活跃覆盖、草稿及苹方已验证；待用户验收。

[Cascader级联选择器](cascader/README.md)：74独立状态、48数量/层级配方、草稿和苹方已技术验证；规范缺少已填多选禁用态，用户验收待定。

[Transfer部分导入](transfer/README.md)：完整源盘点已保存；额度已恢复，当前11/18主组合已构建；按业务优先级暂缓，家族构建和验证未完成，不可计为支持。

Transfer新增离线开发预览（参数数量、左右内容、树层级、搜索/分页展示、明确策略的移动结果）。Figma导入仍部分完成，编译器禁止将开发节点用于Figma出稿；见[Transfer](transfer/README.md)。
Upload新增独立离线开发预览，复用62源状态选择器；不影响既有表单上传。独立草稿到Figma仍待验证，见[Upload](upload/README.md)。

后续按业务影响优先级（内部验证资料未随公开包分发）推进：暂停全量顺序导入，低频能力保留缺口并按真实需求恢复。

2026-10-20 规范源各家族新增“结构解析说明板”，已抽取并与本目录逐家族核对，见说明板对照（内部验证资料未随公开包分发）。组件集未漂移；草稿内容页签容器按整栏 normalTabs 修正；Tabs 整栏、Pagination、Tag、Dialog、Alert、Transfer 仍为部分覆盖，Steps/Notification/Popconfirm 未导入。颜色以本地颜色样式为准（Gray7=#8B8B8B），说明板与组件数据冲突处列为待UI确认。

V1.4.0：Badge/Collapse/List/Progress/Statistic 已纳入，具体入口与未完成的新文件迁移见 [组件说明](../docs/verified-components.md)。本表较早版本的“未纳入”记录由该范围说明更新。

V1.5.0已补齐[Button](button/README.md)的回执迁移、工作台与抽屉底栏。未完成扩展按原说明隔离，不以Button发布扩大其他组件能力。

V1.6.0已纳入Form工作台/抽屉、密码及单选按钮组字段、长内容与恢复，详见[Form](form/README.md)。独立Upload另批完成。
