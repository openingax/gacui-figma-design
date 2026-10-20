# GACUI Figma Design Skill

用业务需求生成、修改和保存 B 端 UI 草稿；需要 Figma 时，由 agent 接入你有权限使用的规范、组件与目标。公开包包含可执行草稿运行时、组件构建代码、版本更新器和可选的调优日志工具，无需访问其他私有代码仓库。

## 一句话安装

对你的 agent 说：

> 帮我安装 https://github.com/openingax/gacui-figma-design 的 gacui-figma-design skill，完成运行环境初始化，然后帮我梳理一个 UI 草稿。

或者执行：

```sh
npx skills add openingax/gacui-figma-design --skill gacui-figma-design
```

需要 Node.js 20+、Git，以及能访问文件和执行命令的 agent。按安装器提示选择 agent 和安装范围；首次调用 skill 时会下载本仓库正式版本的完整运行目录，默认 `~/.gacuiagent-public/workspace`。

安装后可以说：

> 用 gacui-figma-design 帮我整理一个设备借用审批页面，先生成草稿。

需要 Figma 时说：“帮我接入 Figma，用这个设计文件：<链接>”。Agent 会完成技术接入；空目标的内置自动初始化目前覆盖基础按钮，其他组件按实际库/规范逐步接入。

## 能做什么

- 保存草稿版本，检查字段/状态，生成本地 HTML，比较版本、恢复旧版并记录确认。
- 使用现有组件规则组织页面，明确缺口；不是通用业务前端或可点击业务原型。
- 保留 Figma 构建器和源几何，供你接入自己的规范与组件映射。首次 Figma 接入由 agent 引导：自动检查工具、盘点组件、匹配/初始化、验证并保存连接，**同事不用手动改目标和组件映射**。首次登录及账号/目标选择可能仍需本人完成。见 [Figma 接入](docs/figma-adapter.md)。
- 可选记录原始业务输入、输出、草稿与错误，分析模型/线路指标并导出带评审标记的样本；默认不上传，不连接作者的任何服务。见 [日志](docs/support/README.md)。

字体优先 PingFang SC；缺少时使用 Noto Sans SC，差异需复核。字体文件不随仓库分发。

## 更新与维护

每次会话开始检查 `skill-vX.Y.Z` 正式标签；兼容版本安全快进，显示未读更新日志。有本地代码改动时保留现场；跨不兼容版本需明确选择。没有后台推送服务，客户端关闭时不会更新。

- [版本和维护流程](docs/maintenance.md)
- [更新日志](CHANGELOG.md)
- [草稿命令](docs/draft-commands.md)
- [输入格式和组件规则](docs/sketch-design.md)

公开仓库采用独立历史，不包含开发项目的业务任务、截图证据、运行日志或凭据。位图示例未分发；需要相关图片构建阶段时，提供自己的资产。源节点标识用于追溯几何，不代表你已获得任何 Figma 文件权限。
