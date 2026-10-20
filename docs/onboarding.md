# GACUIAgent Skill 首次接入

产品经理/UI只需提供业务材料并与 agent 对话，不需要手动执行本页命令。这些步骤由 agent 完成。

1. 安装 skill：`npx -y skills@latest add openingax/gacui-figma-design --skill gacui-figma-design -g -y --copy -a <当前agent>`（必须带 `-y`，无键盘环境下交互界面会一直等待）。运行其 scripts/manage.mjs sync，进入返回的 workspace；升级时查看版本更新说明。sync 同时在运行目录自动接入调优日志，结果在 `logging` 字段。
2. 检查 Node.js 20+ 与 Git。不需要统一 npm install、私有仓库权限、Figma 登录或额外 AI API。
3. 读取 AGENTS.md、docs/draft-first.md 和 skill 的 references/workflow.md。
4. 从材料整理页面与字段，建立任务记录，保存讨论稿并打开 HTML 预览。
5. 根据反馈保存新版本、检查和对比；用户确认后导出指定版本。本阶段到此即可交付。

可用公开演示检查本地运行能力：

```sh
node sketch/sketch.mjs save tasks/demo/draft examples/draft-first/v1.json 0
node sketch/sketch.mjs check tasks/demo/draft --discussion
node sketch/sketch.mjs render tasks/demo/draft
```

示例 v1 刻意保留取消规则待回答，不能直接确认。v2.json 是演示第二轮反馈后的候选，可用预期版本1保存为新版。

详细调优日志默认开启，见 [调优日志说明](support/README.md)；接入失败不影响草稿。不会自动连接 Figma；用户明确要求出稿时，再按 [Figma 出稿](figma-output.md) 核实账号、完成目标适配核对后生成。
