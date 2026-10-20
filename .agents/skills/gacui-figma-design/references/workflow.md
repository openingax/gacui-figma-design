# 需求到草稿与 Figma

## 先确认实际能力

默认交付可保存、讨论、修改的静态草稿。先读 `components/README.md` 和所需组件说明，区分规则事实、设计判断和待确认信息。示例只有演示意义，不能默认迁移为业务需求。

Node.js 20+；草稿不需要 Figma 登录。先在 `tasks/<日期>-<任务>/记录.md` 记录目标、来源、当前版本、确认状态、差异、缺口及下一步。业务任务不提交到公开 Git。公开 skill 不自动接入任何日志服务。

## 组织需求

提取使用者、目标、页面、字段、操作、状态、导航及验收标准。先做组件覆盖预检；缺组件用 gap 表达，不用相似控件冒充。关键业务问题集中提出并给推荐答案；低影响设计判断可明确标注后继续。

## 保存与修改草稿

格式见 `docs/sketch-design.md`，命令和恢复规则见 `docs/draft-commands.md`。参考 `sketch/examples/` 的格式，不复制示例业务作为用户需求。

- 每个字段/节点用 from 记录需求出处、推荐、判断或演示；依照 `docs/state-checklist.md` 写出 decisions 和待回答 questions。
- 写候选 JSON，再用 `node sketch/sketch.mjs save <草稿目录> <候选.json> 0` 保存初版。
- 用 `check <目录> --discussion` 检查讨论稿；运行 `render <目录>` 后给用户预览链接、版本、变化、问题与缺口。文件生成不代表视觉通过，应实际查看预览。
- 修改前读 status，基于当前版本保存新版本，不直接改 vN.json 或 versions.json。restore 保留全部历史。
- 用户明确确认具体版本后，先严格检查，再按 status 返回的版本/hash 调用 confirm。接受建议不自动等于草稿确认，更不自动授权 Figma。

## Figma

仅在明确请求后阅读 `docs/figma-adapter.md`，执行 agent 引导接入。用户只确认账号和目标（已知则复用）；agent 负责 start、盘点/库发现、匹配、缺失组件初始化、校验实例、回读和截图，技术 JSON 全部由 agent 维护在 .local。

已有 ready 连接先 verify-code 复查后复用；失效由 agent reset 并重新接入。不要让产品或 UI 填 fileKey、节点 ID、映射文件或 adapterVerified。

新连接默认使用 agent-native 原生组件组合，不调用依赖历史内部基线的旧 code 路径。根据需求按需扩展实际组件角色；未支持项明确说明。复杂页面仍需 agent 按规范组织和截图验收。人工改过的节点先比对现稿，只改明确范围。

## 反馈、日志和交付

汇报已完成、未完成、假设、字体限制及如何继续修改；业务验收由产品经理决定，视觉验收由 UI 决定。

用户明确启用日志后，可以通过 trace 记录本任务原始输入、可见输出和实际可获得的模型/线路指标，UI 反馈关联原输出 ID；未知指标填 null。不获取隐藏思维链或无关客户端历史，不把日志上传授权当公开发布业务数据授权。
