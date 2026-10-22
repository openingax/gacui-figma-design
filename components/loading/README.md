# Loading 区域加载

源Page45921:328218、集合45929:328225，9组合、6外层活跃用途，无说明板。源属性不能按字面任意交叉：indicator=false/text=false是纯图形；indicator=true/text=false是图形加文案；indicator=false/text=true是纯文案。分别对应API variant spinner/spinner-text/text，每种small/medium/large。

目标Page760:2，集合760:17/760:32/760:35；映射catalog.json/dependencies.json，可执行数据extension-data，构建按scripts/component-gaps/loading-next.mjs既存断点。未改受保护节点。

草稿 `{id:'loader',type:'loading',from:'判断',size:'medium',variant:'spinner-text',label:'正在读取...'}`。纯图形不得配置label；当前生成220高居中区域是设计判断，组件本体保持源尺寸。使用独立母组件实例，可原位修改文字。此入口不等同按钮Loading或Message等待；不承诺动画、真实请求、超时、业务交互阻塞。

27节点回读：3文字因Noto临时替代比苹方宽1px，对应HUG外框同步增宽，其余属性一致；6矢量误差最大4.76837e-7、逐字段无错误。三组截图、Page761:2九个真实画板complete=true、六个带字实例长短往返ID和宽度稳定、三类页面截图及浏览器预览通过。技术验证非验收，规范字体仍PingFang SC；完整证据evidence/component-gaps-20261020/loading-*。
