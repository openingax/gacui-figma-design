export const modes=['year','month','date','dateTime','dateRange','dateTimeRange'];
export const sourceModes={year:'year 年份',month:'month 月份',date:'date 日期',dateTime:'dateTimes 日期时间',dateRange:'mode 类型6',dateTimeRange:'d&t + d&t日期区间时间选择器'};
export function parseDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('日期必须为YYYY-MM-DD');const[y,m,d]=value.split('-').map(Number);const t=new Date(Date.UTC(y,m-1,d));if(t.getUTCFullYear()!==y||t.getUTCMonth()!==m-1||t.getUTCDate()!==d)throw Error('无效日期');return {y,m,d,t};}
const iso=t=>t.toISOString().slice(0,10);
export function calendarRows({year,month,selected,today,start,end,disabledDates=[],hover}){
 if(!Number.isInteger(year)||year<100||year>9999||!Number.isInteger(month)||month<1||month>12)throw Error('日历年月无效');
 for(const v of [selected,today,start,end,...disabledDates].filter(Boolean))parseDate(v);
 if((start&&!end)||(!start&&end)||start>end)throw Error('区间起止无效');
 const first=new Date(Date.UTC(year,month-1,1)),offset=first.getUTCDay();
 return Array.from({length:6},(_,row)=>Array.from({length:7},(_,col)=>{const t=new Date(Date.UTC(year,month-1,1-offset+row*7+col)),date=iso(t);let flags=[];
 // 日期数据的状态选择策略：额外月份优先，其次禁用、区间/选中、今日。来源状态本身不变。
 if(t.getUTCMonth()!==month-1)flags=['additional 额外'];
 else if(disabledDates.includes(date))flags=['disabled 禁用'];
 else if(start&&start===end&&date===start)flags=['active 选中激活'];
 else if(start&&date===start)flags=['active-start 选中开始'];
 else if(end&&date===end)flags=['active-end 选中结束'];
 else if(start&&date>start&&date<end)flags=['highlight'];
 else if(date===selected)flags=['active 选中激活'];
 else if(date===today)flags=['now 此刻'];
 if(date===hover){if(flags.some(f=>['disabled 禁用','active 选中激活','active-start 选中开始','active-end 选中结束'].includes(f)))throw Error('该悬停组合未在规范定义');flags.push('hover 悬浮');}
 return {date,label:String(t.getUTCDate()),flags};}));
}
export function timeColumns(value){if(!/^\d{2}:\d{2}:\d{2}$/.test(value||''))throw Error('时间必须为HH:mm:ss');const parts=value.split(':').map(Number),max=[23,59,59];if(parts.some((v,i)=>v>max[i]))throw Error('时间超界');return parts.map((selected,i)=>{const start=Math.max(0,Math.min(max[i]-6,selected-3));return Array.from({length:7},(_,j)=>({label:String(start+j).padStart(2,'0'),flags:start+j===selected?['active 选中高亮']:[]}))});}
export function pickerModel(config){if(!modes.includes(config.mode))throw Error('未知用途');const mode=config.mode,range=mode.includes('Range'),dt=mode.includes('Time');parseDate(config.value);if(range){parseDate(config.end);if(config.value>config.end)throw Error('区间倒置');}if(dt){timeColumns(config.time);if(range){timeColumns(config.endTime);if(config.value===config.end&&config.time>config.endTime)throw Error('日期时间区间倒置');}}
 const d=parseDate(config.value),e=range?parseDate(config.end):null,months=config.months||(range?[[d.y,d.m],[e.y,e.m]]:[[d.y,d.m]]);if(months.length!==(range?2:1))throw Error('月份视图数量不符');
 const calendars=months.map(([year,month])=>({year,month,rows:calendarRows({year,month,selected:range?null:config.value,today:config.today,start:range?config.value:null,end:range?config.end:null,disabledDates:config.disabledDates,hover:config.hover})}));
 const slash=v=>v.replaceAll('-','/'),valueText=mode==='year'?String(d.y):mode==='month'?slash(config.value).slice(0,7):slash(config.value)+(dt?' '+config.time:'');
 return {...config,sourceMode:sourceModes[mode],range,dt,calendars,timeData:dt?[timeColumns(config.time),...(range?[timeColumns(config.endTime)]:[])]:[],inputMode:range?(dt?'datetimesRange 日期时间区间':'dateRange 日期区间'):'date 日期',inputValues:range?[valueText,slash(config.end)+(dt?' '+config.endTime:'')]:[valueText],panelSize:mode==='year'||mode==='month'?[280,224]:mode==='dateTime'?[496,278]:mode==='dateRange'?[560,278]:mode==='dateTimeRange'?[560,556]:[280,278]};}
