// 浏览器与接收端共用验证；details 为可选的项目授权调优内容。
export const OPS = ['save','restore','label','star','confirm','recover','export','check','render','diff','status','agent','model','tool','route','review','unknown'];
export const ERRORS = ['none','validation','version_conflict','storage','unexpected','check_failed','preview_error'];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const TASK = /^[0-9a-f]{32}$/;
export function exactKeys(o, keys) { if (!o || typeof o!=='object' || Array.isArray(o) || Object.keys(o).some(k=>!keys.includes(k))) throw Error('invalid fields'); }
export function validEvent(e) {
 exactKeys(e,['id','taskId','runId','at','phase','operation','outcome','durationMs','before','after','build','dirty','platform','node','errorCode','details','context']);
 if(typeof e.id!=='string'||typeof e.runId!=='string'||typeof e.taskId!=='string'||typeof e.at!=='string'||!UUID.test(e.id)||!UUID.test(e.runId)||!TASK.test(e.taskId)||!/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(e.at)||!Number.isFinite(Date.parse(e.at))) throw Error('invalid identity');
 if(!['start','finish'].includes(e.phase)||!OPS.includes(e.operation)||!['running','success','error'].includes(e.outcome)||!ERRORS.includes(e.errorCode)) throw Error('invalid event');
 for(const k of ['durationMs','before','after']) if(!Number.isSafeInteger(e[k])||e[k]<0) throw Error('invalid count');
 if(typeof e.build!=='string'||typeof e.node!=='string'||!/^(?:[a-f0-9]{40}|unknown)$/.test(e.build)||typeof e.dirty!=='boolean'||!['darwin','win32','linux','other'].includes(e.platform)||!/^v\d+\.\d+\.\d+$/.test(e.node)) throw Error('invalid environment');
 if(e.context!==undefined){
  const c=e.context;exactKeys(c,['command','exitCode','category','message','skillVersion','buildSource','evidenceSource']);
  for(const k of ['command','category','message','skillVersion','buildSource','evidenceSource'])if(c[k]!==undefined&&(typeof c[k]!=='string'||c[k].length>(k==='message'?1200:100)))throw Error('invalid context');
  if(c.exitCode!==undefined&&!Number.isSafeInteger(c.exitCode))throw Error('invalid exitCode');
 }
 if(e.details!==undefined){
  exactKeys(e.details,['schema','kind','payload']);
  if(e.details.schema!==1||!['draft-command','agent-turn','model-call','tool-call','route','ui-review'].includes(e.details.kind)||!e.details.payload||typeof e.details.payload!=='object'||Array.isArray(e.details.payload)||new TextEncoder().encode(JSON.stringify(e.details)).length>2*1024*1024)throw Error('invalid tuning details');
 }
 return e;
}
export function validFeedback(f) {
 exactKeys(f,['schema','id','taskId','runId','at','version','page','state','category','description','expected','events','attachments']);
 if(typeof f.id!=='string'||typeof f.taskId!=='string'||typeof f.at!=='string'||!(f.runId===null||typeof f.runId==='string')||f.schema!==1||!UUID.test(f.id)||!TASK.test(f.taskId)||!(f.runId===null||UUID.test(f.runId))||!Number.isFinite(Date.parse(f.at))||!Number.isSafeInteger(f.version)||f.version<1) throw Error('invalid identity');
 for(const k of ['page','state']) if(typeof f[k]!=='string'||f[k].length>200) throw Error('invalid context');
 if(!['other','understanding','component','lost-change','display','blocked'].includes(f.category)) throw Error('invalid category');
 if(typeof f.description!=='string'||!f.description.trim()||f.description.length>4000||typeof f.expected!=='string'||f.expected.length>4000) throw Error('invalid description');
 if(!Array.isArray(f.events)||f.events.length>30) throw Error('invalid events');f.events.forEach(validEvent);
 if(f.events.some(e=>e.taskId!==f.taskId)) throw Error('invalid task association');
 exactKeys(f.attachments,['draft','screenshot']);
 if(f.attachments.draft!==undefined && (!f.attachments.draft||typeof f.attachments.draft!=='object'||Array.isArray(f.attachments.draft)||JSON.stringify(f.attachments.draft).length>1000000)) throw Error('invalid draft');
 if(f.attachments.screenshot!==undefined && (typeof f.attachments.screenshot!=='string'||f.attachments.screenshot.length>2800000||!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(f.attachments.screenshot))) throw Error('invalid screenshot');
 return f;
}
