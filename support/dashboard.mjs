#!/usr/bin/env node
// 维护者本机只读统计网页：只监听 127.0.0.1，不提供公网访问；日志内容只作为数据转义展示。
import http from 'node:http';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validEvent,validFeedback} from './protocol.mjs';

const TZ='Asia/Shanghai';
const DRAFT_OPS=['save','restore','label','star','confirm','recover','export','check','render','diff','status'];
const day=at=>new Intl.DateTimeFormat('sv-SE',{timeZone:TZ}).format(new Date(at));
const time=at=>at?new Intl.DateTimeFormat('zh-CN',{timeZone:TZ,dateStyle:'short',timeStyle:'short'}).format(new Date(at)):'—';
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
    days:new Set(),tasks:new Set(),firstSeen:null,lastSeen:null,commands:0,commands7d:0,saves:0,confirms:0,errors:0,errorCodes:{},agentTurns:0,toolErrors:0,feedback:0,blockedFeedback:0,accepted:0,rejected:0,blockedTasks:0,sources:new Set()});
  }
  return people.get(client);
 };
 const tasks=new Map();
 for(const e of events){
  const p=person(e.client);p.pathUser??=pathUser(e);p.days.add(day(e.at));p.tasks.add(e.taskId);p.firstSeen??=e.at;p.lastSeen=e.at;
  const key=e.client+':'+e.taskId;
  if(!tasks.has(key))tasks.set(key,{client:e.client,taskId:e.taskId,target:null,firstSeen:e.at,lastSeen:e.at,events:[],sources:new Set()});
  const t=tasks.get(key);t.lastSeen=e.at;t.events.push(e);t.target??=e.details?.payload?.target??null;
  for(const url of links(e.details?.payload)){t.sources.add(url);p.sources.add(url);}
  if(e.phase!=='finish')continue;
  if(DRAFT_OPS.includes(e.operation)){p.commands++;if(now-Date.parse(e.at)<7*86400000)p.commands7d++;}
  if(e.outcome==='success'&&e.operation==='save')p.saves++;
  if(e.outcome==='success'&&e.operation==='confirm')p.confirms++;
  if(e.outcome==='error'){p.errors++;p.errorCodes[e.errorCode]=(p.errorCodes[e.errorCode]??0)+1;}
  if(e.details?.kind==='agent-turn')p.agentTurns++;
  if(e.details?.kind==='tool-call'&&e.outcome==='error')p.toolErrors++;
  const q=e.details?.kind==='ui-review'?e.details.payload.quality:null;if(typeof q?.accepted==='boolean')q.accepted?p.accepted++:p.rejected++;
 }
 for(const f of feedback){const p=person(f.client);p.feedback++;if(f.category==='blocked')p.blockedFeedback++;for(const url of links([f.description,f.expected]))p.sources.add(url);}
 const errorMessage=e=>{const d=e.details?.payload;return String(d?.error?.message??d?.error??d?.output?.stderr??e.errorCode).slice(0,300);};
 const taskRows=[...tasks.values()].map(t=>{
  const finishes=t.events.filter(e=>e.phase==='finish');let trailing=0;for(const e of [...finishes].reverse()){if(e.outcome!=='error')break;trailing++;}
  const lastError=[...finishes].reverse().find(e=>e.outcome==='error');
  const blockedReport=feedback.some(f=>f.client===t.client&&f.taskId===t.taskId&&f.category==='blocked'&&!finishes.some(e=>e.outcome==='success'&&e.at>f.at));
  const confirmed=finishes.some(e=>e.operation==='confirm'&&e.outcome==='success');
  // 阻塞：最近连续失败≥2次，或报告阻塞后未再成功；最近一次失败记为“未恢复”。
  const status=trailing>=2||blockedReport?'阻塞':trailing===1?'未恢复':confirmed?'已确认':'正常';
  if(status==='阻塞')person(t.client).blockedTasks++;
  return {client:t.client,taskId:t.taskId,target:t.target,firstSeen:t.firstSeen,lastSeen:t.lastSeen,status,trailingErrors:trailing,
   commands:finishes.filter(e=>DRAFT_OPS.includes(e.operation)).length,saves:finishes.filter(e=>e.operation==='save'&&e.outcome==='success').length,
   errors:finishes.filter(e=>e.outcome==='error').length,version:Math.max(0,...t.events.map(e=>e.after)),lastError:lastError?errorMessage(lastError):null,
   sources:[...t.sources].map(url=>({url,kind:sourceKind(url)}))};
 }).sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen));
 const name=p=>aliases[p.client]??(p.deviceId&&aliases[p.deviceId])??p.profile?.gitName??p.profile?.osUser??p.pathUser??('设备 '+(p.deviceId??p.client).slice(0,8));
 const peopleRows=[...people.values()].map(p=>({client:p.client,name:name(p),deviceId:p.deviceId,revoked:p.revoked,
  osUser:p.profile?.osUser??p.pathUser,hostname:p.profile?.hostname??null,gitName:p.profile?.gitName??null,gitEmail:p.profile?.gitEmail??null,
  platform:p.profile?[p.profile.platform,p.profile.arch,p.profile.osRelease].filter(Boolean).join(' '):null,agent:p.profile?.agent?.CLAUDE_CODE_ENTRYPOINT??p.profile?.agent?.TERM_PROGRAM??(p.profile?.agent?.envNames?.length?p.profile.agent.envNames.join(','):null),
  skillVersion:p.profile?.skillVersion??null,connectFailures:p.profile?.connectFailures?.length??0,profileSeen:p.profileSeen,
  firstSeen:p.firstSeen,lastSeen:p.lastSeen,activeDays:p.days.size,tasks:p.tasks.size,commands:p.commands,commands7d:p.commands7d,saves:p.saves,confirms:p.confirms,
  errors:p.errors,errorCodes:p.errorCodes,agentTurns:p.agentTurns,toolErrors:p.toolErrors,feedback:p.feedback,blockedFeedback:p.blockedFeedback,blockedTasks:p.blockedTasks,
  accepted:p.accepted,rejected:p.rejected,sources:{feishu:[...p.sources].filter(u=>sourceKind(u)==='飞书').length,figma:[...p.sources].filter(u=>sourceKind(u)==='Figma').length,other:[...p.sources].filter(u=>sourceKind(u)==='其他').length}}))
  .sort((a,b)=>String(b.lastSeen).localeCompare(String(a.lastSeen)));
 const daily=new Map();for(let i=29;i>=0;i--)daily.set(day(now-i*86400000),{date:day(now-i*86400000),commands:0,errors:0,people:new Set()});
 for(const e of events){const d=daily.get(day(e.at));if(!d||e.phase!=='finish')continue;d.people.add(e.client);if(DRAFT_OPS.includes(e.operation))d.commands++;if(e.outcome==='error')d.errors++;}
 const names=Object.fromEntries(peopleRows.map(p=>[p.client,p.name]));
 return {
  generatedAt:new Date(now).toISOString(),
  totals:{people:peopleRows.length,devices:Object.keys(devices).length,events:events.length,tasks:taskRows.length,commands:peopleRows.reduce((n,p)=>n+p.commands,0),errors:peopleRows.reduce((n,p)=>n+p.errors,0),blockedTasks:taskRows.filter(t=>t.status==='阻塞').length,feedback:feedback.length},
  people:peopleRows,
  tasks:taskRows.map(t=>({...t,person:names[t.client]})),
  daily:[...daily.values()].map(d=>({date:d.date,commands:d.commands,errors:d.errors,people:d.people.size})),
  recentErrors:events.filter(e=>e.phase==='finish'&&e.outcome==='error').slice(-50).reverse().map(e=>({at:e.at,person:names[e.client],taskId:e.taskId,operation:e.operation,errorCode:e.errorCode,message:errorMessage(e)})),
  sources:[...new Map(taskRows.flatMap(t=>t.sources.map(s=>[s.url,{...s,person:names[t.client],taskId:t.taskId,lastSeen:t.lastSeen}]))).values()].sort((a,b)=>b.lastSeen.localeCompare(a.lastSeen))
 };
}

