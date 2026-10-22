# headerMenu 顶部菜单导航-智慧云平台

来源为指定节点 `25795:66655`，仅制作其 1440×64、暗色、7项导航变体。详细规则见 `definition.json`，原始证据不进入默认检索。需要完整几何时由生成器读取 `build-data.json` 和原始 Logo 资产。

外层横向 SPACE_BETWEEN，左右24，上下12；Logo与标题间8，品牌区与菜单区间24，菜单间8，右侧操作区间16。仅底边1px，描边不参与外层布局。示例SaaS选中、具体菜单和账号文本是内容，不是通用默认业务规则。

执行 `node components/header-menu/generator.mjs STAGE FILE_KEY PAGE_ID STATE_JSON` 输出 use_figma 代码。阶段依次为 image → structure → vector:0..4。image返回imageHash供structure使用；structure返回的map供矢量阶段使用。每阶段必须保存返回值，不盲目重试已完成结构。先读工具与授权规则，源文件只读。

当前目标：使用者自己的 Figma 目标（需配置）。复用时创建组件实例；不要重复建立同名集合。9个文字节点为临时Noto字体并保留源文字自适应规则，后续由用户桌面处理。嵌套源实例已转为本地可编辑图层，没有远程库依赖。

已实际核对36节点布局、颜色、原文及5个矢量。2个矢量的Figma重新计算几何字符串存在差异，最大坐标差约0.00001px；详见验证报告。用户尚未验收，不加✅。

文字保留源textAutoResize行为。最新差异与复核见 `docs/text-layout-validation.md`，临时字体可能改变文字宽度和相关位置。

公开分发不包含原始图片示例/品牌位图。相关图片构建阶段需自行提供资产；本地草稿使用占位内容。

公开包将源样例账号文本替换为 demo-user01；几何与样式数据未据此改写。
