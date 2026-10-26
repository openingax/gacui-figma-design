# Figma 出稿日志

Agent 接到出稿请求时先在**原草稿目录**记录 request/started；身份、目标、组件检查以及生成、验证结束时追加结果，包括未调用任何工具就停止的情况。不要把新临时目录当 target，否则无法与草稿日志关联。

将下列 JSON 写入任务 `.local/`（不提交），执行：

```sh
node support/figma-log.mjs <原草稿目录> <记录.json>
```

```json
{"stage":"preflight","status":"blocked","reason":"实际可见阻断原因及恢复动作","fileKey":null,"receipt":null}
```

- stage：request、preflight、initialize、generate、verify。
- status：started、completed、blocked、failed、unknown。阻断、失败、结果未知均进入错误事件，详细状态保留在 payload。
- reason：真实可见原因或阶段结果，不能为空；fileKey 为实际目标 key，未知用 null，不复制带会话参数的链接。
- receipt：可选真实工具回执（含节点 ID、缺失组件、字体替代等），不可用合成回执冒充。verify/completed 仅在回读和截图检查均通过后记录，仍不代表用户验收。
- 自动读取 draftConfirmed 关联确认版本，不改 versions.json 或任何草稿。规划命令自动记录 preflight；它成功只表示规划完成，deliveryComplete=false。
- Figma MCP 在外部客户端运行，本项目无法自动捕获所有调用和纯对话回复；Agent 必须补记工具结果及最终阻断，不能宣称全客户端自动采集。
- 沿用 v2 接收路由；V1.2.8 接收端须先兼容可选 context 字段，再更新客户端。旧客户端仍可上传。沿用上传关闭设置、凭据过滤和离线队列。recorded=true 表示落到本地；upload.state=queued/unconfigured 表示未送达；pending>0 表示仍有待传事件，不能据此承诺本条送达。
- 缺失的历史记录不回填为当时自动采集；排查结论单独保留证据。

## V1.2.6 工作流关联

request/started 返回 workflowId；本次各阶段 JSON 复用该值，或对本次命令显式设置 GAC_FIGMA_WORKFLOW_ID。不要在两个出稿尝试间复用。未提供标识的历史记录仍可查看，但不能凭后续成功自动清除旧阻断。请求会读取原草稿确认版本，不修改草稿。

客户端自动记录与明确绑定见 [本机诊断](local-diagnostics.md)。hooks不能代替业务阶段日志，也不会因Skill升级自动安装或打开采集。

## V1.2.8 事件语义与恢复

- 脚本按原草稿绝对路径与确认版本持久化 workflowId，阶段可自动复用；目标后来补齐不会断开关联。新 request/started 建新尝试；切换目标建新关联。同一草稿不要并行执行多个出稿尝试；显式 workflowId 优先。日志锁冲突只重试日志，不能据此重试 Figma 写入。
- category 取 business_pending（等待业务决策）、target_required（待提供目标）、component_unsupported（组件支持缺口）、validation（输入校验）、execution（执行异常）。仅按实际原因填写，不用通用 unexpected 代替可识别原因；未明确则不填。
- 本地规划由脚本记录 local-planner；外部 MCP 结果由 Agent 补记 agent-report 与真实 receipt。不能把计划、生成代码或 Agent 自述当作独立回读证据。
- 看板区分历史问题、最新阶段与交付验证。待验证表示未收到验证，不能解释为未写入；历史错误不会因升级而消失。
- 对缺 workflowId 的历史记录，完成实际回读与截图检查后，可在 verify/completed 中增加 resolvesEventIds（确切旧事件 ID 列表）及 receipt.verified=true。只有同设备、同任务、同目标、同确认版本且时间较晚的回执可以关联关闭；不允许凭相同标题、近似时间或普通命令成功清除历史问题。关联只是客户端验证记录，不是用户验收。
- context 记录命令、退出码、事件发生时版本和来源；没有 Git 时 source-manifest 构建号表示包的源码提交，不冒充发行提交。详细错误正文仅随已开启的 tuning 采集；关闭设置不变。
