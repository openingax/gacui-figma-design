# Checkbox

原生成器保留 `item/unit/checkbox` 的七个已验收 16×16 元状态；新增 `family.mjs` 复用这些元件，覆盖带文字七态与可变数量分组。准确的属性名、状态组合、颜色、几何和排版规则见 `definition.json`。不要扩展出未定义的 hover、半选组合或交互，也不要添加 ✅。

按 `definition.variants[].name` 精确选择状态；未列出的组合应报告规范缺口。`bg` 是底框，`check` 是勾，`dash` 是半选块。默认不检索原始证据。

文字与分组使用普通自动布局容器组织，不生成「Checkbox 多选 / 多选组」组件：单项横排间距 8，16px 方框相对 22px 文字行下移 3；文字 Body/Medium，PingFang SC Regular 14/22，文字禁用色跟随方框。多项横排间距 16；数量和选中项由业务决定，数量由业务决定，已验证2–8项、9项与长文案；竖排和换行未在源规范出现，本接口不宣称支持。

元组件无文字。文字组合优先 PingFang SC，云端缺字时暂用 Noto；本批已在桌面恢复苹方并回读，替代字体不能算完全还原。

生成可直接作为 `use_figma.code` 的脚本（仅本地输出，不调用 Figma）：

```sh
node components/checkbox/generator.mjs TARGET_FILE_KEY PAGE_ID > /tmp/checkbox.use-figma.js
```

执行前必须取得明确目标文件及 Page 授权，并核对连接身份。已授权测试目标与验证结果见项目 `docs/checkbox-figma-validation.md`；目标已有同名组件集，勿重复生成。`fileKey` 传同一个目标文件；`skillNames` 使用 `figma-use,figma-generate-library`。生成器拒绝源文件、错误目标、不存在的 Page、目标 Page 内同名组件集（含已验收名称），以及重复或值冲突的同名样式。仅复用/建立四个被引用的本地颜色样式；Figma 样式属于文件级资源，调用者需确认该范围。不会删除或修改已有样式。

矢量使用全精度 `setVectorNetworkAsync`，不设置节点级圆角、不 resize 勾。需在真实 Figma 回读尺寸及 `fillGeometry` 并截图验证后才能确认还原通过。离线假对象只核对 API 写入及原始网络，不模拟真实几何内核。

三项横排用法示例：使用者自己的 Figma 目标（需配置）。框/文间距8，组间距16，文字22行高、方框y=3。该Frame仅展示组合规则，三项数量和选中顺序不是组件限制。


## 完整家族入口（2026-10-15）

`renderCheckbox(figma,parent,spec,deps,existing?)`，deps 见 dependencies.json。kind=single 时使用 label/checked/indeterminate/hover/disabled；kind=group 时 options 为带唯一 id、label 和同名状态的数组。半选必须 checked=true；禁用、已选与半选不允许 hover。width 为可用宽度约束，超出明确报错，不截断。

第五参数支持原位长文案和状态修改，要求选项 id/数量保持不变。全选联动由业务决定，本组件仅表达半选视觉，不把源示例的选中项当作规则。旧元件不重复导入；文字与分组为可编辑 Frame＋原元件实例，没有新增TEXT属性绑定。

草稿 `type:checkbox` 支持工作台、抽屉正文与 options/checked/indeterminate/disabled 等状态补丁；预览是静态业务示意。旧 Form checkbox 字段路径仍保留，不把独立入口的半选能力外推到历史表单。

21个源变体按7元状态＋7文字状态＋7数量组合完整覆盖，源无脱离集合的活跃母组件。131个本批文字节点已恢复苹方。家族技术验证通过，用户验收待定；历史✅仅指原元件与三项示例。验证记录（内部验证资料未随公开包分发）。
