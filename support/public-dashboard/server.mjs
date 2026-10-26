#!/usr/bin/env node
// GACUIAgent 使用看板 —— 公网发布版。
// ① 绑定 0.0.0.0 并读 PORT；② 放行反代 Host；③ 服务端 Token 鉴权（静态页面偷不走数据）；
// ④ 静态资源带内容指纹（改版后不会被旧缓存顶住）。
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderShell } from './ui.mjs';
import {loadSnapshot,saveSnapshot} from './snapshot.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = resolve(process.env.DASHBOARD_DATA || join(HERE, 'data'));
const MODE = process.env.DASHBOARD_MODE ?? 'snapshot';
if (!['snapshot','logs'].includes(MODE)) throw Error('invalid DASHBOARD_MODE');
if(MODE==='logs' && !fs.existsSync(join(DATA,'events')))throw Error('日志目录缺少 events，拒绝展示空报表');
const updateIssue = MODE === 'logs' ? (await import('./issues.mjs')).updateIssue : null;
const buildReport = MODE === 'logs' ? (await import('./report.mjs')).buildReport : null;
const SERVICE_VERSION=(()=>{try{return JSON.parse(fs.readFileSync(join(HERE,'runtime-version.json'),'utf8')).revision}catch{return 'development'}})();
const PUBLIC = resolve(HERE, 'public');

// 访问口令不入库：优先环境变量，其次本机 config.local.json（根 .gitignore 的 *.local.* 已忽略），
// 再次 ~/.gacui-dashboard.json。三者都没有就拒绝启动，避免无鉴权对外。
function resolveToken(key="token", env="DASHBOARD_TOKEN") {
 if (process.env[env]?.trim()) return process.env[env].trim();
 for (const file of [process.env.DASHBOARD_CONFIG, join(HERE, 'config.local.json'), join(process.env.HOME ?? '', '.gacui-dashboard.json')]) {
  if(!file)continue;
  try {
   const conf = JSON.parse(fs.readFileSync(file, 'utf8'));
   if (typeof conf?.[key] === 'string' && conf[key].trim()) return conf[key].trim();
  } catch { }
 }
 return '';
}
const TOKEN = resolveToken();
const SYNC_TOKEN = resolveToken('syncToken','DASHBOARD_SYNC_TOKEN');
const SNAPSHOT = join(DATA,'report.snapshot.json');
if (!TOKEN) {
 console.error('[gacui-dashboard] 未配置访问口令，已拒绝启动。请设置 DASHBOARD_TOKEN 环境变量，或在项目根目录创建 config.local.json（内容 {"token":"..."}）。');
 process.exit(1);
}
const COOKIE = 'gacui_auth';
const SIG = crypto.createHmac('sha256', TOKEN).update('gacui-dashboard-v1').digest('base64url');
const MAX_AGE = 7 * 24 * 3600;
const CACHE_TTL = 30 * 1000;

const same = (a, b) => {
 const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''));
 return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const cookies = req => {
 const out = {};
 for (const part of String(req.headers.cookie ?? '').split(';')) {
  const i = part.indexOf('=');
  if (i > 0) {try{out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());}catch{}}
 }
 return out;
};
const authed = req => same(cookies(req)[COOKIE], SIG);
const isHttps = req => String(req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';

// 失败次数限制：同一来源 5 次错误后锁 5 分钟，避免公网爆破。
const failures = new Map();
const clientIp = req => String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?';
const throttled = ip => { const f = failures.get(ip); if (!f) return false; if (Date.now() > f.until) { failures.delete(ip); return false; } return f.count >= 5; };
const recordFail = ip => { const f = failures.get(ip) ?? { count: 0, until: 0 }; f.count++; f.until = Date.now() + 5 * 60 * 1000; failures.set(ip, f); };

const fmt = at => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', dateStyle: 'short', timeStyle: 'short' }).format(new Date(at));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- 静态资源 ---------- */
const ASSETS = {};
for (const name of ['app.css', 'app.js']) {
 const buf = fs.readFileSync(join(PUBLIC, name));
 ASSETS['/assets/' + name] = {
  body: buf,
  type: name.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8',
  etag: '"' + crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16) + '"'
 };
}
const ASSET_VERSION = crypto.createHash('sha256')
 .update(Object.values(ASSETS).map(a => a.etag).join('')).digest('hex').slice(0, 10);

