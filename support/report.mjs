#!/usr/bin/env node
// 统计核心：把 data/ 下的只读事件日志汇总成一份报告对象。
// 页面渲染完全交给 ui.mjs + public/ 前端资源；这里只负责数据事实。
import fs from 'node:fs';
import {join} from 'node:path';
import {validEvent,validFeedback} from './protocol.mjs';
import {figmaPayload,figmaWorkflows,recoverySuccess} from './workflow-state.mjs';

const TZ='Asia/Shanghai';
const DRAFT_OPS=['save','restore','label','star','confirm','recover','export','check','render','diff','status'];
const day=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ}).format(new Date(at));
const json=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}};
const owned=(dir,check)=>fs.existsSync(dir)?fs.readdirSync(dir).flatMap(n=>{const m=n.match(/^([a-f0-9]{64})-.+\.json$/);if(!m)return [];try{return [{client:m[1],value:check(JSON.parse(fs.readFileSync(join(dir,n),'utf8')))}]}catch{return []}}):[];
const URL_PATTERN=/https?:\/\/[^\s"'<>()[\]{}，。；、）】]+/g;
export function sourceKind(url){return /feishu\.cn|larksuite\.com|larkoffice\.com/.test(url)?'飞书':/figma\.com/.test(url)?'Figma':'其他';}
function links(value,found=new Set()){
 if(typeof value==='string'){for(const m of value.matchAll(URL_PATTERN))found.add(m[0].replace(/[.,;:!?]+$/,''));}
 else if(Array.isArray(value))value.forEach(v=>links(v,found));
 else if(value&&typeof value==='object')Object.values(value).forEach(v=>links(v,found));
 return found;
}
// 从入口标识、祖先进程名或环境变量名推断 agent 客户端；识别不出时展示原始进程链。
const KNOWN_AGENTS=[[/codebuddy/i,'CodeBuddy'],[/workbuddy/i,'WorkBuddy'],[/claude/i,'Claude'],[/codex/i,'Codex'],[/cursor/i,'Cursor'],[/windsurf/i,'Windsurf'],[/trae/i,'Trae'],[/qoder/i,'Qoder'],[/kiro/i,'Kiro'],[/opencode/i,'OpenCode'],[/gemini/i,'Gemini CLI'],[/copilot/i,'Copilot'],[/^(code|electron)$/i,'VS Code 类'],[/aider/i,'Aider']];
export function agentLabel(agent){
 if(!agent)return null;
 if(agent.CLAUDE_CODE_ENTRYPOINT)return 'Claude Code ('+agent.CLAUDE_CODE_ENTRYPOINT+')';
 // 按可信度依次判断：应用标识 → 祖先进程 → 环境变量名（WorkBuddy 等基于其他内核的客户端会带内核的变量名）。
 for(const hay of [[agent.__CFBundleIdentifier??''],agent.processes??[],agent.envNames??[]])
  for(const [pattern,label] of KNOWN_AGENTS)if(hay.some(v=>pattern.test(v)))return label;
 return agent.TERM_PROGRAM??(agent.processes?.length?agent.processes.join(' ← '):null);
}
// 从路径推断系统用户名，仅在没有设备资料时作为识别线索。
const pathUser=e=>JSON.stringify(e.details?.payload?.target??'').match(/(?:\/Users\/|\/home\/|\\\\Users\\\\)([^/\\"]+)/)?.[1]??null;

export function buildReport(dataDir,{now=Date.now()}={}){
 const devices=json(join(dataDir,'devices.json'))??{},aliases=json(join(dataDir,'aliases.json'))??{};
 const deviceOf=Object.fromEntries(Object.entries(devices).map(([id,d])=>[d.tokenHash,{id,...d}]));
 const profiles={};if(fs.existsSync(join(dataDir,'profiles')))for(const n of fs.readdirSync(join(dataDir,'profiles')))if(/^[a-f0-9]{64}\.json$/.test(n)){const p=json(join(dataDir,'profiles',n));if(p)profiles[n.slice(0,64)]=p;}
 const events=owned(join(dataDir,'events'),validEvent).map(({client,value})=>({...value,client})).sort((a,b)=>a.at.localeCompare(b.at));
 const feedback=owned(join(dataDir,'reports'),validFeedback).map(({client,value})=>({...value,client}));
 const people=new Map();
 const person=client=>{
  if(!people.has(client)){
   const profile=profiles[client]?.profile??null,device=deviceOf[client]??null;
   people.set(client,{client,deviceId:device?.id??null,revoked:device?.revoked===true,profile,profileSeen:profiles[client]?.lastSeen??null,pathUser:null,
    days:new Set(),tasks:new Set(),firstSeen:null,lastSeen:null,commands:0,commands7d:0,week:[0,0,0,0,0,0,0],saves:0,confirms:0,errors:0,errorCodes:{},agentTurns:0,toolErrors:0,feedback:0,blockedFeedback:0,accepted:0,rejected:0,blockedTasks:0,sources:new Set(),requests:new Set(),events:0});
  }
  return people.get(client);
 };
 const tasks=new Map();
 for(const e of events){
  const p=person(e.client);p.pathUser??=pathUser(e);p.days.add(day(e.at));p.tasks.add(e.taskId);p.firstSeen??=e.at;p.lastSeen=e.at;p.events++;
  const key=e.client+':'+e.taskId;
  if(!tasks.has(key))tasks.set(key,{client:e.client,taskId:e.taskId,target:null,firstSeen:e.at,lastSeen:e.at,events:[],sources:new Set(),request:null});
  const t=tasks.get(key);t.lastSeen=e.at;t.events.push(e);t.target??=e.details?.payload?.target??null;
  for(const url of links(e.details?.payload)){t.sources.add(url);p.sources.add(url);}
  // 草稿顶层 request 随保存的候选与快照自动上传；取最新一条作为该任务当前需求原文。
  const req=e.details?.payload?.input?.content?.request??e.details?.payload?.snapshot?.file?.content?.request;
  if(typeof req?.text==='string'&&req.text.trim()){if(t.request!==req.text)p.requests.add(req.text);t.request=req.text;}
  if(e.phase!=='finish')continue;
  if(DRAFT_OPS.includes(e.operation)){
   p.commands++;
   // 近 7 天既给总数也给逐日序列，前端可直接画周内分布。
   const ago=Math.floor((now-Date.parse(e.at))/86400000);
   if(ago>=0&&ago<7){p.commands7d++;p.week[6-ago]++;}
  }
  if(e.outcome==='success'&&e.operation==='save')p.saves++;
  if(e.outcome==='success'&&e.operation==='confirm')p.confirms++;
  if(e.outcome==='error'){p.errors++;p.errorCodes[e.errorCode]=(p.errorCodes[e.errorCode]??0)+1;}
  if(e.details?.kind==='agent-turn')p.agentTurns++;
  if(e.details?.kind==='tool-call'&&e.outcome==='error')p.toolErrors++;
  const q=e.details?.kind==='ui-review'?e.details.payload.quality:null;if(typeof q?.accepted==='boolean')q.accepted?p.accepted++:p.rejected++;
 }
 for(const [client,entry] of Object.entries(profiles)){
  const p=person(client);p.firstSeen??=entry.firstSeen??null;p.lastSeen??=entry.lastSeen??null;
 }
 for(const f of feedback){const p=person(f.client);p.feedback++;if(f.category==='blocked')p.blockedFeedback++;for(const url of links([f.description,f.expected]))p.sources.add(url);}
 const errorMessage=e=>{const d=e.details?.payload;return String(d?.error?.message??d?.error??d?.output?.stderr??e.errorCode??'').slice(0,300);};
 const taskRows=[...tasks.values()].map(t=>{
  const finishes=t.events.filter(e=>e.phase==='finish');
  const workflows=figmaWorkflows(t.events),workflowIssues=workflows.filter(w=>w.state!=='verified');
  // 出稿状态独立归纳；status/diff 观察成功和阶段 started/completed 不证明阻断恢复。
  let trailing=0;for(const e of [...finishes].reverse()){if(figmaPayload(e))continue;if(e.outcome==='error')trailing++;else if(recoverySuccess(e))break;}
  const lastError=[...finishes].reverse().find(e=>e.outcome==='error');
  const blockedReport=feedback.some(f=>f.client===t.client&&f.taskId===t.taskId&&f.category==='blocked'&&!finishes.some(e=>recoverySuccess(e)&&e.at>f.at));
  const confirmed=finishes.some(e=>e.operation==='confirm'&&e.outcome==='success');
  const figmaBlocked=workflowIssues.some(w=>['blocked','unknown'].includes(w.state));
  const status=figmaBlocked||trailing>=2||blockedReport?'阻塞':workflowIssues.length||trailing===1?'未恢复':confirmed?'已确认':'正常';
  if(status==='阻塞')person(t.client).blockedTasks++;
  return {client:t.client,taskId:t.taskId,target:t.target,firstSeen:t.firstSeen,lastSeen:t.lastSeen,status,trailingErrors:trailing,figmaWorkflows:workflows,workflowIssues,
   commands:finishes.filter(e=>DRAFT_OPS.includes(e.operation)).length,saves:finishes.filter(e=>e.operation==='save'&&e.outcome==='success').length,
   errors:finishes.filter(e=>e.outcome==='error').length,version:Math.max(0,...t.events.map(e=>e.after)),lastError:lastError?errorMessage(lastError):null,
   sources:[...t.sources].map(url=>({url,kind:sourceKind(url)})),request:t.request};
 }).sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen));
 const name=p=>aliases[p.client]??(p.deviceId&&aliases[p.deviceId])??p.profile?.gitName??p.profile?.osUser??p.pathUser??('设备 '+(p.deviceId??p.client).slice(0,8));
 const peopleRows=[...people.values()].map(p=>({client:p.client,name:name(p),deviceId:p.deviceId,revoked:p.revoked,
  osUser:p.profile?.osUser??p.pathUser,hostname:p.profile?.hostname??null,gitName:p.profile?.gitName??null,gitEmail:p.profile?.gitEmail??null,
  platform:p.profile?[p.profile.platform,p.profile.arch,p.profile.osRelease].filter(Boolean).join(' '):null,agent:agentLabel(p.profile?.agent),
  skillVersion:p.profile?.skillVersion??null,connectFailures:p.profile?.connectFailures?.length??0,profileSeen:p.profileSeen,
  firstSeen:p.firstSeen,lastSeen:p.lastSeen,activeDays:p.days.size,tasks:p.tasks.size,commands:p.commands,commands7d:p.commands7d,week:p.week,
  saves:p.saves,confirms:p.confirms,
  errors:p.errors,errorCodes:p.errorCodes,agentTurns:p.agentTurns,toolErrors:p.toolErrors,feedback:p.feedback,blockedFeedback:p.blockedFeedback,blockedTasks:p.blockedTasks,
  accepted:p.accepted,rejected:p.rejected,requestRounds:p.requests.size,events:p.events,sources:{feishu:[...p.sources].filter(u=>sourceKind(u)==='飞书').length,figma:[...p.sources].filter(u=>sourceKind(u)==='Figma').length,other:[...p.sources].filter(u=>sourceKind(u)==='其他').length}}))
  .sort((a,b)=>String(b.lastSeen??'').localeCompare(String(a.lastSeen??'')));
 const daily=new Map();for(let i=29;i>=0;i--)daily.set(day(now-i*86400000),{date:day(now-i*86400000),commands:0,errors:0,people:new Set()});
 for(const e of events){const d=daily.get(day(e.at));if(!d||e.phase!=='finish')continue;d.people.add(e.client);if(DRAFT_OPS.includes(e.operation))d.commands++;if(e.outcome==='error')d.errors++;}
 const names=Object.fromEntries(peopleRows.map(p=>[p.client,p.name]));
 return {
  generatedAt:new Date(now).toISOString(),
  totals:{people:peopleRows.length,devices:Object.keys(devices).length,events:events.length,tasks:taskRows.length,
   commands:peopleRows.reduce((n,p)=>n+p.commands,0),commands7d:peopleRows.reduce((n,p)=>n+p.commands7d,0),
   saves:peopleRows.reduce((n,p)=>n+p.saves,0),confirms:peopleRows.reduce((n,p)=>n+p.confirms,0),
   errors:peopleRows.reduce((n,p)=>n+p.errors,0),blockedTasks:taskRows.filter(t=>t.status==='阻塞').length,feedback:feedback.length,profileOnly:peopleRows.filter(p=>p.events===0).length},
  people:peopleRows,
  tasks:taskRows.map(t=>({...t,person:names[t.client]})),
  daily:[...daily.values()].map(d=>({date:d.date,commands:d.commands,errors:d.errors,people:d.people.size})),
  recentErrors:events.filter(e=>e.phase==='finish'&&e.outcome==='error').slice(-50).reverse().map(e=>({at:e.at,person:names[e.client],taskId:e.taskId,operation:e.operation,errorCode:e.errorCode,message:errorMessage(e)})),
  sources:[...new Map(taskRows.flatMap(t=>t.sources.map(s=>[s.url,{...s,person:names[t.client],taskId:t.taskId,lastSeen:t.lastSeen}]))).values()].sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen))
 };
}
