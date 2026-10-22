# 草图环节设计（草案）

> 2026-10-15 优先级调整：先完善可独立交付的对话草稿能力，Figma 出稿按需继续。现状核查、实施批次与验收标准见独立草稿能力实施规划（内部验证资料）；A–C 已完成本地开发与验证，产品经理试用和 Windows 验收待完成。操作见 [草稿命令](draft-commands.md)，以下保留原 Figma 流程及历史记录，草稿可独立交付。

日期：2026-10-13。状态：**设计已确认；S1–S5 和草图到 Figma（第八节）已实现并通过本地测试。草图到 Figma 已在测试 Page 实际生成 7 张画板；产品经理实际使用的验证暂缓，见第十二节。**

来源是 2026-10-13 头脑风暴里“在需求和出稿之间插入草图层”的方向。用户当天决定把这一环节作为接下来的重点，所以不再沿用分析文档里“先用文字方案卡，等试用数据再决定是否做可视化”的判断。

## 一、目标与红线

**目标：** 把需求文档整理成一份结构化草图。产品经理用对话调整草图，满意后再出 Figma。改草图要比改 Figma 便宜、快，这样可以多来几轮。

**红线：** 草图用来对齐意图，不做精细编辑，不能变成第二个 Figma。

- 能用一句话完成的调整，不做成按钮或拖拽。
- 草图不表达颜色、尺寸、间距。视觉由组件实现和 Figma 阶段保证。
- 草图里只出现已导入的组件。没有的组件显示为“缺口”，不用相似控件代替。

## 二、和现有方案卡的关系

现在的方案卡是对话里的一段文字（见使用流程（内部验证资料））。草图把它升级为**一份结构化数据加两种视图**：

| 视图 | 给谁看 | 内容 |
|---|---|---|
| 对话里的方案卡摘要 | 产品经理在 Codex 里看 | 版本号、相对上一版的变化、待决策问题、缺口。和现在的方案卡格式基本一致 |
| 本地预览页面 | 产品经理在浏览器里看 | 低保真线框，按页面和状态切换，可以对比两个版本 |
| 结构化数据（布局树） | AI 和脚本用 | 唯一的事实来源，上面两种视图都由它生成，出 Figma 也读它 |

“相对上一版的变化”由脚本按数据计算，不靠 AI 手写，所以不会漏写。

## 三、产品经理看到的流程

1. 在 Codex 里说“用 gacui-figma-design 出稿”，附上需求文档、截图或流程图。
2. AI 读需求，生成草图 v1。对话里给出摘要和最多 6 个选择题，并打开本地预览页面。
3. 产品经理看预览，用对话提修改。例如“查询区去掉场站类型”“v2 和 v3 对比一下”“回到方案A”。如果说不清改哪里，就在预览里点一下那个区域，点“复制引用”，把引用粘贴到对话里。
4. 每次修改生成一个新版本，预览页面自动包含所有版本。
5. 产品经理说“确认，可以出稿”。AI 记录确认的是哪个版本，然后按这个版本生成 Figma。

## 四、草图数据（布局树）

### 存放位置

```
tasks/<日期>-<任务名>/草图/
  v1.json  v2.json  v3.json   每个版本一个完整文件，从不覆盖
  versions.json               版本索引：名称、星标、基于哪一版、变化摘要、是否已确认
  预览.html                   由脚本生成，单文件，可以直接双击打开
```

`tasks/` 已经被 git 忽略。需求内容只留在产品经理的电脑上。

### 顶层结构

| 字段 | 内容 |
|---|---|
| `format` | 固定为 1 |
| `task` | 任务名 |
| `pages` | 页面列表。`frame` 为 `workbench`（工作台：顶栏 + 侧栏）或 `drawer`（抽屉）；抽屉可以用 `over` 指定压在哪个页面上，用 `width` 写规范宽度；工作台可以写 `menu`（所在菜单） |
| `states` | 要生成的状态画板：`id`、`page`、`title`、`codes`（对应清单编号）、`patch`（相对默认画面改了什么） |
| `decisions` | 每个适用清单项的结论，见第七节 |
| `questions` | 待产品经理决定的问题：`id`、`code`、`node`（路径）、`ask`、`recommend`（必填）、`answer` |
| `gaps` | 不在页面里的组件缺口，如全局提示：`need`、`component`、`handling` |
| `judgments` | 设计判断，一句一条 |
| `demo` | 演示数据说明 |
| `request` | 本版本对应的用户需求原文与来源：`{"text":"原文","sources":[{"url"或"path":…,"read":true/false,"note":"读取情况"}]}`。每个版本写本轮内容，不进入版本对比；缺失时 save/check 提示 |

