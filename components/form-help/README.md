# Form 校验提示

范围修正：此包只包含提示文字，完整Form的边框和外侧状态图标由form-validation实现，见[Form家族归纳](../form/README.md)。源母组件216宽是样例值；活跃默认实例覆盖为400宽且使用HEIGHT，其余三种校验样例文字仍为WIDTH_AND_HEIGHT，不能宣称长提示已统一换行。

default/success/error/warning四状态。提示文案与校验规则属于业务；本包不实现校验逻辑。源提示文案提到折行，但元文字为自适应宽高，长提示行为需结合实际容器确认。

精简知识见 `definition.json`；精确生成数据在 `build-data.json`，原始证据只在 `evidence/form-help/`。默认不检索原始快照。

构建代码入口：

```sh
node scripts/lib/figma-build.mjs form-help STAGE TARGET_FILE_KEY PAGE_ID STATE_JSON
```

阶段及增量映射合并见 `docs/batch-execution.md`。不要盲目重复执行已经完成的批次；现有目标：使用者自己的 Figma 目标（需配置）。业务出稿优先创建本地主组件实例，并选择已有的精确状态名。

文字按源textAutoResize处理，临时Noto由用户桌面处理。修改实例文字前加载当前字体；同名label应结合父层定位，不全页替换。定义中的properties仅承诺实际暴露的变体属性，不承诺源TEXT/INSTANCE_SWAP绑定已迁移。

最新回读和字体度量差异见 `readback-after-text-layout.json`；没有用户验收，不加✅。源缺口不得由样例数量、默认选中或常见设计习惯补造。