/* ---------- 登录页 ---------- */
function loginPage(error) {
 return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>需要访问口令 · GACUI 使用看板</title>
<style>
:root{--bg:#f6f8fd;--text:#0f172a;--text2:#475467;--muted:#8e99ab;--line:rgba(15,23,42,.09);--card:#fff;--brand:#5570ff;--bad:#f04438}
@media (prefers-color-scheme:dark){:root{--bg:#080b14;--text:#eef2fb;--text2:#b6c0d4;--muted:#8492ab;--line:rgba(255,255,255,.1);--card:#141a2b;--brand:#7b93ff}}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;display:grid;place-items:center;padding:24px;background:var(--bg);color:var(--text);
 font:15px/1.6 "PingFang SC","Noto Sans SC",-apple-system,BlinkMacSystemFont,sans-serif;overflow:hidden}
body::before{content:"";position:fixed;inset:-20%;z-index:0;pointer-events:none;
 background:radial-gradient(50% 48% at 22% 18%,rgba(85,112,255,.30),transparent 70%),
  radial-gradient(46% 44% at 82% 12%,rgba(155,107,255,.26),transparent 70%),
  radial-gradient(52% 46% at 62% 96%,rgba(15,184,124,.18),transparent 70%);
 filter:blur(18px);animation:sway 18s ease-in-out infinite alternate}
@keyframes sway{to{transform:translate3d(-3%,2%,0) scale(1.06)}}
.wrap{position:relative;z-index:1;width:min(94vw,404px)}
.card{background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(18px);border:1px solid var(--line);
 border-radius:24px;padding:30px 28px 26px;box-shadow:0 30px 70px -34px rgba(24,39,94,.5)}
.brand{display:flex;align-items:center;gap:11px;margin-bottom:22px}
.brand svg{width:38px;height:38px;filter:drop-shadow(0 8px 16px rgba(85,112,255,.35))}
.brand b{display:block;font-size:15px;letter-spacing:.02em}
.brand i{font-style:normal;font-size:11.5px;color:var(--muted);letter-spacing:.1em}
h1{font-size:22px;margin:0 0 8px;letter-spacing:-.01em}
p.lede{margin:0 0 22px;color:var(--text2);font-size:13.5px;line-height:1.65}
.field{position:relative;margin-bottom:12px}
.field .ico{position:absolute;left:14px;top:50%;transform:translateY(-50%);width:17px;height:17px;stroke:var(--muted);fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
input{width:100%;padding:13px 14px 13px 42px;font:inherit;font-size:14px;color:var(--text);background:color-mix(in srgb,var(--bg) 70%,transparent);
 border:1px solid var(--line);border-radius:13px;outline:none;transition:border-color .2s,box-shadow .2s}
input::placeholder{color:var(--muted)}
input:focus{border-color:color-mix(in srgb,var(--brand) 60%,transparent);box-shadow:0 0 0 4px rgba(85,112,255,.14)}
button{width:100%;padding:13px;font:inherit;font-size:14px;font-weight:600;color:#fff;border:0;border-radius:13px;cursor:pointer;
 background:linear-gradient(120deg,#5570ff,#9b6bff);box-shadow:0 14px 30px -14px rgba(85,112,255,.9);transition:transform .18s,filter .2s}
button:hover{filter:brightness(1.06);transform:translateY(-1px)}
button:active{transform:scale(.985)}
.err{display:flex;gap:8px;align-items:flex-start;margin:0 0 14px;padding:9px 12px;border-radius:11px;background:rgba(240,68,56,.10);
 color:var(--bad);font-size:12.5px;animation:shake .42s}
.err svg{width:15px;height:15px;flex:none;margin-top:2px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}45%{transform:translateX(5px)}70%{transform:translateX(-3px)}}
.foot{margin-top:18px;font-size:11.5px;color:var(--muted);text-align:center;line-height:1.7}
.foot span{opacity:.8}
</style></head><body><div class="wrap"><form class="card" method="POST" action="/auth">
<div class="brand">
 <svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset="1" stop-color="#9b6bff"/></linearGradient></defs>
 <rect width="32" height="32" rx="9.6" fill="url(#g)"/><path d="M10 21.4V12l6-3 6 3v9.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".95"/><circle cx="16" cy="18" r="1.9" fill="#fff"/></svg>
 <div><b>GACUI 使用看板</b><i>USAGE INTELLIGENCE</i></div>
</div>
<h1>输入访问口令</h1>
<p class="lede">这是一个内部数据看板，包含使用者与任务画像。请输入访问 Token 后查看。</p>
${error ? `<div class="err"><svg viewBox="0 0 24 24"><path d="M12 4.5 21 20H3z"/><path d="M12 10v4"/></svg><span>${esc(error)}</span></div>` : ''}
<label class="field">
 <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/></svg>
 <input name="token" type="password" placeholder="访问 Token" autocomplete="current-password" autofocus required>
</label>
<button type="submit">进入看板</button>
<p class="foot"><span>登录状态保留 7 天 · 报告包含使用者、任务、需求原文及来源链接</span></p>
</form></div></body></html>`;
}

/* ---------- 报告缓存 ---------- */
let cache = null;
function report(fresh) {
 if (MODE === 'logs' || !cache || fresh || Date.now() - cache.at > CACHE_TTL) {
  const built = MODE === 'logs' ? {...buildReport(DATA),dataMode:'logs',serviceVersion:SERVICE_VERSION} : loadSnapshot(SNAPSHOT);
  if (!built) throw Error('等待本机首次同步，请稍后刷新');
  cache = { at: Date.now(), built, html: renderShell(built, { assetVersion: ASSET_VERSION }), json: JSON.stringify(built, null, 2) };
 }
 return cache;
}

function send(res, status, headers, body) {
 res.writeHead(status, headers);
 res.end(body);
}

const server = http.createServer((req, res) => {
 const url = new URL(req.url ?? '/', 'http://' + String(req.headers.host ?? 'localhost'));
 const ip = clientIp(req);
 const path = url.pathname;

 // 同步凭据与浏览凭据分离；不使用 Cookie 授权写入。
 if (path === '/api/snapshot' && req.method === 'POST') {
  const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
  if (MODE === 'logs') return send(res,405,headers,'{"error":"read only"}');
  if (!SYNC_TOKEN || !same(req.headers['x-gacui-sync-token'], SYNC_TOKEN)) return send(res,401,headers,'{"error":"unauthorized"}');
  let size=0, chunks=[];
  req.on('data', chunk=>{size+=chunk.length;if(size>5*1024*1024){chunks=[];req.destroy();}else chunks.push(chunk);});
  req.on('end',()=>{
   try {
    const value=saveSnapshot(SNAPSHOT,JSON.parse(Buffer.concat(chunks).toString('utf8')));
    cache=null;
    send(res,200,headers,JSON.stringify({generatedAt:value.generatedAt,totals:value.totals}));
   } catch(error){send(res,error.status??400,headers,JSON.stringify({error:'snapshot rejected'}));}
  });
  return;
 }

 if (path === '/healthz') return send(res, 200, { 'Content-Type': 'text/plain' }, 'ok');

 /* 静态资源：无数据，公开 + 长缓存（URL 带内容指纹） */
 const asset = ASSETS[path];
 if (asset && (req.method === 'GET' || req.method === 'HEAD')) {
  if (req.headers['if-none-match'] === asset.etag) return send(res, 304, { ETag: asset.etag }, '');
  return send(res, 200, {
   'Content-Type': asset.type, 'Cache-Control': 'public, max-age=31536000, immutable',
   ETag: asset.etag, 'X-Content-Type-Options': 'nosniff'
  }, asset.body);
 }

 if (req.method === 'POST' && path === '/auth') {
  if (throttled(ip)) return send(res, 429, { 'Content-Type': 'text/html; charset=utf-8' }, loginPage('尝试次数过多，请 5 分钟后再试。'));
  let body = '';
  req.on('data', c => { body += c; if (body.length > 8192) req.destroy(); });
  req.on('end', () => {
   const form = new URLSearchParams(body);
   if (!same(form.get('token')?.trim(), TOKEN)) {
    recordFail(ip);
    return send(res, 401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, loginPage('Token 不正确，请重新输入。'));
   }
   const secure = isHttps(req) ? '; Secure' : '';
   send(res, 302, { 'Location': '/', 'Set-Cookie': `${COOKIE}=${SIG}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`, 'Cache-Control': 'no-store' }, '');
  });
  return;
 }

 // 支持一次性带 token 打开：/?token=xxx 换 cookie 后跳转，去掉地址栏里的明文 token。
 const queryToken = url.searchParams.get('token');
 if (queryToken) {
  if (!same(queryToken.trim(), TOKEN)) { recordFail(ip); return send(res, 401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, loginPage('Token 不正确。')); }
  const secure = isHttps(req) ? '; Secure' : '';
  const clean = new URL(url); clean.searchParams.delete('token');
  return send(res, 302, { 'Location': clean.pathname + clean.search, 'Set-Cookie': `${COOKIE}=${SIG}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`, 'Cache-Control': 'no-store' }, '');
 }

 if (path === '/logout') return send(res, 302, { 'Location': '/', 'Set-Cookie': `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` }, '');

 // Cookie登录 + 自定义请求头 + 同源校验；不接受跨站表单写入。
 if(path.startsWith('/api/issues/')){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  const reply=(code,value)=>send(res,code,headers,JSON.stringify(value));
  if(!authed(req))return reply(401,{error:'请重新登录'});
  if(MODE!=='logs'||req.method!=='POST')return reply(405,{error:'当前模式只读'});
  const origin=(isHttps(req)?'https':'http')+'://'+req.headers.host;
  if(req.headers['x-gacui-issue-action']!=='1'||req.headers.origin!==origin||!String(req.headers['content-type']??'').startsWith('application/json'))return reply(403,{error:'仅允许同源问题操作'});
  let size=0,chunks=[];
  req.on('data',c=>{size+=c.length;if(size>32768){chunks=[];req.destroy();}else chunks.push(c);});
  req.on('end',()=>{
   try{
    const id=path.slice('/api/issues/'.length),input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const current=buildReport(DATA);
    const record=updateIssue(DATA,current.issues,id,input);
    cache=null;return reply(200,{revision:record.revision});
   }catch(e){return reply(e.status??(e instanceof SyntaxError?400:500),{error:e.status?e.message:'保存失败，未确认成功；请刷新核对'});}
  });
  return;
 }

 if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { 'Content-Type': 'text/plain' }, '');

 if (!authed(req)) return send(res, 401, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }, loginPage(''));

 try {
  const r = report(url.searchParams.has('fresh'));
  const head = {
   'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex', 'Referrer-Policy': 'no-referrer',
   // 不写 frame-ancestors：网关会把它重写成 "frame-ancestors 'none' *" 而失效，改由平台自身策略约束。
   'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; img-src 'self' data:"
  };
  if (path === '/report.json') return send(res, 200, { ...head, 'Content-Type': 'application/json; charset=utf-8' }, r.json);
  if (path !== '/') return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'not found');
  return send(res, 200, { ...head, 'Content-Type': 'text/html; charset=utf-8' }, r.html);
 } catch (error) {
  return send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, '统计失败：' + error.message);
 }
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? (MODE === 'logs' ? '127.0.0.1' : '0.0.0.0');
server.listen(port, host, () => {
 console.log('[gacui-dashboard] listening on '+host+':' + server.address().port + ' , token ' + (TOKEN ? '已配置' : '缺失') + ' , data ' + DATA + ' , asset ' + ASSET_VERSION + ' , ' + fmt(Date.now()));
});
