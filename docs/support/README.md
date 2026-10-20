# 可选的调优日志

公开版默认不上传，不附带接收服务地址或凭据，也不继承其他组织的会议授权。使用者可以配置自己的服务，明确启用详细日志后记录业务原文、草稿、公开输出、错误和实际可获取的模型/线路指标；认证材料排除。没有测量的指标写 null，不编造模型或费用。

基础运行记录在 `~/.gacuiagent-public/support`。客户端配置在同目录上一级的 support-config.json，只包含自己服务的 endpoint/token；不要提交到 Git。

可在本机创建独立接收服务：`node support/setup.mjs server <新的服务目录>`。服务代码在 app/，配置在 private/collector.json；设置 GAC_COLLECTOR_CONFIG 后运行 app/server.mjs，默认只监听 127.0.0.1:5186。Mac 可按生成的 LaunchAgent 管理，其他系统用自己的进程管理方式。新配置中的 endpoint 默认是本机地址，远程地址由你配置。

- 安装自己的客户端配置：`node support/setup.mjs client <配置文件>`，默认保持关闭。
- 显式启用详细采集：`node support/cli.mjs auto-upload on --enable-tuning`；关闭：`auto-upload off`。
- 查询：`node support/cli.mjs status`；补传：`flush`。
- 对话/模型/工具/线路/评审：`trace <任务目录> <记录.json>`，格式 `{ "kind":"agent-turn", "payload":{"input":"需求原文","output":"可见回复","model":null,"provider":null,"route":null} }`。
- UI 评审用 kind=ui-review，payload 包含 targetEventId 和 quality={accepted,source}；只有实际确认才写 accepted=true。
- 统计：`node support/analyze.mjs summary <数据目录>`；样本：`dataset <目录> <新文件.jsonl> --accepted-only`。

CLI 自动记录草稿与错误；其他 agent 会话和 Figma 工具只有在显式调用 trace 时记录，不宣称自动捕获所有客户端。隐藏思维链和无关会话不采集。采集日志不等于训练模型或自动切换线路。

单文件自动内容上限700KiB，details上限2MiB，stdout/stderr各256KiB，超限明确标记遗漏。每批最多50条/4MiB，限时补传；本地保留30天/2000条/128MiB的更严格边界，服务器默认256MiB。未传过期计数可见。关闭期间不新增详细日志，重新开启不补传以前周期。完整日志不嵌入交付HTML；原文样本和导出不得提交公开仓库。
