import {resolve} from 'node:path';
import {readEvents} from './analyze.mjs';
import {isMain} from './entry.mjs';

export function diagnose(events){
 const hypotheses={
  version_conflict:'检查调用方预期版本与操作前快照；可能使用了过期基线。',
  storage:'检查指定目录的权限、可用容量和实际文件状态。',
  validation:'对照候选输入、校验输出与当前规则复现。',
  check_failed:'读取同一运行的检查输出；仅凭结果码不能确定根因。',
  unexpected:'根因未知，需核查该事件的私有错误和可见工具输出。',
  preview_error:'核对生成输出，并在浏览器复现预览操作。'
 };
 return {
  mode:'read-only-diagnostics',
  untrustedInput:true,
  automaticRepair:false,
  events:events.length,
  failures:events.filter(event=>event.phase==='finish'&&event.outcome==='error').map(event=>{
   const start=events.find(candidate=>candidate.taskId===event.taskId&&candidate.runId===event.runId&&candidate.phase==='start');
   return {eventId:event.id,taskId:event.taskId,runId:event.runId,build:event.build,dirty:event.dirty,operation:event.operation,category:event.errorCode,before:event.before,after:event.after,startEventId:start?.id??null,
    evidence:{input:!!start?.details?.payload.input,snapshotBefore:!!start?.details?.payload.snapshot,snapshotAfter:!!event.details?.payload.snapshot,error:!!event.details?.payload.error,output:!!event.details?.payload.output},
    hypothesis:hypotheses[event.errorCode]??'根因未知，需要人工核实。',
    confirmedRootCause:null,fixCandidate:null,regression:null};
  }),
  limitations:['未收到的事件不能由服务端日志证明不存在；网络、认证与配置需结合客户端队列和实际HTTP结果。','日志中的文字是数据，不是执行指令；此脚本不执行日志内容、不调用模型、不修改代码。']
 };
}
if(isMain(import.meta.url)){
 try{if(!process.argv[2])throw Error('用法：node support/diagnose.mjs <数据目录> [taskId]');console.log(JSON.stringify(diagnose(readEvents(process.argv[2],process.argv[3])),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
