# Agent 引导的 Figma 接入（后续阶段研发参考）

当前0.3.0交付聚焦本地草稿。本文保留0.2.0已实现的部分接入路径，不是当前产品/UI同事使用草稿的前置步骤，也不代表完整组件及整页链路已经完成。

产品经理和 UI 同事只需说：

> 用 gacui-figma-design 帮我接入 Figma，使用这个设计文件：<链接>，然后开始整理需求。

不需要填写节点 ID、组件 key 或改配置文件。Agent 负责检查工具、身份、文件与库，匹配组件，创建校验实例、回读并查看截图，保存本机连接。已有连接会先复查后复用。

首次登录 Figma、开启客户端集成，以及多个账号/目标的选择仍可能需要使用者完成；agent 只询问缺少的业务选择。权限不足不能靠本地脚本解决，也不能把只读工具当可写工具。

## Agent 执行流程

所有技术文件由 agent 写到 `.local/`，不交给产品经理编辑，不提交公开仓库。使用当前环境真实的 Figma 工具及其操作约定，不假定不同客户端工具名/参数相同。

1. **环境与授权**：检查是否有身份查询、文件读取、Plugin API 写入、截图能力。登录后查询实际账号；有多个可用账号才询问一次。复用用户已有目标；用户授权新建且工具可用时创建新文件。源规范只读，不能擅自把规范文件当出稿目标。
2. **建立连接**：写请求 JSON（targetUrl、可选sourceUrl、accountId、用户已有authorization依据），运行 `node scripts/figma/connect.mjs start <请求.json>`，保存返回 sessionFile。所有后续命令使用同一 sessionFile。
3. **已有连接**：status=ready 时先执行 verify-code 返回的只读代码。核对当前账号仍符合本次选择；失效时用 reset 归档旧配置并重新盘点，不让使用者修节点 ID。
4. **发现组件**：先看 Code Connect 和现有页面实例；再读目标已添加的库，限定适用的规范库搜索实际所需组件。不要为了找到结果改用无关风格的库。通过 inspect-code 在各个已观察到的 Page 上只读盘点，返回结果交 inventory 保存；按 nextOffset 分页到完成。库搜索返回的 componentKey/componentSetKey 可交 library-code 导入并盘点真实变体，再交 inventory 保存。
5. **自动映射**：根据业务角色和实际目录写 requirements（role/name/variant），调用 match。只有精确且唯一的候选自动采用；多个候选由 agent 根据规范回读确认后 choose，不让同事面对技术 ID。缺失的组件由 agent 按规范构建或明确列为缺口，不能猜映射、把近似控件当已支持。
6. **空文件初始化**：没有合适组件时，可用随包已验证配方自动初始化基础按钮。scope-code 建立独立 Page，scope-receipt 保存真实回执；seed-plan 给出阶段；每阶段 seed-code 输出真实构建代码，交工具执行，再用 seed-receipt 保存工具回执。当前内置初始化只覆盖中尺寸基础纯文字按钮12态；其他家族不因此视为已自动初始化。已有同名集合先盘点复用，不能重跑创建重复集合。同一目标正在被其他人初始化时先协调；本机连接文件不是跨机器锁。
7. **真实验证**：probe-code 创建校验实例，probe-receipt 保存并校验真实回读；获取截图并实际查看后，visual-receipt 记录 frameId、passed、截图位置 evidence、观察 observations。只有此后才是 ready。临时字体必须说明，不能代用户做设计验收。
8. **开始出稿**：新连接使用原生组件模式，agent 用 bindings 组合业务页面。compose-code 支持实例布局与按真实文字层名覆盖文案；更复杂页面由当前 Figma 工具按实际组件/样式组合，依旧需要需求核对和截图验收。edit-code 先检查原文，再原位修改；发现人工修改会拒绝覆盖。新增业务角色按需增量盘点与验证。

有明确 safeToRetryWithoutCanvasRead 的工具失败遵循工具返回；结果不明先回读，不能盲重跑初始化阶段。任何工具返回报错都不能作为成功回执。

## 命令与数据（仅供 Agent）

```sh
node scripts/figma/connect.mjs start .local/request.json
node scripts/figma/connect.mjs inspect-code <session.json> .local/page-query.json --out .local/inspect.js
node scripts/figma/connect.mjs inventory <session.json> .local/真实盘点回执.json
node scripts/figma/connect.mjs match <session.json> .local/requirements.json
node scripts/figma/connect.mjs probe-code <session.json> --out .local/probe.js
node scripts/figma/connect.mjs probe-receipt <session.json> .local/真实写入回执.json
node scripts/figma/connect.mjs visual-receipt <session.json> .local/截图检查.json
```

page-query：`{"pageId":"实际页ID","offset":0,"limit":30}`，读规范源时加 source=true。先不传pageId可列页面；不能猜页ID。

requirements：`[{"role":"primary-action","name":"实际组件或组件集名","variant":{"实际属性名":"实际取值"}}]`。输入来自需求与盘点；没有固定业务默认状态。

库导入：`library-code <session> <asset.json>`，asset 为 `{"type":"component_set","key":"工具返回的真实componentSetKey"}` 或 type=component。跨文件未发布组件可能无法导入，agent 应使用规范构建路径或说明缺口。

组合：`compose-code <session> <layout.json>`；layout 示例 `{"id":"业务操作区","direction":"HORIZONTAL","gap":16,"items":[{"role":"primary-action","text":{"实际文字层名":"查询"}}]}`。id 应包含本任务标识，避免不同业务任务重名；间距依据当前规范，复杂多区块仍由 agent 规划。

修改：`edit-code <session> <edits.json>`；edits 为 `[{"instanceId":"真实实例ID","layer":"真实文字层名","before":"已回读原文","after":"新文案"}]`。直接提供未知属性不会替代实际工具检查。

## 与旧构建器的关系

这是独立的 `agent-native` 接入路径，不会写 `adapterVerified=true` 伪装旧 `sketch/figma.mjs` 所需的历史画板/完整依赖已经迁移。旧路径继续保留给已完整适配的项目。新接入默认不要调用旧 code 入口。

连接的 ready 只证明本次已映射角色通过读写与截图检查，不代表整份组件库或所有业务页面已验收。字体优先 PingFang SC；云端不可用时如实记录 Noto Sans SC 临时替代。
