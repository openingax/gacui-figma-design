# GitHub 老用户切换到 Gitee

V1.2.2 是一次性桥接版，不是迁移完成状态。用户说“更新 Skill”时，AI 在同一次请求按以下步骤执行，不要求用户手动重新安装。

1. 保留旧入口 sync 返回的准确 workspace，以及本次实际调用的 Skill 目录（含 scripts/manage.mjs 的目录）。不要猜测其他 agent 的安装位置，不覆盖其他入口。
2. 在运行目录执行：

```sh
node scripts/distribution/migrate-gitee.mjs --workspace <原运行目录> --entry <本次实际Skill目录>
```

3. 从原入口再次执行 `node <本次实际Skill目录>/scripts/manage.mjs sync --workspace <原运行目录>`，确认 repository/origin 是 Gitee、版本至少 V1.2.3。用户已有关闭设置会沿用；不要为了验证而开启日志。
4. 展示 notice 后用同一入口 `ack --version <实际版本> --workspace <原运行目录>`，再报告更新完成。后续正常更新从 Gitee 拉取。

迁移在同一个 Git 运行目录快进，Gitee 目标历史包含 GitHub 桥接提交。不复制或重建 tasks、private、.local、.env、用户级日志配置与凭据。只修改 origin、Skill 状态和已核实的安装入口管理脚本。入口原文备份为 scripts/manage.mjs.pre-gitee-backup。软链接到运行目录的入口直接使用更新后的管理器。

固定版本不会自动解除；有代码修改/本地提交、入口脚本未知修改、非受管目录或未知来源时保留现场并说明原因。0.x 用户仍需遵守跨主版本确认规则，不自动越过。迁移失败可检查原因后重复同一命令；旁边的 .gitee-migration.json 保存恢复进度，不能删除记录来绕过核对。

新 Gitee 用户仍使用 ~/.gacuiagent-gitee/workspace；迁移用户沿用 ~/.gacuiagent-public/workspace 或其原自定义目录。复制入口保存原目录委派关系；自定义 workspace 的软链接用户继续显式传 --workspace。同一机器多个旧入口若共享运行目录，只迁移本次入口；其他入口需由维护者核对后重新安装 Gitee 入口并指定该运行目录，不能混用迁移记录。

这次会修改 GitHub 公开 Skill 和个人 Gitee 公开 Skill；不涉及任何公司内部仓库。日志采集范围和关闭方法见 docs/support/README.md，保持原有设置。
