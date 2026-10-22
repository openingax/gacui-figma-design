# Layout 布局

完整盘点范围：11档 Spacer（2、4、8、12、16、24、32、40、48、64、96px），源12列栅格与侧栏24列栅格，以及侧边、顶部、组合导航三种布局。技术验证已通过，用户验收仍待完成。

- `applySpacing(frame,value)` 设置已有 Auto Layout 的间距，保留子节点；只允许规范档位。
- `applyLayoutGrid(frame,sourceId,rules)` 从 `grid-rules.json` 应用源栅格。12列为 gutter16/offset24；侧栏24列为 gutter20/offset20，不合并两者。
- `composeLayout(figma,parent,spec,slots)` 接收 mode=side/top/combined、width、height，以及 content/header/sidebar 实际节点；顶部64、侧栏200、内容边距20、页脚52。返回 root/body/content/footer，可调整 root 尺寸；1440×960→1280×800→还原已验证。
- 草稿工作台可用 `page.layout` 选择三种布局；表格、分页、描述、时间线与图片区域随内容宽度生成。省略时保持既有行为。

导航来自 Layout 原规范示例，仅作为默认依赖。样例菜单名称、默认选中和业务文案不是规则，不代表 Menu 家族完整支持。源变量跨文件关系未迁移，保留解析色；源特殊字体和字重保留，SF Pro 私有图标用源字形轮廓保留外观。

源 Page48218:528564，spacer集25788:24769；目标Page492:2、spacer集492:25、header500:15989、sidebar500:16072。草稿验证Page511:2。构建入口 `scripts/layout/build.mjs`、`navigation-build.mjs`、`navigation-finalize.mjs`、`examples.mjs`；不得对已有目标重复创建。

证据：`evidence/layout-completion/`；导入过程和限制见 `docs/layout-import-20261015.md`。绿色Spacer是间距展示，不是业务页面内容。未发布共享库。
