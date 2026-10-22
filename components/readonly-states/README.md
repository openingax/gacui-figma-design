# 只读禁用状态补充（部分导入）

沿用已有Form字段入口，disabled:true时自动使用精确源状态。Textarea自动增高1/40；单时间空/填充禁用2/16；中尺寸双侧数字空/填充禁用2/16；普通Radio已选/未选禁用2/5。完整类型和未实现状态见evidence/readonly-states/*-inventory.json；不宣称四个独立家族完整支持。

来源、原需求重跑和范围见docs/existing-states-20261014.md。原始快照保持精度与矢量网络，构建时使用Noto临时替代PingFang SC。

构建：node scripts/readonly-states/prepare.mjs → python3 scripts/lib/prepare-copy.py readonly-states 采集日期；build.mjs生成start、nodes:0至5、vectors:0至1、finish脚本，依次执行并合并mapDelta到state.json，最后group.mjs按控件分集并在最终父级恢复源变体名称。不能把四类不同属性集合混作同一变体集。目标限定当前授权测试页；历史映射不能用于其他文件。

只读值修改保持禁用，字数和已有值不清空；normal/invalid/submitting仍沿用旧实现。Radio按每项f.disabled||option.disabled处理，不改变业务值。本批真实表单11态已执行，含只读空值和300字内容；静态视觉不代表事件/键盘防编辑已实现，尚待用户验收。
