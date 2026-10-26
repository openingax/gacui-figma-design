// 看板页面外壳：只负责 HTML 骨架 + 静态插画，数据由浏览器端脚本渲染。
// 数据以 <script type="application/json"> 注入，不执行任何内联脚本逻辑，配合严格 CSP。
const ICONS = `
<svg id="sprite" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M2.6 20c0-3.3 2.9-5.6 6.4-5.6s6.4 2.3 6.4 5.6"/><circle cx="17.4" cy="8.7" r="2.6"/><path d="M17.2 14.7c2.5.3 4.3 2.2 4.3 4.9"/></symbol>
<symbol id="i-layers" viewBox="0 0 24 24"><path d="M12 3.2 20.6 8 12 12.8 3.4 8 12 3.2Z"/><path d="M3.4 12.4 12 17.2l8.6-4.8"/><path d="M3.4 16.6 12 21.4l8.6-4.8"/></symbol>
<symbol id="i-terminal" viewBox="0 0 24 24"><rect x="2.6" y="4.2" width="18.8" height="15.6" rx="3"/><path d="M7 9.4l3 2.7-3 2.7"/><path d="M13.2 14.9h4"/></symbol>
<symbol id="i-pulse" viewBox="0 0 24 24"><path d="M2.6 12.2h3.6l2.8-7 4 14 2.8-7h5.6"/></symbol>
<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3.2 19.4 6v5.4c0 4.2-3 7.4-7.4 9.4-4.4-2-7.4-5.2-7.4-9.4V6L12 3.2Z"/><path d="M8.9 11.8l2.2 2.2 4-4.2"/></symbol>
<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4.2 21 20.2H3L12 4.2Z"/><path d="M12 9.6v4"/><circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none"/></symbol>
<symbol id="i-message" viewBox="0 0 24 24"><path d="M20.8 11.8a8.4 8.4 0 0 1-12.1 7.5L4 20.8l1.5-4.6A8.4 8.4 0 1 1 20.8 11.8Z"/><path d="M8.6 11.4h6.8M8.6 14.6h4.2"/></symbol>
<symbol id="i-device" viewBox="0 0 24 24"><rect x="3" y="4.2" width="18" height="12.6" rx="2.4"/><path d="M8.6 20.4h6.8M12 16.8v3.6"/></symbol>
<symbol id="i-external" viewBox="0 0 24 24"><path d="M14.2 4.2h5.6v5.6"/><path d="M19.8 4.2 11.6 12.4"/><path d="M18.4 14.2v4.8a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V7.6A1.6 1.6 0 0 1 5.4 6H10"/></symbol>
<symbol id="i-copy" viewBox="0 0 24 24"><rect x="8.8" y="8.8" width="11.4" height="11.4" rx="2.4"/><path d="M5.2 15.2V6a1.8 1.8 0 0 1 1.8-1.8h8.8"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6.4 6.4 17.6 17.6M17.6 6.4 6.4 17.6"/></symbol>
<symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></symbol>
<symbol id="i-moon" viewBox="0 0 24 24"><path d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6 8.8 8.8 0 1 0 20.4 14.6Z"/></symbol>
<symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.2 4.4v5.2h-5.2"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.6"/><path d="M16 16l4.4 4.4"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="M4.6 12.4l4.8 4.8 10-10.4"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.4"/><path d="M12 7.4V12l3.2 2"/></symbol>
<symbol id="i-git" viewBox="0 0 24 24"><circle cx="6.4" cy="6" r="2.6"/><circle cx="6.4" cy="18" r="2.6"/><circle cx="17.6" cy="12" r="2.6"/><path d="M6.4 8.6v6.8"/><path d="M17.6 9.4c0 3.4-2.4 3.2-5.2 3.4-2.6.2-4.4.6-4.4 2"/></symbol>
<symbol id="i-chip" viewBox="0 0 24 24"><rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2.4"/><rect x="10" y="10" width="4" height="4" rx="1"/><path d="M9 3v3.2M15 3v3.2M9 17.8V21M15 17.8V21M3 9h3.2M3 15h3.2M17.8 9H21M17.8 15H21"/></symbol>
<symbol id="i-link" viewBox="0 0 24 24"><path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1.4 1.4"/><path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1.4-1.4"/></symbol>
<symbol id="i-inbox" viewBox="0 0 24 24"><path d="M3.4 13.4 6.6 5.6A2 2 0 0 1 8.4 4.4h7.2a2 2 0 0 1 1.8 1.2l3.2 7.8v4.2a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-4.2Z"/><path d="M3.4 13.4h4.4l1.2 2.2h6l1.2-2.2h4.4"/></symbol>
<symbol id="i-power" viewBox="0 0 24 24"><path d="M12 3.6v8"/><path d="M7.4 6.6a7.4 7.4 0 1 0 9.2 0"/></symbol>
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h13"/><path d="M12.6 6.2 18.8 12l-6.2 5.8"/></symbol>
<symbol id="i-star" viewBox="0 0 24 24"><path d="M12 3.4l1.9 5.3 5.3 1.9-5.3 1.9L12 17.8l-1.9-5.3-5.3-1.9 5.3-1.9L12 3.4Z"/></symbol>
</defs></svg>`;