版本号、名称、星标和确认版本不写在草图里，写在同目录的 `versions.json`。这样给旧版本改名、加星时不用改动旧版本文件。

### 节点类型

词汇是封闭的：每种节点对应已导入的组件。字段名沿用现有页面配置（`pages/work-orders/spec.json`、`pages/settlement/spec.mjs`），这样转成生成参数时基本可以直接映射。

| 节点 | 对应组件 | 主要字段 |
|---|---|---|
| `search` | Search | `fields`：`label`、`kind`（input / select / date / date-range）、`placeholder`、`value`、`options` |
| `heading` | 文字样式 + Tag | `title`、`subtitle`、`status: {label, theme}`；正文标题组合，不是详情描述组件 |
| `actions` | Button | `message`（画板内说明）；`buttons`：`label`、`primary`、`opens`（打开哪个页面）。抽屉底栏写 `footer: true` |
| `tabs` | Tabs | `items`、`active`、`placement: "content"`（正文页签；默认导航位置） |
| `table` | Table + Table Cell + Pagination | `columns`：`title`、`kind`（text / tag / operations）；`selection`、`pagination`、`rows`（演示行数）、`rowActions`（`when`、`labels`、`more`，可以按数据状态分别列出）、`emptyText` |
| `form` | Form + Form Field | `fields`：`label`、`kind`（input / textarea / select / date / date-range / time / number / radio / switch / checkbox / upload）、`required`、`max`、`help`、`options`、`value`；`cols`（1 或 2 列） |
| `note` | 无（画板外说明文字） | `text` |
| `gap` | 无（缺口占位） | `need`（需要什么）、`handling`（本轮怎么处理） |

不在表里的东西一律写成 `gap`。只有真实需求反复用到某种结构时，才新增节点类型；每次新增都要有对应的已导入组件。

### 标识、来源和路径

- `id`：页面、节点、字段、按钮、列都有 `id`，只能用字母、数字、`-` 和 `_`，修改时保持不变。路径由 `id` 拼成，如 `list/search/timeout`，供状态 `patch`、问题定位和版本对比使用。
- `from`：来源，取值为 `需求:<文档位置>`、`产品:<问题编号或对话>`、`推荐`、`判断` 或 `演示`。预览里推荐、判断和演示有不同标记。
- `patch` 可以改的属性：`rows`、`emptyText`、`selected`（partial / all）、`loading`、`error`、`value`、`disabled`、`note`；另支持`visible/selection/selectedRows/disabledRows/disabledWhen/rowActions/rowActionRules/data/retryLabel/fileStates/active/message/title/status`，具体节点适用范围见下方修复补充。

完整示例：[工单列表 + 创建抽屉](../sketch/examples/work-order.json)、[对账未完成](../sketch/examples/settlement.json)。

## 五、预览页面

- **单个 HTML 文件**：样式和脚本内联，不联网，不需要启动服务。Mac 和 Windows 双击都能打开，AI 也可以用系统命令打开（Mac 用 `open`，Windows 用 `Start-Process`）。
- **低保真**：灰色线框，但显示真实的字段名、列名和按钮文字。缺口用红色虚线框，演示数据有明确标注，推荐和判断的内容用不同标记区分。看起来就不像终稿，产品经理会把注意力放在结构和业务上。
- **布局**：
  - 左侧：页面和状态列表，例如“工单列表 / 无结果”。
  - 中间：线框画布。
  - 右侧：待决策问题、缺口、本版变化。
- **版本**：顶部切换版本。“对比”模式把两个版本并排显示，并高亮新增、删除和改动的节点。
- **唯一的手动操作**：点击一个节点，显示它的路径、来源和相关问题，并提供“复制引用”，复制出类似 `[工单列表 › 查询区 › 是否超时]` 的文字，粘贴到 Codex 里使用。不能拖拽，也不能在页面里编辑。

## 六、版本快照

- **自动快照**：AI 每次修改都生成新版本文件，从不改动旧版本。
- **手动命名和星标**：产品经理说“这版叫方案A”“给 v3 加星”，AI 就更新 `versions.json`。
- **回到旧版本**：“回到方案A”的做法是把方案A复制成一个新版本，历史记录不改写，所以随时都能来回切换。
- **变化摘要**：由脚本按节点 `id` 计算差异，生成“相对上一版：新增…删除…修改…”，作为对话摘要的第一行。

## 七、内建边界状态检查

