# DatePicker 家族

使用者自己的 Figma 目标（需配置）。六类静态、可编辑选择器已完成生成、回读、内容修改及视觉检查，待用户验收；不代表交互原型完成。

| 用途 | 输入 | 弹板 | 完整示例 |
|---|---|---|---|
| 年份 | date覆盖年份，240×32 | 280×224 | 130:44 |
| 月份 | date覆盖年月，240×32 | 280×224 | 131:113 |
| 日期 | date，240×32 | 280×278 | 131:380 |
| 日期时间 | date覆盖日期时间，240×32 | 日历280＋时间216，496×278 | 131:812 |
| 日期区间 | dateRange，240×32 | 双日历560×278 | 131:1288 |
| 日期时间区间 | datetimesRange，360×32 | 两列，每列日历上/时间下，560×556 | 131:1986 |

六种输入均与弹板左对齐，间距8。源`mode 类型6`映射为日期区间；母组件原名保留。输入集70:2与弹板集71:126继续复用，原单日期主组件71:2保留ID。

## 可复用部分

日期格14状态、月份格8、年份格8、时间项4、日期/日期时间区间文字各3，共40个源有效状态；另保留24输入状态和4种头部。颜色、四角、背景延伸与向量保留源精度。完整弹板通过这些原生实例组合，没有把示例画板整体复制进组件库。

单元入口：date-cell、month-cell、year-cell、time-cell、date-range-cell、datetime-range-cell；头部位于datepicker-*-header。目标实际属性在各definition.json；不要按第一个变体猜默认。文字通过加载字体后修改实例TEXT槽，不承诺源TEXT属性已绑定。

## 生成与修改

```js
import {generatePicker} from './components/datepicker/generator.mjs';
const code = generatePicker({
  mode: 'dateTime', value: '2028-02-29', time: '23:59:59', today: '2028-02-27'
}, {replace: true});
// 将code交给use_figma；目标固定为config中的DatePicker Page。
```

CLI：`node components/datepicker/generator.mjs CONFIG_JSON [replace]`。首次已存在同名示例会拒绝重复；replace保留弹板与示例根ID并重建内部组合。返回全部受影响ID，记录到本地证据。

mode支持year/month/date/dateTime/dateRange/dateTimeRange。value使用YYYY-MM-DD；区间另给end；时间模式给time，时间区间另给endTime，均为HH:mm:ss。可给today、disabledDates、hover、yearWindowStart；区间可给months明确两个显示年月。生成器拒绝无效日期、倒置区间、超界时间及未定义的悬停组合。示例配置及修改后配置位于evidence/datepicker。

日期行使用6×7格、SPACE_BETWEEN；年月为4×3。时间显示七行窗口，支持整个小时/分/秒取值范围，不把源11–17等示例值当上限。固定七行是当前静态视窗方案，不等于只支持七个时间选项；滚动行为未实现。

数据策略属于生成器判断：额外月份优先，再禁用、区间/选中、今日；单日区间映射选中；年份默认按十年窗口含两端额外年。可明确传入数据，不把源不联动的日期时间当业务规则。

## 验证与限制

六模式回读通过；修改已覆盖2028闰日、跨2026/2027的区间、00:00:00与23:59:59，尺寸及根ID保持。135个基础节点逐层比对，78项差异来自Noto字宽/居中及相关HUG容器，完整记录在unit-readback.json。216宽时间区部分列有约0.000004px自动布局浮点差异，未手动取整。

新生成流程在尺寸和文字恢复完成后提交描边，已通过桌面对照修复右边过粗。月份集合527%检查及54个描边节点回读记录见docs/datepicker-stroke-order.md。

PingFang暂用Noto，用户桌面处理；翻月点击、滚轮、关闭、键盘、时区及提交等原型行为未实现。原有日期面板早期内部ID已失效，当前映射见evidence/date-panel/target.json；不要操作target-initial.json内的历史节点。
