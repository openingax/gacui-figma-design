// 事件事实与兼容投影；不修改原始日志，不把未知原因推断成已确认故障。
export const CATEGORIES=['business_pending','target_required','component_unsupported','validation','execution'];
const nonempty=(...values)=>values.find(v=>typeof v==='string'&&v.trim())??'';
export function eventMessage(e){const p=e.details?.payload;return nonempty(e.context?.message,p?.error?.message,typeof p?.error==='string'?p.error:null,p?.output?.stderr,p?.output?.stdout,p?.reason,e.errorCode).slice(0,1200);}
export function eventCategory(e){
 if(CATEGORIES.includes(e.context?.category))return e.context.category;
 const p=e.details?.payload;if(CATEGORIES.includes(p?.category))return p.category;
 const message=eventMessage(e);
 if(e.operation==='check'&&message.includes('确认出稿前：')&&/仍待决策|未回答/.test(message)){
  const errors=message.split('待产品回答：')[0].split('\n').filter(s=>s.startsWith('- '));
  if(errors.length&&errors.every(s=>/确认出稿前：.*(?:仍待决策|未回答)$/.test(s)))return 'business_pending';
 }
 if(p?.tool==='figma-workflow'&&p.stage==='preflight'){
  if(/尚无可移植构建数据：/.test(message))return 'component_unsupported';
  if(/关键业务决策仍未回答/.test(message))return 'business_pending';
 }
 return e.errorCode==='validation'?'validation':'execution';
}
export const isWaiting=e=>['business_pending','target_required'].includes(eventCategory(e));
export function helpEventIds(events){
 const runs=new Set(events.filter(e=>e.phase==='start'&&['--help','-h','help'].includes(e.context?.command??e.details?.payload?.command)&&!(e.details?.payload?.args?.length)).map(e=>JSON.stringify([e.client,e.taskId,e.runId])));
 return new Set(events.filter(e=>runs.has(JSON.stringify([e.client,e.taskId,e.runId]))).map(e=>e.id));
}
export function eventVersion(e){return {skillVersion:e.context?.skillVersion??null,build:e.build,buildSource:e.context?.buildSource??(e.build==='unknown'?'unknown':'git')};}
