#!/usr/bin/env node
// 本地/SSH 分析；不提供公网查询，也不自动调用模型或训练 API。
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validEvent,TASK} from './protocol.mjs';
export function readEvents(directory,task){
 if(task&&!TASK.test(task))throw Error('任务标识无效');
 const dir=join(directory,'events');
 if(!fs.existsSync(dir))throw Error('未找到 events 目录');
 return fs.readdirSync(dir).filter(n=>/^(?:[a-f0-9]{64}-)?[a-f0-9-]+\.json$/.test(n)).map(n=>validEvent(JSON.parse(fs.readFileSync(join(dir,n),'utf8')))).filter(e=>!task||e.taskId===task).sort((a,b)=>a.at.localeCompare(b.at));
}
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const percentile=(a,p)=>a.length?[...a].sort((x,y)=>x-y)[Math.max(0,Math.ceil(a.length*p)-1)]:null;
function qualityIndex(all){
 const reviews=new Map();
 for(const e of all)if(e.details?.kind==='ui-review'&&typeof e.details.payload.targetEventId==='string'&&typeof e.details.payload.quality?.accepted==='boolean'&&typeof e.details.payload.quality?.source==='string')reviews.set(e.details.payload.targetEventId,{taskId:e.taskId,...e.details.payload});
 return event=>{const review=reviews.get(event.id);return review?.taskId===event.taskId?{quality:review.quality,correction:review.correction??null}:{quality:event.details?.payload.quality??null,correction:null};};
}
export function summarize(all){
 const qualityFor=qualityIndex(all);
 const groups=new Map();
 for(const e of all.filter(e=>e.phase==='finish')){
  const p=e.details?.payload??{},metrics=p.metrics??{};
  const identity={kind:e.details?.kind??e.operation,model:p.model??null,provider:p.provider??null,route:p.route??null};
  const key=JSON.stringify(identity);
  if(!groups.has(key))groups.set(key,{...identity,count:0,errors:0,latencies:[],inputTokens:0,outputTokens:0,tokenSamples:0,retries:0,retrySamples:0,accepted:0,reviewed:0});
  const g=groups.get(key);g.count++;if(e.outcome==='error')g.errors++;
  // CLI 的时长来自实际时钟；agent 手填接口须明确提供测量值，未知不当作零延迟。
  const measured=finite(metrics.latencyMs)?metrics.latencyMs:(e.details?.kind==='draft-command'||!e.details||p.durationMeasured===true)?e.durationMs:null;
  if(measured!==null)g.latencies.push(measured);
  if(finite(metrics.inputTokens)&&finite(metrics.outputTokens)){g.inputTokens+=metrics.inputTokens;g.outputTokens+=metrics.outputTokens;g.tokenSamples++;}
  if(Number.isSafeInteger(metrics.retries)&&metrics.retries>=0){g.retries+=metrics.retries;g.retrySamples++;}
  const {quality}=qualityFor(e);if(typeof quality?.accepted==='boolean'){g.reviewed++;if(quality.accepted)g.accepted++;}
 }
 return {events:all.length,detailed:all.filter(e=>e.details).length,groups:[...groups.values()].map(({latencies,...g})=>({...g,latencySamples:latencies.length,latencyP50Ms:percentile(latencies,.5),latencyP95Ms:percentile(latencies,.95)}))};
}
export function dataset(all,{acceptedOnly=false}={}){
 const qualityFor=qualityIndex(all);
 return all.filter(e=>['agent-turn','model-call'].includes(e.details?.kind)).flatMap(e=>{
  const p=e.details.payload,{quality,correction}=qualityFor(e);if(typeof p.input!=='string'||typeof p.output!=='string'||(acceptedOnly&&quality?.accepted!==true))return [];
  return [{id:e.id,taskId:e.taskId,runId:e.runId,at:e.at,input:p.input,output:p.output,model:p.model??null,provider:p.provider??null,route:p.route??null,metrics:p.metrics??null,quality,correction,build:e.build}];
 });
}
export function exportJsonl(file,rows){fs.writeFileSync(file,rows.map(r=>JSON.stringify(r)).join('\n')+(rows.length?'\n':''),{flag:'wx',mode:0o600});return rows.length;}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [cmd,dir,out,...flags]=process.argv.slice(2);
  if(!dir||!['summary','export','dataset'].includes(cmd)||flags.some(f=>f!=='--accepted-only')||(flags.length&&cmd!=='dataset'))throw Error('用法：summary <数据目录> | export <目录> <新文件.jsonl> | dataset <目录> <新文件.jsonl> [--accepted-only]');
  const all=readEvents(dir);
  if(cmd==='summary')console.log(JSON.stringify(summarize(all),null,2));
  else{if(!out)throw Error('需要新输出文件');const rows=cmd==='dataset'?dataset(all,{acceptedOnly:flags.includes('--accepted-only')}):all;console.log(JSON.stringify({written:exportJsonl(out,rows),excluded:all.length-rows.length}));}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