头脑风暴要求把补边界状态的工作写进工具，不靠临场 prompt。做法是用一个检查脚本按节点类型对照清单：

| 草图里有 | 必须给出结论的清单项 |
|---|---|
| `table` | L 组（空、加载中、加载失败、超长、选择、分页等） |
| `search` | L 组里和查询、重置相关的项 |
| `form` | F 组（必填、长度、校验时机、提交中、提交失败、关闭时是否保留内容等） |
| 字段 `kind: upload` | U 组 |
| 字段 `kind: select` 或 `date` | S 组 |
| 有多个页面，或有 `opens` | N 组 |
| 任何草图 | G 组 |

每一项都必须在 `decisions` 里有结论：

| 结论 | 什么时候用 | 必须写的来源 |
|---|---|---|
| 已明确 | 需求原文写明 | `需求:<出处>` |
| 已确认 | 产品经理回答过 | `产品:<问题编号或对话>` |
| 按推荐 | 影响小，直接用清单推荐默认 | `推荐` |
| 待决策 | 需要产品经理决定 | 同时要有一个未回答、编号相同的问题 |
| 本轮不做 | 明确不做 | 写清是谁定的 |

漏掉的项会被列出来，附上清单里的问法和推荐默认值。确认出稿前用 `--final` 再查一次，不允许还有待决策项或未回答的问题。

检查脚本还会拦截以下情况：

- 用了组件目录以外的组件，但没有写进 `gaps`。
- 标为“已明确”的状态没有写需求出处。
- `id` 重复，`opens`、`over`、`patch` 或问题指向不存在的路径。
- 字段、列的 `kind` 不在词汇内。
- 问题没有推荐答案。

AI 必须先过检查，才能把草图交给产品经理。

“节点类型 → 清单编号”的对应关系写在脚本里，清单文档仍是问法的唯一来源。再加一个测试，确认脚本里引用的编号在清单里都存在。

## 八、草图到 Figma（2026-10-14 实现）

用户决定直接做“列表页 + 抽屉表单”范围内的自动转换，不再等两个真实页面手工转换后再提取。命令行是 `sketch/figma.mjs`，Figma 端执行代码在 `sketch/figma-runtime.mjs`。

```
node sketch/figma.mjs plan <草图目录>                    列出要生成的画板和顺序
node sketch/figma.mjs code <草图目录> <画板> [--out 文件]  输出交给 use_figma 的代码，每次一个画板
```

**前提：**
- `versions.json` 里有 `confirmed`（确认版本）和 `figmaPage`（本任务的 Figma Page 名称）。
- 确认版本能通过 `check --final`，否则拒绝生成。

**生成顺序：** 先生成工作台页面，再生成抽屉，最后生成各个状态。画板名为 `<页面或状态> · v<版本>`，同一版本的画板排成一行。新版本另起一行，旧版本的画板保留不动。

| 画板 | 做法 |
|---|---|
| 工作台页面 | 复制工单页基线 `180:3`，替换下面这些内容；基线本身不修改 |
| 抽屉页面 | 复制同版本的背景页面画板，加上抽屉组件（宽度 300 / 500 / 760，其他宽度在 large 基础上调整）。表单用 `composeForm` 和顶部标签字段生成，`cols: 2` 时两个字段一行，多行文本和上传各占一行 |
| 状态 | 复制该页面的默认画板，按 `patch` 修改 |

工作台页面要替换的内容：
- 页签
- 侧栏当前菜单的文字
- 查询区：每行 3 个，最后一格是“查询 / 重置”
- 工具栏按钮
- 表格（`buildTable`，列宽自动铺满）
- 分页总数

状态 `patch` 在 Figma 里的效果：
- **`rows`**：删掉多余的行。为 0 时显示空结果文字，并隐藏分页。
- **`selected`**：切换选择框，表达半选或全选。
- **`value`**：填入字段值，字数计数同步更新；上传字段显示文件列表。
- **`error`**：控件改为红框，并在下方加错误提示。
- **`disabled`**：按钮和已接通的字段切换现有禁用态；缺少精确配方的字段返回未表达项。
- **`loading`**：抽屉按钮使用已有 Loading 外观；工作台加载按钮和表格加载仍未支持。表格 `error` 已支持失败文案和重试，见列表状态修复章节。`note` 是状态说明，不能替代真实控件。

**安全措施：**
- 只写入 `figmaPage` 指定的 Page。组件分类页和历史页面拒绝写入。
- Page 里有不是草图出稿生成的内容时拒绝写入。
- 同名画板已存在时不重复生成，返回 `exists`。

