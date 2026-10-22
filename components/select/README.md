# Select 选择器

已补齐32输入状态、单选与多选各10选项状态，以及1–10项菜单配方。复用原24未展开输入，新增8展开输入；完整调用及边界见[FAMILY.md](FAMILY.md)。列表数量是数据。

精简知识见 `definition.json`；精确生成数据在 `build-data.json`，原始证据只在 `evidence/select/`。默认不检索原始快照。

构建代码入口：

```sh
node scripts/lib/figma-build.mjs select STAGE TARGET_FILE_KEY PAGE_ID STATE_JSON
```

阶段及增量映射合并见 `docs/batch-execution.md`。不要盲目重复执行已经完成的批次；现有目标：使用者自己的 Figma 目标（需配置）。业务出稿优先创建本地主组件实例，并选择已有的精确状态名。

文字按源textAutoResize处理，临时Noto由用户桌面处理。修改实例文字前加载当前字体；同名label应结合父层定位，不全页替换。定义中的properties仅承诺实际暴露的变体属性，不承诺源TEXT/INSTANCE_SWAP绑定已迁移。

最新回读和字体度量差异见 `readback-after-text-layout.json`；没有用户验收，不加✅。源缺口不得由样例数量、默认选中或常见设计习惯补造。

列表生成器 `components/select/popup.mjs` 接受任意非空options数组，已实际测试7项。多选源Checkbox未禁用的矛盾仍保留；2026-10-14按用户要求解决业务组合：停用行用已验收禁用Checkbox并保留规范灰文字，禁止停用项写入值。独立popup与草图open共用实现；见../multi-option/README.md，不能称规范已修正。
