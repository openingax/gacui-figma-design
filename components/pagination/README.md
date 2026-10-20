# Pagination 分页

五类必要配置：基础、总数、条数选择、跳转、极简。不是整张示例画板。总数、当前页、页大小与数据量由业务决定；未实现点击逻辑。

精简知识见 `definition.json`；精确生成数据在 `build-data.json`，原始证据只在 `evidence/pagination/`。默认不检索原始快照。

构建代码入口：

```sh
node scripts/lib/figma-build.mjs pagination STAGE TARGET_FILE_KEY PAGE_ID STATE_JSON
```

阶段及增量映射合并见 `docs/batch-execution.md`。不要盲目重复执行已经完成的批次；现有目标：使用者自己的 Figma 目标（需配置）。业务出稿优先创建本地主组件实例，并选择已有的精确状态名。

文字按源textAutoResize处理，临时Noto由用户桌面处理。修改实例文字前加载当前字体；同名label应结合父层定位，不全页替换。定义中的properties仅承诺实际暴露的变体属性，不承诺源TEXT/INSTANCE_SWAP绑定已迁移。

最新回读和字体度量差异见 `readback-after-text-layout.json`；没有用户验收，不加✅。源缺口不得由样例数量、默认选中或常见设计习惯补造。

2026-10-20 说明板（内部验证资料未随公开包分发）核对：源组件集共24组合（default 16、simple 8，含 disable=true 整体禁用），外层820×64、左右定位24，group 间距 default 16 / simple 14，页码按钮 32×32、jumper 160×32。当前五类配置是部分覆盖，整体禁用与其余组合未导入。simple 的源属性 jumper=false 时 btnGroup 内仍可见 jumper，按源保留，不改写。