**每次执行的返回结果：**
- 画板 ID。
- 缺失的文字：按草图应该出现、却没在画板里找到的文字。
- 失效的组件引用。
- 没能表达的内容。
- 临时字体。

画板下方另有说明文字，内容包括：草图版本、演示数据、缺口、没能表达的内容、字体替代。

**本轮不支持（遇到会直接报错，不会生成走样的稿子）：**
- 查询区的单个日期。
- 工作台页面里的表单。
- 抽屉里的表格、查询区、页签和正文按钮。
- 一个页面里有多个表格。
- 表格有操作列但没写 `rowActions`。
- 列太多，每列不足 80px。

**沿用基线、未按需求调整的部分：**
- 顶部导航，以及侧栏里当前菜单以外的其他菜单。这一点会写在画板说明里。
- 表格没给 `data` 时，单元格统一填“演示”。

**实测（2026-10-14，测试 Page“草图出稿测试 20261014” `329:2`）：**
- 测试数据：用 `sketch/examples/work-order.json` 作为确认版本。
- 已生成并查看截图的画板（7 张）：
  - 工单列表
  - 创建工单抽屉
  - W2 无结果
  - W3 半选
  - W3 全选
  - D2 必填错误
  - D3 附件格式拒绝
- 回读结果：没有缺失文字，也没有失效的组件引用。
- 发现并修正了 3 个问题：
  1. 字段没有默认值时传了空文字，导致执行失败。这次失败的执行整体回滚，没有留下残稿。
  2. 字段标题显示在最右边，控件宽度固定为 400。
  3. 错误提示被插进了横向的字段行。
- 实测时为了缩短调用长度，部分调用只带了相关函数，并且 D2 的修正是手工代码验证的。W3 全选使用 CLI 原样输出的完整代码。
- 没有实测的部分：
  - D1、D3 数量拒绝、W1。
  - 同名画板的 `exists` 保护。
  - 第二个版本另起一行的排布。
  - 对账页这类“页签 + 日期区间”的页面。

**已修正的共享问题：** 实测中发现，共享的 `fitFieldContent` 会把顶部标签字段的标题设为 FILL（源标题文字为右对齐，所以显示在最右），并且 `controlWidth` 在实例上不生效。2026-10-14 已在共享函数里修正，见 Form README 和 `evidence/form/fit-field-fix-20261014.json`。草图出稿原先的局部修正 `tidyField` 已删除。现在只对输入框、选择器、多行文本和日期传 `controlWidth`；开关和多选保留组件固有宽度。用修正后的代码重新生成了创建工单抽屉（`340:758`），截图正确。

**这次需要调整的原则：** 项目文档里多处写明“不做通用页面 DSL”（README、`docs/mvp-scope.md`、`docs/component-import-workflow.md`）。草图数据本质上就是一种低保真的页面描述，所以设计确认后要同步修改这几处。改法是：允许一份范围受限的草图格式，词汇只覆盖已导入组件；组件内部的生成数据仍然不使用 DSL。

## 九、不做

- 拖拽、自由布局，以及对颜色、尺寸、间距的编辑。
- 高保真预览。高保真留给 Figma。
- 在线托管或分享链接。需要给别人看时，直接发送 `预览.html` 文件。
- 在预览页面里调用 AI，或接入额外的 AI API。
- 多人同时编辑同一份草图。

## 十、实现拆分与验收

| # | 内容 | 验收 |
|---|---|---|
| S1 | 草图格式，并把 3 个现有页面（工单工作台、创建工单抽屉、对账未完成）写成草图 | 3 个页面都能表达，没有用到表外的节点；不能表达的部分说明原因 |
| S2 | `render`：把草图转成单文件预览页面，支持页面和状态切换、点击复制引用 | Mac 和 Windows 浏览器都能打开 S1 的 3 个草图，人工判断结构和原页面一致 |
| S3 | `check`：格式校验、组件缺口和清单检查，附测试 | 故意删掉状态、用未导入组件、写重复 `id`，都能被拦下 |
| S4 | 版本：差异计算、变化摘要、预览中的对比模式 | 对 v1 和 v2 改动的节点能准确高亮；回到旧版本不改写历史 |
| S5 | skill 和使用说明：第 2 步改为生成草图，并更新 `pm-guide` | 新 Codex 会话从需求到草图 v1、再到修改出 v2 都能走通 |
| S6 | 用真实需求盲测（原 B3，改为评估草图） | 产品经理按评分表打分：组件选得准不准，有没有漏页面和状态 |