// Hero 插画：设计画布 + 悬浮状态卡 + 光标。纯静态 SVG，由 CSS 驱动浮动动效。
const HERO_ART = `
<svg class="art" viewBox="0 0 520 390" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
 <defs>
  <radialGradient id="hg-halo" cx="50%" cy="50%" r="50%">
   <stop offset="0%" stop-color="#6d8bff" stop-opacity=".28"/><stop offset="70%" stop-color="#9b6bff" stop-opacity=".10"/><stop offset="100%" stop-color="#9b6bff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="hg-frame-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#dfe7ff"/><stop offset="100%" stop-color="#eef1ff"/></linearGradient>
  <linearGradient id="hg-frame-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5b7cff"/><stop offset="100%" stop-color="#9b6bff"/></linearGradient>
  <linearGradient id="hg-bar" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#5b7cff"/><stop offset="100%" stop-color="#9b6bff"/></linearGradient>
 </defs>
 <circle cx="272" cy="188" r="168" fill="url(#hg-halo)"/>
 <circle cx="272" cy="188" r="148" stroke="#7d93ff" stroke-opacity=".28" stroke-dasharray="3 11" stroke-width="1.4"/>
 <ellipse cx="268" cy="352" rx="148" ry="15" fill="#1b2559" opacity=".08"/>

 <g class="fa">
  <g transform="translate(18 168) rotate(-6)">
   <rect width="112" height="126" rx="14" fill="#fff" stroke="rgba(16,24,40,.09)"/>
   <rect x="14" y="16" width="30" height="7" rx="3.5" fill="#c9d3ee"/>
   <rect x="14" y="36" width="12" height="12" rx="3.5" fill="#dfe6ff"/><rect x="32" y="39" width="52" height="6" rx="3" fill="#e3e8f5"/>
   <rect x="14" y="58" width="12" height="12" rx="3.5" fill="#dfe6ff"/><rect x="32" y="61" width="40" height="6" rx="3" fill="#e3e8f5"/>
   <rect x="14" y="80" width="12" height="12" rx="3.5" fill="#5b7cff"/><rect x="32" y="83" width="58" height="6" rx="3" fill="#b9c6ea"/>
   <rect x="14" y="102" width="12" height="12" rx="3.5" fill="#dfe6ff"/><rect x="32" y="105" width="34" height="6" rx="3" fill="#e3e8f5"/>
  </g>
 </g>

 <g class="fc">
  <g transform="rotate(-5 268 190)">
   <rect x="112" y="76" width="312" height="222" rx="20" fill="#fff" stroke="rgba(16,24,40,.09)"/>
   <rect x="113" y="77" width="310" height="44" rx="19" fill="#f7f9ff"/>
   <path d="M113 120h310" stroke="rgba(16,24,40,.07)"/>
   <circle cx="134" cy="99" r="4" fill="#ff8a8a"/><circle cx="148" cy="99" r="4" fill="#ffcf7a"/><circle cx="162" cy="99" r="4" fill="#7ee2b8"/>
   <rect x="186" y="94" width="86" height="10" rx="5" fill="#e8ecf8"/>
   <rect x="132" y="140" width="128" height="146" rx="12" fill="url(#hg-frame-a)"/>
   <rect x="146" y="154" width="58" height="9" rx="4.5" fill="#c3cff0"/>
   <rect x="146" y="172" width="96" height="7" rx="3.5" fill="#d6def2"/>
   <rect x="146" y="187" width="80" height="7" rx="3.5" fill="#d6def2"/>
   <rect x="146" y="212" width="100" height="26" rx="8" fill="#fff" opacity=".75"/>
   <rect x="146" y="248" width="62" height="24" rx="8" fill="#5b7cff" opacity=".9"/>
   <rect x="276" y="140" width="130" height="66" rx="12" fill="#f2f5ff"/>
   <rect x="290" y="154" width="44" height="7" rx="3.5" fill="#c8d3ef"/>
   <rect x="290" y="170" width="96" height="7" rx="3.5" fill="#dde4f5"/>
   <rect x="290" y="185" width="72" height="7" rx="3.5" fill="#dde4f5"/>
   <rect x="276" y="218" width="130" height="68" rx="12" fill="url(#hg-frame-b)"/>
   <path d="M296 262c14-18 24-4 34-14s18 2 26-6" stroke="#fff" stroke-opacity=".85" stroke-width="2.4" stroke-linecap="round"/>
   <circle cx="356" cy="242" r="4.5" fill="#fff"/>
   <g stroke="#5b7cff" stroke-width="1.6">
    <rect x="128" y="136" width="136" height="154" rx="14" fill="none"/>
    <rect x="124.5" y="132.5" width="7" height="7" rx="1.6" fill="#fff"/><rect x="260.5" y="132.5" width="7" height="7" rx="1.6" fill="#fff"/>
    <rect x="124.5" y="286.5" width="7" height="7" rx="1.6" fill="#fff"/><rect x="260.5" y="286.5" width="7" height="7" rx="1.6" fill="#fff"/>
   </g>
  </g>
 </g>

 <g class="fb">
  <g transform="translate(348 62)">
   <rect width="132" height="42" rx="21" fill="#fff" stroke="rgba(16,24,40,.08)"/>
   <circle cx="24" cy="21" r="11" fill="#e6f9f1"/><path d="M19 21.4l3.4 3.4 6.2-6.6" stroke="#12b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
   <text x="44" y="18" fill="#101828" font-size="11.5" font-weight="600">已确认</text>
   <text x="44" y="32" fill="#98a2b3" font-size="10">v6 · 6 次保存</text>
  </g>
 </g>

 <g class="fd">
  <g transform="translate(52 92) rotate(-4)">
   <rect width="112" height="36" rx="18" fill="#fff" stroke="rgba(16,24,40,.08)"/>
   <circle cx="20" cy="18" r="9" fill="#eaf0ff"/><path d="M16.6 18.6l2.6 2.6 4.6-5" stroke="#5b7cff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
   <text x="36" y="22" fill="#475467" font-size="11" font-weight="500">飞书需求</text>
  </g>
 </g>

 <g class="fc">
  <g transform="translate(352 268)">
   <path d="M0 0l16 6.2-6.6 2.8-2.8 6.6L0 0Z" fill="#101828"/>
   <rect x="15" y="17" width="62" height="21" rx="10.5" fill="#5b7cff"/>
   <text x="27" y="31.5" fill="#fff" font-size="10.5" font-weight="600">GACUI</text>
  </g>
 </g>

 <g class="spark" fill="#5b7cff">
  <path d="M92 216l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8Z" opacity=".55"/>
  <path d="M446 176l2.4 6.4 6.4 2.4-6.4 2.4-2.4 6.4-2.4-6.4-6.4-2.4 6.4-2.4 2.4-6.4Z" opacity=".75"/>
  <path d="M400 92l1.8 4.8 4.8 1.8-4.8 1.8-1.8 4.8-1.8-4.8-4.8-1.8 4.8-1.8 1.8-4.8Z" fill="#9b6bff" opacity=".6"/>
 </g>
</svg>`;

