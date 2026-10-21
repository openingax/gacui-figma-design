# Steps 步骤条

规范源Page43752:306570、五集合43755:319692/319737/319831/319884/319933，共56变体（36单项+20整条）。当前2–6项×横纵×default/dot；四状态finish/process/default/error，首末项边界按源。icon只提供false，vertical只有positive；游离反向旧样例43755:320070/320092按用户历史排除规则不支持。301含嵌套实例已分组盘点，辅助stepper/check/图标保留于精确子树，不能误认为独立Steps类型。说明板见evidence/spec-guides-20261020/Steps.md。

目标Page764:2，14分包，56变体/1137节点/29矢量。definition/build-data在extension-data；dependencies和catalog保存全部映射。源INSTANCE展开为FRAME保留内部几何；1137节点属性除1812宽变成1811.9998779296875的浮点尾差外一致，矢量最大差9.49093e-7且逐字段无错误。14组截图已检查，全部原始快照/映射/回执在evidence/component-gaps-20261020/steps-*。

草稿`{id:'flow',type:'steps',from:'判断',orientation:'horizontal',theme:'default',items:[{title:'提交申请',description:'核对信息',state:'finish'},{title:'审核处理',description:'等待审核',state:'process'}]}`。每项状态明确输入，不推断状态转换。当前独立工作台区块，按可用宽度均分横向单项，纵向280宽；不自动加入抽屉。长标题和描述换行属于页面适配判断；标记、状态配色、首末线来自源。横向dot仍为24px数字/图标，纵向dot才是8px圆点。当前出稿单项解除实例关联为可编辑FRAME，以允许重排，目标母组件不变；updateSteps支持同结构文案修改，结构/状态变化重新生成状态画板。

真实验证专用Page766:2，20组合覆盖2–6项及四结构，每个complete=true。四状态均有真实节点；20次长短文案修改ID稳定且恢复原尺寸。四结构、横向六项和长内容截图核对无截断/越界，预览已核对。首四画板初始误用Loading验证页，已携说明移动到专用页，ID不变；steps-first-four-repair.json记录改前父节点和复核，原始回执保留。首版横向连接线判断已原位修正并截图，未修改任何受保护节点。

规范字体PingFang SC，云端Noto Sans SC临时替代；未验证桌面苹方。技术验证非用户验收，不实现流程点击、业务状态转换或动画。
