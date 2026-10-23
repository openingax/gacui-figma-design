# 本机项目日志与诊断

V1.2.6 新增项目范围的客户端 hooks。它记录当前项目的用户提交、公开最终回复及可观察工具事件；不会采集内部思考，不读取历史 transcript，不自动修复或执行日志文字。未收到工具事件不能证明没有调用工具。Skill 安装/升级不自动注册 hooks，也不改变现有日志开关。

## 安装与关闭

在运行目录执行，project 是用户实际工作的项目绝对目录（可以与 Skill 运行目录不同）：

```sh
node support/hooks/configure.mjs install --project <项目绝对路径> --client codex
node support/hooks/configure.mjs status --project <项目绝对路径> --client codex
```

Claude Code 使用 `--client claude`。只合并项目 `.codex/hooks.json` 或 `.claude/settings.local.json`，保留原配置并保存私有备份；不改全局配置、信任设置或日志偏好。Codex 必须在客户端审核信任 hook 后才会执行，项目配置也需要被当前运行时加载。安装成功不等于实际收到事件；`status` 只检查配置。

WorkBuddy 仅提供 `render` 候选配置；未证明桌面项目配置加载与正常登录后的完整事件，不自动安装。不同客户端/版本不能互相代替实测。

采集沿用 `node support/cli.mjs auto-upload off` 开关；关闭或 basic 模式均不采集新的 hook 内容。原本开启详细模式的项目沿用原授权；确需开启时由用户明确选择 `node support/cli.mjs auto-upload on --project-authorized`。不能为运行探针静默改变正式偏好。测试应使用隔离 GAC_SUPPORT_HOME/GAC_SUPPORT_CONFIG。

卸载：

```sh
node support/hooks/configure.mjs remove --project <项目绝对路径> --client codex
```

只移除本安装器对应事件的注册，保留其他 hooks、用户新增配置及日志。命令含本机绝对运行路径，不进入 Git。运行目录移动后在新目录重新安装并核对；不要复制其他电脑的配置或凭据。

## 查看诊断与绑定草稿

```sh
node support/hooks/report.mjs report --project <项目绝对路径>
node support/hooks/report.mjs report --project <项目绝对路径> --html <新的本机报告.html>
```

报告使用白名单摘要，不复制原始对话、用户姓名、设备信息、绝对路径或 Figma 文件标识。原始当前事件在本机 `GAC_SUPPORT_HOME/hook-events/` 下受限保存，默认30天、2000条、128MiB；诊断中的事件 ID 用于复核。缺失/未知保留，直接拒绝只是候选，不能当成已确认根因。无宿主事件 ID 的重复消息无法可靠去重；无轮次 ID 且并发输入时保持关联未知。

尚未选择草稿时事件保持 unbound，不伪造 taskId。明确原草稿后可绑定当前客户端会话（session ID 来自实际回执/客户端会话详情）：

```sh
node support/hooks/report.mjs bind --project <项目绝对路径> --client codex --session <真实会话ID> --target <项目内原草稿目录>
node support/hooks/report.mjs flush --project <项目绝对路径>
```

绑定要求已存在 versions.json，不能改绑另一草稿。历史已采事件和之后的当前会话事件映射成已有 v2 日志并进入队列，重复重放幂等。hook 本身不联网；绑定不等于送达，现有 Figma 日志命令或显式 flush 才上传。只以逐事件 ACK 确认送达；关闭偏好仍优先。未绑定事件只在本机保留，不进入草稿统计。

维护者可用 `node support/diagnose.mjs <已有日志目录> [taskId]` 排查已上报记录；本机报告的 `--data` 可显式指定日志目录。不要将原始诊断 JSON 当作公开摘要。

## 出稿关联和恢复

按 figma-logging.md 记录 request/started，取得 workflowId；本次 request/preflight/initialize/generate/verify 全部复用它。普通状态查询、规划完成或下一次出稿成功不能清除其他工作流的阻断；缺少 workflowId 的旧历史保持证据不足。只有同一流程且目标、确认版本匹配的 verify/completed 才能记录技术恢复，用户验收独立。

## 验证边界

客户端支持、项目配置加载、回调触发、最终文字采集、任务绑定、排队和服务端收件是分别验证的环节。实际运行记录随发布任务保留。认证过期/模型不可用只证明相应错误及已触发事件，不代表正常业务流程验证通过；同事电脑尚未接入。

### 本次本机实测

2026-10-23：桌面捆绑 Codex CLI 0.163.0-alpha.11.2 已收到真实 UserPromptSubmit/Stop/PreToolUse/PostToolUse/SessionStart/SessionEnd；最终回复及单次工具非零退出均已捕获。PATH 中旧 Codex CLI 0.137.0 与当前模型接口不兼容，不作通过依据。Claude Code 2.1.304 只证明请求/会话事件触发，OAuth过期导致正常回复未验证。WorkBuddy 5.9.0内置CLI能触发请求/Stop，但返回登录提示；桌面加载及正常业务未验证，不开放自动安装。日志关闭偏好保持不变；上述采用独立测试存储，不上传正式采集服务。

范围按真实 cwd 限定；可识别的工具 file_path/path 指向项目外时，省略该工具输入与结果。Shell 等通用命令无法可靠判断输出源头，不能承诺内容来源均在项目内。仅宿主 event_id/tool_call_id 能可靠识别重复交付，turn_id 仅用于轮次关联。同一交付ID但事实不同会记录身份冲突，不覆盖原事件。

Codex有两层独立信任：项目层和具体hook定义。`-c projects...trust_level`临时参数不等于项目层已获信任。当前项目的既有信任未修改，已实测安装后自动发现并触发；探针仅对本次审查过的hook使用一次性信任参数，不修改用户全局信任配置。
