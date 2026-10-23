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
- 兼容当前 v2 接收端的 tool-call，不需要升级服务器。沿用上传关闭设置、凭据过滤和离线队列。recorded=true 表示落到本地；upload.state=queued/unconfigured 表示未送达；pending>0 表示仍有待传事件，不能据此承诺本条送达。
- 缺失的历史记录不回填为当时自动采集；排查结论单独保留证据。

## V1.2.6 工作流关联

request/started 返回 workflowId；本次各阶段 JSON 复用该值，或对本次命令显式设置 GAC_FIGMA_WORKFLOW_ID。不要在两个出稿尝试间复用。未提供标识的历史记录仍可查看，但不能凭后续成功自动清除旧阻断。请求会读取原草稿确认版本，不修改草稿。

客户端自动记录与明确绑定见 [本机诊断](local-diagnostics.md)。hooks不能代替业务阶段日志，也不会因Skill升级自动安装或打开采集。
