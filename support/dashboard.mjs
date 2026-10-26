#!/usr/bin/env node
import http from 'node:http';
import {resolve} from 'node:path';
import {isMain} from './entry.mjs';
import {buildReport} from './report.mjs';
export {buildReport,sourceKind,agentLabel} from './report.mjs';
const TZ='Asia/Shanghai';
const time=at=>at?new Intl.DateTimeFormat('zh-CN',{timeZone:TZ,dateStyle:'short',timeStyle:'short'}).format(new Date(at)):'—';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const table=(head,rows)=>`<div class="scroll"><table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${head.length}" class="muted">暂无数据</td></tr>`}</tbody></table></div>`;
const badge=s=>`<span class="badge ${({阻塞:'bad',未恢复:'warn',已确认:'ok'})[s]??''}">${esc(s)}</span>`;
export function renderHtml(r){
 const max=Math.max(1,...r.daily.map(d=>d.commands));
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GACUIAgent 使用情况</title><style>
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
<h1>GACUIAgent 使用情况</h1><div class="muted">生成于 ${esc(time(r.generatedAt))}（${TZ}）· 仅本机访问 · 刷新页面重新统计</div>
<div class="cards">${[['使用者',r.totals.people],['仅接入',r.totals.profileOnly],['登记设备',r.totals.devices],['任务',r.totals.tasks],['草稿命令',r.totals.commands],['错误',r.totals.errors],['阻塞任务',r.totals.blockedTasks],['反馈',r.totals.feedback]].map(([k,v])=>`<div class="card"><span class="muted">${k}</span><b>${v}</b></div>`).join('')}</div>
<h2>问题处理概况（只读）</h2>${table(['问题','状态','使用者','类型','次数','原因','负责人','修复'],(r.issues??[]).map(i=>[esc(i.number),esc(i.stateLabel),esc(i.person),i.kind==='technical'?'技术问题':'待跟进',i.count,`<div class="wrap">${esc(i.message)}</div>`,esc(i.assignee),esc(i.fixVersion)]))}
<p class="muted">处理记录独立于任务日志；请在正式网页问题中心操作。历史错误次数不会因关闭而减少。</p>
<h2>按使用者</h2>${table(['使用者','系统用户/主机','Git','系统','agent','Skill','首次','最近','活跃天数','任务','命令','近7天','修改(保存)','确认','错误','错误分类','阻塞任务','需求记录','agent轮次','工具错误','反馈/阻塞反馈','评审通过/退回','飞书/Figma/其他链接','接入失败','设备'],
 r.people.map(p=>[`<b>${esc(p.name)}</b>${p.events===0?' <span class="badge warn">仅接入</span>':''}`,esc([p.osUser,p.hostname].filter(Boolean).join(' @ ')||null),esc([p.gitName,p.gitEmail].filter(Boolean).join(' ')||null),esc(p.platform),esc(p.agent),esc(p.skillVersion),esc(time(p.firstSeen)),esc(time(p.lastSeen)),p.activeDays,p.tasks,p.commands,p.commands7d,p.saves,p.confirms,p.errors,esc(Object.entries(p.errorCodes).map(([k,v])=>k+'×'+v).join(' ')||null),p.blockedTasks,p.requestRounds,p.agentTurns,p.toolErrors,`${p.feedback}/${p.blockedFeedback}`,`${p.accepted}/${p.rejected}`,`${p.sources.feishu}/${p.sources.figma}/${p.sources.other}`,p.connectFailures,`<code>${esc((p.deviceId??p.client).slice(0,8))}</code>${p.revoked?' 已撤销':''}`]))}
<h2>按任务</h2>${table(['状态','使用者','任务目录','最新需求原文','首次','最近','命令','修改','版本','错误','最近错误','来源链接'],
 r.tasks.map(t=>[badge(t.status),esc(t.person),`<span title="${esc(t.taskId)}">${esc(t.target??t.taskId.slice(0,8))}</span>`,t.request?`<div class="wrap" title="${esc(t.request)}">${esc(t.request.length>120?t.request.slice(0,120)+'…':t.request)}</div>`:'<span class="muted">未记录</span>',esc(time(t.firstSeen)),esc(time(t.lastSeen)),t.commands,t.saves,t.version,t.errors,`<div class="wrap">${esc(t.lastError)}</div>`,t.sources.length]))}
<h2>近30天</h2>${table(['日期','活跃人数','草稿命令','错误',''],r.daily.slice().reverse().map(d=>[esc(d.date),d.people,d.commands,d.errors,`<span class="bar" style="width:${Math.round(d.commands/max*240)}px"></span>`]))}
<h2>最近错误</h2>${table(['时间','使用者','操作','分类','信息','任务'],r.recentErrors.map(e=>[esc(time(e.at)),esc(e.person),esc(e.operation),esc(e.errorCode),`<div class="wrap">${esc(e.message)}</div>`,`<code>${esc(e.taskId.slice(0,8))}</code>`]))}
<h2>使用的文档与链接</h2>${table(['类型','链接','使用者','最近'],r.sources.map(s=>[esc(s.kind),`<div class="wrap"><a href="${esc(s.url)}" rel="noreferrer" target="_blank">${esc(s.url)}</a></div>`,esc(s.person),esc(time(s.lastSeen))]))}
<p class="muted">Figma 阻断按同一工作流验证结果判断，状态查询成功不代表恢复；无关联标识的旧记录保留待核实。其他任务按失败与反馈记录判断。需求原文与链接取自草稿顶层 request（随保存自动上传）、草稿内容、反馈与 agent 记录。名称优先级：aliases.json → Git 姓名 → 系统用户名 → 设备编号。仅接入：只上报过客户端档案、没有任何事件的用户，计入使用者与邮件告警口径，但没有任务和命令数据。</p>
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
if(isMain(import.meta.url)){
 const [dir,port]=process.argv.slice(2);
 if(!dir){console.error('用法：node support/dashboard.mjs <数据目录> [端口，默认5190]');process.exitCode=1;}
 else{const server=await serve(resolve(dir),Number(port??5190));console.log('使用情况网页：http://127.0.0.1:'+server.address().port+'/');process.on('SIGTERM',()=>server.close(()=>process.exit(0)));}
}
