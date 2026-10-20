# Form 表单家族

使用者自己的 Figma 目标（需配置）。来源为[Form规范示例](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=47967-523354)。当前完成可编辑静态组件与组合，**未用户验收**。

## 已实现范围

| 能力 | 实现 |
|---|---|
| 基础字段 | [form-field](../form-field/README.md)，4类型×help开关，共8状态 |
| 提示文字 | [form-help](../form-help/README.md)，default/error/warning/success，共4状态 |
| 顶部标签字段 | [form-top](../form-top/README.md)，11控件类型×required/help/tooltips，共88状态 |
| 校验字段 | [form-validation](../form-validation/README.md)，4种文字反馈、3种图标反馈，共7状态 |
| 表单布局 | 纵向left 14、纵向top 14、行内left 6，共34源组合；通过同一个字段数组组合函数生成 |
| 内容修改 | 11类顶部字段与7类校验的长标题/长说明真实修改验证；字段高度增长且互不重叠 |

11类为input、select、datePicker、timePicker、inputPassword、inputNumber、textarea、checkbox、radio、radioButton、switch。范围是Form字段外观，不等于密码/单选等独立控件全家族均已支持。隐藏slider与未活跃右标签历史类型保留缺口。

## 共享职责与规范规则

Form排列字段及操作区；字段包含标签、控件和反馈。必填、说明、辅助提示入口、校验状态相互独立；Input自身的填充/禁用/焦点不能代替校验状态。

顶部标题22高、下间距8；普通控件32高，多行控件54高。无说明底部24，有单行说明为20高提示＋底部4；不把400×56固定为全部字段尺寸。普通纵向字段组gap=0，指定基础示例另用gap=20。纵向操作区前8，按钮间16。行内两字段实例260宽、字段间120、操作区前32；三/四字段实际宽度分别为266.6666564941406/270，保留源精度，不将其当成任意业务的固定公式。

成功文字反馈绿边框；成功图标反馈灰边框。其余错误/警告分别红/橙。外侧标签与状态图标需要父级留白。源Gray4实例存在#DCDDDE和#DCDCDC两种实际paint，同名不同值使用明确覆盖样式，未改动公共样式。

源顶部布局组合还使用一个历史母组件：顶部标签＋控件内标题。此差异经实际引用确认，以顶部标签加现有基础字段实例表达，不用普通顶部Input静默替换。数字输入源内部也有额外左侧标题，保留这一事实。

## 可执行组合

```sh
node components/form/generator.mjs SPEC_JSON
```

输出代码交给目标文件的use_figma执行。SPEC_JSON传入name、layout（VERTICAL/HORIZONTAL）、width、fields数组、fieldGap、controlsGap及可选actions。每个字段指定componentId和width；可附已公开properties或content。操作按钮指定本地主组件componentId与text。仅允许既定目标文件和Form页；同名组合拒绝重复生成。

完整可运行参数见 `evidence/form/modify-before-spec.json`（11字段）和 `validation-before-spec.json`。34个规范组合的重建入口为 `node scripts/form/layouts.mjs left|top|inline`。业务数量由数组决定，已实测11字段，源2–8字段枚举不是上限。

`fitFieldContent(figma,node,content)`由同一公共实现处理长内容：content可含label、help、sourceComponentId和显式controlWidth。标签/说明按字段列宽换行，控件默认保留源固有宽度，不能把开关拉成整行。顶部标签：标题一行放得下时保持源的HUG，放不下才换行，换行时左对齐（设计判断，源标题文字为RIGHT，换行后会贴右）；外置标签保持源的右对齐。`controlWidth`只在与字段同宽时生效（控件改为FILL）：实例内把控件设为FIXED会回到母组件宽度、resize不生效，所以其他宽度会直接报错。开关、多选等固有宽度控件不要传`controlWidth`。2026-10-14修正前，标题一律FILL（单行也贴右），`controlWidth`在实例上静默无效，见`evidence/form/fit-field-fix-20261014.json`。顶部字段继续保持实例；外置标签的继承居中约束无法在实例内覆盖，因此右侧长内容适配会detach为可编辑FRAME并返回新ID。调用方必须使用返回ID、保留sourceComponentId，不能继续拿旧实例ID编辑。

普通短内容母组件保留原始几何。长内容的自适应是组合/修改策略：四种提示统一HEIGHT，标题/容器增长，外侧标记按源锚点放置。不是悄悄改变源母组件。字段文字、选项数量、默认选中和按钮文案仍属业务；组内选项数量目前通过编辑图层调整，未提供动态选项数组接口。

## 验证与边界

88顶部状态1196节点、7校验状态77节点已回读并检查截图；34布局及18修改实例验证通过，25个公共颜色样式未变。Noto暂代源字体，星号宽8→7px。回读容差0.0001，矢量region样式ID按本地映射区别，实际paint/样式名称单独核对。

内部控件实例本地化为图层，不承诺源原型事件或INSTANCE_SWAP迁移。tooltip浮层、实时校验、提交/取消副作用及导航未定义/未实现。云端视觉检查不代替桌面和用户验收。

完整证据、阶段提交和遗留项见实现记录（内部验证资料未随公开包分发）；326条源状态的当前覆盖见 `evidence/form/current-coverage.json`。

## 草图使用入口

`sketch/figma.mjs` 已接通表单字段 `input / textarea / select / date / date-range / time / number / radio / checkbox / switch / upload`。Select多选数组、单选值、Checkbox数组和条件显示见 [草图文档](../../docs/sketch-design.md#复杂表单入口2026-10-14-修复)。日期区间组合已有 DatePicker 输入，不新增家族。inputPassword/radioButton 在组件层已有，但草图入口尚未开放；多行自动增高、单时间、双侧中尺寸数字及普通单选的禁用配方已补齐，见../readonly-states/README.md；其余独立家族类型仍未完整导入。复测边界与证据见 复杂表单修复（内部验证资料未随公开包分发）。