命令行是 `sketch/sketch.mjs`（子命令 `check`、`render`、`diff`）和 `sketch/figma.mjs`（`plan`、`code`）。校验和对比的纯函数在 `sketch/core.mjs`，生成预览时原样内联进页面，Node 和浏览器用同一份实现。只用 Node 标准库，不新增依赖。

S1 到 S3 是最小可用闭环，S4 依赖 S2。S6 需要真实需求文档，可以和 S4、S5 并行准备。

## 十一、已确认（2026-10-13）

1. 预览用低保真线框。
2. 预览是本地单文件 HTML，需求不离开本机。
3. 第一版只覆盖“列表页 + 抽屉表单”。详情页和弹窗等真实需求出现后再加；弹窗组件导入前一律显示为缺口。

## 十二、待验证（2026-10-14 决定暂缓，后续补做）

以下都没有做过，在完成之前不能说草图环节“可用”。

| # | 验证内容 | 怎么验证 | 通过标准 |
|---|---|---|---|
| V1 | Codex 能按 skill 写出合格草图 | 在 Codex 新会话里给 2～3 个需求，可以用截图、一句话需求、`sketch/examples` 对应的原需求。只走到草图，不写 Figma | 一次或少量修改就通过 check；节点类型、来源标注、清单结论使用正确；没有把关键规则标成“按推荐”或“本轮不做” |
| V2 | Mac 上的完整对话流程 | 实测清单（内部验证资料）第 6、6a 步 | 预览自动打开；复制引用后能定位并生成新版本；旧版本文件没有被改动 |
| V3 | Windows 上的完整对话流程 | 实测清单第 6、6a 步，以及 Windows 风险第 3 条 | 中文检查结果和预览没有乱码；`Start-Process` 能打开 `预览.html` |
| V4 | 产品经理能否看低保真草图判断方案 | 真实需求盲测（S6），按 B3 评分表打分，并记录每轮修改发生在草图阶段还是 Figma 阶段 | 结构性修改主要发生在草图阶段；产品经理没有反馈“看不懂”或“必须看高保真才能判断” |
| V5 | 草图和现有页面一致 | 人工对照 `sketch/examples` 的预览和对应 Figma 稿 | 页面、字段、列、操作、状态没有遗漏或多出 |
| V6 | 已确认草图转成 Figma | 维护者已用工单示例在测试 Page 生成 7 张画板（见第八节）；还需要用真实需求的草图，由 Codex 按 skill 第 4 步完整生成一次，并补测第八节列出的未实测项 | 生成内容和草图一致；回读没有缺失文字；截图没有明显问题 |

本地已验证的部分：检查、差异计算和预览生成的自动测试；在浏览器里看过列表页、抽屉必填错误、版本对比和复制引用（维护者 Mac）。

### 列表状态规则与完整性回执（2026-10-14）

工作台默认页和状态页共用完整状态解析，不再只从默认画板删行。`states.patch`可覆盖`visible`、`selection`、`selectedRows`、`disabledRows`、`disabledWhen`、`rowActions`、`rowActionRules`、`data`、`retryLabel`；原有`rows/selected/error/emptyText/disabled/value/note/loading`保持兼容。可见性用于整个操作栏或单个按钮；只读需明确设置`selection:false`并将行操作改为仅查看。字段的额外状态并非因此自动获得支持。

表格可写`selectedRows:[0,1]`（零基行索引），`disabledRows:[3,6]`或`disabledWhen:{field:'status',equals:'已完成'}`。`selected:'all'`只选择当前页可选行，表头按可选行计算全选/半选；旧`partial`保留只选第一条可选行的含义，不用它代替精确两条。显式选择禁选行、重复或越界索引报错。

`rowActionRules:[{match:{field:'status',equals:'已完成'},labels:['查看']},{labels:['查看','编辑']}]`按数据顺序匹配第一条规则，末尾无match为默认规则。旧`rowActions`仍支持样例逐行操作；自然语言`when`不执行条件求值，会明确列为未表达，不冒充动态规则。

按钮`enableWhenSelected:{table:'table',field:'status',equals:'未开始'}`在已选记录至少一条匹配时启用，否则禁用；不写field时为任意已选。规则由默认和状态共用。失败状态使用`error:'计划加载失败，请重试',retryLabel:'重试'`：隐藏数据行和分页，用已有文本与Button表达错误及重试入口，不导入或冒充规范空状态组件；真实请求不属于静态出稿。

