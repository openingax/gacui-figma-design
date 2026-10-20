# Input 独立Focus

从规范Page仍在使用的Focus实例27023:84496提取。其母组件25406:43085的parent=null，不在40状态集合中，但实例有真实Page祖先，不能忽略。

400×32是样例实例宽度，支持按业务调整，不是上限。Brand5边框和2px聚焦外圈来自源。当前仅竖线光标，无内嵌标题，是静态样例；不要把它当键盘行为。原始证据保留INSTANCE类型，本地明确提升为COMPONENT。

构建入口：`scripts/lib/figma-build.mjs input-focus`，依次start、nodes:0、finish，合并mapDelta。目标集合89:88，未用户验收，不加✅。
