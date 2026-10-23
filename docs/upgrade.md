# 新版本提示与升级引导

每次新会话先 sync。AI 必须把版本检查结果转成用户可见的中文提示，不把 blocked 当作可以默默略过的日志。

示例：

> 发现 GACUIAgent 新版本：0.4.6 → 1.2.4。新版补充了组件与出稿能力，并完善升级提示。这次跨主版本，需要重新核对 Figma 目标依赖；会保留现有草稿和日志设置。现在升级（推荐），还是本次稍后？

具体变化以本次 update.summary 和目标 CHANGELOG 为准。不得把示例当作所有版本的固定说明。

- `update` 提供 current、target、latest、summary、requiresAcceptance、status 和 args。CLI 同时输出中文 stderr 提示；stdout 保持 JSON。AI 必须在对话里转述，不假设用户能看到工具输出。
- 跨系列先展示再询问。用户已说“升级/更新”不重复询问；直接按所展示版本的 args 执行，期间不开始业务生成。`--upgrade-to` 限定本次目标但不固定未来更新；`--version` 仍保留历史的安装并固定语义。
- 接受后重新 sync/status 检查实际版本和 commit；展示 notice 后再 ack。同系列仍可自动更新后展示变化。
- 稍后只作用于本次会话，不写 pin、不 ack 尚未安装的版本；下次使用仍提醒。
- 固定版本必须先说明固定状态，用户明确选择解除后 unpin。离线、本地修改、未知来源仍保留现场，禁止 reset、clean 或强制覆盖。
- 新版说明读取失败时明确说明并重试，不拿当前旧版的 notice 充当新版本说明。

## 已安装 GitHub 0.4.6 的同事

旧入口是保存在同事电脑上的代码。发布本版不能远程修改它，也不能保证旧 AI 会遵守新增说明。需要一次性把下面这段交给正在使用旧 Skill 的 AI；这不是要求用户自己操作终端：

> 请更新 GACUIAgent Skill。我同意从 0.4.6 跨版本升级，并完成已有的 GitHub 到 Gitee 原位迁移。请先检查本次实际 Skill 入口和原 workspace，展示版本变化；保留草稿、配置和日志关闭设置。遇到固定版本或本地修改先说明，不擅自解除或覆盖。迁移后从同一入口复查实际版本和来源，未成功不要说更新完成。

AI 执行步骤：

1. 从实际旧入口运行 `node <原Skill目录>/scripts/manage.mjs sync --workspace <原workspace>`，记录 version/latest/blocked/pinned。没有明确跨版本授权先按上文询问；有固定版本仍需单独确认解除。
2. 从发布仓库的目标标签读取 `skill-release.json` 与 CHANGELOG，展示变化。旧 GitHub 当前最新为 1.2.2 桥接版，不能说这是 Gitee 的最终最新版。
3. 用户接受后从同一旧入口运行 `sync --accept-breaking --workspace <原workspace>`。检查已达到桥接版且没有 blocked；不加 `--version`，避免意外固定而阻止迁移。若已有已授权的固定选择则保持它并说明未完成迁移。
4. 阅读运行目录 `docs/gitee-migration.md`，按其步骤执行 `scripts/distribution/migrate-gitee.mjs --workspace <原workspace> --entry <原Skill目录>`。仅修复本次已核实的入口，不覆盖其他 agent 的安装。
5. 从原入口再次 sync；迁移脚本会将复制入口改为委派给原运行目录的新管理器，因此未来更新能使用新逻辑。软链接入口也会随运行目录更新。核实 Gitee 来源、实际最新版本、无 blocked、草稿原件和日志偏好保留。展示更新说明后 ack，之后继续用户业务。

如果仍使用复制安装的旧 SKILL.md，AI 应读取运行目录最新 SKILL.md 并执行其规则；可在确认原 workspace 与迁移入口后更新当前 agent 的 Skill 安装说明。不要直接新装到默认目录再宣称原任务已迁移。

没有用户机器实际调用的证据时，只能报告已发布或已验证升级路径，不能报告同事已经升级或已经看到提示。