const FAVICON = 'data:image/svg+xml,' + encodeURIComponent(
 `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset="1" stop-color="#9b6bff"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#g)"/><path d="M20 42V24l12-6 12 6v18" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="32" cy="36" r="3.4" fill="#fff"/></svg>`);

const BRAND_MARK = `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5b7cff"/><stop offset="1" stop-color="#9b6bff"/></linearGradient></defs><rect width="32" height="32" rx="9.6" fill="url(#bm)"/><path d="M10 21.4V12l6-3 6 3v9.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" opacity=".95"/><circle cx="16" cy="18" r="1.9" fill="#fff"/></svg>`;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function renderShell(report, opts = {}) {
 const title = opts.title ?? 'GACUI 使用看板';
 // < 转成 unicode 转义，避免 JSON 里的 </script> 提前闭合数据块。
 const payload = JSON.stringify(report).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
 const v = opts.assetVersion ?? '1';
 return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="GACUIAgent 使用看板：使用者、任务与执行与交付状态一览。">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="/assets/app.css?v=${encodeURIComponent(v)}">
</head><body>
<div class="bg" aria-hidden="true"><span class="orb o1"></span><span class="orb o2"></span><span class="orb o3"></span></div>
${ICONS}
<header class="bar" id="bar">
 <div class="bar-in">
  <a class="brand" href="#top" aria-label="返回顶部">
   <span class="brand-mark">${BRAND_MARK}</span>
   <span class="brand-text"><b>GACUI</b><i>使用看板</i></span>
  </a>
  <nav class="nav" id="nav" aria-label="导航">
   <a href="#overview" class="on">概览</a>
   <a href="#issue-center">问题中心</a>
   <a href="#people">使用者</a>
   <a href="#tasks">任务</a>
   <a href="#ops">链路</a>
  </nav>
  <div class="bar-act">
   <span class="sync" id="sync-chip" title="数据快照时间"><span class="dot"></span><span id="sync-text">同步中</span></span>
   <button class="icon-btn" id="btn-refresh" type="button" title="刷新数据" aria-label="刷新数据"><svg class="i"><use href="#i-refresh"/></svg></button>
   <button class="icon-btn" id="btn-theme" type="button" title="切换主题" aria-label="切换主题"><svg class="i"><use href="#i-moon"/></svg></button>
   <a class="icon-btn" href="/logout" title="退出登录" aria-label="退出登录"><svg class="i"><use href="#i-power"/></svg></a>
  </div>
 </div>
 <div class="bar-progress" id="bar-progress"></div>
</header>

<main id="top">
 <section class="hero reveal" id="overview">
  <div class="hero-copy">
   <span class="eyebrow"><span class="eyebrow-dot"></span>GACUIAgent · Usage Intelligence</span>
   <h1>让每一次<span class="grad">设计协作</span><br>都被看见。</h1>
   <p class="lede">汇总使用者、任务与执行与交付状态 —— 谁在用、做了什么、卡在哪里，一屏读完。</p>
   <div class="hero-meta" id="hero-meta"></div>
  </div>
  <div class="hero-art">${HERO_ART}</div>
 </section>

 <div id="app" aria-live="polite">
  <div class="skeleton-grid">
   ${'<div class="sk"></div>'.repeat(4)}
  </div>
 </div>
</main>

<footer class="foot">
 <div class="foot-l">
  <span class="foot-mark">${BRAND_MARK}</span>
  <span>数据来自本机日志统计 · 包含使用者、任务、需求原文及来源链接</span>
 </div>
 <div class="foot-r" id="foot-meta"></div>
</footer>

<div class="drawer-mask" id="drawer-mask" hidden></div>
<aside class="drawer" id="drawer" hidden aria-labelledby="drawer-title"></aside>
<div class="toast-wrap" id="toast-wrap" aria-live="assertive"></div>

<noscript><div class="noscript">这个看板需要 JavaScript 才能渲染图表。也可以直接访问 <a href="/report.json">/report.json</a> 查看原始数据。</div></noscript>
<script type="application/json" id="gacui-data">${payload}</script>
<script src="/assets/app.js?v=${encodeURIComponent(v)}" defer></script>
</body></html>`;
}
