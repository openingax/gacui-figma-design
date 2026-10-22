# Figma 出稿：已确认草稿 → 可编辑设计稿

本文适用于V1.2.0，出稿能力始于0.4.6。产品经理确认草稿版本并明确要求出 Figma 后，agent 按本页把草稿生成为团队出稿文件中的可编辑画板：使用已导入的规范组件实例，不是截图或静态图片。产品经理只需对话，以下命令由 agent 执行。

## 适用范围

- **出稿目标**：已导入本版本所需组件库的团队出稿文件。出稿代码按节点引用其中的组件，`scripts/figma/target.mjs` 会核对全部依赖。目标链接向维护者获取，仓库不保存；没有导入组件的新建空文件不能直接使用，见下文“其他文件”。
- **页面类型**：草稿支持的工作台（查询、列表、详情、页签、反馈、时间线、图片查看等）与右侧抽屉表单，以及草稿中的状态画板和确认对话框。本版本新增入口及隔离边界以 [草稿能力表](draft-component-capabilities.md) 为准，部分家族只部分支持，缺口照常列出。
- **账号与工具**：当前 Figma 工具需要能查询身份、读取文件、执行 Plugin API 写入和截图。账号对出稿文件需要编辑权限。只有读取或导出图片能力时不能出稿。

## Agent 执行步骤

1. **核实身份与目标**：查询实际登录账号，读取目标文件确认可访问。用户没给目标时只问这一项；规范源 `jNf9icrxfw8B7QkSQa9g33` 只读，脚本会拒绝把它当目标。
2. **适配核对（每台电脑首次、版本升级后各一次）**：
   ```sh
   node scripts/figma/target.mjs status
   node scripts/figma/target.mjs plan <目标文件链接> > .local/target-plan.json
   node scripts/figma/target.mjs check-code <目标文件链接> <批次索引> > .local/target-check.js
   ```
   先创建 `.local/`。按 plan 的 batches 顺序，对每个 index 生成并执行只读代码，保存工具返回的真实 JSON；不能只执行默认第0批。将 plan 原有字段与 `receipts: [各批真实回执]` 合并保存为 `.local/target-receipt.json`，再执行：
   ```sh
   node scripts/figma/target.mjs receipt <目标文件链接> .local/target-receipt.json
   ```
   本版本检查1152个依赖，分4批（每批最多300）。指纹包含有序ID和预期类型；旧版本回执、缺批、重复批、错误目标/类型/ID集合均拒绝。只读回执证明节点存在及新增主组件类型，不证明编辑权限、字体、视觉、素材或业务验收。身份与写入权限仍按第1步核实，实际出稿需第6步回读和截图。禁止手写成功回执绕过检查；自动测试的 mock 不可用作真实连接。通过后写本机 `.local/figma-pages.json`，不提交；依赖更新须重新适配。
3. **确认草稿**：用户明确确认具体版本后，按 `status` 返回的 hash 执行 `confirm`。接受建议不等于确认。
4. **记录出稿请求**：用户明确要求出 Figma 后执行
   ```sh
   node sketch/sketch.mjs figma <草稿目录> <已确认版本> <Page名称>
   ```
   Page 名称建议“任务名-日期”。不存在时出稿自动新建；含非出稿内容的 Page 一律拒绝写入。
5. **逐个生成画板**：
   ```sh
   node sketch/figma.mjs plan <草稿目录>
   node sketch/figma.mjs code <草稿目录> <画板ID> --out .local/<画板ID>.js
   ```
   按 plan 顺序把每段代码原样交给 use_figma；抽屉画板依赖其背景页面，须先生成背景。单段超过 50000 字符会被拒绝，此时拆分草稿页面，不要手工删改代码。
6. **检查回执与截图**：回执需 `status=created`、`complete=true`，且 `semanticErrors`、`missingTexts`、`brokenInstances`、`unsupported` 为空；同名画板已存在时返回 `exists`，不会重复生成。记录 pageId、boardId，实际查看截图后再汇报。
7. **字体**：规范字体为 PingFang SC。云端缺少时临时使用 Noto Sans SC，回执 `fontFallback` 会写明。告诉用户在 Figma 桌面端把临时字体替换为苹方后复核，不能宣称已完全还原。

## 修改与边界

- 出稿只写新建或仅含出稿画板的 Page；不删除、不发布库、不改共享权限、不发评论。
- 草稿修改后保存新版本、重新确认、重新请求出稿。已有画板的原位修改需先回读、取得用户确认，不要盲目重跑。
- 生成的是静态可编辑设计，不含真实接口与交互逻辑；业务验收由产品经理决定，视觉验收由 UI 决定。

## 其他文件

使用自己的新文件，或文件中没有导入组件库时，走 [Agent 引导的 Figma 接入](figma-adapter.md)。该路径目前只自动初始化基础按钮，不能生成完整页面。
