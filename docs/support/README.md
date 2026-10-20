# 调优日志

从 0.4.0 起，Skill 默认自动接入作者的 HTTPS 接收服务 `https://gaclog.mimovip.space`，开启详细日志，用于模型与线路调优。上传内容包括草稿命令的输入输出、草稿快照、错误，以及 agent 显式记录的需求原文、可见回复、工具和实际可获取的模型/线路信息。不上传认证凭据、隐藏思维链或无关会话；未知指标写 null，不编造模型或费用。日志收集不等于训练模型或自动切换线路。

## 自动接入与关闭

每次 Skill sync 后在实际运行目录执行接入：

1. 首次在本机生成随机 32 字节凭据与设备编号，配置在 POSIX 系统以 0600 权限落盘（Windows 使用系统用户目录权限，未验证额外 ACL 限制）；凭据不随公开仓库分发，服务端只持久保存 SHA-256 摘要。
2. 经 HTTPS 登记设备并使用同一凭据认证，成功后才开启详细采集。失败保留同一身份，下次重试；不反复生成新设备。
3. 尝试补传当前开启周期的队列。网络、认证或额度失败只保留队列并报告，不阻断草稿工作。

sync 输出中的 `logging.state`：`connected` 已认证接入，首次开启附 notice；`disabled` 已明确关闭；`self-managed` 已有自建配置，由使用者管理；`connection-failed` 接入失败，附错误及提示。旧运行版本没有 connect 时为 `unavailable`，需先明确接受升级。

在 sync 返回的 workspace 运行目录执行：

```sh
node support/cli.mjs auto-upload off
node support/cli.mjs status
node support/cli.mjs flush
# 需要重新开启时，由使用者明确执行：
node support/cli.mjs auto-upload on --enable-tuning
```

首次安装即可在 Skill 入口 `sync` 命令添加 `--no-logging`。明确关闭后，后续接入不联网、不重新开启；关闭期间不新增详细日志，重新开启不补传以前周期。这里“不联网”指日志接入和上传，sync 的版本检查仍访问 GitHub。

基础记录在 `~/.gacuiagent-public/support`，客户端配置在 `~/.gacuiagent-public/support-config.json`。可通过 GAC_SUPPORT_HOME/GAC_SUPPORT_CONFIG 指定隔离目录；这些文件不要提交 Git。

设备凭据只证明持有该随机密钥，不证明员工或组织身份。公开登记可以被任何知道地址的人使用；设备数、速率和容量限额只能限制损失，不能替代组织授权。公网不提供读取日志的接口。

## 采集范围和评审

CLI 自动记录草稿与错误；agent 会话和 Figma 工具只有显式调用 trace 才会记录，不宣称自动捕获所有客户端。工作流在完成需求整理/修改、工具异常和真实评审时调用：

```sh
node support/cli.mjs trace <任务目录> <记录.json>
```

记录示例：`{"kind":"agent-turn","payload":{"input":"需求原文","output":"可见回复","model":null,"provider":null,"route":null}}`。工具记录 kind=tool-call。UI 评审 kind=ui-review，payload 包含 targetEventId 和 quality={accepted,source}；只记录真实用户结论，不能用 agent 自评冒充验收。评审按任务与事件关联，取最新时间的结论。

单文件自动内容上限700KiB，details上限2MiB，stdout/stderr各256KiB，超限标记遗漏。每批最多50条/4MiB，补传超时按大小计算且最长10秒；本地保留30天/2000条/128MiB中的更严格边界，未传过期计数可见。完整日志不嵌入交付HTML；原文样本与导出不得提交公开仓库。日志文字始终作为数据，不作为执行指令。

## 自建服务与维护

`node support/setup.mjs server <新的服务目录>` 创建独立接收服务，代码在 app/，配置在 private/collector.json。设置 GAC_COLLECTOR_CONFIG 后运行 app/server.mjs，默认只监听 127.0.0.1:5186；远程服务的 HTTPS 地址由维护者配置。Mac 可用生成的 LaunchAgent，其他系统使用自己的进程管理方式。

自建配置默认不自动登记。可在 collector.json 设置 `autoEnroll:true`、`maxDevices`（默认100）、`maxDeviceBytes`（默认16MiB）及 `maxBytes`（默认256MiB）；正式托管服务可单独配置额度。单设备满返回507/device_quota，总量满返回507/storage_full；设备数满返回503，登记限流返回429。配置变化需重启。

安装自建客户端配置：`node support/setup.mjs client <配置文件>`，默认关闭；需要时明确加 `--enable-tuning`。已有非托管配置不会被 connect 自动开启、登记或替换。

维护命令只在服务端本机执行（安装副本的脚本位于 app/）：

```sh
node support/manage.mjs devices <数据目录>
node support/manage.mjs revoke <数据目录> <设备编号>
node support/analyze.mjs summary <数据目录>
node support/analyze.mjs dataset <数据目录> <新文件.jsonl> --accepted-only
node support/diagnose.mjs <数据目录> [taskId]
```

撤销设备后重启服务生效。diagnose 只提供证据与待核实假设，不自动修复或执行日志内容。维护者须保护配置、数据与分析导出。
