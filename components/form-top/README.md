# Form 顶部字段

源 `25737:69520` 的11类型×required/help/tooltips三个开关，共88状态。目标按类型分成11个组件集，每集8状态；完整ID见definition.json。

构建：`node scripts/form/build.mjs form-top input`，将生成代码交给目标文件的use_figma。其余类型：select、datePicker、timePicker、inputPassword、inputNumber、textarea、checkbox、radio、radioButton、switch。入口只允许既定测试文件的Form页，同名组件存在即拒绝重复创建。生成代码返回sourceOrderMap，与selectedData中的非COMPONENT_SET节点顺序对应；持久化map后可运行`scripts/form/audit.mjs`。

实例优先使用“字段标题”“说明文字”TEXT属性；required/help/tooltips仍为源VARIANT属性。控件内文案按所属图层语义修改。原始尺寸/布局/矢量保存；内部控件实例当前本地化为可编辑图层，不承诺原型事件、源实例换件属性或整个Input/Radio家族迁移。

窄字段的说明可能超出逻辑宽度，状态集合用统一展示列宽容纳。数字输入源节点内还含外置“标题”，与顶部标题并存；作为源事实保留，不擅自删去。临时Noto使必填星号窄1px，其余已回读字段匹配（矢量浮点容差0.0001）。生成与视觉检查不等于用户验收。

源、目标、回读及截图见`evidence/form-top/`。长内容与表单组合验证由Form家族入口记录。