const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const table=(head,rows)=>`<div class="scroll"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}" class="muted">暂无数据</td></tr>`}</tbody></table></div>`;
const badge=s=>`<span class="badge ${({阻塞:'bad',未恢复:'warn',已确认:'ok'})[s]??''}">${esc(s)}</span>`;
export function renderHtml(r){
 const max=Math.max(1,...r.daily.map(d=>d.commands));
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GACUI 使用情况</title><style>
:root{--bg:#f6f7f9;--card:#fff;--text:#1d2129;--muted:#86909c;--line:#e5e6eb;--ok:#00b42a;--warn:#ff7d00;--bad:#f53f3f;--bar:#3370ff}
@media (prefers-color-scheme:dark){:root{--bg:#17171a;--card:#232324;--text:#e5e6eb;--muted:#86909c;--line:#3a3a3d;--bar:#4c8dff}}
body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 "PingFang SC","Noto Sans SC",system-ui,sans-serif}
main{max-width:1400px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}
.muted{color:var(--muted)}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;margin-top:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}.card b{display:block;font-size:24px}
.scroll{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;white-space:nowrap}th{color:var(--muted);font-weight:500}
td.wrap{white-space:normal;min-width:240px;max-width:520px;word-break:break-all}.badge{padding:1px 6px;border-radius:4px;border:1px solid var(--line)}
.badge.bad{color:var(--bad);border-color:var(--bad)}.badge.warn{color:var(--warn);border-color:var(--warn)}.badge.ok{color:var(--ok);border-color:var(--ok)}
.bar{display:inline-block;height:8px;background:var(--bar);border-radius:4px;vertical-align:middle}a{color:var(--bar)}code{font-size:12px}
</style></head><body><main>
<h1>GACUI 使用情况</h1><div class="muted">生成于 ${esc(time(r.generatedAt))}（${TZ}）· 仅本机访问 · 刷新页面重新统计</div>
<div class="cards">${[['使用者',r.totals.people],['登记设备',r.totals.devices],['任务',r.totals.tasks],['草稿命令',r.totals.commands],['错误',r.totals.errors],['阻塞任务',r.totals.blockedTasks],['反馈',r.totals.feedback]].map(([k,v])=>`<div class="card"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}</div>
<h2>按使用者</h2>${table(['使用者','系统用户/主机','Git','系统','agent','Skill','首次','最近','活跃天数','任务','命令','近7天','修改(保存)','确认','错误','错误分类','阻塞任务','agent轮次','工具错误','反馈/阻塞反馈','评审通过/退回','飞书/Figma/其他链接','接入失败','设备'],
 r.people.map(p=>[`<b>${esc(p.name)}</b>`,esc([p.osUser,p.hostname].filter(Boolean).join(' @ ')||null),esc([p.gitName,p.gitEmail].filter(Boolean).join(' ')||null),esc(p.platform),esc(p.agent),esc(p.skillVersion),esc(time(p.firstSeen)),esc(time(p.lastSeen)),p.activeDays,p.tasks,p.commands,p.commands7d,p.saves,p.confirms,p.errors,esc(Object.entries(p.errorCodes).map(([k,v])=>k+'×'+v).join(' ')||null),p.blockedTasks,p.agentTurns,p.toolErrors,`${p.feedback}/${p.blockedFeedback}`,`${p.accepted}/${p.rejected}`,`${p.sources.feishu}/${p.sources.figma}/${p.sources.other}`,p.connectFailures,`<code>${esc((p.deviceId??p.client).slice(0,8))}</code>${p.revoked?' 已撤销':''}`]))}
