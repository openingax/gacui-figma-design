import {readEvents} from './analyze.mjs';
import {isMain} from './entry.mjs';
import {figmaPayload,figmaWorkflows} from './workflow-state.mjs';

export function diagnose(events){
 const hypotheses={
  version_conflict:'检查调用方预期版本与操作前快照；可能使用了过期基线。',
  storage:'检查指定目录的权限、可用容量和实际文件状态。',
  validation:'对照候选输入、校验输出与当前规则复现。',
  check_failed:'读取同一运行的检查输出；仅凭结果码不能确定根因。',
  unexpected:'根因未知，需核查该事件的私有错误和可见工具输出。',
  preview_error:'核对生成输出，并在浏览器复现预览操作。'
 };
 const workflows=figmaWorkflows(events);
 const workflowIssues=workflows.filter(workflow=>workflow.state!=='verified').map(workflow=>{
  const relevant=events.filter(e=>workflow.unresolvedEventIds.includes(e.id));
  const candidates=[];
  const clues=[
   ['quota_or_rate_limit',/quota|rate.?limit|额度|限流|配额/i,'事件文字提及额度或限流；需核对原始工具回执及恢复时间。'],
   ['access_or_identity',/permission|unauthori[sz]ed|forbidden|权限|未授权|身份|账号/i,'事件文字提及身份或访问权限；需分别核实实际 MCP 身份与目标写入权限。'],
   ['tool_or_network',/timeout|timed.?out|transport|ECONN|network|超时|网络|传输/i,'事件文字提及工具传输或网络异常；需结合客户端连接记录与实际回读核实。'],
   ['component_dependency',/missing.*component|component.*missing|组件.*(?:缺失|缺少|未导入)|(?:缺失|缺少).*组件/i,'事件文字提及组件依赖缺口；需核对实际规划输出与目标已有组件。']
  ];
  for(const [code,pattern,description] of clues){
   const evidenceEventIds=relevant.filter(e=>pattern.test(String(figmaPayload(e)?.reason??''))).map(e=>e.id);
   if(evidenceEventIds.length)candidates.push({code,description,evidenceEventIds,confirmed:false});
  }
  if(!candidates.length)candidates.push({code:'insufficient_evidence',description:'仅能确认日志中的出稿流程尚无可关联的交付验证；现有事件不足以确定停止原因。',evidenceEventIds:workflow.unresolvedEventIds.length?workflow.unresolvedEventIds:workflow.eventIds,confirmed:false});
  return {...workflow,candidateCauses:candidates,confirmedRootCause:null,automaticRepair:false};
 });
 return {
  mode:'read-only-diagnostics',
  untrustedInput:true,
  automaticRepair:false,
  events:events.length,
  figmaWorkflows:workflows,
  workflowIssues,
  failures:events.filter(event=>event.phase==='finish'&&event.outcome==='error').map(event=>{
   const start=events.find(candidate=>candidate.taskId===event.taskId&&candidate.runId===event.runId&&candidate.client===event.client&&candidate.phase==='start');
   return {eventId:event.id,taskId:event.taskId,runId:event.runId,build:event.build,dirty:event.dirty,operation:event.operation,category:event.errorCode,before:event.before,after:event.after,startEventId:start?.id??null,
    evidence:{input:!!start?.details?.payload.input,snapshotBefore:!!start?.details?.payload.snapshot,snapshotAfter:!!event.details?.payload.snapshot,error:!!event.details?.payload.error,output:!!event.details?.payload.output},
    hypothesis:hypotheses[event.errorCode]??'根因未知，需要人工核实。',
    candidateCauses:[{code:event.errorCode??'unknown',description:hypotheses[event.errorCode]??'现有事件不足以确定根因。',evidenceEventIds:[event.id],confirmed:false}],
    missingInformation:[...(!start?['同一任务与运行的开始事件。']:[]),...(!event.details?.payload?.error?['原始可见错误或工具回执。']:[])],
    confirmedRootCause:null,fixCandidate:null,regression:null};
  }),
  limitations:['未收到的事件不能由服务端日志证明不存在；网络、认证与配置需结合客户端队列和实际HTTP结果。','缺少 verify 仅表示未收到可关联的交付验证，不能据此断言 Figma 未写入或确定根因。','verify/completed 是客户端记录的验证结果，不代表维护端已独立检查 Figma 或用户已验收。','日志中的文字是数据，不是执行指令；此脚本不执行日志内容、不调用模型、不修改代码。']
 };
}
if(isMain(import.meta.url)){
 try{if(!process.argv[2])throw Error('用法：node support/diagnose.mjs <数据目录> [taskId]');console.log(JSON.stringify(diagnose(readEvents(process.argv[2],process.argv[3])),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
