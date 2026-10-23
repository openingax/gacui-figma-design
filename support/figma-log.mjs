// Uses existing v2 tool-call events so deployed collectors need no schema upgrade.
import fs from 'node:fs';
import {join} from 'node:path';
import {trace,flush} from './client.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {isMain} from './entry.mjs';
export function figmaTrace(target,input){
 const {stage,status,reason,fileKey=null,receipt=null}=input;
 const workflowId=input.workflowId??process.env.GAC_FIGMA_WORKFLOW_ID??(stage==='request'&&status==='started'?randomUUID():null);
 if(workflowId!==null&&(typeof workflowId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(workflowId)))throw Error('Figma日志 workflowId 无效');
 const digest=workflowId?createHash('sha256').update(workflowId).digest('hex'):null;
 const runId=digest?`${digest.slice(0,8)}-${digest.slice(8,12)}-4${digest.slice(13,16)}-a${digest.slice(17,20)}-${digest.slice(20,32)}`:undefined;
 if(!['request','preflight','initialize','generate','verify'].includes(stage)||!['started','completed','blocked','failed','unknown'].includes(status)||typeof reason!=='string'||!reason.trim())throw Error('Figma日志需要有效 stage/status/reason');
 if(fileKey!==null&&(typeof fileKey!=='string'||!/^[a-zA-Z0-9]{22,128}$/.test(fileKey)))throw Error('Figma日志 fileKey 无效');
 if(receipt!==null&&(typeof receipt!=='object'||Array.isArray(receipt)))throw Error('Figma日志 receipt 无效');
 let confirmedVersion=null;try{confirmedVersion=JSON.parse(fs.readFileSync(join(target,'versions.json'),'utf8')).draftConfirmed??null;}catch{}
 const result=trace(target,{kind:'tool-call',runId,outcome:['blocked','failed','unknown'].includes(status)?'error':'success',payload:{tool:'figma-workflow',workflowId,stage,status,reason,error:['blocked','failed','unknown'].includes(status)?{message:reason}:null,fileKey,confirmedVersion,receipt,deliveryComplete:stage==='verify'&&status==='completed',userAccepted:null}});
 return {...result,workflowId};
}
export async function logFigma(target,input){
 const result=figmaTrace(target,input);let upload;try{upload=await flush();}catch{upload={state:'queued'};}return {...result,upload};
}
if(isMain(import.meta.url))try{const [target,input]=process.argv.slice(2);console.log(JSON.stringify(await logFigma(target,JSON.parse(fs.readFileSync(input,'utf8')))));}catch(e){console.error(e.message);process.exitCode=1;}
