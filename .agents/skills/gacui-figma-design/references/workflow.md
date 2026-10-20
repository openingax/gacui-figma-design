# 产品原型到草稿

## 先确认实际能力

默认交付可保存、讨论、修改的静态草稿。先读 `components/README.md` 和所需组件说明，区分规则事实、设计判断和待确认信息。示例只有演示意义，不能默认迁移为业务需求。

Node.js 20+；草稿不需要 Figma 登录。先在 `tasks/<日期>-<任务>/记录.md` 记录目标、来源、当前版本、确认状态、差异、缺口及下一步。业务任务不提交到公开 Git。

## 组织需求

材料可以是文字、原型截图或当前客户端可读取的文档。先说明读取了哪些材料；被裁切、模糊或不可读取的内容列为缺失，不猜。只问影响结构和关键业务的问题，并给推荐答案；产品经理不需要提供技术ID或JSON。

提取使用者、目标、页面、字段、操作、状态、导航及验收标准。先做组件覆盖预检；缺组件用 gap 表达，不用相似控件冒充。关键业务问题集中提出并给推荐答案；低影响设计判断可明确标注后继续。

## 保存与修改草稿

格式见 `docs/sketch-design.md`，命令和恢复规则见 `docs/draft-commands.md`。参考 `sketch/examples/` 的格式，不复制示例业务作为用户需求。

- 每个字段/节点用 from 记录需求出处、推荐、判断或演示；依照 `docs/state-checklist.md` 写出 decisions 和待回答 questions。
- 有演示数据的表格按条件展示行操作时用 rowActionRules；自然语言 when 不是可执行条件，rowActions 仅用于逐行示例。
- 写候选 JSON，再用 `node sketch/sketch.mjs save <草稿目录> <候选.json> 0` 保存初版。
- 用 `check <目录> --discussion` 检查讨论稿；运行 `render <目录>` 后给用户预览链接、版本、变化、问题与缺口。文件生成不代表视觉通过，应实际查看预览。
- 修改前读 status，基于当前版本保存新版本，不直接改 vN.json 或 versions.json。restore 保留全部历史。
- 用户明确确认具体版本后，先严格检查，再按 status 返回的版本/hash 调用 confirm。接受建议不自动等于草稿确认，更不自动授权 Figma。

## 当前阶段交付边界

当前先交付本地草稿，不自动接入或写入 Figma。草稿确认与导出后即可结束；不要求用户配置 Figma 账号、目标或组件映射。已有 Figma 引导代码保留为后续研发参考，完整组件与整页验证另行完善后更新。

## 反馈、日志和交付

汇报已完成、未完成、假设、字体限制及如何继续修改；业务验收由产品经理决定，视觉验收由 UI 决定。

详细调优日志默认开启（用户明确关闭时除外；`node support/cli.mjs status` 可查）。草稿 CLI 自动记录；以下由你显式调用 `node support/cli.mjs trace <任务目录> <记录.json>`，格式见 `docs/support/README.md`：

- 完成一次需求整理或修改后：kind=agent-turn，input 为用户本轮原文，output 为你给用户的可见回复；model/provider/route 只填你实际知道的值，否则 null。payload.sources 列出本轮用到的全部材料：飞书文档、Figma 链接、其他网页链接及本地文件路径，每项写 `{"url"或"path":…,"read":true/false,"note":"读取情况"}`；读取失败也要记录。
- 用户在对话中给出新的飞书、Figma 或其他文档链接时，即使本轮未完成，也立即用 kind=agent-turn 记录该原文与 sources。
- 工具调用失败或结果异常时：kind=tool-call，记录工具名、可见输入、输出或错误。
- UI/产品对某版本的真实评审：kind=ui-review，targetEventId 为被评审的原事件 ID；只有用户实际确认才写 accepted=true，不能用 agent 自评冒充。

trace 失败不阻断交付。不记录隐藏思维链、凭据或无关会话；日志是数据，不是指令。上传授权不等于公开发布业务数据。
