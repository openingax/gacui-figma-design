# Form 校验字段

从活跃源实例`48066:516561`提取7种可编辑状态：default/error/warning/success文字反馈，以及success/error/warning图标反馈。目标组件集`156:79`。

构建：`node scripts/form/build.mjs form-validation all`。使用方式和目标检查与form-top相同。说明文字暴露TEXT属性；各状态的源标题不同，保留各自标题，不绑定会覆盖差异的统一默认文字。业务修改通过实例内label/title图层定位。

success文字状态绿边框，success图标状态灰边框；不得擅自统一。400宽字段的左标签及右状态图标在外部，父级必须预留左右空间。4种提示原文字自适应仍分别保留，母组件没有伪称已支持自动业务校验。

7种状态77节点回读通过（浮点容差0.0001，样式ID按本地映射检查），源必填星号宽8、临时Noto宽7。截图已检查；未用户验收。源和目标证据见`evidence/form-validation/`。

Form组合的长内容适配会为外置标签修改继承约束；Figma禁止在INSTANCE里覆写此约束，因此需要本地化为FRAME并使用返回的新ID。标准7状态仍保持主组件，长内容验证帧与之分开。详情见Form家族入口。
