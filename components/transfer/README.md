# Transfer 穿梭框（部分导入，禁止标为完整支持）

规范源46709:352686；完整快照2912节点、4集34变体、402活跃实例已保存。主组合18、控制器4、列表项4、数量配方8；活跃用途包含树结构、搜索、尺寸变化、左右移、保留源列表、长内容、数量增多及选择/悬停/禁用。

当前仅为构建断点，不能用于完整家族出稿：9个主组合已归组，第10个节点和矢量已写入但尚未finish，其余8个尚未构建。控制器和列表项各4态已生成，但未进行本批最终几何、苹方、修改和视觉验证。现已提供离线参数模型、显式移动策略和开发草稿入口；目标Figma参数内容更新器仍未验证，不能当作正式出稿能力。

目标页615:2，名称“Transfer 穿梭框（部分导入）”。执行能力在scripts/transfer/build.mjs；精确恢复顺序见断点报告（内部验证资料未随公开包分发）。不要重新执行已完成start/nodes阶段。当前构建使用临时Noto Sans SC，不能宣称苹方已验证。

## 离线参数化接口

`family.mjs` 导出 `validateTransfer(spec)`、`transferModel(spec, catalog)`、`moveTransfer(spec, direction, policy)` 和 `transferHtml(model, escape)`。catalog读取同目录recipes.json，源中18个组合及数量1–8的32px行高/4px间隔均由完整快照提取。超过8项按相同排版规则扩展，是参数化设计判断，不新增源变体。

source/target为 `{id,label,checked?,disabled?,state?:normal|hover,depth?}` 数组；ID稳定且每侧唯一。tree只表达明确输入的层级，不推断父子联动。retainSource要求目标为源的子集；已在目标的源项不可重复选择。search展示查询输入；有查询时显式传入filterPolicy=label-includes演示策略。pagination需明确pageSize/sourcePage/targetPage，不从样例推导页容量。width至少448；viewportHeight至少64，可滚动承载任意项数与长内容。

moveTransfer只处理平面列表，调用者必须传入 `{order:'append',selection:'clear-moved'}`；树移动明确拒绝，等待父子规则。无副作用，不修改输入。左右移动后的静态画面不证明真实产品交互。

草稿节点type=transfer，工作台/抽屉/状态patch均可预览。Figma编译器显式拒绝此开发节点，即使草稿被确认也不会静默遗漏。源没有树＋分页组合；双空态仅显示缺口草稿。低保真预览的颜色和折行策略为讨论用途，非像素验收。

运行 `node scripts/transfer/offline-gallery.mjs` 生成/更新开发画廊；保留草稿版本。证据在evidence/transfer/offline：38模型、39页面＋1修改状态、全页面DOM检查和长文案/抽屉截图。最终几何、字体、源实例差异与Figma原位文字修改仍待完成。

## 列表内容写入器（离线实现，未执行Figma）

`items.mjs` 的 `generateTransferItems(stage,target,spec)`生成创建/更新代码；spec为`{id,width,items,rootId?}`，items沿用上述稳定ID、label、checked、disabled、state。仅授权615:2测试页，源文件拒绝。复用已有四态母组件，不重复导入；同一业务项只修改文字时复用INSTANCE与label，换状态通过swapComponent；真实文字ID与几何仍须回读验证。

数量0/1/8/9/23、长文字、四种行状态、错误目标、缺少原位目标与超预算输入均有离线测试。超过45000字符明确拒绝，不能截断数据。零项只生成1px空内容容器，不代表源空态组件。字体保留并显式加载，不自动替换。创建失败只回收本次新容器；更新失败必须回读，不能盲目重试。

此接口仅解决列表内容，不假称已完成两侧外壳、头部复选框、搜索、分页和树的整体Figma适配。整个Transfer草稿编译仍拒绝。`usage-plan.mjs`已为38场景绑定源槽、4态列表/控制器与现有目标映射；后8个主组合的目标ID明确为空，不生成假ID。恢复额度后先验证列表单批与原位文字身份，再接外壳。

`active-usage.json`定位12类用途、13个顶层活跃样例，其中“保留源项”同时包括列表与树。选中态样例存在已选复选框/可用右移与“0项”并存；源事实保留，预览按输入算计数是设计判断。静态树预览不证明父子联动或移动规则。
