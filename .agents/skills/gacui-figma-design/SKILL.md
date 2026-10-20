---
name: gacui-figma-design
description: 将产品需求、原型截图或可读文档整理为可保存、预览和修改的 B 端 UI 草稿；用于梳理草稿、根据原型生成草稿、反馈修改、版本对比、确认和导出。当前交付聚焦本地草稿，不要求 Figma 接入。
---

# GACUI 草稿助手

使用简体中文。首次调用或新会话开始，从本 skill 的真实路径运行：

```sh
node <本skill目录>/scripts/manage.mjs sync
```

完整运行资源来自公开仓库 `openingax/gacui-figma-design`，默认目录 `~/.gacuiagent-public/workspace`，不需要其他私有仓库权限。可传 `--workspace <独立路径>`；后续命令使用同一路径。

1. 读取输出 workspace 下的 `AGENTS.md`、`docs/draft-first.md`、`docs/onboarding.md` 和 `.agents/skills/gacui-figma-design/references/workflow.md`，在那里执行任务。相对路径均相对运行目录。
2. notice 非空时先向用户展示新版本、影响和操作，再调用 `ack --version <版本>`；未展示不确认。blocked 时保留现有文件，说明原因；离线可继续已安装版本。
3. 不在业务生成中途升级。有本地修改不覆盖；固定当前版本用 `pin --version X.Y.Z`，解除用 `unpin`；跨不兼容版本在用户选择后用 `sync --accept-breaking`。回退请用新目录安装旧版本。
4. 当前正式交付为“产品原型/需求 → 本地草稿”，不询问 Figma 账号、文件或映射，不因确认草稿自动继续 Figma。完整 Figma 接入留待后续版本；只有明确要求维护/测试该能力时才读取 docs/figma-adapter.md。
5. 日志默认不上传。只有用户要求配置日志时阅读 `docs/support/README.md`，不得沿用作者或其他组织的接收地址、凭据或授权。

维护代码和规则时读 `docs/maintenance.md`。普通出稿保留共享组件实现；缺口如实说明，不把样例内容当业务规则。
