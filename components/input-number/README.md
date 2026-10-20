# InputNumber 数字输入框

来源：[B端整理](https://www.figma.com/design/jNf9icrxfw8B7QkSQa9g33/?node-id=42459-300256)。包含双侧调整与右侧调整，两种填充状态，各有默认/悬停/聚焦/禁用，共16整框变体；右侧增加与减少控件各4态，共24源变体。所有均导入，活跃样例中单独禁用减少、增加悬停/点击组合也保留。

```js
await renderInputNumber(figma,parent,{
  id:'threshold',theme:'column',value:8888,state:'hover',
  increase:{state:'active'},decrease:{disabled:true}
},dependencies);
```

入口 generator.mjs，目标映射 dependencies.json。theme=row/column；state=normal/hover/focus；disabled只能搭配normal。value为有限数字或null，占位文案默认“请输入”；是否填充由value推导，0也是已填。width最小为row144、column96，高32。

increase/decrease独立状态为normal/hover/active与disabled。只在column的hover/focus中控件可见时使用；禁用控件只有normal。不把默认数值8888、步长、最小/最大值或增减算法写成规范业务规则；当前输出静态可编辑稿，业务联动需要独立需求。

文本保留源TRUNCATE和FILL；窄宽长数字可按源省略，完整值仍在文字节点。需要展示完整长值时显式加宽；本批280宽验证13位数字，负小数与原位还原也验证。不会改字号掩盖溢出。

可传existing实例原位修改数值、宽度、外观与控件状态；同一母组件的数值修改保持文字ID。切换主题/变体仍保持根实例ID，但内部节点随母组件结构改变，不承诺全部内部ID稳定。内部按钮/箭头为精确本地层，没有迁移TEXT/INSTANCE_SWAP绑定；控件状态复用已导入母组件paint，保留源矢量几何与样式。

草稿`type:number`使用同名参数，工作台/抽屉正文与状态补丁已接入；旧Form `kind:number`保留历史路径，不外推独立入口的新能力。苹方缺失时临时Noto，最终桌面验证单列。

构建：`node scripts/input-number/build.mjs input-number start|nodes:N|vectors:N|finish`；number-increase、number-decrease同协议。已有目标映射不得重复运行。完整盘点、验证与剩余项见 批次记录（内部验证资料未随公开包分发）。
