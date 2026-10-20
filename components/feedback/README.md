# 空态与失败反馈（部分导入）

来源、52态覆盖清单、来源快照及目标回读见 ../../docs/feedback-import-20261014.md 和 ../../evidence/feedback/。三个发布Empty组件原生导入，保留64/210宽小型及121宽页面图标差异。页面组合目前验证compact；wide/page保留导入引用，尚无真实页面验收。Alert仅danger＋图标＋标题，1/52，不能宣称Alert全家族支持。

使用table.feedback={variant:"compact"}启用规范反馈；无数据用emptyText，失败用error＋retryLabel，不显示旧数据或分页。未开启时兼容历史草图。独立导出validateFeedback、renderFeedback、updateFeedback、verifyFeedback供生成及原位修改共用。error必须包含action。隐藏关闭是业务组合判断；原Alert仍有关闭按钮。

构建：先以scripts/lib/prepare-copy.py准备feedback，scripts/feedback/build.mjs依次输出start、nodes:0、vectors:0、finish，交给授权目标use_figma执行并合并state。目标限定evidence/feedback/target.json；source只读。字体临时替代Noto Sans SC，规范为PingFang SC。静态稿重试不执行真实请求。

独立页面反馈：{id:"failure",type:"feedback",from:"需求",kind:"error",message:"巡检计划加载失败，请重试",action:"重试",visible:false}。imageViewer.emptyFeedback={variant:"compact"}启用无附件空态。详情11态及修改证据在evidence/feedback/detail；运行node tests/feedback-detail.test.mjs。

2026-10-16：抽屉正文也支持独立feedback节点，按与form区块的相对顺序插入，状态visible控制显示；语义回读限定前景抽屉，避免把背景页反馈重复计数。保存失败使用error＋重试，字段校验仍用field.error。草稿、现有生成函数原位组合、真实Figma回读及苹方截图见../../evidence/inspection-flow-20261016/；运行node --test tests/inspection-flow.test.mjs。此组合能力不增加Alert家族覆盖数。
