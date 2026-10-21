# ImageViewer 图片预览

当前四集20变体已映射并完成技术验证，用户未验收。view 6态、image 6态、modal-button 5态、layout 3态；保留原4个受保护组件，新增16个。完整来源、映射和验证见导入记录（内部验证资料）、catalog.json、dependencies.json。

`imageViewer` 节点支持 `items:[{id,filename,state:'normal'|'hover'|'error',ratio:'1:1'|'16:9'|'9:16',imageHash?}]`、`open:图片id`、`gallery`、`showThumbnails`、`openError`、`closeState:'normal'|'hover'|'disabled'`、`title`、`demo`、`visible`。图库必须有图片，缩略栏只用于图库；失败大图可独立指定。当前左右切换按钮只有常态，previousState/nextState只接受normal，不补造hover/disabled。空数组非图库显示暂无附件，可配置emptyFeedback复用小空态。

图库缩略图240平方，普通168平方。图库数量、选中项来自业务数据。竖图按比例适配大图区域是页面设计判断；源母组件保留原始尺寸与路径。仅静态展示，不执行下载、重试、关闭或切换事件。

构建数据见extension-data；extended.mjs提供渲染、回读和`updateImageViewerContents`原位文件名修改。现有旧入口保持兼容，扩展按实际配置注入。演示图使用目标既有43621e…资产（字节在components/upload/assets），不迁移源业务照片；业务imageHash须已在目标可用。规范字体PingFang SC，云端Noto为临时替代。
