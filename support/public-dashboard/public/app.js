/* GACUI 使用看板 —— 浏览器端渲染与交互
   纯手写，无外部依赖；所有数据来自 #gacui-data 的 JSON 块。 */
(() => {
 'use strict';

 let DATA = JSON.parse(document.getElementById('gacui-data').textContent || '{}');
 const $ = (s, r = document) => r.querySelector(s);
 const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 const sum = (arr, f) => arr.reduce((n, x) => n + (Number(f(x)) || 0), 0);
 const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
 const icon = (n, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
 const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

 /* ---------------- 时间与格式化 ---------------- */
 const TZ = 'Asia/Shanghai';
 const pad = n => String(n).padStart(2, '0');
 function parts(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat('en-CA', {
   timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(d).reduce((o, x) => (o[x.type] = x.value, o), {});
  return p;
 }
 function fmtShort(iso) { const p = parts(iso); return p ? `${p.month}-${p.day} ${p.hour}:${p.minute}` : '—'; }
 function fmtFull(iso) { const p = parts(iso); return p ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` : '—'; }
 function fmtDay(date) { return String(date || '').slice(5).replace('-', '/'); }
 function rel(iso) {
  const t = Date.parse(iso);
  if (!t) return '—';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.round(h / 24);
  if (d === 1) return '昨天';
  if (d < 30) return d + ' 天前';
  return Math.round(d / 30) + ' 个月前';
 }

 /* ---------------- 视觉工具 ---------------- */
 const PALETTE = [
  ['#5b7cff', '#9b6bff'], ['#12b981', '#2dd4bf'], ['#f79009', '#f97362'],
  ['#8b5cf6', '#ec4899'], ['#0ea5e9', '#6366f1'], ['#14b8a6', '#84cc16'],
  ['#f43f5e', '#fb923c']
 ];
 const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
 const avatarStyle = key => { const [a, b] = PALETTE[hash(key) % PALETTE.length]; return `background:linear-gradient(140deg,${a},${b})`; };
 function initials(name) {
  const s = String(name || '?').trim();
  if (!s) return '?';
  if (/^[A-Za-z0-9]/.test(s)) {
   const words = s.match(/[A-Za-z0-9]+/g) || [];
   if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
   return s.slice(0, 1).toUpperCase();
  }
  return s.slice(0, 2);
 }
 const STATUS = {
  '正常': { k: 'ok', color: '#0fb87c' },
  '未恢复': { k: 'warn', color: '#f2890b' },
  '待业务确认': { k: 'warn', color: '#f2890b' },
  '待提供目标': { k: 'warn', color: '#f2890b' },
  '待验证': { k: 'info', color: '#5570ff' },
  '阻塞': { k: 'bad', color: '#f04438' },
  '已确认': { k: 'info', color: '#5570ff' }
 };
 const statusOf = s => STATUS[s] || { k: 'info', color: '#8e99ab' };

 function smoothPath(pts) {
  const n = pts.length;
  if (!n) return '';
  if (n < 3) return pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' ');
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0] || .001; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
   if (m[i - 1] * m[i] <= 0) t[i] = 0;
   else { const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1]; t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]); }
  }
  t[n - 1] = m[n - 2];
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
   const h = dx[i];
   const c1 = [pts[i][0] + h / 3, pts[i][1] + t[i] * h / 3];
   const c2 = [pts[i + 1][0] - h / 3, pts[i + 1][1] - t[i + 1] * h / 3];
   d += ` C ${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
 }

 function sparkline(values, { w = 84, h = 30, color = '#5570ff', id = 'sg' } = {}) {
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const pts = values.map((v, i) => [i * step, h - 3 - (v / max) * (h - 8)]);
  const d = smoothPath(pts);
  return `<svg class="spark-line" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
   <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".26"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
   <path class="area" d="${d} L ${w} ${h} L 0 ${h} Z" style="fill:url(#${id})"/>
   <path class="line" d="${d}" style="stroke:${color}"/></svg>`;
 }

 function ring(score, size = 46, color = '#0fb87c') {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const len = c * clamp(score, 0, 100) / 100;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="transform:rotate(-90deg)">
   <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="5"/>
   <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"
     stroke-dasharray="${len.toFixed(1)} ${(c - len).toFixed(1)}" style="transition:stroke-dasharray 1.1s cubic-bezier(.22,.8,.28,1)"/></svg>`;
 }

 function stackBar(counts) {
  const total = Math.max(1, Object.values(counts).reduce((a, b) => a + b, 0));
  const segs = Object.entries(counts).filter(([, v]) => v > 0)
   .map(([k, v]) => `<i style="width:${(v / total * 100).toFixed(1)}%;background:${statusOf(k).color}"></i>`).join('');
  return `<span class="sbar">${segs}</span>`;
 }

 /* ---------------- 汇总指标 ---------------- */
 let people,tasks,daily,sources,errors,totals,saves,confirms,feedback,commands7d,errCount,cmdCount,blocked,unrecovered,errRate,health,healthTxt,days7,taskStatusCount;
 function derive(){
 people = Array.isArray(DATA.people) ? DATA.people : [];
 tasks = Array.isArray(DATA.tasks) ? DATA.tasks : [];
 daily = Array.isArray(DATA.daily) ? DATA.daily : [];
 // 同一文档常被反复提交（带 / 不带跟踪参数），按 host+path 归并，只留最近一次。
 sources = (() => {
  const raw = Array.isArray(DATA.sources) ? DATA.sources : [];
  const key = u => { try { const x = new URL(u); return x.host + x.pathname.replace(/\/$/, ''); } catch { return u; } };
  const merged = new Map();
  for (const s of raw) {
   const k = key(s.url), prev = merged.get(k);
   if (!prev || String(s.lastSeen) > String(prev.lastSeen)) merged.set(k, s);
  }
  return [...merged.values()].sort((a, b) => String(b.lastSeen).localeCompare(String(a.lastSeen)));
 })();
 errors = Array.isArray(DATA.recentErrors) ? DATA.recentErrors : [];
 totals = DATA.totals || {};
 saves = sum(people, p => p.saves);
 confirms = sum(people, p => p.confirms);
 feedback = sum(people, p => p.feedback);
 commands7d = sum(people, p => p.commands7d);
 errCount = totals.errors || 0;
 cmdCount = totals.commands || 0;
 blocked = totals.blockedTasks || 0;
 unrecovered = tasks.filter(t => t.status === '未恢复').length;
 errRate = DATA.metrics?.draftAttempts ? DATA.metrics.draftFailures / DATA.metrics.draftAttempts * 100 : 0;
 health = clamp(100 - errRate, 0, 100);
 healthTxt = health >= 90 ? '优秀' : health >= 75 ? '良好' : health >= 60 ? '一般' : '需关注';
 days7 = daily.slice(-7);
 taskStatusCount = tasks.reduce((o, t) => (o[t.status] = (o[t.status] || 0) + 1, o), {});

 }
 derive();

 /* ---------------- Hero ---------------- */
 function renderHero() {
  $('#sync-chip').dataset.generatedAt=DATA.generatedAt;
  const box = $('#hero-meta');
  if (!box) return;
  box.innerHTML = [
   `<span class="chip"><span class="k">快照</span><b>${esc(fmtShort(DATA.generatedAt))}</b></span>`,
   `<span class="chip"><span class="k">事件</span><b>${totals.events ?? 0}</b><span class="k">条</span></span>`,
   `<span class="chip"><span class="k">任务</span><b>${tasks.length}</b><span class="k">个</span></span>`,
   `<span class="chip chip-mint">${icon('shield')}<b>草稿技术成功率 ${DATA.metrics?.draftAttempts ? health.toFixed(1) + '%' : '暂无样本'}</b><span>· 全部历史</span></span>`
  ].join('');
  const stale=Date.now()-Date.parse(DATA.generatedAt)>5*60*1000;
  $('#sync-text').textContent = (DATA.dataMode==='logs'?'实时读取 · ':stale?'同步已延迟 · ':'已同步 · ') + fmtShort(DATA.generatedAt);
  $('#sync-chip').title=DATA.dataMode==='logs'?'每15秒自动读取本机最新日志':stale?'超过 5 分钟未同步，当前显示最后成功数据':'本机每分钟同步统计报告';
  const fm = $('#foot-meta');
  if (fm) fm.innerHTML = `<span>看板 ${esc(DATA.serviceVersion || '版本未记录')}</span><span>·</span><span>报告生成时间（不代表客户端在线） ${esc(fmtFull(DATA.generatedAt))} (UTC+8)</span><span>·</span><span>${DATA.dataMode==='logs'?'每15秒自动刷新 · 直接读取本机日志':'本机每分钟同步 · 刷新查看最新报告'}</span>`;
 }

 /* ---------------- KPI ---------------- */
 function renderKpi() {
  const cards = [
   {
    cls: '', ico: 'users', label: '使用者', value: totals.people ?? people.length, unit: '位',
    sub: `${totals.devices ?? 0} 台登记设备 · ${totals.profileOnly ?? 0} 位仅接入<span class="sep"></span>近 7 天活跃 ${days7.filter(d => d.people > 0).length} 天`,
    viz: sparkline(days7.map(d => d.people), { id: 'sp1', color: '#5570ff', w: 78, h: 28 })
   },
   {
    cls: '', ico: 'layers', label: '任务', value: tasks.length, unit: '个',
    sub: `正常 ${taskStatusCount['正常'] || 0}<span class="sep"></span>阻塞 ${blocked}`,
    viz: `<div class="sbar-wrap">${stackBar(taskStatusCount)}</div>`
   },
   {
    cls: '', ico: 'terminal', label: '草稿命令', value: cmdCount, unit: '次',
    sub: `近 7 天 ${commands7d}<span class="sep"></span>保存 ${saves} · 确认 ${confirms}`,
    viz: sparkline(days7.map(d => d.commands), { id: 'sp2', color: '#5570ff', w: 78, h: 28 })
   },
   {
    cls: health >= 75 ? 'good' : 'warm', ico: 'shield', label: '草稿技术成功率', value: DATA.metrics?.draftAttempts ? health.toFixed(1) : '—', unit: '%',
    sub: `全部历史草稿命令 · 排除业务等待<span class="sep"></span>失败率 ${errRate.toFixed(1)}%`,
    viz: ring(health, 48, health >= 75 ? '#0fb87c' : '#f2890b')
   }
  ];
  const strip = [
   ['device', '登记设备', totals.devices ?? 0, '台'],
   ['check', '修改保存', saves, '次'],
   ['shield', '确认完成', confirms, '次'],
   ['alert', '错误事件', errCount, '条'],
   ['message', '用户反馈', feedback, '条'],
   ['pulse', '近 7 天命令', commands7d, '次']
  ];
  $('#app').innerHTML = `
   <section class="sec" id="kpi" style="margin-top:0">
    <div class="kpis stagger" id="kpi-grid">${cards.map(c => `
     <article class="card kpi ${c.cls}" tabindex="0">
      <div class="kpi-top"><span class="kpi-ico">${icon(c.ico)}</span><span class="kpi-label">${c.label}</span></div>
      <div class="kpi-val"><b data-count="${c.value}">0</b><span class="unit">${c.unit}</span></div>
      <div class="kpi-sub">${c.sub}</div>
      <div class="kpi-viz">${c.viz}</div>
     </article>`).join('')}</div>
    <div class="card strip stagger" id="strip">${strip.map(([ic, k, v, u]) => `
     <div class="item"><span class="k">${icon(ic)}${k}</span><span class="v">${v}<em>${u}</em></span></div>`).join('')}</div>
   </section>

   <section class="sec" id="issue-center"></section>

   <section class="sec reveal" id="trend">
    <div class="sec-head">
     <div class="sec-title"><span class="ico">${icon('pulse')}</span><h2>近 30 天活跃趋势</h2></div>
     <span class="count-pill">${daily.length} 天</span>
     <div class="task-tools"><div class="seg" id="metric-seg">
      <button type="button" data-metric="commands" class="on">草稿命令</button>
      <button type="button" data-metric="people">活跃人数</button>
      <button type="button" data-metric="errors">错误发生次数</button>
     </div></div>
    </div>
    <div class="charts">
     <div class="card">
      <div class="card-head"><div><h3>使用强度</h3><p>每天完成的草稿命令数与错误分布</p></div>
       <div class="right legend">${['commands', 'people', 'errors'].map(m => `<span><i style="background:${METRICS[m].color}"></i>${METRICS[m].label}</span>`).join('')}</div>
      </div>
      <div class="chart-wrap" id="chart-wrap">
       <svg class="chart-svg" id="chart" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="近30天趋势图"></svg>
       <div class="tip" id="chart-tip"></div>
      </div>
     </div>
     <div class="card">
      <div class="card-head"><div><h3>任务状态分布</h3><p>全部 ${tasks.length} 个任务</p></div></div>
      <div class="donut-wrap">
       <div class="donut" id="donut"></div>
       <div class="donut-legend" id="donut-legend"></div>
      </div>
      <p class="donut-note">历史问题保留；待验证表示尚未收到交付验证，不代表未写入。业务等待与技术失败分开显示。</p>
     </div>
    </div>
   </section>

   <section class="sec" id="people">
    <div class="sec-head">
     <div class="sec-title"><span class="ico">${icon('users')}</span><h2>使用者</h2></div>
     <span class="count-pill">${people.length} 位</span>
     <span class="hint">点击卡片查看每位使用者的完整画像</span>
    </div>
    <div class="people stagger" id="people-grid">${people.map(personCard).join('') || emptyBox('还没有使用者接入', '完成一次接入后，这里会出现第一位使用者。')}</div>
   </section>

   <section class="sec" id="tasks">
    <div class="sec-head">
     <div class="sec-title"><span class="ico">${icon('layers')}</span><h2>任务</h2></div>
     <span class="count-pill" id="task-count">${tasks.length} 个</span>
     <div class="task-tools">
      <div class="filters" id="task-filters">${['全部', '正常', '待业务确认', '待提供目标', '待验证', '未恢复', '阻塞', '已确认'].map(s => {
       const n = s === '全部' ? tasks.length : (taskStatusCount[s] || 0);
       return `<button type="button" class="fchip${s === '全部' ? ' on' : ''}" data-filter="${s}">${s}<b>${n}</b></button>`;
      }).join('')}</div>
      <label class="search">${icon('search')}<input id="task-search" type="search" placeholder="搜索需求 / 任务号" autocomplete="off"></label>
     </div>
    </div>
    <div class="tasks" id="task-list"></div>
   </section>

   <section class="sec reveal" id="ops">
    <div class="sec-head">
     <div class="sec-title"><span class="ico">${icon('link')}</span><h2>链路</h2></div>
     <span class="count-pill">${sources.length} 个来源 · ${errors.length} 条错误</span>
    </div>
    <div class="cols">
     <div class="card">
      <div class="card-head"><div><h3>使用的文档与链接</h3><p>需求与规范来源，仅记录链接本身</p></div>
        <span class="right count-pill">${sources.length}</span></div>
      <div class="src-list">${sources.length ? sources.map(srcRow).join('') : emptyBox('暂无来源链接', '需求里带飞书或 Figma 链接时会自动归集。')}</div>
     </div>
     <div class="card">
      <div class="card-head"><div><h3>最近异常与等待</h3><p>最近 50 条记录，含历史技术失败及业务等待</p></div>
        <span class="right count-pill">${errors.length}</span></div>
      <div class="err-list">${errors.length ? errors.map(errRow).join('') : emptyBox('没有错误记录', '当前未收到错误记录，不代表链路已验证。')}</div>
     </div>
    </div>
   </section>`;

  renderIssues();
  renderTasks();
  renderDonut();
  drawChart('commands');
 }

 /* ---------------- 使用者卡片 ---------------- */
 function weekOf(p) {
  if (Array.isArray(p.week) && p.week.length === 7) return p.week;
  // 兜底：没有逐日数据时，把 7 天命令数平均摊到最近几天，仅作视觉占位。
  const arr = [0, 0, 0, 0, 0, 0, 0];
  arr[6] = Number(p.commands7d) || 0;
  return arr;
}
 function weekBars(p) {
  const w = weekOf(p), max = Math.max(1, ...w);
  return `<div class="weekbars" title="近 7 天每天的命令数">${w.map((v, i) => {
   const hh = v ? Math.max(3, Math.round(v / max * 100)) : 3;
   return `<i class="${v && v === max ? 'hi' : ''}" style="height:${hh}%"></i>`;
  }).join('')}</div>`;
 }
 function personCard(p, i) {
  const tag = p.revoked ? '<span class="tag gray">已撤销</span>' : '';
  const shortId = String(p.deviceId || p.client).slice(0, 8);
  let where = p.hostname
   ? [p.osUser, p.hostname].filter(Boolean).join(' @ ')
   : (p.osUser ? `${p.osUser} · ${shortId}` : '设备 ' + shortId);
  if (where === p.name) where = '未上报设备信息';
  return `<article class="person${p.revoked ? ' is-revoked' : ''}" role="button" tabindex="0" data-person="${esc(p.client)}" aria-label="查看 ${esc(p.name)} 的详情">
   <div class="person-top">
    <span class="ava" style="${avatarStyle(p.client)}">${esc(initials(p.name))}<span class="stat"></span></span>
    <div style="min-width:0">
     <div class="p-name"><span>${esc(p.name)}</span>${tag}</div>
     <div class="p-sub" title="${esc(where)}">${esc(where)}</div>
    </div>
   </div>
   <div class="p-tags">
    ${p.events===0 ? '<span class="p-tag">仅接入</span>' : ''}
    ${p.platform ? `<span class="p-tag">${icon('device')}${esc(shortPlatform(p.platform))}</span>` : ''}
    ${p.agent ? `<span class="p-tag">${icon('chip')}${esc(p.agent)}</span>` : ''}
    ${p.skillVersion ? `<span class="p-tag">${icon('star')}v${esc(p.skillVersion)}</span>` : ''}
    ${p.gitName ? `<span class="p-tag">${icon('git')}${esc(p.gitName)}</span>` : ''}
   </div>
   <div class="p-stats">
    <div><b data-count="${p.tasks || 0}">0</b><span>任务</span></div>
    <div><b data-count="${p.commands || 0}">0</b><span>命令</span></div>
    <div><b data-count="${p.activeDays || 0}">0</b><span>活跃天数</span></div>
   </div>
   ${weekBars(p)}
  </article>`;
 }
 const shortPlatform = s => String(s).replace(/^darwin/, 'macOS').replace(/^win32/, 'Windows').replace(/ linux/, ' Linux').split(' ').slice(0, 2).join(' ');

 /* ---------------- 任务 ---------------- */
 let filter = '全部';
 let query = '';

 function taskText(t) {
  if (t.request && String(t.request).trim()) return String(t.request).trim();
  const base = String(t.target || '').split('/').filter(Boolean).pop();
  return base ? '任务目录 · ' + base : '未记录需求原文';
 }
 function renderTasks() {
  const list = $('#task-list');
  if (!list) return;
  const rows = tasks.filter(t => {
   if (filter !== '全部' && t.status !== filter) return false;
   if (!query) return true;
   const hay = [t.request, t.target, t.taskId, t.person].join(' ').toLowerCase();
   return hay.includes(query.toLowerCase());
  });
  $('#task-count').textContent = `${rows.length} 个`;
  if (!rows.length) {
   list.innerHTML = emptyBox('没有匹配的任务', filter === '全部' ? '调整关键词再试试。' : `当前没有「${filter}」状态的任务。`);
   return;
  }
  list.innerHTML = rows.map(t => {
   const st = statusOf(t.status);
   const hasReq = t.request && String(t.request).trim();
   return `<article class="task">
    <span class="status ${st.k}"><i></i>${esc(t.status)}</span>
    <div class="task-main">
     <div class="task-req${hasReq ? '' : ' none'}" title="${esc(t.target || taskText(t))}">${esc(taskText(t))}</div>
     <div class="task-meta">
      <span class="m">${icon('users')}${esc(t.person)}</span>
      <span class="m">${icon('terminal')}${t.commands} 命令</span>
      <span class="m">${icon('check')}${t.saves} 保存</span>
      ${t.errors ? `<span class="m" style="color:var(--rose)">${icon('alert')}${t.errors} 错误</span>` : ''}
      ${(t.issueIds||[]).map(issueLink).join('')}
      ${t.version ? `<span class="m">v${t.version}</span>` : ''}
      <span class="mono" title="任务标识">${esc(String(t.taskId).slice(0, 8))}</span>
      ${t.sources && t.sources.length ? `<span class="m">${icon('link')}${t.sources.length} 来源</span>` : ''}
     </div>
    </div>
    <div class="task-side">
     <span class="when">${icon('clock')}${esc(rel(t.lastSeen))}</span>
     <button class="mini-btn" type="button" data-copy="${esc(t.taskId)}" title="复制任务标识">${icon('copy')}</button>
    </div>
   </article>`;
  }).join('');
 }

 /* ---------------- 问题中心：处理进度独立于任务日志状态 ---------------- */
 let issueFilter='active',issueQuery='',drawerIssue=null;
 const issueStates={open:'待处理',in_progress:'处理中',fixed_pending:'已修复待验证',closed:'已关闭'};
 const resolutionLabels={verified:'已验证恢复',false_positive:'误报',duplicate:'重复问题',wont_fix:'无需处理'};
 const issueItems=()=>DATA.issues||[];
 function issueLink(id){const i=issueItems().find(x=>x.id===id);return i?`<button type="button" class="fchip" data-issue="${i.id}">${esc(i.number)} · ${esc(i.stateLabel)}</button>`:'';}
 function renderIssues(){
  const box=$('#issue-center');if(!box)return;
  const summary=DATA.issueSummary||{};
  const filters={active:'未关闭',...issueStates,followup:'待跟进',all:'全部'};
  const filtered=issueItems().filter(i=>{
   const matches=issueFilter==='all'||issueFilter==='followup'&&i.kind==='followup'||i.kind==='technical'&&(issueFilter==='active'?i.state!=='closed':i.state===issueFilter);
   return matches&&[i.number,i.person,i.taskId,i.message,i.assignee,i.fixVersion,...i.events.map(e=>e.version.skillVersion||e.version.build)].join(' ').toLowerCase().includes(issueQuery.toLowerCase());
  });
  box.innerHTML=`<div class="sec-head"><div class="sec-title"><span class="ico">${icon('inbox')}</span><h2>问题中心</h2></div><span class="count-pill">${summary.total||0} 个技术问题 · ${summary.followup||0} 个待跟进</span></div>
   <p class="hint">问题处理进度与任务交付独立。历史错误保留；发布修复不代表用户已升级或任务已恢复。</p>
   <div class="issue-counts">${Object.entries(issueStates).map(([s,label])=>`<button type="button" class="card issue-count" data-issue-filter="${s}"><span>${label}</span><b>${summary[s]||0}</b></button>`).join('')}</div>
   <div class="task-tools"><div class="filters">${Object.entries(filters).map(([s,label])=>`<button type="button" class="fchip${s===issueFilter?' on':''}" data-issue-filter="${s}">${label}</button>`).join('')}</div>
    <label class="search">${icon('search')}<input id="issue-search" type="search" placeholder="搜索问题 / 使用者 / 版本" value="${esc(issueQuery)}"></label></div>
   <div class="issue-list">${filtered.length?filtered.map(i=>`<button type="button" class="card issue-row" data-issue="${i.id}"><div class="issue-row-top"><b>${esc(i.number)}</b><span class="issue-state state-${i.state}">${esc(i.stateLabel)}${i.reopened?' · 复发':''}</span></div><p class="issue-title">${esc(i.message||i.category)}</p><div class="hint">${esc(i.person)} · ${esc(i.stage||i.operation)} · ${i.count} 次 · ${esc(fmtShort(i.lastAt))}${i.kind==='followup'?' · 业务待跟进':''}</div><div class="hint">负责人：${esc(i.assignee||'未分配')}${i.fixVersion?' · 修复 '+esc(i.fixVersion):''}</div></button>`).join(''):emptyBox('没有匹配的问题','可切换状态或清空搜索；已关闭问题仍保留处理记录。')}</div>`;
 }
 function openIssue(id){
  const i=issueItems().find(x=>x.id===id);if(!i)return;
  drawerClient=null;drawerIssue=id;
  const version=e=>e.version.skillVersion?'Skill '+e.version.skillVersion:'构建 '+(e.version.build||'未记录').slice(0,8);
  $('#drawer').innerHTML=`<div class="drawer-head"><div><h3 id="drawer-title">${esc(i.number)}</h3><div class="sub">${esc(i.stateLabel)}${i.reopened?' · 关闭后再次失败':''} · ${i.kind==='followup'?'业务待跟进':'技术问题'}</div></div><button class="icon-btn" type="button" id="drawer-close" aria-label="关闭">${icon('close')}</button></div>
   <div class="drawer-body"><p class="issue-message">${esc(i.message)}</p><dl class="kv"><dt>使用者 / 阶段</dt><dd>${esc(i.person)} / ${esc(i.stage||i.operation)}</dd><dt>任务日志状态</dt><dd>${esc(i.taskStatus)}（独立于问题处理）</dd><dt>任务标识</dt><dd><code>${esc(i.taskId)}</code></dd><dt>首次 / 最近</dt><dd>${esc(fmtFull(i.firstAt))}<br>${esc(fmtFull(i.lastAt))}</dd><dt>发生次数</dt><dd>${i.count}</dd></dl>
   ${i.reopened?'<p class="issue-notice">关闭后出现时间更晚的新失败，已重新打开；此前处理记录保留。</p>':''}
   ${i.closureSource==='workflow-receipt'?'<p class="issue-notice">已收到可关联的工作流验证回执，自动标记恢复；不代表用户验收。</p>':''}
   <details class="d-sec"><summary>原始事件与版本（${i.count}）</summary>${i.events.map(e=>`<p>${esc(fmtFull(e.at))} · ${esc(version(e))}<br><code>${esc(e.id)}</code></p>`).join('')}${i.recoveryEvidence.length?`<p>验证事件：${i.recoveryEvidence.map(esc).join('、')}</p>`:''}</details>
   <div class="d-sec"><h4>处理记录（${i.history.length}）</h4>${i.history.map(h=>`<article class="issue-history"><b>${esc(issueStates[h.state])} · ${esc(h.actor)}</b><div class="hint">${esc(fmtFull(h.at))} · 自填操作人</div><p>${esc(h.note)}</p>${h.fixVersion?`<p>修复：${esc(h.fixVersion)}</p>`:''}${h.resolution?`<p>关闭原因：${esc(resolutionLabels[h.resolution])}</p>`:''}${h.evidence?`<p>依据：${esc(h.evidence)}</p>`:''}${h.duplicateOf?issueLink(h.duplicateOf):''}</article>`).join('')||'<p class="hint">尚无人工处理记录。</p>'}</div>
   ${DATA.dataMode==='logs'?`<form id="issue-form" class="issue-form" data-id="${i.id}" data-etag="${i.etag}"><h4>更新处理进度</h4><p class="hint">操作人由填写者声明，当前共享口令不验证个人身份。保存会追加记录，不改原始日志。</p>
    <label>状态<select name="state">${Object.entries(issueStates).map(([s,label])=>`<option value="${s}"${i.state===s?' selected':''}>${label}</option>`).join('')}</select></label>
    <label>操作人（必填）<input name="actor" maxlength="80" required></label>
    <label>负责人<input name="assignee" value="${esc(i.assignee)}" maxlength="80"></label>
    <label>修复版本 / 提交<input name="fixVersion" value="${esc(i.fixVersion)}" maxlength="200"></label>
    <label>处理说明（必填）<textarea name="note" maxlength="4000" required rows="3"></textarea></label>
    <label>验证结果 / 处理依据（关闭时必填）<textarea name="evidence" maxlength="4000" rows="3">${esc(i.evidence)}</textarea></label>
    <label>关闭原因<select name="resolution"><option value="">请选择</option>${Object.entries(resolutionLabels).map(([s,label])=>`<option value="${s}"${i.resolution===s?' selected':''}>${label}</option>`).join('')}</select></label>
    <label>重复问题归属<select name="duplicateOf"><option value="">仅关闭为重复时选择</option>${issueItems().filter(x=>x.id!==id&&x.resolution!=='duplicate').map(x=>`<option value="${x.id}"${i.duplicateOf===x.id?' selected':''}>${esc(x.number+' · '+x.person+' · '+x.message.slice(0,60))}</option>`).join('')}</select></label>
    <p id="issue-form-error" role="alert"></p><button type="submit" class="fchip issue-submit">保存处理记录</button></form>`:'<p class="hint">当前为只读快照，请在正式问题中心更新。</p>'}</div>`;
  const mask=$('#drawer-mask'),dr=$('#drawer');mask.hidden=false;dr.hidden=false;
  requestAnimationFrame(()=>{mask.classList.add('in');dr.classList.add('in');});document.body.style.overflow='hidden';$('#drawer-close').focus({preventScroll:true});
 }
 async function saveIssue(form){
  const button=form.querySelector('button[type="submit"]');if(button.disabled)return;
  button.disabled=true;$('#issue-form-error').textContent='';
  try{
   const body={...Object.fromEntries(new FormData(form)),etag:form.dataset.etag};
   const response=await fetch('/api/issues/'+form.dataset.id,{method:'POST',headers:{'Content-Type':'application/json','X-Gacui-Issue-Action':'1'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
   const result=await response.json();if(!response.ok)throw Error(result.error||'保存失败');
   // 独立回读，不与定时刷新竞态；编辑中的表单不会被定时刷新覆盖。
   const read=await fetch('/report.json?fresh=1',{cache:'no-store'});if(!read.ok)throw Error('已保存，但回读失败，请重新打开详情核对');
   DATA=await read.json();derive();const metric=chartMetric;renderKpi();renderHero();$('#task-search').value=query;$$('#task-filters .fchip').forEach(b=>b.classList.toggle('on',b.dataset.filter===filter));renderTasks();drawChart(metric);bindChartHover();io?.disconnect();observeAll();observeNavigation();openIssue(form.dataset.id);toast('处理记录已保存');
  }catch(e){const box=$('#issue-form-error');if(box)box.textContent=e.name==='TimeoutError'?'请求超时，结果未确认，请重新打开详情核对后再操作':e.message;}
  finally{button.disabled=false;}
 }

 /* ---------------- 来源与错误 ---------------- */
 const kindCls = k => k === '飞书' ? 'feishu' : k === 'Figma' ? 'figma' : 'other';
 function srcRow(s) {
  let host = '';
  try { host = new URL(s.url).host; } catch { host = s.url; }
  return `<div class="src">
   <span class="src-badge ${kindCls(s.kind)}">${esc(s.kind === '飞书' ? '飞书' : s.kind === 'Figma' ? 'Fig' : 'URL')}</span>
   <div class="src-main">
    <a class="src-url" href="${esc(s.url)}" target="_blank" rel="noreferrer noopener" title="${esc(s.url)}">${esc(host)}${esc(pathOf(s.url))}</a>
    <div class="src-meta"><span>${esc(s.person)}</span><span>·</span><span>${esc(rel(s.lastSeen))}</span></div>
   </div>
   <div class="src-act">
    <button class="mini-btn" type="button" data-copy="${esc(s.url)}" title="复制链接">${icon('copy')}</button>
    <a class="mini-btn" href="${esc(s.url)}" target="_blank" rel="noreferrer noopener" title="打开链接">${icon('external')}</a>
   </div>
  </div>`;
 }
 function pathOf(u) { try { const x = new URL(u); return x.pathname === '/' ? '' : x.pathname; } catch { return ''; } }

 function errRow(e) {
  const long = String(e.message || '').length > 76;
  return `<div class="err" data-err>
   <div class="err-top">
    <span class="err-code">${esc(e.errorCode || 'unknown')}</span>
    <span class="err-op">${esc(e.operation || '执行')}</span>
    <span class="err-when">${esc(rel(e.at))}</span>
   </div>
   ${e.issueId?issueLink(e.issueId):''}
   <div class="err-msg">${esc(e.message || '（无错误信息）')}</div>
   ${long ? '<button class="err-toggle" type="button">展开全部</button>' : ''}
   <div class="src-meta" style="margin-top:6px;font-size:11.5px;color:var(--muted)">${esc(e.person)} · 任务 ${esc(String(e.taskId || '').slice(0, 8))}</div>
  </div>`;
 }

 function emptyBox(title, sub) {
  return `<div class="empty">
   <svg viewBox="0 0 120 84" fill="none" aria-hidden="true">
    <ellipse cx="60" cy="72" rx="34" ry="5" fill="currentColor" opacity=".10"/>
    <rect x="26" y="18" width="62" height="44" rx="10" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-width="2"/>
    <path d="M38 32h30M38 42h20" stroke="currentColor" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="80" cy="52" r="15" fill="var(--surface-solid)" stroke="currentColor" stroke-opacity=".35" stroke-width="2.4"/>
    <path d="M91 63l8 8" stroke="currentColor" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 12l2 4 4 2-4 2-2 4-2-4-4-2 4-2 2-4Z" fill="currentColor" opacity=".22"/>
   </svg>
   <b>${esc(title)}</b><span>${esc(sub)}</span></div>`;
 }

 /* ---------------- 趋势图 ---------------- */
 // 画布尺寸随视口切换：窄屏用更"瘦高"的比例，避免图表被压成一条。
 let CW = 760, CH = 272;
 const PAD = { t: 16, r: 16, b: 28, l: 40 };
 const isNarrow = () => window.innerWidth < 680;
 const METRICS = {
  commands: { label: '草稿命令', color: 'var(--brand)', hex: '#5570ff', field: 'commands' },
  people: { label: '活跃人数', color: 'var(--brand-2)', hex: '#9b6bff', field: 'people' },
  errors: { label: '错误发生次数', color: 'var(--rose)', hex: '#f04438', field: 'errors' }
 };
 let chartMetric = 'commands';
 let chartPts = [];

 function drawChart(metric) {
  chartMetric = metric;
  $$('#metric-seg button').forEach(b => b.classList.toggle('on', b.dataset.metric === metric));
  const m = METRICS[metric], vals = daily.map(d => Number(d[m.field]) || 0);
  const svg = $('#chart');
  if (!svg) return;
  CW = isNarrow() ? 420 : 760;
  CH = isNarrow() ? 248 : 272;
  svg.setAttribute('viewBox', `0 0 ${CW} ${CH}`);
  const iw = CW - PAD.l - PAD.r, ih = CH - PAD.t - PAD.b;
  const rawMax = Math.max(1, ...vals);
  const stepY = Math.max(1, Math.ceil(rawMax / 4));
  const top = stepY * 4;
  const x = i => PAD.l + (vals.length > 1 ? i * iw / (vals.length - 1) : iw / 2);
  const y = v => PAD.t + ih - (v / top) * ih;
  chartPts = vals.map((v, i) => [x(i), y(v), v, daily[i].date]);

  const d = smoothPath(chartPts.map(p => [p[0], p[1]]));
  const area = `${d} L ${x(vals.length - 1)} ${PAD.t + ih} L ${x(0)} ${PAD.t + ih} Z`;
  const grid = Array.from({ length: 5 }, (_, i) => {
   const v = stepY * i, yy = y(v);
   return `<line class="grid-l" x1="${PAD.l}" y1="${yy}" x2="${CW - PAD.r}" y2="${yy}"/>
    <text class="axis-t" x="${PAD.l - 8}" y="${yy + 3.5}" text-anchor="end">${v}</text>`;
  }).join('');
  const xlab = chartPts.map((p, i) => (i % 5 === 0 || i === chartPts.length - 1)
   ? `<text class="axis-t" x="${p[0]}" y="${CH - 8}" text-anchor="middle">${fmtDay(p[3])}</text>` : '').join('');

  svg.innerHTML = `<defs>
    <linearGradient id="chartArea" x1="0" y1="0" x2="0" y2="1">
     <stop offset="0" stop-color="${m.hex}" stop-opacity=".30"/><stop offset="1" stop-color="${m.hex}" stop-opacity="0"/>
    </linearGradient></defs>
   ${grid}${xlab}
   <path class="area" d="${area}" fill="url(#chartArea)"/>
   <path class="line" id="chart-line" d="${d}" stroke="${m.hex}"/>
   <line id="chart-guide" x1="0" y1="${PAD.t}" x2="0" y2="${PAD.t + ih}" stroke="${m.hex}" stroke-opacity=".35" stroke-dasharray="3 3" style="opacity:0"/>
   <circle id="chart-dot" r="5" fill="${m.hex}" class="dot" style="opacity:0"/>`;

  if (!reduced) {
   const line = $('#chart-line');
   if (line) {
    const len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    line.getBoundingClientRect();
    line.style.transition = 'stroke-dashoffset 1.15s cubic-bezier(.22,.8,.28,1)';
    line.style.strokeDashoffset = '0';
    setTimeout(() => { line.style.strokeDasharray = 'none'; line.style.transition = ''; }, 1250);
   }
  }
  const tip = $('#chart-tip');
  if (tip) tip.classList.remove('show');
 }

 function bindChartHover() {
  const wrap = $('#chart-wrap');
  if (!wrap) return;
  const move = ev => {
   if (!chartPts.length) return;
   const svg = $('#chart'), r = svg.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
   const sx = (ev.clientX - r.left) / r.width * CW;
   let best = 0, dist = Infinity;
   chartPts.forEach((p, i) => { const dd = Math.abs(p[0] - sx); if (dd < dist) { dist = dd; best = i; } });
   const p = chartPts[best];
   const guide = $('#chart-guide'), dot = $('#chart-dot');
   if (guide) { guide.setAttribute('x1', p[0]); guide.setAttribute('x2', p[0]); guide.style.opacity = 1; }
   if (dot) { dot.setAttribute('cx', p[0]); dot.setAttribute('cy', p[1]); dot.style.opacity = 1; }
   const tip = $('#chart-tip');
   tip.innerHTML = `<div class="d">${esc(fullDay(p[3]))}</div><div class="r"><i style="background:${METRICS[chartMetric].hex}"></i>${METRICS[chartMetric].label} ${p[2]}</div>`;
   tip.style.left = (p[0] / CW * r.width + (r.left - wr.left)) + 'px';
   tip.style.top = (p[1] / CH * r.height + (r.top - wr.top)) + 'px';
   tip.classList.add('show');
  };
  const leave = () => {
   const t = $('#chart-tip'); if (t) t.classList.remove('show');
   const g = $('#chart-guide'), d = $('#chart-dot');
   if (g) g.style.opacity = 0; if (d) d.style.opacity = 0;
  };
  wrap.addEventListener('mousemove', move);
  wrap.addEventListener('mouseleave', leave);
  wrap.addEventListener('touchmove', ev => { if (ev.touches[0]) move(ev.touches[0]); }, { passive: true });
 }
 const fullDay = date => String(date || '').replace(/-/g, '/');

 /* ---------------- 环形图 ---------------- */
 function renderDonut() {
  const box = $('#donut'), lg = $('#donut-legend');
  if (!box) return;
  const R = 63, C = 2 * Math.PI * R;
  const order = ['正常', '已确认', '待业务确认', '待提供目标', '待验证', '未恢复', '阻塞'];
  const entries = order.filter(k => taskStatusCount[k]).map(k => [k, taskStatusCount[k]]);
  const total = entries.reduce((n, [, v]) => n + v, 0) || 1;
  let acc = 0;
  const segs = entries.map(([k, v]) => {
   const len = v / total * C;
   const off = -acc; acc += len;
   return `<circle class="seg-c" cx="79" cy="79" r="${R}" stroke="${statusOf(k).color}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>`;
  }).join('');
  box.innerHTML = `<svg width="158" height="158" viewBox="0 0 158 158" role="img" aria-label="任务状态分布">
    <circle class="track" cx="79" cy="79" r="${R}"/>${segs}</svg>
   <div class="donut-mid"><b data-count="${tasks.length}">0</b><span>个任务</span></div>`;
  lg.innerHTML = entries.map(([k, v]) =>
   `<div class="dl"><span class="sw" style="background:${statusOf(k).color}"></span><span class="nm">${esc(k)}</span><span class="n">${v}</span><span class="p">${Math.round(v / total * 100)}%</span></div>`
  ).join('') || '<div class="dl"><span class="nm">暂无任务</span></div>';
  const mid = $('.donut-mid b', box);
  if (mid) countUp(mid);
  if (!reduced) {
   $$('.donut svg circle.seg-c', box).forEach((c, i) => {
    const da = c.getAttribute('stroke-dasharray');
    c.style.strokeDasharray = `0 ${C}`;
    setTimeout(() => { c.style.strokeDasharray = da; }, 120 + i * 110);
   });
  }
 }

 /* ---------------- 数字滚动与入场 ---------------- */
 function countUp(el) {
  const to = Number(el.dataset.count) || 0;
  if (reduced || to === 0) { el.textContent = String(to); return; }
  const dur = 850, t0 = performance.now();
  const tick = t => {
   const p = clamp((t - t0) / dur, 0, 1);
   const e = 1 - Math.pow(1 - p, 3);
   el.textContent = String(Math.round(to * e));
   if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
 }
 const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(en => {
   if (!en.isIntersecting) return;
   en.target.classList.add('in');
   $$('[data-count]', en.target).forEach(countUp);
   io.unobserve(en.target);
  });
 }, { threshold: .01, rootMargin: '0px 0px -6% 0px' }) : null;

 function observeAll() {
  if (!io) { $$('.reveal,.stagger').forEach(e => e.classList.add('in')); $$('[data-count]').forEach(countUp); return; }
  $$('.reveal,.stagger').forEach(el => {
   if (el.classList.contains('in')) return;
   io.observe(el);
   // 网格内元素依次入场
   $$(':scope > *', el).forEach((c, i) => { c.style.transitionDelay = Math.min(i * 55, 420) + 'ms'; });
  });
  // 兜底：动画只是装饰，任何情况下都不能让内容永久不可见（打印、脚本异常、超长视口等）。
  setTimeout(() => {
   $$('.reveal:not(.in),.stagger:not(.in)').forEach(el => {
    el.classList.add('in');
    $$('[data-count]', el).forEach(countUp);
   });
  }, 2600);
 }

 /* ---------------- 抽屉 ---------------- */
 let drawerClient = null;
 function openDrawer(client) {
  const p = people.find(x => x.client === client);
  if (!p) return;
  drawerClient = client;drawerIssue=null;
  const mine = tasks.filter(t => t.client === client);
  const week = weekOf(p);
  const wmax = Math.max(1, ...week);
  const wlbl = days7.map(d => String(d.date).slice(5).replace('-', '/'));
  $('#drawer').innerHTML = `
   <div class="drawer-head">
    <div style="min-width:0;flex:1"><h3 id="drawer-title">使用者详情</h3><div class="sub">只读画像 · 包含任务与来源</div></div>
    <button class="icon-btn" type="button" id="drawer-close" aria-label="关闭">${icon('close')}</button>
   </div>
   <div class="drawer-body">
    <div class="d-ava">
     <span class="ava" style="${avatarStyle(p.client)}">${esc(initials(p.name))}</span>
     <div style="min-width:0">
      <b>${esc(p.name)}</b>
      <span>${esc(p.revoked ? '设备已撤销' : '设备已登记')}${p.skillVersion ? ' · Skill v' + esc(p.skillVersion) : ''}</span>
     </div>
    </div>
    <div class="mgrid">
     ${[['任务', p.tasks], ['命令', p.commands], ['活跃天数', p.activeDays], ['保存', p.saves], ['确认', p.confirms], ['技术失败', p.technicalErrors ?? p.errors], ['等待事件', p.waiting ?? 0]]
    .map(([k, v]) => `<div class="mbox"><b>${v ?? 0}</b><span>${k}</span></div>`).join('')}
    </div>

    <div class="d-sec"><h4>近 7 天命令</h4>
     <div class="d-week">${week.map((v, i) => {
    const hh = v ? Math.max(5, Math.round(v / wmax * 100)) : 4;
    return `<i class="${v === wmax && v ? 'hi' : ''}" style="height:${hh}%" title="${wlbl[i]}：${v}"></i>`;
   }).join('')}</div>
     <div class="d-week-lbl">${wlbl.map(l => `<span>${l}</span>`).join('')}</div>
    </div>

    <div class="d-sec"><h4>设备与环境</h4>
     <dl class="kv">
      <dt>设备编号</dt><dd><code>${esc(p.deviceId || p.client.slice(0, 12))}</code>
        <button class="mini-btn" type="button" data-copy="${esc(p.deviceId || p.client)}" title="复制">${icon('copy')}</button></dd>
      <dt>系统</dt><dd>${esc(p.platform || '—')}</dd>
      <dt>Agent</dt><dd>${esc(p.agent || '—')}</dd>
      <dt>Git</dt><dd>${esc([p.gitName, p.gitEmail].filter(Boolean).join(' · ') || '—')}</dd>
      <dt>首次出现</dt><dd>${esc(fmtFull(p.firstSeen))}</dd>
      <dt>最近接收</dt><dd>${p.lastReceivedAt ? esc(fmtFull(p.lastReceivedAt)) : '旧数据无接收时间'}</dd>
      <dt>画像上报</dt><dd>${esc(fmtFull(p.profileSeen))}（版本来自此时上报）</dd>
      <dt>上传观测</dt><dd>${p.uploadHealth ? esc(`待上传 ${p.uploadHealth.pending ?? '未知'}；过期丢弃 ${p.uploadHealth.expired ?? '未知'}；观测 ${fmtFull(p.uploadHealth.observedAt)}`) : '旧客户端未上报；不能判断队列是否为空'}</dd>
      <dt>最近事件</dt><dd>${esc(fmtFull(p.lastSeen))} <span style="color:var(--muted)">(${esc(rel(p.lastSeen))})</span></dd>
     </dl>
    </div>

    ${p.errorCodes && Object.keys(p.errorCodes).length ? `<div class="d-sec"><h4>历史原始错误码（含等待事件）</h4>
      <div class="x-chips">${Object.entries(p.errorCodes).map(([k, v]) => `<span class="x-chip">${esc(k)} × ${v}</span>`).join('')}</div></div>` : ''}

    <div class="d-sec"><h4>关联问题</h4>${issueItems().filter(i=>i.client===client).map(i=>issueLink(i.id)).join('')||'暂无问题'}</div>
    <div class="d-sec"><h4>该使用者的任务 (${mine.length})</h4>
     ${mine.length ? mine.map(t => `<div class="d-task">
       <span class="status ${statusOf(t.status).k}" style="padding:2px 8px;font-size:11px"><i></i>${esc(t.status)}</span>
       <span class="t" title="${esc(taskText(t))}">${esc(taskText(t))}</span>
       <span class="when">${esc(rel(t.lastSeen))}</span></div>${taskEvidence(t)}`).join('') : '<div class="d-empty">暂无任务记录</div>'}
    </div>

    <div class="d-sec"><h4>其他</h4>
     <dl class="kv" style="border-top:0;padding-top:0">
      <dt>需求轮次</dt><dd>${p.requestRounds ?? 0}</dd>
      <dt>Agent 轮次</dt><dd>${p.agentTurns ?? 0}</dd>
      <dt>工具错误</dt><dd>${p.toolErrors ?? 0}</dd>
      <dt>反馈</dt><dd>${p.feedback ?? 0} 条（阻塞 ${p.blockedFeedback ?? 0}）</dd>
      <dt>评审</dt><dd>通过 ${p.accepted ?? 0} / 退回 ${p.rejected ?? 0}</dd>
      <dt>来源链接</dt><dd>飞书 ${p.sources?.feishu ?? 0} · Figma ${p.sources?.figma ?? 0} · 其他 ${p.sources?.other ?? 0}</dd>
     </dl>
    </div>
   </div>`;
  const mask = $('#drawer-mask'), dr = $('#drawer');
  mask.hidden = false; dr.hidden = false;
  requestAnimationFrame(() => { mask.classList.add('in'); dr.classList.add('in'); });
  document.body.style.overflow = 'hidden';
  $('#drawer-close').focus({ preventScroll: true });
 }
 function taskEvidence(t) {
  const version=v=>v?.skillVersion ? 'Skill '+v.skillVersion : v?.build&&v.build!=='unknown' ? '构建 '+v.build.slice(0,8) : '版本未记录';
  const stage={request:'已请求',preflight:'前置检查',initialize:'组件初始化',generate:'生成',verify:'验证'};
  return `<details class="d-sec"><summary>进度与历史证据</summary><p>最新阶段：${esc(stage[t.latestStage]||t.latestStage||'未记录')} · ${esc(version(t.latestEventVersion))}</p><p>交付：${t.deliveryState==='verified'?'已收到客户端验证记录（不代表用户验收）':'未收到可关联的交付验证'}</p>${t.lastError?`<p>历史问题 ${esc(fmtFull(t.lastErrorAt))} · ${esc(version(t.lastErrorVersion))}</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(t.lastError)}</p>`:''}${(t.workflowIssues||[]).some(w=>w.legacy)?'<p>旧记录缺少流程关联；后续成功不能自动关闭历史问题。</p>':''}</details>`;
 }
 function closeDrawer() {
  const mask = $('#drawer-mask'), dr = $('#drawer');
  if (!dr || dr.hidden) return;
  mask.classList.remove('in'); dr.classList.remove('in');
  document.body.style.overflow = '';
  setTimeout(() => { mask.hidden = true; dr.hidden = true; dr.innerHTML = ''; drawerClient = null;drawerIssue=null; }, 380);
 }

 /* ---------------- Toast ---------------- */
 function toast(msg) {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon('check')}<span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 320); }, 1900);
 }

 /* ---------------- 主题 ---------------- */
 function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('gacui-theme'); } catch { }
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(saved || (sysDark ? 'dark' : 'light'), false);
  $('#btn-theme').addEventListener('click', () => {
   const cur = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
   setTheme(cur, true);
  });
 }
 function setTheme(mode, save) {
  document.documentElement.dataset.theme = mode;
  const btn = $('#btn-theme');
  if (btn) btn.innerHTML = icon(mode === 'dark' ? 'sun' : 'moon');
  if (save) { try { localStorage.setItem('gacui-theme', mode); } catch { } }
 }

 /* ---------------- 顶栏与导航 ---------------- */
 let navSpy;
 function observeNavigation(){
 navSpy?.disconnect();
  if ('IntersectionObserver' in window) {
   const links = $$('#nav a');
   const secs = links.map(a => $(a.getAttribute('href'))).filter(Boolean);
   navSpy = new IntersectionObserver(es => {
    es.forEach(e => {
     if (!e.isIntersecting) return;
     links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    });
   }, { rootMargin: '-45% 0px -50% 0px' });
   secs.forEach(s => navSpy.observe(s));
  }

 }
 function initChrome() {
  const bar = $('#bar'), prog = $('#bar-progress');
  const onScroll = () => {
   const y = window.scrollY || document.documentElement.scrollTop;
   bar.classList.toggle('stuck', y > 8);
   const h = document.documentElement.scrollHeight - window.innerHeight;
   const p = h > 0 ? clamp(y / h, 0, 1) : 0;
   prog.style.width = (p * 100) + '%';
   prog.classList.toggle('on', y > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  observeNavigation();

  $('#btn-refresh').addEventListener('click', ev => {
   const b = ev.currentTarget;
   b.classList.add('spin');
   refreshReport().finally(()=>b.classList.remove('spin'));
  });
 }

 /* ---------------- 事件绑定 ---------------- */
 function bind() {
  document.addEventListener('click', ev => {
   const issue=ev.target.closest('[data-issue]');if(issue)return openIssue(issue.dataset.issue);
   const fi=ev.target.closest('[data-issue-filter]');if(fi){issueFilter=fi.dataset.issueFilter;renderIssues();return;}
   const p = ev.target.closest('[data-person]');
   if (p) return openDrawer(p.dataset.person);
   const cp = ev.target.closest('[data-copy]');
   if (cp) {
    ev.preventDefault();
    const v = cp.dataset.copy;
    const done = () => toast('已复制');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(v).then(done).catch(() => { });
    else {
     const ta = document.createElement('textarea');
     ta.value = v; ta.style.position = 'fixed'; ta.style.opacity = '0';
     document.body.appendChild(ta); ta.select();
     try { document.execCommand('copy'); done(); } catch { }
     ta.remove();
    }
    return;
   }
   const f = ev.target.closest('[data-filter]');
   if (f) {
    filter = f.dataset.filter;
    $$('#task-filters .fchip').forEach(b => b.classList.toggle('on', b.dataset.filter === filter));
    renderTasks();
    return;
   }
   const m = ev.target.closest('[data-metric]');
   if (m) { drawChart(m.dataset.metric); return; }
   const t = ev.target.closest('.err-toggle');
   if (t) {
    const box = t.closest('.err');
    box.classList.toggle('open');
    t.textContent = box.classList.contains('open') ? '收起' : '展开全部';
    return;
   }
   if (ev.target.closest('#drawer-close') || ev.target.id === 'drawer-mask') return closeDrawer();
  });

  document.addEventListener('keydown', ev => {
   if (ev.key === 'Escape') return closeDrawer();
   if (ev.key === 'Enter' && ev.target.dataset?.person) { ev.target.click(); return; }
   if (ev.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
    const s = $('#task-search');
    if (s) { ev.preventDefault(); s.focus(); }
   }
  });

  document.addEventListener('submit',ev=>{if(ev.target.id==='issue-form'){ev.preventDefault();saveIssue(ev.target);}});
  document.addEventListener('input', ev => {
   if(ev.target.id==='issue-search'){const pos=ev.target.selectionStart;issueQuery=ev.target.value;renderIssues();$('#issue-search').focus();try{$('#issue-search').setSelectionRange(pos,pos);}catch{}return;}
   if (ev.target.id !== 'task-search') return;
   query = ev.target.value.trim();
   renderTasks();
  });

  // KPI 光标跟随高光
  document.addEventListener('mousemove', ev => {
   const k = ev.target.closest('.kpi');
   if (!k) return;
   const r = k.getBoundingClientRect();
   k.style.setProperty('--mx', (ev.clientX - r.left) + 'px');
   k.style.setProperty('--my', (ev.clientY - r.top) + 'px');
  }, { passive: true });

  bindChartHover();
  let rz = 0, wasNarrow = isNarrow();
  window.addEventListener('resize', () => {
   const tip = $('#chart-tip'); if (tip) tip.classList.remove('show');
   clearTimeout(rz);
   rz = setTimeout(() => {
    if (wasNarrow !== isNarrow()) { wasNarrow = isNarrow(); drawChart(chartMetric); }
   }, 220);
  });

  if (location.search.includes('fresh=')) {
   const u = new URL(location.href);
   u.searchParams.delete('fresh');
   history.replaceState(null, '', u.pathname + (u.search || ''));
  }
 }

 let refreshing=false;
 const contentKey = r => JSON.stringify({...r,generatedAt:null});
 async function refreshReport(){
  if(refreshing)return;
  refreshing=true;
  try{
   const response=await fetch('/report.json?fresh=1',{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(response.status===401){$('#sync-text').textContent='登录已失效，请重新登录';return;}
   if(!response.ok)throw Error('读取失败');
   const next=await response.json();
   if(!next.totals || !Array.isArray(next.people) || !next.generatedAt)throw Error('报告无效');
   const changed=contentKey(next)!==contentKey(DATA);
   DATA=next;derive();renderHero();
   if(changed){
    const y=window.scrollY,metric=chartMetric,focus=document.activeElement?.id,selection=$('#task-search')?.selectionStart;
    renderKpi();
    $('#task-search').value=query;
    $$('#task-filters .fchip').forEach(b=>b.classList.toggle('on',b.dataset.filter===filter));
    renderTasks();drawChart(metric);bindChartHover();io?.disconnect();observeAll();observeNavigation();
    if(drawerClient){if(people.some(p=>p.client===drawerClient))openDrawer(drawerClient);else closeDrawer();}
    if(focus && $('#'+focus)){ $('#'+focus).focus({preventScroll:true});if(focus==='task-search')$('#task-search').setSelectionRange(selection,selection); }
    window.scrollTo(0,y);
   }
  }catch{ $('#sync-text').textContent='自动刷新失败 · 保留上次数据'; }
  finally{refreshing=false;}
 }

 /* ---------------- 启动 ---------------- */
 function boot() {
  initTheme();
  renderHero();
  renderKpi();
  observeAll();
  bind();
  initChrome();
  setInterval(()=>{if(!document.hidden)refreshReport();},15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshReport();});
  setTimeout(() => { $('#sync-text')?.classList.remove('pulse'); }, 600);
 }

 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
 else boot();
})();
