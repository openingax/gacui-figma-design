# DatePicker/header/date

DatePicker家族的可复用单元；用途与组合见[家族入口](../datepicker/README.md)。属性与来源在definition.json，精确构建数据按需读build-data.json；原始证据位于evidence/datepicker-date-header。

目标组件集：使用者自己的 Figma 目标（需配置），Page112:91。已有组件优先创建实例；不要按children[0]猜默认状态，按明确状态属性匹配。文字需加载当前字体后编辑实例内TEXT槽。

生成入口：`node scripts/lib/figma-build.mjs datepicker-date-header STAGE FILE PAGE STATE_JSON`。按start、nodes、vectors、finish执行并保存增量map。没有用户验收，不加✅。

实际属性/四角/样式回读与字体差异记录在evidence/datepicker/unit-readback.json。源字体PingFang暂用Noto，字宽可能不同；原几何值保留。静态状态不代表交互原型。
