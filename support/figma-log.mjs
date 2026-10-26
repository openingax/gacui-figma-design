// v2 transport; deploy collectors supporting optional event context before this client.
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {trace,flush,supportHome,tuningEnabled} from './client.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {isMain} from './entry.mjs';
export function figmaTrace(target,input){
 let {stage,status,reason,fileKey=null,receipt=null}=input;
 if(!tuningEnabled())return {recorded:false,reason:'tuning-disabled'};
 if(!['request','preflight','initialize','generate','verify'].includes(stage)||!['started','completed','blocked','failed','unknown'].includes(status)||typeof reason!=='string'||!reason.trim())throw Error('Figma日志需要有效 stage/status/reason');
 if(fileKey!==null&&(typeof fileKey!=='string'||!/^[a-zA-Z0-9]{22,128}$/.test(fileKey)))throw Error('Figma日志 fileKey 无效');
 if(receipt!==null&&(typeof receipt!=='object'||Array.isArray(receipt)))throw Error('Figma日志 receipt 无效');
 let confirmed=null;try{confirmed=JSON.parse(fs.readFileSync(join(target,'versions.json'),'utf8')).draftConfirmed??null;}catch{}
 const dir=join(supportHome(),'workflows');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const key=createHash('sha256').update(JSON.stringify([resolve(target),confirmed])).digest('hex');
 const file=join(dir,key+'.json'),lock=file+'.lock';
 // 并发调用不覆盖流程归属；调用者可以重试日志，不能因此重试 Figma 写入。
 fs.mkdirSync(lock);let workflowId;
 try{
  let prior;try{prior=JSON.parse(fs.readFileSync(file,'utf8'))}catch{}
  if(fileKey&&prior?.fileKey&&fileKey!==prior.fileKey)prior=null;
  workflowId=input.workflowId??process.env.GAC_FIGMA_WORKFLOW_ID??(stage==='request'&&status==='started'?randomUUID():prior?.workflowId??randomUUID());
  if(typeof workflowId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(workflowId))throw Error('Figma日志 workflowId 无效');
  fileKey??=prior?.fileKey??null;
  const temp=file+'.'+randomUUID();fs.writeFileSync(temp,JSON.stringify({workflowId,fileKey}),{flag:'wx',mode:0o600});fs.renameSync(temp,file);
 }finally{fs.rmdirSync(lock);}

 if(workflowId!==null&&(typeof workflowId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(workflowId)))throw Error('Figma日志 workflowId 无效');
 const digest=workflowId?createHash('sha256').update(workflowId).digest('hex'):null;
 const runId=digest?`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`:undefined;
 let confirmedVersion=null;try{confirmedVersion=JSON.parse(fs.readFileSync(join(target,'versions.json'),'utf8')).draftConfirmed??null;}catch{}
 const resolvesEventIds=input.resolvesEventIds??[];
 if(!Array.isArray(resolvesEventIds)||resolvesEventIds.length>100||resolvesEventIds.some(id=>typeof id!=='string'||!/^[0-9a-f-]{36}$/.test(id)))throw Error('恢复关联必须引用有效事件 ID');
 if(resolvesEventIds.length&&!(stage==='verify'&&status==='completed'&&receipt?.verified===true&&fileKey&&confirmedVersion!=null))throw Error('恢复旧问题需要目标、版本和 verified 回读回执');
 const result=trace(target,{kind:'tool-call',runId,outcome:['blocked','failed','unknown'].includes(status)?'error':'success',payload:{tool:'figma-workflow',category:input.category??null,evidenceSource:input.evidenceSource??'agent-report',resolvesEventIds,workflowId,stage,status,reason,error:['blocked','failed','unknown'].includes(status)?{message:reason}:null,fileKey,confirmedVersion,receipt,deliveryComplete:stage==='verify'&&status==='completed',userAccepted:null}});
 return {...result,workflowId};
}
export async function logFigma(target,input){
 const result=figmaTrace(target,input);let upload;try{upload=await flush();}catch{upload={state:'queued'};}return {...result,upload};
}
if(isMain(import.meta.url))try{const [target,input]=process.argv.slice(2);console.log(JSON.stringify(await logFigma(target,JSON.parse(fs.readFileSync(input,'utf8')))));}catch(e){console.error(e.message);process.exitCode=1;}