plan逐稿列出需求缺口；每张稿继承顶层gaps和本页gap。生成返回`created:true`仅说明已创建；`status:incomplete,complete:false,validation:failed`表示存在缺口、未支持属性、缺文、失效实例或语义检查失败。`status:created,complete:true`只说明已表达结构化需求的自动检查通过，不代表自然语言需求无遗漏、规范字体或UI验收。语义核对覆盖每行文字/动作、勾选/禁选、按钮可见/禁用、表头和失败入口；`exists`仍要求人工回读，不能当作本轮验证成功。画板外gap/note仅为说明，不充当画板内实现。

## 复杂表单入口（2026-10-14 修复）

Form 新增 `kind: time | number | radio`，复用已导入的 Form 顶部字段；`date-range` 使用 DatePicker 的日期区间输入，不能指向日期时间区间。尚未开放与本轮无关的 password/radioButton 入口，不宣称 11 类型全部开放。

- 日期区间值用 `["2026-11-01", "2026-11-30"]`；兼容历史 `2026-11-01 至 2026-11-30`。倒置日期及越界数字可保留并配 `error`，用于静态错误画板。
- `time.value` 是 HH:mm 文字；`number.value` 是数值（含 0）；`min/max/step` 保留业务规则，静态稿不执行业务校验。`number.max` 不代表字数上限。
- `radio.options` 为选项文字，value 为单项；`checkbox.options` 为选项文字，value 为数组。未填写不能继承规范样例默认选中。
- `select.multiple: true` 使用数组值和已有多选标签。options 可为字符串或 `{label, disabled}`；禁用选项不能写入选中值。多选展开已接通open:true，options可在状态中覆盖；停用行文字与Checkbox一致，源矛盾及组合决策见existing-states-20261014.md。
- `visibleWhen: {field: "页面/区域/字段", equals: true}` 条件只控制展示，不清空值。预览和Figma共同使用 resolvePage，状态页由同一构建路径完整生成。
- upload.value 为文件名数组；`fileStates: {"文件名.png": "fail"}` 指定失败文件（其余成功），结合 error 使用现有失败上传和重新上传入口。fileStates 可在状态 patch 中设置。未指定失败文件时不能宣称逐文件失败状态通过。
- 底栏保留全部按钮；disabled 选现有Button禁用态，loading 选已有静态Loading外观并移除实例反应。静态设计不能代替实际提交防重逻辑。
- 输入、日期、Select、Switch、Checkbox 使用已有可用禁用态；Form多行自动增高、单时间、双侧中尺寸数字及普通单选禁用配方已补齐；其余独立类型仍待导入，返回 incomplete，不能用整体降透明度冒充规范状态。
- 表单回读校验字段集合、值、单选/多选/开关状态、日期类型、时间/数字控件类型、附件成功失败及重试、底栏按钮和加载状态；任一遗漏不能返回完整成功。字体及视觉仍需实看、UI验收。
# 详情现有能力修复补充（2026-10-14）

工作台可组合文字样式、Tag、Tabs、Button、Table及已接通的descriptions、imageViewer、dialog等入口。Timeline仅提供垂直左对齐同侧的历史入口，其扩展暂停。当前类型、组合配置及边界见[草稿能力表](draft-component-capabilities.md)。

- `heading` 节点：`title`、`subtitle`（编号）、`status: {label, theme}`，主题为 `default/primary/success/warning/danger`。标题完整换行；状态可 patch `title/status/visible`。这是页面组合入口，没有创建新母组件。
- `tabs.placement: "content"` 在正文生成无关闭按钮的内容页签，顶部导航保留页面名。patch `active` 为从0开始的有效索引，配合 `table.visible` 隐藏非当前内容；静态状态画板不等于点击交互。
- `actions.message` 是实际画板内的操作/权限/失败说明，可 patch；`note` 仍是画板外注释，不自动当成UI。失败状态可隐藏标题、业务操作和记录，只保留返回及独立重试操作组。使用已有文字样式和Button，不声称规范反馈组件已导入。
- `tag` 类型表格列可写 `themes: {"有异常":"warning", "正常":"success"}`，必须逐一配置展示值的主题。主题映射是业务设计判断，不从文案自动推断。Tag列可加`tag:{variant,shape,icon,closable,disabled,closeState}`，heading.status同样支持这些属性；默认outline/square，medium与任意iconName/iconId明确拒绝，详见components/tag/README.md。
- 生成校验检查页签集合与选中、标题和状态Tag、操作说明、隐藏表格、行内容与操作。任何剩余 gap 均保持 `complete:false`。原需求含自然语言但未被结构化保留的遗漏，仍需人工逐项核对。


