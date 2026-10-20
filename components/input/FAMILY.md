# 输入框家族调用

基础40、Focus1、密码32、多行40、标签6均有可执行实现，用户验收待定。详细验证见导入记录（内部验证资料未随公开包分发）。

`family-dependencies.json`提供5种family及每项真实variant名称，不做笛卡尔积扩展。调用`renderInputField(figma,parent,spec,deps,existing?)`，其中spec含id、family、variant，可选value、placeholder、tips、prepend、append、width、limit。文字必须为字符串。选择的变体决定视觉状态，值不会暗中改变变体。

输出是从母组件派生的可编辑Frame，保留源矢量、字体样式与布局。相同变体的existing保持文字ID；切换变体重新生成，不能把Frame当成可在属性面板切换的Instance。原始组件集本身可正常选择变体。源码参数化遮罩长度，不限制为源样例5点。业务密码仅使用演示值。

草稿使用`type:"inputField"`与同一spec，可置入工作台或抽屉，状态patch可改variant/value等。旧Form字段尚未全量迁移。

新包构建：`node scripts/input/build.mjs input-password|textarea|input-addon STAGE`；依赖映射：`node scripts/input/dependencies.mjs`。已有目标不可重跑start/nodes/finish。独立范例见`evidence/input/family/gallery-specs.json`。
