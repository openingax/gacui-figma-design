// 草图预览页面脚本：由 sketch.mjs render 和 core.mjs 一起内联，只读展示，不能编辑。
(() => {
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
  const versions = BUNDLE.versions;
  const ui = {cur: versions.length - 1, cmp: null, page: versions.at(-1).data.pages[0].id, state: null, sel: null, selVersion: null};
  const BADGES = {推荐: '荐', 判断: '判', 演示: '演'};

  const badge = from => BADGES[from] ? `<i class="badge b-${BADGES[from]}">${BADGES[from]}</i>` : '';
  const attrs = (path, from, mark, cls) => `class="${cls}${mark ? ' m-' + mark : ''}${ui.sel === path ? ' sel' : ''}" data-path="${esc(path)}" title="${esc(from ? '来源：' + from : '')}"`;
  const bar = (i, j) => `<span class="bar" style="width:${40 + ((i * 7 + j * 13) % 5) * 12}%"></span>`;

  function paginationHtml(input){
    const s=validatePagination(input),arrow=(text,disabled)=>`<span style="color:${disabled?'#aeb4bc':'#171f26'}">${text}</span>`;
    const jump=`<span>跳至 <span class="page-input">${s.current}</span> /${s.pageCount} 页</span>`;
    return `<div class="spec-pagination ${s.disabled?'disabled':''}">${s.totalContent?`<span class="page-total">共 ${s.total} 项数据</span>`:''}<div>${s.pagesize?`<span class="page-size">${s.pageSize} 条/页　⌄</span>`:''}${arrow('‹',s.disabled||s.current===1)}${s.theme==='simple'?jump:s.pages.map(p=>`<span class="page-number ${p===s.current?'selected':''}">${p}</span>`).join('')}${arrow('›',s.disabled||s.current===s.pageCount)}${s.theme==='default'&&s.jumper?jump:''}</div></div>`;
  }
  function tagHtml(input) {
    const s=validateTag(input),r=TAG_CATALOG.rows.find(r=>r.key===tagKey(s));
    if(!r)throw Error('Tag预览数据缺失');
    return `<span class="spec-tag" style="color:${r.color};background:${r.background};border:1px solid ${r.border};border-radius:${s.shape==='round'?9999:3}px" aria-disabled="${s.disabled}">${s.icon?'<svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 2h6l6 6-6 6-6-6Z" fill="none" stroke="currentColor"/><circle cx="5" cy="5" r="1" fill="currentColor"/></svg>':''}${esc(s.label)}${s.closable?`<span class="tag-close" style="color:${s.closeState==='hover'?TAG_CATALOG.closes.find(c=>c.theme===(s.variant==='dark'&&s.theme!=='default'?'White':s.theme)&&c.state==='hover').color:r.closeColor}">×</span>`:''}</span>`;
  }
  // 全文入口只用于审阅静态草稿，不表示业务控件的展开行为。
  const fullValue = value => `<details class="full-value"><summary>查看全文</summary><div>${esc(value)}</div></details>`;
  function field(f, path, patch, mark, kind) {
    if (f.visible === false) return '';
    const p = {...f, ...(patch[path] ?? {})};
    const value = p.value ?? f.value;
    const text = value ?? f.placeholder ?? (kind === 'select' ? '请选择' : kind.startsWith('date') ? '' : '请输入');
    let box;
    if (kind === 'date-range') box = `<span class="box">${esc(Array.isArray(value) ? value.join(' ~ ') : value ?? '开始日期 ~ 结束日期')}<b>▦</b></span>`;
    else if (kind === 'date') box = `<span class="box">${esc(value ?? '请选择日期')}<b>▦</b></span>`;
    else if (kind === 'select') box = `<span class="box${value ? '' : ' ph'}" title="${esc((f.options ?? []).map(o=>typeof o==='string'?o:o.label+(o.disabled?'（停用）':'')).join(' / '))}">${esc(text)}<b>▾</b></span>`;
    else if (kind === 'switch') box = `<span class="switch${value ? ' on' : ''}"></span>`;
    else if (kind === 'time') box = `<span class="box">${esc(value ?? '请选择时间')}<b>◷</b></span>`;
    else if (kind === 'number') box = `<span class="box">−　${esc(value ?? '请输入')}　＋</span>`;
    else if (kind === 'checkbox' || kind === 'radio') box = `<span class="checks">${(f.options ?? [f.label]).map(o => `<span>${(Array.isArray(value)?value.includes(typeof o==='string'?o:o.label):value===(typeof o==='string'?o:o.label)) ? (kind==='radio'?'◉':'☑') : (kind==='radio'?'○':'☐')} ${esc(typeof o==='string'?o:o.label)}</span>`).join('')}</span>`;
    else if (kind === 'upload') box = `<span class="upload">＋ 上传文件</span>${(Array.isArray(value) ? value : []).map(n => `<span class="file">${esc(n)} ${p.fileStates?.[n]==='fail'?'（失败） 重新上传 · 移除':p.disabled?'':'✕'}</span>`).join('')}`;
    else box = `<span class="box${value ? '' : ' ph'}${kind === 'textarea' ? ' tall' : ''}">${esc(text)}${f.max ? `<em class="count">${[...String(value ?? '')].length}/${f.max}</em>` : ''}</span>`;
    if (['input','select'].includes(kind)) {
      box = `<span class="box single${value ? '' : ' ph'}"><span class="single-value">${esc(text)}</span>${kind==='select'?'<b>▾</b>':''}${f.max?`<em class="count">${[...String(value??'')].length}/${f.max}</em>`:''}</span>${value!=null&&String(value)!==''?fullValue(value):''}`;
    }
    if(kind==='select'&&p.open)box+=`<div class="select-popup">${(p.options??[]).map(o=>typeof o==='string'?{label:o}:o).map(o=>`<div class="${o.disabled?'disabled':''}">${(p.value??[]).includes(o.label)?'☑':'☐'} ${esc(o.label)}</div>`).join('')}</div>`;
    const wide = kind === 'textarea' || kind === 'upload' ? ' wide' : '';
    return `<div ${attrs(path, f.from, mark, `fld k-${kind}${wide}${p.error ? ' err' : ''}${p.disabled ? ' off' : ''}`)}><span class="lb">${f.required ? '<em>*</em>' : ''}${esc(f.label)}${badge(f.from)}</span>${box}${f.help ? `<small class="help">${esc(f.help)}</small>` : ''}${p.error ? `<small class="msg">${esc(p.error)}</small>` : ''}</div>`;
  }

  function imageViewerHtml(n){const item=n.items.find(i=>i.id===n.open),error=n.openError??item?.state==='error',ratio=item?.ratio??(n.gallery?'16:9':'1:1');return '<div class="image-items'+(n.gallery?' gallery-items':'')+'">'+(n.items.map(i=>'<div><div class="image-sample '+(i.state??'normal')+'">'+(i.state==='error'?'图片加载失败':'演示图片')+(i.state==='hover'?'<span class="image-hover">◉ 预览</span>':'')+(n.gallery&&i.state!=='error'?'<span class="gallery-caption">'+esc(i.filename)+'</span>':'')+'</div>'+(n.gallery&&i.state!=='error'?'':'<p>'+esc(i.filename)+'</p>')+'<button>'+(i.state==='error'?'重新加载':'查看原图')+'</button></div>').join('')||(n.emptyFeedback?feedback({kind:'empty',message:'暂无附件'}):'暂无附件'))+'</div>'+(item?'<div class="image-viewer-modal">'+(n.gallery&&n.showThumbnails?'<div class="gallery-strip">'+n.items.map(i=>'<span class="'+(i.id===n.open?'active':'')+'">'+esc(i.filename)+'</span>').join('')+'</div>':'')+'<div class="image-modal-title">'+esc(item.filename)+'</div><span class="image-close '+(n.closeState??'normal')+'">×</span>'+(n.gallery?'<span class="image-previous">‹</span><span class="image-next">›</span>':'')+'<div class="image-modal-picture" style="aspect-ratio:'+ratio.replace(':','/')+';width:'+(ratio==='9:16'?'180px':ratio==='16:9'?'480px':'320px')+'">'+(error?'图片无法显示':'演示图片')+'</div></div>':'');}
  function feedback(s){if(s.kind==='alert'){s=validateAlert(s);const r=ALERT_CATALOG.find(r=>r.key===[s.theme,s.icon,s.showTitle,!!s.description,!!s.operation,s.collapse].join('|')),c=r.background,bg='rgb('+[c.r,c.g,c.b].map(x=>Math.round(x*255)).join(',')+')';return '<div class="alert-preview" style="background:'+bg+'"><span class="alert-close">×</span>'+(s.showTitle?'<div class="alert-title">'+(s.icon?'<i style="background:'+({info:'#0068ff',success:'#00b42a',warning:'#ff7d00',danger:'#f53f3f'}[s.theme])+'">'+({info:'i',success:'✓',warning:'!',danger:'×'}[s.theme])+'</i>':'')+'<span>'+esc(s.message)+'</span>'+(s.operation?'<a>'+esc(s.operation)+'</a>':'')+'</div>':'')+(s.description?'<p style="margin-left:'+(s.icon?28:0)+'px">'+esc(s.description)+'</p>':'')+(s.collapse?'<a class="alert-expand" style="margin-left:'+(s.icon?28:0)+'px">'+esc(s.expandText)+'</a>':'')+'</div>';}return `<div class="feedback ${s.kind}">${FEEDBACK_ICONS[s.kind]}<p>${esc(s.message)}</p>${s.action?`<span class="btn">${esc(s.action)}</span>`:''}</div>`;}
  function table(n, path, patch, marks) {
    const p = patch[path] ?? {};
    const count = n.renderRows ?? p.rows ?? n.rows ?? 5;
    const selected = n.selectedRows ?? [];
    const eligible = count - (n.disabledRows?.length ?? 0);
    const sel = selected.length ? selected.length === eligible ? 'all' : 'partial' : 'none';
    const actions = n.rowActions ?? [];
    const mode=n.selectionMode??(n.selection?'multiple':'none');
    const head = `<tr>${n.selection ? `<th class="ck">${mode==='multiple'?(sel === 'all' ? '☑' : sel === 'partial' ? '⊟' : '☐'):''}</th>` : ''}${n.columns.map(c => `<th style="${c.width?'width:'+c.width+'px;':''}${n.resizableColumns?'border-right:1px solid #ddd;':''}" ${attrs(`${path}/${c.id}`, c.from, marks.get(`${path}/${c.id}`), '')}>${esc(c.title)}${badge(c.from)}</th>`).join('')}</tr>`;
    const rows = Array.from({length: Math.min(count, 10)}, (_, i) => {
      const ra = actions.length ? actions[i % actions.length] : null;
      const checked = selected.includes(i);
      return `<tr>${n.selection ? `<td style="${mode==='expand'&&(n.expandHoverRows??[]).includes(i)?'color:#0068ff':''}" class="ck${n.disabledRows?.includes(i) ? ' off' : ''}">${mode==='single'?(checked?'◉':'○'):mode==='expand'?((n.expandedRows??[]).includes(i)?'⌄':'⌃'):(checked ? '☑' : '☐')}</td>` : ''}${n.columns.map((c, j) => `<td>${c.kind === 'operations' ? `<span class="ops">${(ra ? [...ra.labels, ...(ra.more ? ['更多'] : [])] : ['操作']).map(label=>`<span data-action-label="${esc(label)}">${esc(label)}</span>`).join('　')}</span>` : c.kind==='state'?`<span style="color:${(c.stateThemes?.[n.data?.[i]?.[c.id]]??'normal')==='error'?'#f53f3f':'#00b42a'}">● ${esc(n.data?.[i]?.[c.id]??'')}</span>`:c.kind==='textTag'?`<span class="text-tag-cell"><span class="cell-value truncate">${esc(n.data?.[i]?.[c.id]??'')}</span>${tagHtml({label:String(n.data?.[i]?.[c.tagKey]??''),theme:'success'})}</span>`: c.kind==='tag' ? tagHtml({...c.tag,label:String(n.data?.[i]?.[c.id]??'演示'),theme:c.themes?.[n.data?.[i]?.[c.id]??'演示']??'default'}) : n.data?.[i]?.[c.id] != null ? `<span class="cell-value ${c.maxLines?'multiline':c.wrap?'wrap':'truncate'}" style="${c.maxLines?'display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:'+c.maxLines+';max-height:'+(22*c.maxLines)+'px;white-space:normal;':''}">${esc(n.data[i][c.id])}</span>${c.wrap?'':fullValue(n.data[i][c.id])}` : bar(i, j)}</td>`).join('')}</tr>${mode==='expand'&&(n.expandedRows??[]).includes(i)?`<tr><td colspan="${n.columns.length+1}" style="padding:12px 24px 12px 70px">${esc(n.expandedContent[i])}</td></tr>`:''}`;
    }).join('');
    const empty = n.feedback&&count===0?feedback({kind:n.error?'error':'empty',message:n.error||n.emptyText||'暂无数据',action:n.error?(n.retryLabel||'重试'):n.feedback.action}):count === 0 && !n.error ? `<div class="empty">${esc(p.emptyText ?? n.emptyText ?? '暂无数据')}</div>` : '';
    const legend = actions.some(a => a.when) ? `<div class="legend">行操作：${actions.map(a => `${esc(a.when ?? '其他')} → ${esc([...a.labels, ...(a.more ? ['更多'] : [])].join(' / '))}`).join('；')}</div>` : '';
    const pager = n.pagination && count > 0 ? typeof n.pagination==='object'?paginationHtml(n.pagination):`<div class="pager">共 ${count} 条　‹ 1 ${count > 10 ? '2 3 ' : ''}›</div>` : '';
    return `<div class="tbl"><table><thead>${head}</thead><tbody>${rows}</tbody></table>${empty}${p.loading ? '<div class="overlay">加载中…</div>' : ''}${n.error && !n.feedback ? `<div class="errbox">${esc(n.error)} <span class="btn">${esc(n.retryLabel || '重试')}</span></div>` : ''}<div class="demo">${n.data ? '表格内容为演示数据' : '表格内容为占位，不代表业务数据'}</div>${legend}${pager}</div>`;
  }

  function node(n, pagePath, patch, marks) {
    const path = `${pagePath}/${n.id}`;
    const p = patch[path] ?? {};
    if (n.visible === false || (n.type==='form' && n.fields.every(f=>f.visible===false))) return '';
    let body = '';
    if(n.type==='upload')body=uploadPreview(n,UPLOAD_ROOTS,esc);
    if(n.type==='transfer')body=transferHtml(transferModel(n,TRANSFER_CATALOG),esc);
    if(n.type==='cascader'){const s=validateCascader(n);body=`<div class="sketch-cascader ${s.disabled?'off':''}"><div class="select-input ${s.open?'focus':''}" style="width:${s.width}px">${s.prefixIcon?'♙ ':''}<span>${esc(s.multiple?s.value.join('、')||'请选择':s.value||'请选择')}</span><b>${s.open?'⌃':'⌄'}</b></div>${s.open?`<div class="cascader-popup">${s.columns.map((c,i)=>`<div class="cascader-column" style="width:${s.columnWidth}px">${c.options.map(o=>`<div class="cascader-option ${o.state??'normal'} ${o.disabled?'off':''} ${o.divider?'divider':''}">${s.multiple?`<b>${o.indeterminate?'⊟':o.state==='select'?'☑':'☐'}</b>`:''}<span>${esc(o.label)}</span>${(o.branch??c.branch??i<s.columns.length-1)?'›':''}</div>`).join('')}${c.options.length<5?`<div style="height:${[0,150,112,74,36][c.options.length]}px"></div>`:''}</div>`).join('')}</div>`:''}</div>`;}
    if(n.type==='timePicker'){const s=validateTimePicker(n);body=`<div class="sketch-time-picker ${s.disabled?'off':''}" style="width:${s.width}px"><div class="select-input ${s.open?'focus':''}">${s.values.map((v,i)=>`<span class="time-range ${s.rangeState[i]??'normal'}">${esc(s.display?.[i]??(v||(s.range?(i?'结束时间':'开始时间'):'请选择时间')))}</span>`).join(s.range?' — ':'')}<span>◷</span></div>${s.open?`<div class="time-popup"><div class="time-columns">${s.columns.map(c=>`<div>${c.map(v=>`<div class="time-cell ${v.state??'normal'}">${esc(v.label)}</div>`).join('')}</div>`).join('')}</div><div class="time-footer"><span>取消</span><span>确认</span></div></div>`:''}</div>`;}
    if(n.type==='selectField'){const s=validateSelect(n);body=`<div class="sketch-select-field ${s.disabled?'off':''}" style="width:${s.width}px"><div class="select-input ${s.open?'focus':''}">${s.prefixIcon?'<span>用户</span>':''}<span class="select-values">${s.multiple&&s.values.length?s.values.map(v=>`<span class="select-tag">${esc(v)} ×</span>`).join(''):esc(s.values[0]??s.placeholder??'请选择')}</span><span>${s.open?'⌃':'⌄'}</span></div>${s.open?`<div class="select-popup">${s.options.map(o=>`<div class="select-option ${s.values.includes(o.label)?'selected':o.state??''} ${o.disabled?'off':''} ${o.divider?'with-divider':''}">${s.multiple?`<span>${s.values.includes(o.label)?'☑':'☐'}</span>`:''}${esc(o.label)}</div>`).join('')}</div>`:''}</div>`;}
    if(n.type==='inputField'){const s=validateInputField(n),off=s.variant.includes('disabled 禁用=on'),multi=s.family==='textarea',masked=s.family==='input-password'&&s.variant.includes('browse 浏览=off')&&s.value!==undefined;const value=masked?'●'.repeat(Array.from(s.value).length):s.value??s.placeholder??'请输入';body=`<div class="sketch-input-field ${off?'off':''} ${multi?'multi':''} ${s.variant.includes('focus')?'focus':''}" style="width:${s.width??(multi?400:s.family==='input-addon'?280:240)}px"><div class="input-line">${s.variant.includes('prepend 前置标签=on')?`<span class="addon">${esc(s.prepend??'http://')}</span>`:''}${s.variant.includes('prefixIcon 前置图标=on')?`<span aria-label="前置图标">${s.family==='input-password'?'锁':'用户'}</span>`:''}<span class="input-value" style="${multi&&s.variant.includes('autosize 自动高度=off')?'height:44px;overflow:hidden':''}">${esc(value)}</span>${s.family==='input-password'?'<span aria-label="密码显隐">◉</span>':''}${s.variant.includes('append 后置标签=on')?`<span class="addon">${esc(s.append??'.com')}</span>`:''}</div>${s.variant.includes('maxcharacter 限制字符=on')?`<small>${Array.from(s.value??'').length}/${s.limit??150}</small>`:''}${s.variant.includes('tips 提示=on')?`<small>${esc(s.tips??'额外提示语')}</small>`:''}</div>`;}
    if(n.type==='number'){const s=validateInputNumber(n);const controls=s.theme==='row'?'<i>+</i>':['hover','focus'].includes(s.state)?`<span class="steps">${['increase','decrease'].map((key,i)=>{const c=s[key]??{};return `<i role="button" aria-label="${i?'减少':'增加'}" aria-disabled="${!!c.disabled}" class="${c.disabled?'off':c.state??''}">${i?'⌄':'⌃'}</i>`;}).join('')}</span>`:'';body=`<span class="sketch-number ${s.state} ${s.disabled?'off':''}" style="width:${s.width??(s.theme==='row'?144:96)}px" role="spinbutton" aria-disabled="${!!s.disabled}" ${s.value!=null?`aria-valuenow="${s.value}"`:''}>${s.theme==='row'?'<i>−</i>':''}<span>${esc(s.value==null?(s.placeholder??'请输入'):String(s.value))}</span>${controls}</span>`;}
    if(n.type==='checkbox'){const s=validateCheckbox(n);body=`<div class="sketch-radio" role="group">${s.options.map(o=>`<span role="checkbox" aria-checked="${o.indeterminate?'mixed':!!o.checked}" aria-disabled="${!!o.disabled}" class="${o.disabled?'off':''}">${o.indeterminate?'▣':o.checked?'☑':'□'} ${esc(o.label)}</span>`).join('')}</div>`;}
    if(n.type==='radio'){const s=validateRadio(n);body=`<div class="sketch-radio ${s.kind==='buttonGroup'?'buttons':''}" role="radiogroup">${s.options.map(o=>`<span role="radio" aria-checked="${o.id===s.value}" aria-disabled="${!!o.disabled}" class="${o.disabled?'off':''} ${o.id===s.value?'selected':''}">${s.kind!=='buttonGroup'?(o.id===s.value?'◉':'○'):''} ${esc(o.label)}</span>`).join('')}</div>`;}
    if(n.type==='link')body=`<span class="sketch-link ${n.size??'medium'} ${n.disabled?'disabled':n.state??'normal'}" role="link" aria-disabled="${!!n.disabled}">${n.prefix?`<span>${(n.prefixIcon??'link')==='jump'?'↗':'🔗'}</span>`:''}<span>${esc(n.text??'跳转链接')}</span>${n.suffix?`<span>${(n.suffixIcon??'jump')==='jump'?'↗':'🔗'}</span>`:''}</span>`;
    if(n.type==='divider')body=n.orientation==='vertical'?`<div style="height:${n.length??40}px;border-left:1px ${n.dashed?'dashed':'solid'} #aab0b6;width:1px"></div>`:`<div class="sketch-divider ${n.align??'center'} ${n.dashed?'dashed':''}" style="max-width:${n.length??1192}px"><i></i>${n.text?`<span>${esc(n.text)}</span><i></i>`:''}</div>`;
    if(n.type==='feedback')body=feedback(n);
    if(n.type==='timeline')body=`<div class="log-timeline">${n.items.map(i=>`<div><strong>${esc(i.actor)} · ${esc(i.action)}</strong><p>${esc(i.time)}</p><p>${esc(i.detail)}</p></div>`).join('')||'暂无操作日志'}</div>`;
    if(n.type==='imageViewer')body=imageViewerHtml(n);
    if(n.type==='descriptions')body=`<div class="description-grid" style="grid-template-columns:repeat(${n.columnCount??2},minmax(0,1fr))">${n.items.map(i=>`<div style="${i.span===2?'grid-column:1/-1;':''}"><span>${esc(i.label)}：</span><span>${esc(i.value)}</span></div>`).join('')}</div>`;
    if (n.type === 'heading') body = `<p>${esc(n.title)}</p><p>${esc(n.subtitle??'')}　${tagHtml(n.status)}</p>`;
    if (n.type === 'search') body = `<div class="grid">${n.fields.map(f => field(f, `${path}/${f.id}`, patch, marks.get(`${path}/${f.id}`), f.kind)).join('')}<div class="qbtn"><span class="btn pri">查询</span><span class="btn">重置</span></div></div>`;
    if (n.type === 'actions') body = n.buttons.filter(b => b.visible !== false).map(b => `<span data-action-label="${esc(b.label)}" ${attrs(`${path}/${b.id}`, b.from, marks.get(`${path}/${b.id}`), `btn${b.primary ? ' pri' : ''}${(b.enableWhenSelected ? b.disabled : ((patch[`${path}/${b.id}`] ?? {}).disabled ?? b.disabled)) ? ' off' : ''}`)}>${b.loading?'◌ ':''}${esc(b.label)}${b.opens ? ' ↗' : ''}${badge(b.from)}</span>${b.selectionSummary ? `<small>${esc(b.selectionSummary)}</small>` : ''}`).join('');
    if (n.type === 'actions' && n.message) body += `<p>${esc(n.message)}</p>`;
    if(n.type==='steps'){const s=validateSteps(n);body='<div class="steps-preview '+s.orientation+' '+s.theme+'">'+s.items.map((i,j)=>'<div class="step '+i.state+'"><i>'+(s.orientation==='vertical'&&s.theme==='dot'?'':i.state==='finish'?'✓':i.state==='error'?'×':j+1)+'</i><div><strong>'+esc(i.title)+'</strong><p>'+esc(i.description)+'</p></div></div>').join('')+'</div>';}
    if(n.type==='loading'){const s=validateLoading(n);body=`<div class="region-loading">${s.variant!=='text'?`<i class="loading-ring ${s.size}"></i>`:''}${s.variant!=='spinner'?esc(s.label):''}</div>`;}
    if (n.type === 'tabs') body = '<div class="tabs-bar '+(n.orientation==='left'?'left':'top')+'">'+n.items.map((t, i) => `<span class="tab${(n.active ?? 0) === i ? ' on' : ''}">${n.icon?'◇ ':''}${esc(t)}</span>`).join('')+'</div>';
    if (n.type === 'table') body = table(n, path, patch, marks);
    if (n.type === 'form') body = `<div class="form c${n.cols ?? 1}">${n.fields.map(f => field(f, `${path}/${f.id}`, patch, marks.get(`${path}/${f.id}`), f.kind)).join('')}</div>`;
    if (n.type === 'note') body = `<span class="tag">说明</span>${esc(n.text)}`;
    if (n.type === 'gap') body = `<b>缺口：${esc(n.need)}</b>${n.handling ? `<small>本轮：${esc(n.handling)}</small>` : ''}`;
    const extra = p.note ? `<div class="pnote">${esc(p.note)}</div>` : '';
    return `<section ${attrs(path, n.from, marks.get(path), `n n-${n.type}${n.footer ? ' footer' : ''}`)}>${n.type === 'note' || n.type === 'gap' ? '' : `<span class="ntitle">${esc(nodeTitle(n))}${badge(n.from)}</span>`}${body}${extra}</section>`;
  }

  function canvas(sketch, pageId, stateId, marks) {
    let page = sketch.pages.find(p => p.id === pageId);
    if (!page) return '<div class="none">这个版本没有该页面</div>';
    const state = (sketch.states ?? []).find(s => s.id === stateId && s.page === pageId);
    if (stateId && !state) return '<div class="none">这个版本没有该状态</div>';
    const patch = state?.patch ?? {};
    page = resolvePage(page, patch);
    const dialogs=page.children.filter(n=>n.type==='dialog'&&n.visible!==false);
    const notices=page.children.filter(n=>n.type==='message'&&n.visible!==false).map(n=>`<div class="global-message ${esc(n.theme??'info')}"><b>${{info:'i',success:'✓',warning:'!',error:'×',loading:'◌'}[n.theme??'info']}</b> ${esc(n.text)}${n.closable?'　×':''}</div>`).join('');
    const tips=page.children.filter(n=>n.type==='tooltip'&&n.visible!==false).map(n=>{const s=validateTooltip(n),r=TOOLTIP_CATALOG.find(r=>r.key===s.placement+'|'+s.theme),color=c=>'rgb('+[c.r,c.g,c.b].map(v=>Math.round(v*255)).join(',')+')';return `<div class="tooltip-preview" data-anchor="${esc(s.anchor)}" data-placement="${s.placement}" style="background:${color(r.background)};color:${color(r.color)}">${esc(s.text)}</div>`;}).join('');
    const pops=page.children.filter(n=>n.type==='popconfirm'&&n.visible!==false).map(n=>{const s=validatePopconfirm(n);return '<div class="popconfirm-preview" data-anchor="'+esc(s.anchor)+'" data-placement="'+s.placement+'" data-arrow="'+s.showArrow+'"><div class="popconfirm-content">'+(s.theme==='n/a'?'':'<i style="background:'+({default:'#0068ff',warning:'#ff7d00',danger:'#f53f3f'}[s.theme])+'">'+({default:'i',warning:'!',danger:'×'}[s.theme])+'</i>')+'<div><strong>'+esc(s.title)+'</strong><p>'+esc(s.description)+'</p></div></div><footer><span class="btn">'+esc(s.cancel)+'</span><span class="btn pri">'+esc(s.confirm)+'</span></footer></div>';}).join('');
    const notifications=page.children.filter(n=>n.type==='notification'&&n.visible!==false).map(n=>{const s=validateNotification(n);return '<div class="notification-preview"><div class="notification-content">'+(s.icon?'<i style="background:'+({info:'#0068ff',success:'#00b42a',warning:'#ff7d00',error:'#f53f3f'}[s.theme])+'">'+({info:'i',success:'✓',warning:'!',error:'×'}[s.theme])+'</i>':'')+'<div><strong>'+esc(s.title)+'</strong><p>'+esc(s.description)+'</p></div></div>'+(s.footerBtn?'<footer><span class="btn">'+esc(s.cancel)+'</span><span class="btn pri">'+esc(s.confirm)+'</span></footer>':'')+'</div>';}).join('');
    const overlay=notices+tips+pops+notifications+dialogs.map(n=>{const theme=n.theme??(n.fullscreen?'info':'default'),close=n.closable??n.closeBtn??!!n.fullscreen,color={info:'#0068ff',warning:'#ff7d00',error:'#f53f3f',success:'#00b42a'}[theme];return `<div class="dialog-mask"></div><div class="dialog" data-divider="${!!n.divider}" data-fullscreen="${!!n.fullscreen}" style="width:${n.fullscreen?'100%':(n.width??480)+'px'}"><h3>${color?`<i style="background:${color}">${{info:'i',warning:'!',error:'×',success:'✓'}[theme]}</i>`:''}<span>${esc(n.title)}</span>${close?`<b class="dialog-close" data-state="${n.closeState??'normal'}">×</b>`:''}</h3><p>${esc(n.message)}</p><div class="dialog-footer"><span class="btn">${esc(n.cancel)}</span><span class="btn pri" style="background:${theme==='warning'||theme==='error'?color:'#0068ff'}">${esc(n.confirm)}</span></div></div>`;}).join('');
    const nodes = list => list.filter(n=>!['dialog','message','tooltip','popconfirm','notification'].includes(n.type)).map(n => node(n, page.id, patch, marks)).join('');
    if (page.frame === 'drawer') {
      const parent = page.over && sketch.pages.find(p => p.id === page.over);
      const body = (page.children ?? []).filter(n => !n.footer), foot = (page.children ?? []).filter(n => n.footer);
      const width = Math.round((page.width ?? 500) * 0.8);
      return `<div class="frame">${parent ? `<div class="behind">${canvas(sketch, parent.id, null, new Map())}</div>` : ''}<div class="mask"></div><div ${attrs(page.id, page.from, marks.get(page.id), 'drawer')} style="width:${width}px"><div class="dhead">${esc(page.title)}<span>✕</span></div><div class="dbody">${nodes(body)}</div>${foot.length ? `<div class="dfoot">${nodes(foot)}</div>` : ''}</div>${overlay}</div>`;
    }
    const leftIndex=page.children.findIndex(n=>n.type==='tabs'&&n.orientation==='left');
    const content=leftIndex<0?nodes(page.children):nodes(page.children.slice(0,leftIndex))+'<div class="left-tabs-layout">'+nodes([page.children[leftIndex]])+'<div class="left-tabs-content">'+nodes(page.children.slice(leftIndex+1))+'</div></div>';
    return `<div ${attrs(page.id, page.from, marks.get(page.id), 'frame wb')}>${page.layout==='side'?'':'<div class="top">顶部导航</div>'}<div class="wbody">${page.layout==='top'?'':'<div class="menu">'+esc(page.menu ?? '菜单')+'</div>'}<div class="content"><div class="ptitle">${esc(page.title)}</div>${content}</div></div>${overlay}</div>`;
  }

  function versionName(v) {
    return `v${v.v}${v.label ? ' · ' + v.label : ''}${v.star ? ' ★' : ''}${(BUNDLE.draftConfirmed === v.v || BUNDLE.draftConfirmedVersions?.includes(v.v)) ? ' · 草稿已确认' : ''}${BUNDLE.confirmed === v.v ? ' · 已确认出稿' : ''}`;
  }

  function info(sketch, version) {
    const selectedVersion = versions[ui.selVersion ?? ui.cur];
    const paths = indexPaths(selectedVersion.data);
    const parts = [`<div class="card"><h3>${(BUNDLE.draftConfirmed === version.v || BUNDLE.draftConfirmedVersions?.includes(version.v)) ? '草稿已确认' : '讨论稿 · 尚未确认'} v${version.v}</h3><p>${BUNDLE.exported ? '只读交付，仅含当前版本；续改请保留完整任务目录。' : '可随时保存并继续讨论。确认草稿不会生成 Figma。'}</p></div>`];
    if (BUNDLE.warnings?.length) parts.push(`<div class="card warn"><h3>版本记录需处理</h3>${BUNDLE.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}</div>`);
    if (ui.sel && paths.has(ui.sel)) {
      const {label, item} = paths.get(ui.sel);
      const related = (selectedVersion.data.questions ?? []).filter(q => q.node && (q.node === ui.sel || q.node.startsWith(ui.sel + '/')));
      parts.push(`<div class="card selcard"><h3>已选中 v${selectedVersion.v}</h3><p class="ref">[${esc(label)}]</p>${item.from ? `<p>来源：${esc(item.from)}</p>` : ''}${related.map(q => `<p>${esc(q.id)}：${esc(q.ask)}</p>`).join('')}<button id="copy">复制引用</button><input id="copytext" value="[v${selectedVersion.v} · ${esc(label)}]" readonly><small id="copied"></small><p class="hint">粘贴到 Codex 对话里，再说要怎么改。</p></div>`);
    }
    const base = versions.find(v => v.v === (version.basedOn ?? version.v - 1));
    if (base) {
      const d = diff(base.data, sketch);
      const li = (list, cls, f) => list.map(x => `<li class="${cls}">${f(x)}</li>`).join('');
      parts.push(`<div class="card"><h3>相对 v${base.v} 的变化</h3><ul>${li(d.added, 'add', x => '新增 ' + esc(x.label))}${li(d.removed, 'del', x => '删除 ' + esc(x.label))}${li(d.changed, 'chg', x => `修改 ${esc(x.label)}<small>${esc(x.props.join('；'))}</small>`)}</ul>${d.added.length + d.removed.length + d.changed.length ? '' : '<p>无变化</p>'}</div>`);
    }
    if (version.missing?.length) parts.push(`<div class="card warn"><h3>清单未覆盖</h3><p>以下事项尚无结论，可先讨论，确认前需处理：</p>${(version.missingDetails ?? version.missing.map(code=>({code}))).map(m=>`<p>${esc(m.topic ?? m.code)}<small>${esc(m.ask ?? '')}</small></p>`).join('')}</div>`);
    const open = (sketch.questions ?? []).filter(q => q.answer == null), done = (sketch.questions ?? []).filter(q => q.answer != null);
    parts.push(`<div class="card"><h3>待你决定（${open.length}）</h3>${open.map(q => `<div class="q"><b>${esc(q.id)}${q.code ? ' · ' + esc(q.code) : ''}</b> ${esc(q.ask)}<small>推荐：${esc(q.recommend)}</small></div>`).join('') || '<p>没有待决定的问题</p>'}${done.length ? `<details><summary>已回答 ${done.length} 个</summary>${done.map(q => `<div class="q"><b>${esc(q.id)}</b> ${esc(q.ask)}<small>回答：${esc(q.answer)}</small></div>`).join('')}</details>` : ''}</div>`);
    const gapNodes = sketch.pages.flatMap(p => (p.children ?? []).filter(n => n.type === 'gap').map(n => ({need: n.need, handling: n.handling, acceptedFrom:n.acceptedFrom})));
    const gaps = [...gapNodes, ...(sketch.gaps ?? [])];
    if (gaps.length) parts.push(`<div class="card"><h3>组件缺口</h3>${gaps.map(g => `<p><b>${esc(g.need)}</b>${g.component ? `（${esc(g.component)}）` : ''}<small>本轮：${esc(g.handling ?? '待定')}</small>${g.acceptedFrom ? `<small>处理方式已接受：${esc(g.acceptedFrom)}</small>` : ''}</p>`).join('')}</div>`);
    if (sketch.judgments?.length) parts.push(`<div class="card"><h3>设计判断（不是规范，也不是需求原文）</h3><ul>${sketch.judgments.map(j => `<li>${esc(j)}</li>`).join('')}</ul></div>`);
    if (sketch.demo) parts.push(`<div class="card"><h3>演示数据</h3><p>${esc(sketch.demo)}</p></div>`);
    const decisions = sketch.decisions ?? [];
    if (decisions.length) parts.push(`<details class="card"><summary>边界状态结论（${decisions.length}）</summary><table class="dec">${decisions.map(d => `<tr><td>${esc(d.code)}</td><td>${esc(d.decision)}</td><td>${esc(d.text ?? '')}<small>${esc(d.from ?? '')}</small></td></tr>`).join('')}</table></details>`);
    return parts.join('');
  }

  function updateFullValues() {
    app.querySelectorAll('.full-value').forEach(d => {
      const prev=d.previousElementSibling;
      const value=prev?.querySelector('.single-value')??prev;
      d.hidden=!d.open && (!value || value.scrollWidth<=value.clientWidth+1&&(!value.classList.contains('multiline')||value.scrollHeight<=value.clientHeight+1));
    });
    app.querySelectorAll('.popconfirm-preview').forEach(t=>{const f=t.closest('.frame'),hits=[...f.querySelectorAll('[data-action-label]')].filter(n=>n.dataset.actionLabel===t.dataset.anchor);if(hits.length!==1)return;const a=hits[0].getBoundingClientRect(),r=f.getBoundingClientRect(),p=t.dataset.placement,arrow=t.dataset.arrow==='true',dx=!arrow||p.endsWith('center')||p==='n/a'?t.offsetWidth/2:p.endsWith('right')?30:t.offsetWidth-30;t.style.setProperty('--arrow-offset',dx+'px');t.style.left=a.x-r.x+a.width/2-dx+'px';t.style.top=(p.startsWith('top')?a.y-r.y-t.offsetHeight-4-(arrow?6:0):a.y-r.y+a.height+4+(arrow?6:0))+'px';});
    app.querySelectorAll('.tooltip-preview').forEach(t=>{const frame=t.closest('.frame'),buttons=[...frame.querySelectorAll('.btn')].filter(b=>b.dataset.actionLabel===t.dataset.anchor);if(buttons.length!==1)return;const a=buttons[0].getBoundingClientRect(),f=frame.getBoundingClientRect(),p=t.dataset.placement,side=p.split('-')[0],suffix=p.split('-')[1],vertical=['left','right'].includes(side),offset=suffix==='center'?(vertical?t.offsetHeight:t.offsetWidth)/2:['left','top'].includes(suffix)?(vertical?t.offsetHeight:t.offsetWidth)-13:13;t.style.setProperty('--arrow-offset',offset+'px');let x=a.x-f.x+a.width/2-(p==='n/a'?t.offsetWidth/2:offset),y=a.y-f.y+a.height+10;if(side==='top')y=a.y-f.y-t.offsetHeight-10;if(vertical){x=side==='left'?a.x-f.x-t.offsetWidth-10:a.x-f.x+a.width+10;y=a.y-f.y+a.height/2-offset;}if(p==='n/a')y-=6;if(p==='mouse'){x=a.x-f.x+a.width+8;y=a.y-f.y+a.height+4;}t.style.left=x+'px';t.style.top=y+'px';});

  }
  window.addEventListener('resize', updateFullValues);
  function draw() {
    const version = versions[ui.cur], sketch = version.data;
    if (!sketch.pages.some(p => p.id === ui.page)) ui.page = sketch.pages[0].id;
    if (ui.state && !(sketch.states ?? []).some(s=>s.id===ui.state && s.page===ui.page)) ui.state=null;
    const nav = sketch.pages.map(p => `<div class="pg"><button data-page="${esc(p.id)}" data-state="" class="${ui.page === p.id && !ui.state ? 'on' : ''}">${esc(p.title)}<small>${p.frame === 'drawer' ? '抽屉' : '页面'}</small></button>${(sketch.states ?? []).filter(s => s.page === p.id).map(s => `<button data-page="${esc(p.id)}" data-state="${esc(s.id)}" class="st${ui.page === p.id && ui.state === s.id ? ' on' : ''}">${esc(s.id)} ${esc(s.title)}${s.codes?.length ? `<small>${esc(s.codes.join(' '))}</small>` : ''}</button>`).join('')}</div>`).join('');
    let stage;
    if (ui.cmp !== null && ui.cmp !== ui.cur) {
      const old = versions[ui.cmp].data, d = diff(old, sketch);
      const right = new Map([...d.added.map(x => [x.key, 'add']), ...d.changed.map(x => [x.key, 'chg'])]);
      const left = new Map(d.removed.map(x => [x.key, 'del']));
      stage = `<div class="cmp"><div data-version="${ui.cmp}"><h4>${esc(versionName(versions[ui.cmp]))}</h4>${canvas(old, ui.page, ui.state, left)}</div><div data-version="${ui.cur}"><h4>${esc(versionName(version))}</h4>${canvas(sketch, ui.page, ui.state, right)}</div></div>`;
    } else stage = canvas(sketch, ui.page, ui.state, new Map());
    const options = sel => versions.map((v, i) => `<option value="${i}"${i === sel ? ' selected' : ''}>${esc(versionName(v))}</option>`).join('');
    app.innerHTML = `<header><h1>${esc(sketch.task ?? BUNDLE.title)} <small>草稿 · 可保存、讨论和继续修改；业务操作为静态示意</small></h1><label>版本 <select id="ver">${options(ui.cur)}</select></label><label>对比 <select id="cmp"><option value="">不对比</option>${options(ui.cmp)}</select></label><span class="key"><i class="badge b-荐">荐</i>推荐 <i class="badge b-判">判</i>设计判断 <i class="badge b-演">演</i>演示 <span class="kgap">缺口</span>${ui.cmp !== null ? '<span class="kadd">新增</span><span class="kchg">修改</span><span class="kdel">删除</span>' : ''}</span><button id="report-feedback" type="button">反馈当前页面</button></header><main><nav>${nav}</nav><div class="stage">${stage}</div><aside>${info(sketch, version)}</aside></main>`;
    updateFullValues();
  }

  app.addEventListener('change', e => {
    if (e.target.id === 'ver') ui.cur = Number(e.target.value);
    ui.sel = null; ui.selVersion = null;
    if (e.target.id === 'cmp') ui.cmp = e.target.value === '' ? null : Number(e.target.value);
    draw();
  });
  app.addEventListener('click', e => {
    if(e.target.closest('.full-value')) return;
    if(e.target.id==='report-feedback') { globalThis.openDraftFeedback?.({version:versions[ui.cur].v,page:ui.page,state:ui.state??'',pageTitle:versions[ui.cur].data.pages.find(p=>p.id===ui.page)?.title,stateTitle:versions[ui.cur].data.states?.find(s=>s.id===ui.state)?.title,draft:versions[ui.cur].data});return; }
    const nav = e.target.closest('[data-page]');
    if (nav) { ui.page = nav.dataset.page; ui.state = nav.dataset.state || null; ui.sel = null; ui.selVersion = null; return draw(); }
    if (e.target.id === 'copy') {
      const input = document.getElementById('copytext'), done = document.getElementById('copied');
      const fallback = () => { input.select(); done.textContent = document.execCommand('copy') ? '已复制' : '请按 Ctrl+C / ⌘C 复制'; };
      if (navigator.clipboard) navigator.clipboard.writeText(input.value).then(() => { done.textContent = '已复制'; }, fallback);
      else fallback();
      return;
    }
    const hit = e.target.closest('.stage [data-path]');
    if (hit) { const source = Number(hit.closest('[data-version]')?.dataset.version ?? ui.cur); ui.sel = hit.dataset.path === ui.sel && source === ui.selVersion ? null : hit.dataset.path; ui.selVersion = source; draw(); }
  });
  draw();
})();
