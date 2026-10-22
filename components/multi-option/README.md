# 多选选项

源Select页面30818:109368共10态，覆盖矩阵和活跃展开实例见evidence/multi-option/inventory.json。原无分隔线normal、selected、disabled三态保留；2026-10-15补齐hover、active及5种分隔线状态，合入原440:17。证据见docs/select-family-20261015.md，用户验收仍待定。源母行32高，活跃展开覆盖36高；样例5项不是数量规则。

源停用行30818:109079文字灰、Checkbox却disabled=false；业务组合按原需求“停用班组不可选”换为现有Checkbox禁用未选31:15，保留灰文字。源快照与本地源副本不修改，实际组合在实例副本中处理。停用已选不新增臆造状态，校验直接拒绝；若需要保留历史已选停用项，须另行明确业务规则。该决策待UI验收，不等于规范方已修订。

表单select.multiple:true + open:true；options为字符串或{label,disabled}，value数组。readonly不得展开；options/open支持状态patch。生成器renderMultiPopup与现有components/select/popup.mjs的multiple分支共享；updateMultiOption用于同状态长标签原位更新，改变状态需重新选源行配方。7项实测，长文案可增高。静态出稿不实现点击或键盘禁选。

构建：prepare-copy.py multi-option 读取日期；scripts/multi-option/build.mjs依次start、nodes:0/1、vectors:0、finish，合并mapDelta。目标440:2。规范字体PingFang SC，云端Noto为临时替代。
