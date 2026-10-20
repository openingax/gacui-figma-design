# 日期选择输入框

24真实状态，覆盖单日期、日期范围及日期时间范围的默认/悬浮/聚焦/填充/禁用组合。日期是业务数据，不固定为源样例。

精简知识见 `definition.json`；精确生成数据在 `build-data.json`，原始证据只在 `evidence/date-input/`。默认不检索原始快照。

构建代码入口：

```sh
node scripts/lib/figma-build.mjs date-input STAGE TARGET_FILE_KEY PAGE_ID STATE_JSON
```

阶段及增量映射合并见 `docs/batch-execution.md`。不要盲目重复执行已经完成的批次；现有目标：使用者自己的 Figma 目标（需配置）。业务出稿优先创建本地主组件实例，并选择已有的精确状态名。

文字按源textAutoResize处理，临时Noto由用户桌面处理。修改实例文字前加载当前字体；同名label应结合父层定位，不全页替换。定义中的properties仅承诺实际暴露的变体属性，不承诺源TEXT/INSTANCE_SWAP绑定已迁移。

最新回读和字体度量差异见 `readback-after-text-layout.json`；没有用户验收，不加✅。源缺口不得由样例数量、默认选中或常见设计习惯补造。

家族能力需按[六类用途覆盖清单](../datepicker/README.md)判断。源年份、月份、单日期时间示例共享date输入并覆盖文字；当前六类弹板及完整组合已由datepicker包补齐并实测；不要只从输入mode数量推断用途数量。
