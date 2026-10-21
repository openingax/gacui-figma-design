# 草稿保存、恢复与交付

这些命令由 AI 执行，产品经理只需对话。目录沿用 `tasks/<日期>-<任务>/草图`。无需 Figma 或额外 AI API。所有命令均在项目根目录执行，以下是命令格式，尖括号需替换。

## 创建与修改

先将本轮候选数据写到任务目录的 `候选.json`，不要直接编辑已保存的 vN.json。

```sh
node sketch/sketch.mjs save <草稿目录> <候选.json> 0
node sketch/sketch.mjs status <草稿目录>
node sketch/sketch.mjs save <草稿目录> <候选.json> <预期最新版本>
node sketch/sketch.mjs check <草稿目录> --discussion
node sketch/sketch.mjs render <草稿目录>
node sketch/sketch.mjs diff <草稿目录>
```

首版预期版本为 0；后续先读 status，再按实际最新版本保存。过期基线会被拒绝，重新读取后决定如何修改，不盲目重试。首版没有差异基线，无需 diff。候选通过结构及各状态检查才能保存；讨论稿允许清单未覆盖和问题待回答，预览会列出。save 与 check 会在 stderr 提示“未知属性”：这些键不会被预览或检查读取（常见于拼写错误或放错层级，如 `rowActionRule`、`visibel`），提示带节点路径和最接近的有效名称。看到提示要改正后另存新版本；目前只提示不阻断。候选顶层还应写 `request`（本轮需求原文和飞书/Figma/文档链接、截图路径），缺失或链接未列入 sources 时同样提示。

任务记录从第一轮建立，至少含目标、来源、已知/假设、草稿目录、当前版本、确认版本、未决项、下一步。换会话先读记录和 status；多任务无法确定时询问目标。预览生成后重新打开或刷新，不宣称自动刷新。

## 版本与确认

```sh
node sketch/sketch.mjs label <目录> <版本> <方案名称>
node sketch/sketch.mjs star <目录> <版本> true
node sketch/sketch.mjs restore <目录> <旧版本> <预期最新版本>
node sketch/sketch.mjs confirm <目录> <版本> <status返回的hash>
```

restore 从旧版本复制成新版本，历史不变。label/star 只修改版本索引。

只有产品经理明确确认具体草稿版本后才调用 confirm；测试中的模拟确认必须标注为测试。该命令要求清单结论完整、问题已回答、延期项有范围影响说明。存在 gap 时，还需要 `handling` 和 `acceptedFrom: "产品:<确认出处>"`，表示产品已接受本轮缺口处理，不意味着组件已实现。没有用户依据不得补造该字段。

确认绑定版本和内容摘要；外部改动会使确认失效并阻止后续写入。继续修改产生未确认的新版本，原确认版本保留。`draftConfirmed` 与旧 Figma `confirmed` 分开；草稿确认不调用 Figma。旧目录的数字 draftConfirmed 没有对应摘要时显示需重新确认，不能假定有效。

## 导出与分享

```sh
node sketch/sketch.mjs export <目录> <指定版本> <新文件.html>
```

只导出指定版本的只读预览，不含其他历史快照，不覆盖已有文件。本人完整预览用 render。预览包含所选版本的问题、结论、演示数据等内容，发送前需核对；工具不自动上传或发送。继续编辑需保留完整草稿目录及任务记录，HTML 不是完整备份。

## 中断与损坏

版本文件排他创建；索引通过临时文件替换。两个文件并非一个事务。如果快照已保存、索引未更新，status 会报告“未登记快照”，此时其他写入拒绝。

1. 查看 status、快照实际内容和基线，确认这是本轮候选。
2. 执行 `node sketch/sketch.mjs recover <目录> <未登记版本> [基于版本]`。已有更早版本时必须填写基线。
3. 再读 status、render 和 diff；recover 不确认任何版本。

若进程被强制结束留下 `.draft-write.lock`，维护者须先确认没有其他写入进程，再移除锁文件；工具不自动抢锁。索引损坏、历史文件被改动或缺失时停止写入，从已保留的原文件恢复，不猜测历史。历史证据摘录可以只读，但不能写入或当成完整备份。

## 按需交接 Figma

用户明确请求后，核实所选版本、实际账号、目标授权和组件依赖（`scripts/figma/target.mjs`），再用 `node sketch/sketch.mjs figma <目录> <已确认版本> <Page名称>` 记录出稿请求；它只接受通过内容核验的草稿确认版本，写入 `confirmed`、`figmaPage`。完整步骤见 [Figma 出稿](figma-output.md)。草稿确认不自动迁移到出稿确认；转换支持范围仍由 `sketch/figma.mjs` 限定。所有缺口继续保留，不能将草稿业务确认当作高保真验收。

## 条件字段

`visibleWhen` 指向同页字段路径。单值用 `{field:"review/decision/result", equals:"驳回"}`；多个离散值用 `{field:"review/decision/result", oneOf:["驳回","退回补充"]}`。两者互斥，oneOf不能为空或含重复值。没有默认选择时条件不匹配；显式 `visible:false` 仍保持隐藏。此能力只控制静态状态表达，不执行真实业务规则。保存、检查与渲染都会验证默认页及状态页。

全新会议室预约场景的选型、两轮修改与验证证据见新需求验证记录（内部验证资料未随公开包分发）。该场景保持未确认，不代替真实产品经理试用。

草稿命令支持详细调优日志，公开Skill按安装流程自动登记和开启，网络失败保留队列且不阻断保存。上传内容、接收服务及关闭方法见[调优日志](support/README.md)；可用 --no-logging 或 auto-upload off。预览的反馈入口可发送或离线下载诊断包。

## 任务交接

任务创建、索引、阶段更新及跨机器同步统一遵循任务跟踪流程（内部验证资料未随公开包分发）。同步完整 versions.json 和所有 vN.json；单份预览、最新一版快照或聊天摘要均不能代替完整草稿目录。
