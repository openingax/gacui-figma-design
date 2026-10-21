# Alert 警告提示

现行源Page50063:541914、集合50065:533101共52变体：success/info/warning/danger四主题×13结构。全部带关闭、action=none。标题态支持图标、相关操作、描述；有描述时支持展开入口。无标题只提供无图标、无相关操作、带描述和展开入口的组合。collapse表示展示“展开更多”，源描述仍可见，不将其解释为实际折叠。完整盘点与说明板见evidence/component-gaps-20261020/alert-inventory.json及evidence/spec-guides-20261020/alert.md。

保留受保护默认态430:10646及其7节点，改前后属性一致。Page430:2新增51变体、461节点，拆13个包，映射见dependencies/catalog，可执行definition/build-data在extension-data。74矢量逐字段最大浮点尾差4.76837e-7，无错误。部分标题HUG宽147→146及相邻FILL宽+1来自云端字体度量；其余非矢量属性一致。组截图6/9出现内容缺失，已补单实例2倍截图并核对坐标，独立实例和真实草稿正常，原截图保留。

草稿工作台使用`{id:'notice',type:'feedback',kind:'alert',from:'判断',theme:'info',icon:true,showTitle:true,closable:true,message:'状态提醒',description:'核对计划信息',operation:'查看详情',collapse:true,expandText:'展开更多'}`。description/operation可省略；collapse=false时不可给expandText。无标题需message=null、icon=false、description非空、collapse=true且无operation。不接受源不存在的无关闭、自定义按钮组或组合。抽屉暂未接通新Alert节点，显式拒绝；既有empty/error反馈保持原入口。

真实Page780:2用13画板覆盖52组合，所有回执complete=true、语义/文字/实例错误为空。52实例长短标题及描述往返ID和原尺寸稳定，三类草稿截图、浏览器预览通过。相关操作为紧随标题的文字入口；图标标题缩进32、描述缩进28按源保留。草稿是静态结构，不实现关闭、展开或网络操作。

规范字体PingFang SC；云端Noto Sans SC为临时替代，未宣称苹方验证。技术验证不等于用户验收，coverage.complete=false。

长标题截图进一步发现实例内部宽度不可覆盖，已将草稿副本展开为FRAME，名称保留来源母组件ID；母组件和受保护节点不变。原13画板在原位置修复，无重复画板；转换映射见alert-layout-repair.json（detach产生新副本ID），其后52副本长短文案往返ID及尺寸稳定。另新增long-title画板794:54直接验证最终生成器，长标题按自然宽度、最多可用宽度65%换行。最终14画板56个Alert，其中52种唯一组合。原shape-11首次出稿回执被同名防重复回执覆盖，保留该exists回执及完整修复后实时回读；不将其当作首次出稿证据。
