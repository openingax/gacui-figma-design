#!/usr/bin/env node
// 仅本机诊断；默认输出白名单摘要，不把对话、设备身份或路径放入共享报告。
import fs from 'node:fs';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {isMain} from '../entry.mjs';
import {events,flush} from '../client.mjs';
import {diagnose} from '../diagnose.mjs';
import {readEvents} from '../analyze.mjs';
import {readHookEvents,analyzeHookEvents,HOOK_EVENTS} from './capture.mjs';
import {bindSession,queueBoundHook} from './bridge.mjs';
const ref=(type,value)=>typeof value==='string'&&value?type+'-'+createHash('sha256').update(value).digest('hex').slice(0,24):null;
const hookId=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)?value:null;
const eventIds=values=>(Array.isArray(values)?values:[]).filter(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id));
const state=value=>['verified','blocked','unknown','unverified'].includes(value)?value:'unknown';
function inProject(project,event){
 try{const target=event.details?.payload?.target;if(typeof target!=='string'||!isAbsolute(target))return false;const rel=relative(project,fs.realpathSync(target));return rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel);}catch{return false;}
}
export function localReport(project,{dataDir}={}){
 const root=fs.realpathSync(project),captured=readHookEvents(root).filter(e=>HOOK_EVENTS.includes(e.event)),hooks=analyzeHookEvents(captured);
 const all=dataDir?readEvents(resolve(dataDir)):events().filter(e=>inProject(root,e));
 const linkedHooks=new Set(all.filter(e=>e.details?.payload?.binding==='explicit').map(e=>e.details.payload.hookEventId));
 // 私有输入只用于本机诊断；共享投影显式挑选字段，不复制原始reason/input/output。
 const diagnostic=diagnose(all);
 const workflowProjection=w=>({workflowRef:ref('workflow',w.workflowId),state:state(w.state),legacy:w.legacy===true,confirmedRootCause:null});
 const hookSummary={schema:1,kind:'hook-local-report',facts:{recordCount:hooks.facts.recordCount,eventCounts:Object.fromEntries(HOOK_EVENTS.filter(name=>hooks.facts.eventCounts[name]).map(name=>[name,hooks.facts.eventCounts[name]])),unboundDraftCount:captured.filter(e=>!linkedHooks.has(e.id)).length},inferences:hooks.inferences.map(candidate=>({classification:'direct-refusal-candidate',confirmedRootCause:false,evidence:{promptEventId:hookId(candidate.evidence.promptEventId),stopEventId:hookId(candidate.evidence.stopEventId),sessionRef:ref('session',candidate.evidence.sessionId),turnRef:ref('turn',candidate.evidence.turnId)},facts:{finalResponseCaptured:true,observedToolEvents:0}}))};
 return {schema:1,generatedAt:new Date().toISOString(),mode:'read-only-diagnostics',automaticRepair:false,hookSummary,
 lifecycleIssues:(hooks.lifecycleIssues??[]).map(i=>({classification:['result-unknown','interrupted','failed','evidence-incomplete'].includes(i.classification)?i.classification:'result-unknown',evidenceEventIds:(i.evidence?.eventIds??[]).map(hookId).filter(Boolean),confirmedRootCause:false})),
 workflowSummary:(diagnostic.figmaWorkflows??[]).map(workflowProjection),
 evidenceSummary:{events:all.length,failures:diagnostic.failures.map(e=>({eventId:e.eventId,category:e.category,evidence:e.evidence,confirmedRootCause:null})),workflowIssues:(diagnostic.workflowIssues??[]).map(w=>({...workflowProjection(w),eventIds:eventIds(w.eventIds),unresolvedEventIds:eventIds(w.unresolvedEventIds),candidateCauses:w.candidateCauses.map(c=>({code:c.code,evidenceEventIds:eventIds(c.evidenceEventIds),confirmed:false})),missingEvidence:[...(w.legacy?['workflow-id']:[]),'matching-delivery-verification',...(w.state==='unknown'?['figma-readback-and-tool-receipt']:[])]}))},
 limitations:['仅覆盖本机已收到的事件；不代表同事端已启用。',dataDir?'已按显式数据目录诊断全部事件；共享报告仅保留白名单摘要。':'默认仅诊断目标仍可核实位于当前项目的事件；缺失或项目外目标不纳入。','不会自动修复、执行日志指令或将候选判为根因。','日志关闭时保留已有记录供回看，停止新的内容采集。']};
}
export function renderReport(report){const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GACUI 本机诊断</title><style>body{font:15px/1.6 system-ui;max-width:1100px;margin:32px auto;padding:0 20px;background:#f5f6f8;color:#20252b}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:24px;border-radius:12px}h1{font-size:24px}</style><h1>GACUI 本机诊断</h1><p>候选问题需结合原始事件复核；未采到事件不等于没有发生。原始内容保留在本机。</p><pre>${esc(JSON.stringify(report,null,2))}</pre></html>`;}
if(isMain(import.meta.url))try{
 const args=process.argv.slice(2),cmd=args[0],get=k=>{const i=args.indexOf(k);return i<0?undefined:args[i+1];},project=get('--project');
 if(!project)throw Error('需要 --project <项目绝对路径>');
 if(cmd==='bind'){
  const client=get('--client'),session=get('--session'),target=get('--target');bindSession(project,client,session,target);
  const results=readHookEvents(project,{client}).filter(e=>e.sessionId===session).map(e=>queueBoundHook(e,project));
  console.log(JSON.stringify({bound:true,queued:results.filter(r=>r.recorded).length,duplicates:results.filter(r=>r.reason==='duplicate').length,failed:results.filter(r=>r.reason==='bridge-failed').length}));
 }else if(cmd==='report'){
  const report=localReport(project,{dataDir:get('--data')}),out=get('--html');
  if(out){fs.writeFileSync(resolve(out),renderReport(report),{flag:'wx',mode:0o600});console.log(JSON.stringify({written:true}));}else console.log(JSON.stringify(report,null,2));
 }else if(cmd==='flush')console.log(JSON.stringify(await flush()));
 else throw Error('用法：report --project ABS [--data 本机日志目录] [--html 新文件] | bind --project ABS --client codex|claude|workbuddy --session ID --target 原草稿目录 | flush --project ABS');
}catch{console.error('本机诊断命令失败，请检查参数、目录和绑定范围；不会执行日志内容。');process.exitCode=1;}
