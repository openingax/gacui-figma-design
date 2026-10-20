# Figma 接入边界

本地草稿可以直接使用。Figma 构建代码来自已有组件实现，但依赖特定主组件、样式、Page 和基线画板。公开包不包含内部目标授权、evidence 中的目标映射或图片示例；**不能仅填写一个 fileKey 就声称已适配**。

接入自己的目标时：

1. 核实真实账号、工具的读取/写入/截图能力、规范源和目标授权。源文件保持只读。
2. 按首张页面实际需要导入组件，在自己的目标文件建立主组件、样式和基线画板，保存准确映射。组件说明、definition、build-data 保留源几何/节点出处；历史目标节点不是新环境的有效引用。
3. 按构建器实际读取关系适配依赖：components 下的 dependencies/family-dependencies、sketch/figma-runtime.mjs 的基线、pages/work-orders/build.mjs 的表格依赖，以及生成器读取的 evidence/form-top、drawer、select 等**本地适配文件**。其他日期/穿梭等独立生成器也可能需要自己的映射。不要恢复作者的内部授权配置，也不要盲目替换全部数字 ID。
4. 将基本目标配置放在忽略的 `.local/figma-pages.json`，格式参考 config/figma-pages.json。sourceFileKey 与 fileKey 必须不同。完成代表组件和真实页面的生成、回读、截图及原稿修改验证后，才将 adapterVerified 标为 true，并保留验证记录。
5. 本地计划：`node sketch/figma.mjs plan <草稿目录>`；适配验证后才使用 code 生成并在目标执行。不在本仓库环境替用户执行未知目标写入。

空配置时 code 会明确拒绝；这个保护不是完整的适配工具。首版公开包尚未验证任意第三方目标的一键迁移。缺位图时提供自己的 PNG 资产，不能把缺失源图的效果称作完全还原。

规范字体优先 PingFang SC；临时字体替代必须说明并复核。复制代码不授予任何 Figma 文件或字体使用权限。