<h2>按任务</h2>${table(['状态','使用者','任务目录','首次','最近','命令','修改','版本','错误','最近错误','来源链接'],
 r.tasks.map(t=>[badge(t.status),esc(t.person),`<span title="${esc(t.taskId)}">${esc(t.target??t.taskId.slice(0,8))}</span>`,esc(time(t.firstSeen)),esc(time(t.lastSeen)),t.commands,t.saves,t.version,t.errors,`<div class="wrap">${esc(t.lastError)}</div>`,t.sources.length]))}
<h2>近30天</h2>${table(['日期','活跃人数','草稿命令','错误',''],r.daily.slice().reverse().map(d=>[esc(d.date),d.people,d.commands,d.errors,`<span class="bar" style="width:${Math.round(d.commands/max*240)}px"></span>`]))}
<h2>最近错误</h2>${table(['时间','使用者','操作','分类','信息','任务'],r.recentErrors.map(e=>[esc(time(e.at)),esc(e.person),esc(e.operation),esc(e.errorCode),`<div class="wrap">${esc(e.message)}</div>`,`<code>${esc(e.taskId.slice(0,8))}</code>`]))}
<h2>使用的文档与链接</h2>${table(['类型','链接','使用者','最近'],r.sources.map(s=>[esc(s.kind),`<div class="wrap"><a href="${esc(s.url)}" rel="noreferrer" target="_blank">${esc(s.url)}</a></div>`,esc(s.person),esc(time(s.lastSeen))]))}
<p class="muted">阻塞：任务最近连续失败≥2次，或提交“阻塞”反馈后未再成功；未恢复：最近一次失败。链接从需求原文、草稿、反馈与 agent 记录中提取。名称优先级：aliases.json → Git 姓名 → 系统用户名 → 设备编号。</p>
</main></body></html>`;
}

export function serve(dataDir,port=5190){
 const server=http.createServer((req,res)=>{
  // 只接受本机 Host，防止 DNS 重绑定把本机页面暴露给外部网页。
  if(!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host??'')){res.writeHead(403);return res.end('forbidden');}
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  try{
   const report=buildReport(dataDir);
   if(req.url==='/report.json'){res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});return res.end(JSON.stringify(report,null,2));}
   if(req.url!=='/'){res.writeHead(404);return res.end('not found');}
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'",'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(renderHtml(report));
  }catch(error){res.writeHead(500,{'Content-Type':'text/plain; charset=utf-8'});res.end('统计失败：'+error.message);}
 });
 return new Promise(done=>server.listen(port,'127.0.0.1',()=>done(server)));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [dir,port]=process.argv.slice(2);
 if(!dir){console.error('用法：node support/dashboard.mjs <数据目录> [端口，默认5190]');process.exitCode=1;}
 else{const server=await serve(resolve(dir),Number(port??5190));console.log('使用情况网页：http://127.0.0.1:'+server.address().port+'/');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}
}
