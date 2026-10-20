# ImageViewer（部分导入）

完整盘点见evidence/image-viewer/coverage.json：view 6态、image 6态、modal-button 5态、主布局3态及活跃样例。当前导入view非图库normal/hover/error共3/6、主布局单图1/3。图片子项只沿选定主布局保留方图，关闭按钮沿主布局保留常态；图库、其余比例、大图失败、切换按钮禁用/悬停未导入，不能称全家族支持。

源和目标映射见target.json。原始尺寸、颜色、矢量路径保存；选定组合以可编辑绝对定位几何导入，内部实例展开，不保留源库跨文件链接。缩略图仍用目标组件实例，大图因长标题位置需要修改会detach为可编辑组合。不是响应式组件库。

`imageViewer`节点：`items:[{id,filename,state:'normal'|'hover'|'error',imageHash?}]`、`open:图片id`、`visible`、`title`、`demo`。`items:[]`显示暂无附件；配置`emptyFeedback:{variant:"compact"}`启用已导入规范小空态，已在详情原需复测验证。失败图片保留名称、重试，正常图片查看原图，禁止上传/删除。仅静态状态，不实现网络重试或点击原型。gallery=true显式拒绝。

构建入口generator.mjs；维护导入scripts/image-viewer/import.mjs。复用既有演示资产43621e…（来源同规范的hover样例，原字节在components/upload/assets），不转移手机样例业务图片。业务assetHash由调用者传入，缺失时拒绝生成；合成详情明确标注演示图片，不是真实巡检照片。规范PingFang SC，云端Noto临时替代。

[只读规范来源](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=98004-157568)。
