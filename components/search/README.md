# Search 搜索

[源规范](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33?node-id=72086-226133) · 使用者自己的 Figma 目标（需配置）

用于关键词检索、批量条件输入及联想结果展示。完整盘点并实现源页静态视觉范围：46个Search变体、3个活跃游离母组件对应状态、1个自定义展开覆盖、9个操作区状态和1个弹层。已实际回读与截图检查，未用户验收。

## 选用规则

- 基础搜索：前缀或尾部搜索操作区，normal/hover/focus/disabled按实际变体选用。源属性中prefix=false、suffix=false的部分填充态仍显示前缀图标；以实际图层为准，不用布尔值猜外观。
- 一键清空：使用含清空图标的变体；图标位置按源保留，不等于已接入清空动作。
- 批量：空态32px、编辑态120px、已输入标签态32px。生成器允许更多内容；展开编辑随文字增高，标签按内容换行，具体数据不固定为两项。
- 联想：弹层在主框下方8px，源内边距6px，行间距2px，短行28px；关键词片段蓝色。任意非空字符串数组，长行自动增高；源四项不是限制。
- 自定义展开：可用不高亮的列表，也可传入已授权目标页内的自定义内容节点进行克隆。
- 不补齐不存在的属性笛卡尔积。逐态来源与真实差异在definition.json；精确构建时才读取build-data.json。

## 构建与修改

已授权目标：20260928文件的Search页169:2。已生成集合不能直接重复构建；构建器会拒绝同名集合。

```sh
node scripts/search/build.mjs search prefix 169:2
node scripts/search/build.mjs search suffix 169:2
node scripts/search/build.mjs search suggest 169:2
node scripts/search/build.mjs search batch 169:2
node scripts/search/build.mjs search-extra all 169:2
node scripts/search/build.mjs search-action all 169:2
node scripts/search/build.mjs search-popup all 169:2
```

命令输出Plugin API代码，交给use_figma在目标执行。构建顺序为操作区、弹层、搜索框、活跃扩展。字体加载、精确vectorNetwork、富文本片段、最终几何与描边恢复均有实现。

业务实例可使用generator.mjs。先从definition.json的target.variants按来源状态取得componentId，不能依赖数组首项。创建原样实例时只传componentId；定制内容使用以下JSON并执行 `node components/search/generator.mjs spec.json`：

```json
{
  "componentId": "169:237",
  "width": 400,
  "value": "广州南站",
  "suggestions": ["广州南站充电中心", "广州南站停车场"],
  "highlight": "广州"
}
```

- `value`：输入文字；单行长内容省略（保留完整characters），批量编辑按内容增高。
- `tags`：用于已有标签槽的批量态，非空字符串数组。数量不限，长标签省略，保留删除图标。
- `suggestions`：用于含联想弹层的状态，非空字符串数组。`highlight`为空字符串表示不高亮。
- `customContentId`：替换弹层内容，与suggestions互斥；源内容节点保留，克隆进入弹层。
- `width`：至少160px，默认保持源宽240px；此下限是生成器布局保护判断，不是源规范限制。
- `updateSearch(figma,node,spec)`：修改已有生成结果，返回实际id。结构定制会将新INSTANCE明确本地化为FRAME，标准母组件不变。后续修改使用返回id。

空条件、空联想应选用已有无标签/无弹层状态，不用空数组模拟另一种状态。内容修改保留源文字颜色；若从占位态切换为已输入内容，同时选择对应fill=true状态。

## 已验证与边界

60个元状态、542个内部节点，实际几何/样式/富文本/矢量回读通过；50个完整搜索框做了真实修改，包含400px宽、长查询、五标签、七条联想和多行批量条件。自定义结果卡片也已实际生成并检查。

标准组件保留源自动布局、阴影、圆角、图标与精度。文字临时使用Noto Sans SC；一个光标字符宽度由3px变为4px，单独记录。内部源实例本地化为可编辑图层，不承诺原INSTANCE_SWAP、原库引用或原型行为迁移。

源全页无reactions，未实现搜索请求、Enter提交、清空副作用、删除标签、选择联想后的数据更新或导航。桌面端字体/渲染未验收。
