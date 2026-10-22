# Notification 消息通知

源Page45829:327191、集合45831:333641当前10组合，无独立母组件。四主题info/success/warning/error；footerBtn两种，只有info另有无图标两组合。closeBtn全部false，不扩展不存在的关闭或无图标主题。完整活跃实例及嵌套按钮/图标已盘点，说明板见evidence/spec-guides-20261020/Notification.md。无图标是普通主题配置，不是新主题；示例“可跳转”不构成跳转业务规则。

目标Page771:2、集合771:48/771:95/771:119，10变体/112节点属性一致，8矢量最大尾差4.76837e-7。映射见catalog/dependencies，可执行definition/build-data在extension-data；三组截图已核对，源INSTANCE展开为本地FRAME，外层母组件供草稿实例化。未触碰受保护节点。

草稿`{id:'notice',type:'notification',from:'判断',theme:'success',icon:true,footerBtn:false,title:'处理完成',description:'请查看执行结果'}`。footerBtn=true时必须配置cancel/confirm，无按钮时不接受按钮文字；源未提供关闭，closeBtn/closable=true显式拒绝。每画板最多一个，右32/上80间距为页面判断，容器保持384宽、源白色背景和图标色。仅静态通知，不实现异步请求、自动关闭或跳转。

Page772:2十组合回执complete=true；十实例长短标题、描述和按钮往返ID及原尺寸稳定，三类真实草稿截图与浏览器预览通过。规范PingFang SC，云端Noto Sans SC仅临时替代。技术验证非用户验收；证据evidence/component-gaps-20261020/notification-*。
