// 只归纳日志能够证明的出稿状态，不从普通命令成功推断 Figma 已恢复。
export const figmaPayload=event=>event.details?.kind==='tool-call'&&event.details?.payload?.tool==='figma-workflow'?event.details.payload:null;
export const workflowId=payload=>typeof payload?.workflowId==='string'&&payload.workflowId.trim()?payload.workflowId:null;
export const verifiedFigma=event=>{
 const p=figmaPayload(event);
 return event.phase==='finish'&&event.outcome==='success'&&p?.stage==='verify'&&p.status==='completed'&&p.deliveryComplete===true;
};
export function recoverySuccess(event){
 if(event.phase!=='finish'||event.outcome!=='success'||['status','diff'].includes(event.operation))return false;
 return figmaPayload(event)?verifiedFigma(event):true;
}
const sameContext=(before,after)=>['fileKey','confirmedVersion'].every(key=>before[key]==null||before[key]===after[key]);

export function figmaWorkflows(events){
 const groups=new Map();
 for(const e of [...events].sort((a,b)=>String(a.at??'').localeCompare(String(b.at??'')))){
  const p=figmaPayload(e);if(!p||!['start','finish'].includes(e.phase))continue;
  const id=workflowId(p),key=JSON.stringify([e.client??null,e.taskId,id]);
  if(!groups.has(key))groups.set(key,{taskId:e.taskId,client:e.client??null,workflowId:id,legacy:id===null,firstAt:e.at??null,lastAt:e.at??null,events:[],pending:[],recoveryEventId:null});
  const g=groups.get(key);g.lastAt=e.at??null;g.events.push(e);
  // 无关联标识的旧日志无法证明是同一次请求，保留此前缺口，不能靠后续 verify 消除。
  if(id&&verifiedFigma(e)){
   // 文件到达顺序不代表操作顺序；同一毫秒且没有序号时，也不推断验证发生在阻断之后。
   g.pending=g.pending.filter(previous=>!sameContext(figmaPayload(previous),p)||!(Date.parse(e.at)>Date.parse(previous.at)));
   if(!g.pending.length)g.recoveryEventId=e.id;
  }else if(!verifiedFigma(e))g.pending.push(e);
 }
 // 旧问题只能由显式引用的同设备/任务、同目标/版本、较晚验证回执关闭。
 for(const e of events){
  const p=figmaPayload(e);
  if(!verifiedFigma(e)||!workflowId(p)||p.receipt?.verified!==true||!p.fileKey||p.confirmedVersion==null||!Array.isArray(p.resolvesEventIds))continue;
  for(const g of groups.values()){
   if(g.taskId!==e.taskId||g.client!==(e.client??null))continue;
   const count=g.pending.length;
   g.pending=g.pending.filter(previous=>!(p.resolvesEventIds.includes(previous.id)&&['fileKey','confirmedVersion'].every(k=>figmaPayload(previous)[k]===p[k])&&Date.parse(e.at)>Date.parse(previous.at)));
   if(count&&!g.pending.length)g.recoveryEventId=e.id;
  }
 }
 return [...groups.values()].map(g=>{
  const last=g.pending.at(-1)??g.events.at(-1),p=figmaPayload(last),unknown=g.pending.some(e=>figmaPayload(e).status==='unknown');
  const blocked=g.pending.some(e=>['blocked','failed'].includes(figmaPayload(e).status)||e.outcome==='error');
  const state=unknown?'unknown':blocked?'blocked':g.pending.length?'unverified':g.legacy&&!g.recoveryEventId?'unverified':'verified';
  const missingInformation=[];
  if(g.legacy)missingInformation.push('workflowId：旧日志无法可靠关联同一次出稿请求，后续成功不能证明此前阻断已恢复。');
  if(state!=='verified')missingInformation.push('同一 workflowId、目标及确认版本的 verify/completed 交付记录（回读与截图检查通过后记录）。');
  if(unknown)missingInformation.push('结果未知操作的实际 Figma 回读及原始工具回执；回读前不能判断写入成败或安全重试。');
  return {taskId:g.taskId,client:g.client,workflowId:g.workflowId,legacy:g.legacy,state,firstAt:g.firstAt,lastAt:g.lastAt,
   fileKey:p.fileKey??null,confirmedVersion:p.confirmedVersion??null,stage:p.stage,status:p.status,
   eventIds:g.events.map(e=>e.id),unresolvedEventIds:g.pending.map(e=>e.id),recoveryEventId:g.pending.length?null:g.recoveryEventId,missingInformation};
 });
}
