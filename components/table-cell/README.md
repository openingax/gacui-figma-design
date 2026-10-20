# 表格单元格

10个真实元状态：文本、操作、状态、标签、文本+标签及底色差异。正文44高，纯文字底色变体46高用于表头。列宽由业务指定，不固定复制整列样例。

精简知识见 `definition.json`；精确生成数据在 `build-data.json`，原始证据只在 `evidence/table-cell/`。默认不检索原始快照。

构建代码入口：

```sh
node scripts/lib/figma-build.mjs table-cell STAGE TARGET_FILE_KEY PAGE_ID STATE_JSON
```

阶段及增量映射合并见 `docs/batch-execution.md`。不要盲目重复执行已经完成的批次；现有目标：使用者自己的 Figma 目标（需配置）。业务出稿优先创建本地主组件实例，并选择已有的精确状态名。

文字按源textAutoResize处理，临时Noto由用户桌面处理。修改实例文字前加载当前字体；同名label应结合父层定位，不全页替换。定义中的properties仅承诺实际暴露的变体属性，不承诺源TEXT/INSTANCE_SWAP绑定已迁移。

最新回读和字体度量差异见 `readback-after-text-layout.json`；没有用户验收，不加✅。源缺口不得由样例数量、默认选中或常见设计习惯补造。