## Dialog草稿入口（2026-10-21更新）

页面children可加`dialog`节点，必填id/type/title/message/cancel/confirm/from，默认`visible:false`；状态patch设visible:true。工作台、抽屉共用同一覆盖层实现，不使用Drawer冒充Dialog。每张画板最多一个。常规支持5主题×关闭×分割线共20组合，宽480–960；关闭支持normal/hover/active。全屏只支持源提供的info、带关闭、两种分割线配置，不接受固定width。状态允许修改文案、可见性及受支持的样式参数；校验拒绝缺文案与库外组合。详见[组件使用说明](../components/dialog/README.md)。

原form取消态与detail停用态实际验证在evidence/dialog。对这两个已实现确认视图，应移除对应“Dialog未导入”gap，但保留后续成功/失败、历史数据保留、导航等业务规则与未验证结论；不得把静态弹窗称为真实操作链已实现。

### 详情只读信息组合（2026-10-14）

`descriptions` 使用规范Template只读标签/值组合，非新组件家族。属性 `title`、`columnCount:1|2`、`items:[{id,label,value,span?:1|2,from}]`；状态可覆盖 `items`、`title`、`visible`。label不含冒号，value为完整文字。详见components/descriptions/README.md。本次已覆盖默认/只读/长内容/加载失败隐藏，并真实验证新增验收部门原位修改。

### 详情图片查看（当前20变体已技术验证）

`imageViewer`：`title`、`items:[{id,filename,state?:normal|hover|error,imageHash?}]`、`open?:图片id`、`demo?:演示说明`。支持items/open/visible状态覆盖；正常图查看大图，失败保留文件名与重新加载，空数组显示暂无附件。支持gallery、showThumbnails、openError、closeState和items.ratio三比例；图库240px、单图168px。左右切换仅normal，关闭支持normal/hover/disabled，库外态显式拒绝。见components/image-viewer/README.md。

### 日志时间线（部分导入）

`timeline` 支持12种横纵布局、5种语义颜色和loading/custom条目图标。配置与原位修改限制见[Timeline](timeline.md)。条目数量与顺序由业务数据决定，空数组表达暂无操作日志；未完成的其他家族继续隔离。

### 空态与失败反馈（2026-10-14）

工作台table增加feedback:{variant:"compact"}启用已导入Empty/Alert：无记录采用emptyText，error采用失败Alert＋retryLabel，保留表头并隐藏分页。imageViewer.emptyFeedback:{variant:"compact"}为空附件启用相同规范空态；不改变图片失败自己的视觉。独立feedback节点需要id/from/type、kind:empty|error、message；error必须提供action（例如重试），允许visible/message/kind/action/note状态覆盖。渲染、更新和回读校验共用components/feedback/generator.mjs。原有未启用的历史草图保留原行为。

Empty三个发布来源保留原生导入，当前真实页面仍只验compact。旧error＋重试反馈沿用专用组合；工作台新增 `feedback.kind:"alert"` 已支持现行52组合，见[Alert说明](../components/alert/README.md)。新Alert拒绝close=false及库外组合，抽屉暂不支持新Alert入口。旧反馈证据见反馈验证记录（内部验证资料），不代表新Alert仍只有1/52。

### 多选展开状态

表单select.multiple:true可设置open:true，options支持字符串或{label,disabled}；状态patch允许options/open。只读不可展开，停用项不可作为值。弹层采用源活跃样例的36px最小行高、8px内边距、2px行间距，长标签换行增高为设计判断。列表数量由数据决定，本轮实际验证7项；当前仅无分隔线默认/选中/禁用三态，hover/active与分隔线仍未导入。静态稿不实现点击和键盘事件。

文字表格列支持 `wrap:true`：草图保留完整文字，Figma关闭省略、自动换行并增高整行。默认仍单行；只允许text列，不能用于操作/标签列。它是业务布局选择，不表示完整Table家族导入。

### Layout 规范组合
工作台 page 可选 `layout: "side" | "top" | "combined"`；省略保持既有页面结构。三种结构使用Layout原导航示例，菜单业务内容和选中项仍需按需求配置，不将源样例当业务规则。内容区域、表格、分页、描述、时间线和图片随模式宽度生成。该选项是页面结构选择，不声明通过状态patch切换布局。

### 独立链接（2026-10-15）

