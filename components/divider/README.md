# Divider 分割线

源规范十种变体已构建并逐节点回读：水平/垂直实线与虚线四种，无图标文字分割线左/中/右对齐各两种。完整盘点见 evidence/divider/inventory.json，来源见 definition.json。

调用 `renderDivider(figma,parent,spec)`；参数 `id`、`orientation: horizontal|vertical`、`dashed`、`text`、`align: left|center|right`、`length`。无文字默认长度40，有文字400；不支持垂直文字。文字组合至少120px是本生成器的保护限制，不是规范事实。长文字限制在长度减96px内换行；这是业务组合设计判断，未修改源组件配方。

使用授权目标里的十态主组件构建可编辑FRAME。因实例内部宽度覆盖限制，组合在加载字体后解除实例绑定；不宣称保留源TEXT/INSTANCE_SWAP属性。`updateDivider`支持同类型/状态下的文字与长度原位修改；变更方向、对齐、虚线状态请重新选择对应变体。

草稿 `type: divider` 已接入校验、状态patch、线框预览和工作台Figma生成。工作台按可见区块顺序排列，抽屉支持表单组前后插入；横向长度不得超过各自正文宽度。使用位置属于集成验证，不增加源组件类型。

复现：`node scripts/divider/build.mjs plan`，按 start → nodes:N → finish 合并state，最后 `node scripts/divider/finalize.mjs` 恢复源零高度容器。目标已有组件，禁止盲目重跑。规范源只读。

验证：44个源/目标节点属性比较通过；十态800px/40px组合、标准草稿转换、长文字和原位修改已执行。母组件及本批验证画板已在桌面替换苹方并回读。云端新增生成仍可能临时用Noto，需要同样的桌面字体收尾；历史草稿491:3保留原验证状态。用户验收仍待完成。过程与边界见 docs/divider-import-20261015.md。
