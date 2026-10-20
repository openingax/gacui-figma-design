# Upload 上传

使用者自己的 Figma 目标（需配置）。规范：[Upload-demo](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/B端整理?node-id=43956-310950)。

## 用途与覆盖

上传文件、图片、拖拽提交、批量文件列表、批量图片网格，以及输入框形式的文件选择。完整保留源稿真实的 62 个主变体，不用属性笛卡尔积补造不存在的组合。

| 形态 | 变体数 | 规范根尺寸 |
|---|---:|---|
| 普通文件 | 13 | 180×60；进度 124×60；成功 112×60 |
| 拖拽文件 | 7 | 334×172 |
| 普通图片 | 10 | 180×148，内框 120×120 |
| 拖拽图片 | 8 | 334×172 |
| 批量文件 | 8 | 496×368 / 496×388 |
| 批量图片 | 9 | 496×368 / 496×432 |
| 输入框文件 | 7 | 344×60 / 388×60 |

另包含上传图标按钮四态、图片状态卡五态。图片悬浮活跃样例的 `#EEEEEE` 背景与母组件 `#F1F1F1` 不同，在“源样例差异”中单独保留。

## 选用与业务内容

- `theme`：`file`、`image`、`file-flow`、`image-flow`、`file-input`。
- `state`：`before`、`waiting`、`progress`、`success`、`fail`；具体可用组合由 `resolveUpload()` 校验。
- `interaction`：`normal`、`hover`、`active`、`dragging`；`draggable` / `disabled` 为布尔值。
- `filename`、`helperText`、`fileSize`、`uploadDate`、`buttonLabel`、`progress` 为业务内容。格式、数量限制和提示不写死。
- `files` 用于批量已选状态，接受 `{name, size?, state?, interaction?, progress?}`。同一列表可组合等待、上传中、成功和失败；成功图片可显示 hover 操作。文件表格按行组合，图片按四列组合；文件数量不受源样例的 5 / 8 个限制。
- 图片填充保留源原字节，可在 Figma 中替换；当前生成接口尚未提供任意外部图片 URL 上传。

默认使用主变体。不要把源中“最多 5 份”、40% 进度、文件名、日期和固定展示数量当作业务规则。失败提示与普通说明共用提示槽，由业务给出真实文案。

## 可执行生成与修改

```js
import {resolveUpload, generateUsage} from './components/upload/compose.mjs';
// library 为 evidence/upload/state.json，迁移环境时必须重新验证目标映射。
const spec = {
  theme: 'file-flow', state: 'waiting',
  helperText: '上传巡检材料，允许的格式由业务决定。',
  files: [
    {name: '巡检记录.pdf', size: '48K', state: 'success'},
    {name: '现场照片.jpg', size: '2.4MB', state: 'progress', progress: 73}
  ]
};
const code = generateUsage('create', library, spec);
// 将 code 交给授权目标的 use_figma；保存返回的 rootId、slots。
// 在同一 rootId 上修改：
const edit = generateUsage('update', library, {...spec, helperText:'更新说明'}, example);
// 每次修改后继续保存新返回的 slots（批量重组后部分子节点会更新）。
// 在同一个已授权文件的业务 Page 中生成，可传第五个参数：
// {fileKey: library.fileKey, pageId: businessPageId}
```

调用 `create` 会创建可编辑组合 FRAME，保留可复用按钮实例，并恢复源按钮 reactions。调用 `update` 在原节点上修改。内容修改共享一个 `updateUpload()`；批量数量与混合状态共享 `configureUploadFiles()`，不按示例数量复制页面脚本。

构建母组件使用 `generator.mjs`：`start → asset（3 张原图）→ nodes（按 groups/batches）→ finish`。记录 `mapDelta` 后再执行下一批，不能在在途调用结束前中断并盲目重跑。恢复尺寸时先锁定 FIXED，归组使用 `resizeWithoutConstraints`，最后提交描边。

## 边界与验收

这是可编辑静态设计能力。主 Upload 没有配置文件选择、网络上传、删除、取消或页面导航；源按钮 hover / press 的配置已映射，不等于已验证完整原型触发或真实文件上传。

规范字体是 PingFang SC；云端临时使用 Noto Sans SC。英文、数字等自然宽度存在字体度量差异，不以缩字或取整掩盖。组件与业务修改验证见导入记录（内部验证资料未随公开包分发）。未获用户验收，不加 ✅。

已执行 1105 节点逐层回读、72 个组件根尺寸与 48 处源按钮反应配置核对、全部形态截图检查，以及 7 个原节点上的长内容修改。批量实测 3 文件混合状态、6 图片混合状态；图片按四列换行。普通文件进度根因字体自然宽度由源 124 变为 122，其余主变体根尺寸与源稿一致。矢量最大坐标重算差约 `0.000001px`。

## 独立离线草稿（2026-10-15）

草稿新增 `type: upload`，参数与resolveUpload相同，复用同一个validateUpload校验器；原表单的upload字段不变。可预览62主状态、混合文件列表、四列图片网格、长内容与进度边界，支持状态patch。图片使用明确标注的占位，不请求业务图片或执行真实上传。预览是低保真讨论稿，颜色、图标、交互动画及字体不作为源像素验收。

`node scripts/upload/offline-gallery.mjs`生成67配置/134段创建与修改代码的离线预检，以及67页面+1状态的开发画廊。更新代码里的示例目标ID是占位，不可直接执行；必须用真实回执重新生成。evidence/upload/offline保存代码长度与浏览器检查。独立节点到Figma草稿编译暂时明确拒绝，避免静默省略；不影响已有generateUsage接口或表单上传能力。苹方、真实目标依赖、独立草稿接入与原位修改回读仍待完成。

公开分发不包含原始图片示例/品牌位图。相关图片构建阶段需自行提供资产；本地草稿使用占位内容。
