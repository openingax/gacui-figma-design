# Button Loading 静态外观

从指定Button示例18项按真实几何、布局、颜色去重为13个视觉配方，保留原渐变矢量。范围为中尺寸32px高；没有推断动画、取消、完成行为，也未将它简单等同于disabled。

位于Button页的Loading集合107:302。构建用`scripts/lib/figma-build.mjs button-loading STAGE FILE PAGE STATE_JSON`，当前Page从config/figma-pages.json查询。finish后可使用button/generator.mjs的propertyCode(target,state,true)绑定加载文字。

命名appearance/theme/tone/loading是本地归纳维度，源Loading为FRAME样例，没有这些变体属性；aliases保存18项到13配方的来源对应。样例文字可编辑。未验收，不加✅。
