# Timeline 时间线

V1.2.0 开放已完成技术验证的 Timeline 扩展。线框和 Figma 都是静态设计，不提供真实日志或加载动画。技术检查不代替用户对业务和设计的验收。

草稿节点类型为 `timeline`：

```json
{"id":"history","type":"timeline","from":"判断","layout":"horizontal","align":"alternate","mode":"same","items":[{"id":"created","time":"2026-10-22","actor":"岗位","action":"创建","detail":"演示记录","color":"success","icon":"custom"}]}
```

- `layout=vertical` 时 `align=left/right/alternate`；`horizontal` 时 `align=top/bottom/alternate`。`mode=same/alternate`，共12种组合。
- 条目必须有唯一 `id` 及字符串 `time/actor/action/detail`；颜色为 `default/primary/success/warning/danger`，图标为 `loading/custom` 或省略。空数组显示暂无操作日志。
- 原位文案和颜色修改使用 `updateTimelineExtended`，保持条目ID、数量、顺序和图标类型。改变结构需要重新组织草稿并按已授权流程处理，不能把结构变化冒充原位修改。
- 横向每项至少120px是可读性设计约束；不够时明确拒绝，增加宽度或改用纵向。浏览器线框以符号代替图标；Figma使用库内矢量。
- 升级后运行目标适配流程，14个新增主组件需要真实只读回执。旧回执自动失效；本地测试的合成回执不能用于真实出稿。依赖检查不证明权限、样式、字体或视觉质量，正式出稿仍需核实身份与授权、回读和截图。
- 字体优先 PingFang SC；缺少时允许 Noto Sans SC 临时替代并披露。规范源只读，受保护页面不得改删。

保留旧垂直左对齐入口。Menu、Upload独立入口、Button扩展和其他未完成家族继续隔离，不因本版本发布而变为可用。
