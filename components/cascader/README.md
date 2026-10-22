# Cascader 级联选择器

源46236:328290，8集122变体：30输入、44单/多选父子选项、40数量配方、8层级配方。完整证据见导入报告（内部验证资料未随公开包分发）。技术验证通过，页面待用户验收。

`family.mjs`提供validateCascader、renderCascader、renderCascaderMenu、updateCascaderOption。依赖由`node scripts/cascader/dependencies.mjs`生成，复用既有Divider。输入参数：id、multiple、prefixIcon、open、disabled、state(normal/hover/focus)、value（单选字符串、多选字符串数组）、width（默认280）、columnWidth（默认200）、columns。列包含options与可选branch；选项label、state(normal/hover/active/select)、disabled、divider、indeterminate、branch。默认中间列为父级、最后列为子级，可显式覆盖。半选仅支持多选select。父子状态由调用方提供，必须与已选标签保持业务一致。

源缺少已填写多选的禁用态，两种前置图标组合均拒绝，不能以单选替代。禁用不叠加open或hover。保留源1–4条的占位块，不把样例数量当作业务限制；超过10条、4层可构建。长选项换行自适应、输入长路径按源裁切，多选标签数量由value决定，超宽裁切。

草稿独立type:cascader支持工作台、抽屉、状态patch和本地预览。生成静态可编辑设计，不处理业务树加载或自动勾选传播。旧Form未迁移。

目标606:2，输入607:2，单选子606:19056/父606:19122，多选子606:19205/父606:19312。不要重复导入；重建仅在确实缺失时使用scripts/cascader/build.mjs增量状态。草稿610:27，字体485文本已验证为苹方。