工作台与抽屉的 `children` 支持 `type: "link"`，例如 `{id:"help",type:"link",text:"查看填写说明",size:"medium",state:"normal",prefix:true,suffix:false,from:"演示"}`。尺寸为 large/medium，状态 normal/hover/active；disabled 为 true 时只能 normal。prefix/suffix 为布尔值，prefixIcon/suffixIcon 仅 link/jump 且对应槽必须开启。上述字段及 visible 可用于状态 patch。生成器按草稿顺序放置，长文字超出正文宽度会拒绝出稿，静态画板不实现业务导航。组件字体和已验证范围见 components/link/README.md。

## Transfer 离线开发节点

`type: transfer`使用source/target项目数组，参数见components/transfer/README.md。支持工作台、抽屉和状态patch的本地预览；始终显示开发标记，不接通Figma出稿。搜索过滤、分页容量和移动顺序必须显式表达，树联动未实现，不从静态图推断交互。

## Upload 独立离线开发节点

`type: upload`使用components/upload/README.md的theme/state/interaction/draggable/disabled与内容参数。独立节点支持本地预览和状态patch；静态示意，不打开文件选择器，不上传文件。Figma草稿编译明确拒绝独立节点直到实际接入验证完成；现有form字段kind=upload的能力不变。

### 抽屉保存失败反馈（2026-10-16）

drawer.children可放独立feedback，格式与工作台相同，按form前后位置插入。推荐默认visible:false，在save_failed状态只覆盖visible:true，并保留已填字段。服务端保存失败不要写入某个字段的error，避免误认为字段校验失败。当前使用已导入danger Alert＋重试按钮，静态稿不执行请求；见evidence/inspection-flow-20261016。

表格 `pagination` 可使用对象：`{theme:'default',totalContent:true,pagesize:true,jumper:true,disabled:false,total:101,pageSize:10,current:1,pages:[1,2,3,4,5,'…',11]}`。当前源default 16/simple 8组合；simple须jumper=false（内部跳页框仍显示），不得带pages。default超过6页须显式提供最多6个数字且包含当前页的窗口，省略号仅在末页前。仅生成静态分页，不承诺真实业务翻页事件。

整栏页签：`{type:'tabs',placement:'content',orientation:'top',icon:true,items:['概览','详情','记录'],active:0}`。top仅2–8项，left仅8项；left内容并列，栏宽160/高600。当前整栏无关闭/禁用/任意图标交换组合，不能补造。顶部输出实例；左侧为母组件实例解除关联后的可编辑FRAME，以支持源选中图标几何切换。文字与选中可原位更新，不代表路由行为已实现。

全局提示使用 `message` 节点：`{id:'notice',type:'message',from:'判断',theme:'success',closable:true,text:'保存成功'}`。主题仅info/success/warning/error/loading，关闭开关对应当前10组合。每画板最多1个，可用state patch修改主题、关闭、文字、visible。当前为静态展示，位于顶部80居中（设计判断），不推导持续时间、关闭事件或等待动画。

区域加载用 `loading` 节点，`variant` 为spinner（纯图形）/spinner-text（图文）/text（纯文字），size为small/medium/large。图文和纯文字可配置label；纯图形拒绝label。可用state patch修改variant/size/label/visible；220高居中区域是设计判断，静态状态不承诺动画或请求行为。

- Tooltip独立节点：anchor唯一匹配操作按钮标签，text非空；placement与theme按当前84组合选择，showArrow仅允许与位置一致。每画板最多一个。静态状态预览/可编辑Figma实例，不实现真实悬停事件；详见components/tooltip/README.md。

- steps：工作台独立流程区块；orientation横/纵、theme default/dot、items 2–6项且各项明确title/description/state。只支持当前正向/无自定义图标，详见components/steps/README.md。

- popconfirm：显式气泡确认节点，anchor匹配唯一触发项文字；title/description/cancel/confirm必填，placement/theme/showArrow按当前28组合，不自动替代Dialog；详见components/popconfirm/README.md。

- notification：title/description必填，四主题、icon/footerBtn按当前10组合；底部按钮存在时cancel/confirm必填，当前源不含关闭按钮。静态右上通知，详见components/notification/README.md。

### Alert（2026-10-21）
工作台feedback.kind=alert支持现行52组合；主题、描述、图标、相关操作和展开入口规则见[Alert](../components/alert/README.md)。拒绝源不存在的组合；静态预览不执行关闭或展开。

### Table 扩展（2026-10-21）
`table.selectionMode`支持none/multiple/single/expand；展开需expandedRows与expandedContent，可配expandHoverRows。文字列maxLines与wrap互斥；textTag列用tagKey，state列用stateThemes明确映射normal/error。columns.width和resizableColumns仅表示静态宽度。详见Table记录（内部验证资料）。
