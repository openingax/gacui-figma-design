# GACUIAgent Skill

新增业务组合用法见[业务组合说明](docs/business-compositions.md)。

版本：V1.1.0。支持范围和已知限制以随包文档为准。

根据业务需求和公司 B 端 Figma 规范，由 agent 生成**可编辑的高保真设计**。完整流程是：产品需求、原型文档或截图 → 可保存、预览、讨论和持续修改的 UI 草稿 → 按规范组件生成可编辑的 Figma 设计稿。产品经理和 UI 同事通过对话使用，不需要写 JSON、运行命令或手动配置。

“需求/原型 → UI 草稿”无需任何 Figma 配置即可使用；草稿确认后，可让 agent 在团队出稿文件中生成可编辑 Figma 设计稿（0.4.6 起，见 [Figma 出稿](docs/figma-output.md)）。

## 一句话开始

对你的 agent 说：

> 帮我安装 GACUIAgent Skill：执行 `npx -y skills@latest add openingax/gacui-figma-design --skill gacui-figma-design -g -y --copy -a <你当前的agent名称，如 codebuddy>`，装好后按 skill 说明运行 sync，然后根据我接下来提供的需求或原型（可以贴飞书文档、Figma 链接或截图）整理一份 UI 草稿并打开预览给我看。

需要直接安装命令时使用（agent 环境没有键盘输入，必须带 `-y`，否则会停在交互选择界面）：

```sh
npx -y skills@latest add openingax/gacui-figma-design --skill gacui-figma-design -g -y --copy -a <agent>
```

- `-a <agent>` 填当前使用的 agent，例如 `codebuddy`；只装给它，避免铺到几十个目录。省略时会装给全部已支持的 agent，个别 agent 不支持全局安装会让命令以失败结束，需在 `--json` 结果中确认本 agent 已成功。
- `--copy` 复制实体文件而不是建软链接。

需要 Node.js 20+、Git，以及能读取材料和执行命令的 agent；环境检查由 agent 完成。完整运行资源来自本公开仓库，不需要其他私有代码仓库或额外 AI API。

## 使用过程

1. **提供材料**：需求文字、原型截图、客户端可以读取的文档，说明主要使用者和目标。
2. **生成草稿**：agent 整理页面、字段、操作和状态；不明确的关键规则会集中询问，并给出推荐答案。
3. **查看预览**：打开本地 HTML，切换页面/状态，查看待决策项和组件缺口。
4. **一句话修改**：例如“增加必填申请人，其他内容不变”；保存新版本，可对比和恢复历史。
5. **确认与交付**：明确确认某版后记录确认状态，导出该版本的只读预览。草稿确认后本阶段即可结束。
6. **生成 Figma（可选）**：对 agent 说“把这版草稿出成 Figma，目标文件是 <链接>”。首次会核对账号和目标文件中的组件，然后逐个画板生成可编辑设计稿并截图检查。

详细说明见 [产品与 UI 使用指南](docs/draft-first.md)。公开示例包含 [演示原型](examples/draft-first/产品原型.md) 和两轮草稿数据，用于理解输入与修改流程。

## 当前边界

- 草稿是静态讨论成果，预览中的业务控件不连接真实接口；页面/状态/版本切换用于评审，不等于完整交互原型。
- 使用已有组件表达能力；没有的结构会明确列为缺口，不把近似控件说成已支持。
- 读不到的原型工程文件或被裁切的截图会提示缺失，不会假装已完整读取。
- 只在你明确要求时出 Figma；出稿目标需已导入团队规范组件库（向维护者获取链接），没有组件库的新文件目前只能初始化基础按钮。云端缺少苹方时会临时用 Noto Sans SC，需在 Figma 桌面端换回后复核。
- **默认开启详细调优日志**（见下文），用于改进模型与线路；不需要你配置或申请令牌。

## 版本、维护与日志

每次会话检查正式版本，兼容更新安全快进，显示更新说明；本地改动受保护。

**日志默认开启。** 首次使用时，你的电脑自动生成独立的随机凭据，通过 HTTPS 向维护者的接收服务 `https://gaclog.mimovip.space` 登记，之后自动上传：需求与草稿命令的输入输出、草稿快照、错误，agent 记录的可见对话、用到的飞书/Figma 等文档链接、工具和模型信息（未知项为空），以及使用者与设备资料（系统用户名、主机名、Git 姓名/邮箱、系统、agent 客户端）。不上传认证凭据、隐藏思维链或无关会话。上传失败只在本机排队，不影响草稿。

不想上传时对 agent 说“关闭日志”，它会在运行目录执行 `node support/cli.mjs auto-upload off`；之后的会话不会重新开启。首次使用前就不想上传，可用 `node <skill目录>/scripts/manage.mjs sync --no-logging`。

- [更新日志](CHANGELOG.md)
- [维护流程](docs/maintenance.md)
- [草稿命令](docs/draft-commands.md)
- [调优日志说明](docs/support/README.md)

字体优先 PingFang SC，缺少时使用 Noto Sans SC。业务任务与原始材料留在本机，不提交公开仓库。
