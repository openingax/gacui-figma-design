# 业务组合（V1.1.0）

复用现有Dialog/Table/Descriptions、TimePicker/Button和Loading。静态可编辑设计不实现保存、请求、动画或业务事件；技术验证不代表用户验收。

## Dialog业务内容

`dialog.children` 可放 `table` 和 `descriptions`，同时使用时纵向排列。有children时message可省略。Descriptions使用title/items/columnCount；表格须完整非空data，列支持text/textTag/state/operations。内容表格不支持分页、空/错误反馈、loading或tag列，明确拒绝这些配置。普通宽480–960或全屏；组合容器16px间隔为设计判断。

结构化Dialog仅将新建实例解除关联为FRAME以承载内容，不修改母版。原文字确认Dialog保持INSTANCE。`updateComposedDialog` / `updateDialogContent` 支持同主变体、同内容ID/类型及相同行列/字段结构下的文案修改；先回读副本及其父画板，禁止操作母组件。不把新增字段/列/行冒充已验证的原位更新。

## 可增删时段组

工作台/抽屉使用 `type:"timeRangeGroup"`，`title`、`items:[{id,value:[开始,结束],disabled?}]`，可选min（默认0）/max（默认不限）/disabled/format（H:mm或H:mm:ss）/width（420）/inputWidth（280）/addLabel/removeLabel。

`changeTimeRangeGroup(spec,{type:'add',item})` 或 `{type:'remove',id}` 返回新spec；拒绝重复ID、越界数量和禁用操作。将结果存为新版本或状态patch，线框用状态切换表达增删，不提供业务按钮事件。数量来自需求，不默认3段，不擅自禁止跨午夜或重叠。

Figma `updateTimeRangeGroup(figma,root,next,deps,previous)` 保留未删除行；同格式非空值只改文字，空值/禁用改变可重建该行输入副本，行ID保持。调用前须回读并提供原spec，deps沿用plan/code的timeGroupDeps；禁用Button切换可能改变内部文字ID，实例ID保持。只支持收起区间，展开面板用独立timePicker。

## 表格区域Loading

工作台 `table.loading` 为true/false或 `{active:true,size:'medium',variant:'spinner-text',label:'加载中...'}`。size支持small/medium/large，variant支持spinner/spinner-text/text；spinner不传label。false仍创建可开关容器；省略沿用原表格入口。

`updateTableLoading(figma,region,spec)` 使用plan中的mainId，仅操作 `表格区域/…` 副本；修改前用inspectTableLoading回读。覆盖表格与其反馈区，分页、查询和其它块在外。遮罩填充复用表格源填充，不透明居中是设计判断。关闭隐藏遮罩而保留表格节点；首次打开新增遮罩，后续开关不重复创建。

## 适配与限制

安装本版本不是目标授权。先查询身份、核实目标，按docs/figma-output.md逐批检查并接受真实回执；1.0.0旧指纹不再适用。未适配时拒绝code。源只读、受保护节点不修改，已有稿先回读，禁止重复创建。复杂组合仍受48000代码门禁限制；本轮空表首次加载独立验证，不承诺与时段组等任意组合都能单次生成。云端Noto Sans SC为临时字体，PingFang SC仍是规范字体。

Timeline等未完成扩展继续隔离。本版本使用stable通道。1.0.0可兼容升级，原草稿保留，依赖指纹变化后须重新核实目标。发布和安装检查不代表跨机器或用户验收。
