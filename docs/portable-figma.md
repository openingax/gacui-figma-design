# 空白 Figma 文件：按需初始化与出稿

用户给出自己可编辑的空白 Design 文件（包括 Drafts）即可进入接入流程。不要因“没有预先导入组件”直接拒绝，不要求用户复制旧测试文件。先核实当前账号、目标授权、Plugin API 写入和截图能力；规范源始终只读。

## Agent 流程

1. 读取真实草稿 `status`，使用用户已确认的版本。用户已经确认的 v5 不需要重建或另存为 v1；不可改写旧快照或伪造确认。仅在用户已明确要求出 Figma 后，用 `node sketch/sketch.mjs figma DRAFT VERSION PAGE_NAME` 记录出稿请求。
2. 创建本机 `.local/`，执行 `node scripts/figma/portable.mjs plan DRAFT TARGET > .local/portable-plan.json`。规划先检查整个任务的构建数据、目标保护与工具长度限制。缺数据、缺位图资产、未适配组件集等必须报具体缺口，不能改成“所有空白文件都不能用”，也不能自动删减业务需求。
3. `node scripts/figma/portable.mjs setup-code .local/portable-plan.json` 生成代码，交给 `use_figma`。它复用或创建独立的 `GACUI · 本文件组件` Page 和必要颜色样式，保留默认 Page 与现有业务内容。保存真实返回的 `pageId`。
4. 按 plan.assets 的索引顺序执行 `node scripts/figma/portable.mjs asset-code .local/portable-plan.json PAGE_ID INDEX`，每段原样交给 `use_figma`。将每批真实返回对象保存为 `.local/portable-receipts.json` 数组；同一资产再次返回 `reused` 时更新原条目，不追加重复项。不要手写成功回执。
5. `node scripts/figma/portable.mjs check-code .local/portable-plan.json .local/portable-receipts.json` 生成只读复核代码并执行；核对目标、主组件类型、包装节点归属、版本标识和节点数量。
6. `node scripts/figma/portable.mjs code .local/portable-plan.json DRAFT .local/portable-receipts.json BOARD_ID` 输出整页代码，按 plan.boardIds 的依赖顺序交给 `use_figma`。写入前还会再次回读组件，随后在任务独立 Page 生成页面。`exists` 只表示同名画板存在，必须回读，不能据此报告设计通过。
7. 检查 `complete`、缺失文字、语义错误、损坏实例与未表达项，实际查看截图。保留目标链接、映射、回执、截图与字体替代说明。任务文件原位修改后复查，设计质量由用户验收。

组件初始化不会读写草稿。计划/生成也不修改 `versions.json`、vN 或确认哈希。切换目标时重新规划，保留各文件独立回执；同一文件新增需求先计算新增依赖，复用已初始化资产，不全库导入。

## 实现与恢复

- `portable-index.json` 将旧运行时的编译引用对应到项目 `build-data.json` 的源节点；旧数字仅是兼容编译符号，不向新文件查询这些旧 ID。编译时只替换生成器引用与依赖字段，业务文本即使恰好是 `107:86` 也不替换。
- 初始化使用项目精确节点/矢量数据和共享构建器，运行时使用目标回执的真实 ID。工作台结构由代码创建，不克隆旧测试文件的整页基线。业务菜单取当前需求，不复制旧工单菜单。
- 颜色样式同名但不同值时停止，不覆盖目标已有样式。字体优先 PingFang SC；云端缺少时使用 Noto Sans SC 并明确报告。没有位图字节的资产不以空框冒充。
- 每个资产有确定的包装名称和构建数据哈希，只有完成后才去掉 `building` 标记。遇到未完成包装、重名、回执缺失或类型改变时停止该批；按工具 `safeToRetryWithoutCanvasRead` 回读现场，仅清理此次返回 ID 范围内的残留，再恢复。不能盲目重跑，不能把部分初始化标为完成。
- 当前真实验证覆盖单页查询、主/描边按钮、页签、输入、选择、文字/操作表格、长名称及分页；不是整个组件库或所有变体的验收。当前大组件超过单批50,000字符、组件集级引用、位图资产未适配会在规划阶段明确阻断。既有目标的旧路径保留兼容；新文件路径不解除这些真实能力边界。

## 维护

编译索引由维护端从规范构建数据审核生成，发布包不需要历史导入回执。回归命令：`node tests/portable-figma.test.mjs`、`node tests/figma-logging.test.mjs`、`node tests/draft-store.test.mjs`。


## 出稿日志闭环

用户请求 Figma 后，按 `docs/support/figma-logging.md` 在同一草稿目录记录 request；每个阶段结束及交付前记录实际结果。**即使没有调用工具、只是对话中判断无法继续，也必须先记录 blocked 和可见原因**。工具超时记 unknown，回读后再追加结果，不把未知当失败重试。规划/生成代码成功不等于 Figma 出稿成功。尊重日志关闭设置，日志异常不阻塞业务；不得编造遗漏的历史事件。
