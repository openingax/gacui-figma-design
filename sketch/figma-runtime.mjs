/**
 * 序列化后交给 use_figma 执行，每次生成一个画板：工作台页面、抽屉页面或状态。
 * 只写入任务专用 Page；工作台页面复制工单页基线 180:3 后替换业务内容，不修改基线和母组件。
 * lib 由 sketch/figma.mjs 按需注入 buildTable、composeForm、fitFieldContent、updateDrawer。
 */
export async function sketchRuntime(figma, req, lib) {
  if (figma.fileKey !== req.fileKey) throw Error('仅允许授权目标文件');
  figma.skipInvisibleInstanceChildren = false;
  const walk = n => [n, ...('findAll' in n ? n.findAll(() => true) : [])];
  const warnings = [], unsupported = [...(req.board.unmetRequirements ?? [])];
  const board = req.board;

  if (req.protectedPages.includes(req.pageName)) throw Error('不能写入组件分类页或历史页面：' + req.pageName);
  const pages = figma.root.children.filter(p => p.name === req.pageName);
  if (pages.length > 1) throw Error('同名 Page 不止一个，请人工核实');
  let page = pages[0];
  if (!page) { page = figma.createPage(); page.name = req.pageName; }
  else for (const n of page.children) if (!/ · v\d+$/.test(n.name) && !n.name.startsWith('说明 / '))
    throw Error('Page 里有不是草图出稿生成的内容（' + n.name + '），不在这个 Page 上写入');
  await figma.setCurrentPageAsync(page);
  const existing = page.children.filter(n => n.name === board.name);
  if (existing.length) return {status: 'exists', pageId: page.id, boardId: existing[0].id, boardName: board.name, createdNodeIds: [], message: '同名画板已存在，未重复生成；请回读后决定是否原位修改'};

  // 字体：苹方优先，没有时用 Noto Sans SC 临时替代（与试用执行一致）。
  const available = (await figma.listAvailableFontsAsync()).map(x => x.fontName);
  const loaded = new Set(), fallback = new Set(), preservedFontRoots = new Set();
  async function loadFont(f) { const key = f.family + '/' + f.style; if (!loaded.has(key)) { await figma.loadFontAsync(f); loaded.add(key); } }
  async function pick(original) {
    const style = /Medium|Semibold|Bold/.test(original.style) ? 'Medium' : 'Regular';
    const chosen = available.find(f => f.family === 'PingFang SC' && f.style === style) || available.find(f => f.family === 'Noto Sans SC' && f.style === style);
    if (!chosen) throw Error('规范字体及临时字体均不可用');
    if (chosen.family !== 'PingFang SC') fallback.add(chosen.family);
    await loadFont(chosen);
    return chosen;
  }
  async function normalize(root) {
    for (const t of walk(root).filter(n => n.type === 'TEXT')) {
      // LAYOUT_FONT_START
      let ancestor=t, preserve=false;
      while(ancestor){if(preservedFontRoots.has(ancestor.id)){preserve=true;break;}ancestor=ancestor.parent;}
      if(preserve)continue;
      // LAYOUT_FONT_END
      const segments = t.characters.length ? t.getStyledTextSegments(['fontName']) : [];
      if (!segments.length) { t.fontName = await pick(t.fontName); continue; }
      for (const s of segments) t.setRangeFontName(s.start, s.end, await pick(s.fontName));
    }
  }
  async function load(n) { for (const t of walk(n).filter(x => x.type === 'TEXT')) for (const s of t.getStyledTextSegments(['fontName'])) await loadFont(s.fontName); }
  async function setText(t, value) { if (t?.type !== 'TEXT') throw Error('不是文字节点'); await load(t); t.characters = value; }
  const paints = await figma.getLocalPaintStylesAsync();
  const styleId = name => { const s = paints.filter(p => p.name === name); if (s.length !== 1) throw Error('样式缺失或重复 ' + name); return s[0].id; };
  const C = {body: 'Gray 中性/Gray9-强调\\正文', secondary: 'Gray 中性/Gray6-提示', error: 'Error 错误/Error5-Normal', white: 'Gray 中性/Gray0-白色背景'};
  const copy = x => JSON.parse(JSON.stringify(x));
  async function instance(id, parent, name) {
    const main = await figma.getNodeByIdAsync(id);
    if (main?.type !== 'COMPONENT') throw Error('主组件不存在 ' + id);
    const n = main.createInstance(); parent.appendChild(n); n.name = name; await normalize(n); return n;
  }
  async function buttonLabel(n, value) {
    const key = Object.keys(n.componentProperties).find(k => n.componentProperties[k].type === 'TEXT' && k.startsWith('label'));
    if (!key) throw Error('按钮文案属性缺失'); n.setProperties({[key]: value});
  }
  async function buttonDisabled(n, disabled) {
    const main = await n.getMainComponentAsync();
    const name = main.name.replace(/disabled 禁用=(true|false)/, 'disabled 禁用=' + !!disabled);
    if (main.name === name) return;
    const sibling = main.parent.children.find(c => c.type === 'COMPONENT' && c.name === name);
    if (!sibling) throw Error('找不到按钮状态变体 ' + name);
    const label = n.componentProperties[Object.keys(n.componentProperties).find(k => k.startsWith('label'))].value;
    n.swapComponent(sibling); await normalize(n); await buttonLabel(n, label);
  }
  async function text(parent, name, value, color = 'secondary', width) {
    const t = figma.createText(); parent.appendChild(t); t.name = name;
    t.fontName = await pick({family: 'PingFang SC', style: 'Regular'}); t.fontSize = 14; t.lineHeight = {unit: 'PIXELS', value: 22};
    t.characters = value; await t.setFillStyleIdAsync(styleId(C[color]));
    if (width) { t.resize(width, 22); t.textAutoResize = 'HEIGHT'; } else t.textAutoResize = 'WIDTH_AND_HEIGHT';
    return t;
  }
  function autoFrame(parent, name, dir, width) {
    const n = figma.createAutoLayout(dir); parent.appendChild(n); n.name = name; n.fills = []; n.clipsContent = false;
    n.resize(width, 1); n.primaryAxisSizingMode = 'AUTO'; n.counterAxisSizingMode = 'FIXED'; n.itemSpacing = 8;
    return n;
  }
  const visibleTexts = root => walk(root).filter(n => n.type === 'TEXT' && (() => { let p = n; while (p && p.id !== root.id) { if ('visible' in p && !p.visible) return false; p = p.parent; } return true; })());
  const unique = (scope, name) => { const found = walk(scope).filter(n => n.name === name); if (found.length !== 1) throw Error('图层不唯一或缺失：' + name); return found[0]; };

  function place(root) {
    const others = page.children.filter(n => n !== root);
    const row = others.filter(n => n.name.endsWith(' · v' + req.version) && !n.name.startsWith('说明 / '));
    root.x = 80 + board.slot * 1600;
    root.y = row.length ? row[0].y : others.length ? Math.max(...others.map(n => n.y + n.height)) + 300 : 80;
  }
  async function annotate(root, lines) {
    if (!lines.length) return null;
    const t = await text(page, '说明 / ' + root.name, lines.join('\n'), 'secondary', 1440);
    t.x = root.x; t.y = root.y + root.height + 16;
    return t;
  }

  // ---------- 字段内容 ----------
  function fieldControl(field) {
    const box = walk(field).find(n => 'children' in n && n.children.some(c => c.name === 'label'));
    return box?.children.find(c => c.name !== 'label');
  }
  async function setFieldValue(field, desc, value, filled) {
    if (desc.context === 'search') {
      if (desc.kind === 'input') { const t = unique(field, '请输入'); await setText(t, value); if (filled) await t.setFillStyleIdAsync(styleId(C.body)); }
      else if (desc.kind === 'select') { const t = visibleTexts(field)[0]; await setText(t, desc.label + '    ' + value); t.setRangeFills(0, desc.label.length, copy(paints.find(p => p.name === C.secondary).paints)); }
      else unsupported.push(desc.layer + '：查询区日期不支持填值');
      return;
    }
    throw Error('表单填值必须走类型化入口');
  }

  async function detach(n) { return n.type === 'INSTANCE' ? n.detachInstance() : n; }
  async function fieldError(field, desc, message) {
    if (desc.context === 'search') { unsupported.push(desc.layer + '：查询区字段不支持错误态'); return field; }
    field = await detach(field);
    if (desc.kind === 'upload') { const h = await instance('67:6', field, '错误提示'); await setText(visibleTexts(h)[0], message); return field; }
    const control = fieldControl(field);
    if (control && 'strokes' in control) {const border=desc.kind==='number'?control.children.find(n=>n.name==='input')??control:control;await border.setStrokeStyleIdAsync(styleId(C.error));}
    // 标签和控件可能直接挂在字段根节点下，也可能包在一层容器里；错误提示始终放在字段内、控件所在容器之后。
    const box = control.parent;
    const h = await instance('67:6', field, '错误提示');
    const anchor = box === field ? control : box;
    field.insertChild(field.children.indexOf(anchor) + 1, h);
    await setText(visibleTexts(h)[0], message);
    if ('layoutSizingHorizontal' in h) h.layoutSizingHorizontal = 'FILL';
    return field;
  }
  async function counter(field, desc, value) {
    field=await detach(field);
    let control=fieldControl(field); if(control.type==='INSTANCE') control=control.detachInstance();
    const t=await text(control, '字数', `${Array.from(value ?? '').length}/${desc.max}`);
    if (control.layoutMode && control.layoutMode !== 'NONE') t.layoutPositioning='ABSOLUTE';
    t.x=control.width-t.width-12;
    t.y=desc.kind === 'textarea' ? control.height-t.height-6 : (control.height-t.height)/2;
    return field;
  }
  async function uploadFiles(block, names, desc = {}) {
    for (const old of block.children.filter(n => n.name.startsWith('附件/'))) old.remove();
    for (const [i, name] of names.entries()) {
      if(desc.fileStates?.[name]==='fail') {
        await text(block,'失败文件名',name,'body');
        const item=await instance('222:85',block,'附件/'+i);
        await setText(item.findOne(n=>n.type==='TEXT'&&n.name==='tips'),desc.error || name+'上传失败');
        const retry=item.children.find(n=>n.type==='INSTANCE'); if(desc.disabled) retry.visible=false;
        if(!desc.disabled) {const remove=await instance('107:124',block,'移除/'+name);await buttonLabel(remove,'移除');remove.primaryAxisSizingMode='AUTO';}
        continue;
      }
      const item = await instance('222:76', block, '附件/' + i);
      const b = item.children.find(n => n.type === 'INSTANCE'); if (b) b.visible = false;
      await setText(unique(item, 'file').findOne(n => n.type === 'TEXT'), name);
    }
  }

  async function formValue(node, f) {
    node = await detach(node); node.name = f.layer;
    let control = fieldControl(node);
    const replace = async id => {
      const parent = control.parent, index = parent.children.indexOf(control), width = control.width;
      const n = await instance(id, parent, 'control'); parent.insertChild(index, n); control.remove(); control = n;
      if (['input','textarea','time','number','date','date-range','select'].includes(f.kind)) n.resize(f.kind==='number'?width:f.width, n.height);
      return n;
    };
    const choose = async (id, predicates) => {
      if (f.choice) return replace(f.choice);
      if (lib.formVariantQuery) { const q = lib.formVariantQuery(f); id = q.set; predicates = q.predicates; }
      const set = await figma.getNodeByIdAsync(id);
      const main = set.children.find(c => predicates.every(p => c.name.includes(p)));
      if (!main) throw Error(f.layer + '缺少现有变体');
      return replace(main.id);
    };
    const filled = f.value != null && f.value !== '' && (!Array.isArray(f.value) || f.value.length > 0);
    if (['date','date-range'].includes(f.kind)) {
      await choose();
      const ts = visibleTexts(control);
      if (filled) { await setText(ts[0], f.kind === 'date' ? String(f.value) : f.value[0]); if(f.kind==='date-range') await setText(ts[2], f.value[1]); }
    } else if (f.kind === 'switch') {
      await choose();
    } else if (f.kind === 'select') {
      await choose();
      if (f.multiple && filled) {
        control = control.detachInstance(); control.name = 'control';
        const tags = control.findOne(n => n.name === 'tag'), template = tags.children[0];
        for (const value of f.value) { const tag = template.clone(); tags.appendChild(tag); await setText(visibleTexts(tag)[0], value); }
        for (const old of [...tags.children].slice(0,3)) old.remove();
      } else await setText(visibleTexts(control)[0], filled ? String(f.value) : f.placeholder ?? '请选择');
    } else if (['radio','checkbox'].includes(f.kind)) {
      const templates = [...control.children];
      for (const raw of f.options ?? [f.label]) {
        const o = typeof raw === 'string' ? {label:raw} : raw, selected = f.kind === 'radio' ? f.value === o.label : (f.value ?? []).includes(o.label);
        const item = f.kind==='radio'&&(f.disabled||o.disabled)?await instance(selected?'436:28':'436:24',control,'选项/'+o.label):templates[selected ? 0 : 1].clone(); if(item.parent!==control)control.appendChild(item); item.name = '选项/' + o.label;
        await setText(visibleTexts(item)[0], o.label);
        if (f.kind === 'checkbox') {
          const old = item.children[0]; const ck = await instance(f.disabled || o.disabled ? (selected ? '31:17' : '31:15') : (selected ? '31:12' : '31:2'), item, 'selection'); item.insertChild(0,ck); old.remove();
        }
      }
      for (const old of templates) old.remove();
      control.name = f.kind === 'radio' ? 'Radio-Group 单选组' : 'Checkbox-Group 多选组';

    } else {
      if(f.disabled&&['textarea','time','number'].includes(f.kind)){await replace(f.kind==='textarea'?'436:2':f.kind==='time'?(filled?'436:39':'436:33'):(filled?'436:15':'436:5'));control.name=f.kind==='time'?'TimePicker-input 时间选择输入框':f.kind==='number'?'InputNumber数字输入框':'control';}
      if (f.kind === 'input' && f.disabled) await choose();
      if (f.kind === 'number') {
        const suffix = control.children.find(n => n.name === 'label'); if(suffix) suffix.visible = false;
      }
      const t = visibleTexts(control)[0];
      await setText(t, String(f.value ?? f.placeholder ?? (f.kind==='time'?'请选择时间':'请输入')));
      if(f.kind==='input')for(const extra of visibleTexts(control).slice(1))extra.visible=false;
      if (filled && !f.disabled) await t.setFillStyleIdAsync(styleId(C.body));
      if(f.kind==='textarea') {
        t.resize(Math.max(24,control.width-24),44); t.textAutoResize='HEIGHT'; t.layoutSizingVertical='HUG';
        control.paddingBottom=28; control.primaryAxisSizingMode='AUTO'; control.clipsContent=true;
        if(control.parent.layoutMode==='VERTICAL') control.parent.primaryAxisSizingMode='AUTO';
        if(node.layoutMode==='VERTICAL') node.primaryAxisSizingMode='AUTO';
      }

    }
    if (f.max && ['input','textarea'].includes(f.kind)) node = await counter(node, f, f.value);
    // 单行输入共用省略规则；计数只改变预留宽度。
    if(f.kind==='input'){let c=fieldControl(node);if(c.type==='INSTANCE')c=c.detachInstance();const t=visibleTexts(c)[0];t.textAlignHorizontal='LEFT';t.textAutoResize='TRUNCATE';t.resize(Math.max(24,c.width-(f.max?100:16)),22);t.maxLines=1;t.layoutSizingHorizontal='FIXED';}
    if (f.error) node = await fieldError(node, f, f.error);
    node.name = f.layer;
    return node;
  }

  // ---------- 工作台页面：复制工单页基线后替换业务内容 ----------
  async function buildWorkbench(def) {
    const source = await figma.getNodeByIdAsync('180:3');
    if (!source) throw Error('工单页基线 180:3 不存在');
    const root = source.clone(); page.appendChild(root); root.name = board.name; place(root);
    await normalize(root);
    const one = name => unique(root, name);

    const CONTENT_WIDTH=def.contentWidth??1192,OUTER_WIDTH=CONTENT_WIDTH+32;
    if(def.layout){const w=one('工作区');w.resize(CONTENT_WIDTH+64,w.height);for(const n of w.children)n.resize(OUTER_WIDTH,n.height);}
    const tabs = one('页签区');
    for (const c of [...tabs.children]) c.remove();
    async function fillTabs(parent,items,active,content=false) {
      for (const [i,item] of items.entries()) {
        const t=await instance(i===active?(content?'47:11':'47:57'):'47:2',parent,'页签/'+item);
        await setText(t.findOne(n=>n.type==='TEXT'),item);t.primaryAxisSizingMode='AUTO';
      }
    }
    const contentTabs=def.tabs.placement==='content';
    await fillTabs(tabs,contentTabs?[def.pageTitle]:def.tabs.items,contentTabs?0:def.tabs.active);
    const menu = one('运维菜单').findOne(n => n.name === 'content').children[0];
    await setText(menu.children[0].findOne(n => n.type === 'TEXT'), def.menuLeaf);

    const query = one('查询条件');
    let extra = 0;
    if (!def.search) { query.remove(); one('区块间距').remove(); }
    else {
      // SEARCH_BUILD_START
      const oldRows = [...query.children], kids = oldRows.flatMap(r => r.children);
      const tpl = {input: kids.find(n => n.name === '筛选/工单编号'), select: kids.find(n => n.name === '筛选/场站类型'), actions: kids.find(n => n.name === '查询操作')};
      if (!tpl.input || !tpl.select || !tpl.actions) throw Error('基线查询区结构变化，请先核实 180:3');
      const slots = [...def.search, {kind: 'actions'}];
      const rowCount = Math.ceil(slots.length / 3);
      for (let r = 0; r < rowCount; r++) {
        const row = oldRows[0].clone(); query.appendChild(row); row.name = '查询行/' + (r + 1);if(def.layout)row.resize(CONTENT_WIDTH,row.height);
        for (const c of [...row.children]) c.remove();
        for (const slot of slots.slice(r * 3, r * 3 + 3)) {
          let n;
          if (slot.kind === 'actions') { n = tpl.actions.clone(); for (const c of [...n.children].slice(2)) c.remove(); }
          // SEARCH_FIELDS_START
          else if (slot.kind === 'input') { n = tpl.input.clone(); await setText(unique(n, '输入框标题'), slot.label); await setText(unique(n, '请输入'), slot.value ?? slot.placeholder ?? '请输入'); }
          else if (slot.kind === 'select') { n = tpl.select.clone(); await setFieldValue(n, slot, slot.value ?? '全部'); }
          else if (slot.kind === 'date') {
            const set=await figma.getNodeByIdAsync('70:2'),filled=slot.value!=null&&slot.value!=='';
            const main=set.children.find(n=>n.type==='COMPONENT'&&n.name==='mode 类型=date 日期, state 状态=normal 默认, filled 填充='+filled+', disabled 禁用=false');
            if(!main)throw Error('单日期输入依赖缺失');
            n=await instance(main.id,row,slot.layer);n.resize((CONTENT_WIDTH-48)/3,32);
            await setText(visibleTexts(n)[0],slot.label+'    '+(filled?slot.value:(slot.placeholder??'请选择日期')));
          }
          else if (slot.kind === 'date-range') {
            n = (await figma.getNodeByIdAsync('69:42')).createInstance(); await normalize(n); n.resize(1144 / 3, 32);
            const texts = n.findAllWithCriteria({types: ['TEXT']}); await setText(texts[0], slot.label + '   开始时间'); await setText(texts[2], '结束时间');
          } else throw Error('查询区暂不支持字段类型 ' + slot.kind);
          // SEARCH_FIELDS_END
          if(def.layout&&slot.kind!=='actions')n.resize((CONTENT_WIDTH-48)/3,n.height);
          row.appendChild(n); n.name = slot.kind === 'actions' ? '查询操作' : slot.layer;
        }
      }
      for (const r of oldRows) r.remove();
      const height = 32 + rowCount * 32 + (rowCount - 1) * 16;
      extra = height - query.height; query.resize(query.width, height);
      // SEARCH_BUILD_END
    }

    const toolbar=one('列表工具栏'),mainActions=one('主要操作');
    one('列设置').remove();
    for (const c of [...mainActions.children]) c.remove();
    for(const b of def.buttons.filter(b=>b.visible!==false)){if(b.business){const n=await lib.renderBusinessButton(figma,mainActions,b.business,lib.buttonCatalog);n.name=b.layer;}else{const n=await instance(b.primary?'107:86':'107:124',mainActions,b.layer);await buttonLabel(n,b.label);await buttonDisabled(n,b.disabled);n.primaryAxisSizingMode='AUTO';}if(b.selectionSummary)await text(mainActions,b.layer+'/选择说明',b.selectionSummary);}
    if(!def.buttons.some(b=>b.visible!==false)){toolbar.remove();one('工具栏下间距').remove();}

    const list = one('工单结果');
    // TAG_HELPER_START
    const tagIds={default:'54:27',primary:'54:29',success:'54:31',warning:'54:33',danger:'54:35'};
    async function tag(parent, label, theme, spec) {
      if(spec?.mainId)return lib.renderTag(figma,parent,spec);
      if(!tagIds[theme]) throw Error('标签主题未配置：'+theme);
      const n=await instance(tagIds[theme],parent,'状态标签');
      const t=visibleTexts(n)[0];await setText(t,label);t.textAutoResize='WIDTH_AND_HEIGHT';n.primaryAxisSizingMode='AUTO';return n;
    }
    // TAG_HELPER_END
    for (const h of def.headings ?? []) {
      const block=autoFrame(list,h.layer,'VERTICAL',CONTENT_WIDTH);list.insertChild(0,block);
      await text(block,'标题',h.title,'body',CONTENT_WIDTH);
      if(h.subtitle) await text(block,'编号',h.subtitle);
      await tag(block,h.status.label,h.status.theme,h.status);
      block.paddingBottom=16;
    }
    for(const d of def.descriptions??[]){const node=await lib.renderDescriptions(figma,list,d,lib.descriptionData,{autoFrame,pick,width:CONTENT_WIDTH});list.insertChild(list.children.indexOf(one('工单列表')),node);}
    // CONTENT_TABS_START
    // TABS_EXTENDED_START
    if(def.tabs.mainId){const c=await lib.renderTabs(figma,list,def.tabs,CONTENT_WIDTH);list.insertChild(list.children.indexOf(one('工单列表')),c);}
    // TABS_EXTENDED_END
    else if (contentTabs) {
      // 规范整栏 normalTabs（top）：spacing 0、Gray0 底、仅底边 Gray3 1px INSIDE；见 evidence/spec-guides-20261020/tabs.md
      const content=autoFrame(list,'内容页签','HORIZONTAL',CONTENT_WIDTH);content.resize(CONTENT_WIDTH,48);
      Object.assign(content,{primaryAxisSizingMode:'FIXED',itemSpacing:0,strokeAlign:'INSIDE',strokeWeight:0,strokeBottomWeight:1});
      await content.setFillStyleIdAsync(styleId(C.white));await content.setStrokeStyleIdAsync(styleId('Gray 中性/Gray3-分割线'));
      list.insertChild(list.children.indexOf(one('工单列表')),content);
      await fillTabs(content,def.tabs.items,def.tabs.active,true);
    }
    // CONTENT_TABS_END
    for (const m of def.messages??[]) {
      const t=await text(list,m.layer,m.text,'secondary',CONTENT_WIDTH);
      list.insertChild(Math.max(0,list.children.indexOf(toolbar)+1),t);
    }
    if(!def.table){one('工单列表').remove();one('工单分页').remove();}
    else {
      // TABLE_BUILD_START
      const oldTable=one('工单列表'),index=list.children.indexOf(oldTable);
      oldTable.remove();
      const result=await lib.buildTable(figma,list,def.table.config,lib.tableDeps);
      const built=await figma.getNodeByIdAsync(result.componentId);list.insertChild(index,built);
      for(const mapping of def.tagThemes??[]) for(const [i,row] of built.children.filter(n=>n.name.startsWith('row/')).entries()) {
        const value=def.table.config.rows[i][mapping.key], theme=mapping.themes[value];
        let cell=row.children.find(n=>n.name==='cell/'+mapping.key);cell=cell.detachInstance();
        for(const child of [...cell.children]) child.remove();await tag(cell,value,theme,mapping.specs?.[value]);
      }
      const pagination=one('工单分页');
      pagination.name='分页';
      if(def.layout)pagination.resize(CONTENT_WIDTH,pagination.height);
      // PAGINATION_EXTENDED_START
      if(def.table.pagination?.mainId&&def.table.config.rows.length){const index=list.children.indexOf(pagination),n=await lib.renderPagination(figma,list,def.table.pagination,CONTENT_WIDTH);list.insertChild(index,n);pagination.remove();}
      // PAGINATION_EXTENDED_END
      else if(!def.table.pagination||!def.table.config.rows.length)pagination.visible=false;
      else {
        // PAGINATION_BUILD_START
        pagination.name = '分页';
        await setText(visibleTexts(pagination).find(t => /^共/.test(t.characters)), `共${def.table.config.rows.length} 条`);
        const pageButtons=unique(pagination,'page btn'),numbers=pageButtons.children.filter(n=>n.name.startsWith('页码/'));
        const keep=numbers.find(n=>n.name==='页码/2')??numbers[0];
        for(const b of numbers)if(b!==keep)b.remove();
        keep.name='页码/1';await setText(visibleTexts(keep)[0],'1');
        for(const n of pageButtons.children)if(n!==keep)n.visible=false;
        unique(pagination,'jumper').visible=false;
        // PAGINATION_BUILD_END
      }
      // TABLE_BUILD_END
    }
    // TABLE_EMPTY_START
    if (def.table && !def.table.config.rows.length) {
      if(def.table.feedback){await lib.renderFeedback(figma,list,{id:'table',kind:def.table.error?'error':'empty',variant:def.table.feedback.variant??'compact',message:def.table.error||def.table.emptyText||'暂无数据',action:def.table.error?(def.table.retryLabel||'重试'):def.table.feedback.action},{autoFrame,normalize,setText,instance,buttonLabel,width:CONTENT_WIDTH});}else{
      const message = autoFrame(list, def.table.error ? '加载失败' : '空结果', 'VERTICAL', CONTENT_WIDTH);
      message.resize(CONTENT_WIDTH, 220); message.primaryAxisSizingMode = 'FIXED';
      message.primaryAxisAlignItems = message.counterAxisAlignItems = 'CENTER';
      await text(message, def.table.error ? '失败文案' : '空结果文案', def.table.error || def.table.emptyText || '暂无数据');
      if (def.table.error) {
        const retry = await instance('107:124', message, '重试');
        await buttonLabel(retry, def.table.retryLabel || '重试'); retry.primaryAxisSizingMode = 'AUTO';
      } else unsupported.push('空状态没有规范组件，当前只用文字表达，视觉待 UI 确认');
      }
    }
    // TABLE_EMPTY_END
    // TABLE_LOADING_BUILD_START
    if(def.table?.loading){
      const table=one(def.table.config.name),index=list.children.indexOf(table),region=autoFrame(list,'表格区域/'+def.table.config.name,'VERTICAL',table.width);region.itemSpacing=0;list.insertChild(index,region);region.appendChild(table);
      for(const name of ['反馈/table','加载失败','空结果']){const n=list.children.find(n=>n.name===name);if(n)region.appendChild(n);}
      await lib.updateTableLoading(figma,region,def.table.loading);
    }
    // TABLE_LOADING_BUILD_END
    // ALERT_BUILD_START
    for(const s of def.alerts??[])await lib.renderAlert(figma,list,s,CONTENT_WIDTH);
    // ALERT_BUILD_END
    // STEPS_BUILD_START
    for(const s of def.steps??[])await lib.renderSteps(figma,list,s,CONTENT_WIDTH);
    // STEPS_BUILD_END
  // LOADING_BUILD_START
    for(const s of def.loadings??[])await lib.renderLoading(figma,list,s,CONTENT_WIDTH);
    // LOADING_BUILD_END
    // TIMEGROUP_BUILD_START
    for(const s of def.timeRangeGroups??[])await lib.renderTimeRangeGroup(figma,list,s,lib.timeGroupDeps);
    // TIMEGROUP_BUILD_END
    for(const s of def.feedbacks??[])await lib.renderFeedback(figma,list,s,{autoFrame,normalize,setText,instance,buttonLabel,width:CONTENT_WIDTH});

    // STATISTIC_BUILD_START
    for(const s of def.statistics??[]){const n=await lib.renderStatistic(figma,list,s,lib.statisticCatalog);if(n.width>CONTENT_WIDTH)throw Error('Statistic超过工作台正文宽度');}
    // STATISTIC_BUILD_END
    // PROGRESS_BUILD_START
    for(const s of def.progresses??[])await lib.renderProgress(figma,list,s,lib.progressCatalog);
    // PROGRESS_BUILD_END
    // LIST_BUILD_START
    for(const s of def.lists??[])await lib.renderList(figma,list,s,{normalize,renderLink:lib.renderLink,listDeps:lib.listDeps,width:CONTENT_WIDTH,renderPagination:lib.renderPagination,inspectPagination:lib.inspectPagination,verifyPagination:lib.verifyPagination});
    // LIST_BUILD_END
    // COLLAPSE_BUILD_START
    for(const s of def.collapses??[])await lib.renderCollapse(figma,list,s,{normalize,renderLink:lib.renderLink,collapseDeps:lib.collapseDeps,width:CONTENT_WIDTH});
    // COLLAPSE_BUILD_END
    for(const s of def.timelines??[])await lib.renderTimeline(figma,list,s,{autoFrame,text,normalize,setText,width:CONTENT_WIDTH,renderTimelineExtended:lib.renderTimelineExtended,timelineDeps:lib.timelineDeps});
    for(const s of def.imageViewers??[])await lib.renderImageViewer(figma,root,list,s,{autoFrame,text,instance,normalize,setText,buttonLabel,renderFeedback:lib.renderFeedback,imageViewerDeps:lib.imageViewerDeps,width:CONTENT_WIDTH});
    // TABS_LAYOUT_START
    if(def.tabs?.orientation==='left'){lib.arrangeLeftTabs(figma,list,CONTENT_WIDTH);list.primaryAxisSizingMode='AUTO';}
    // TABS_LAYOUT_END
    if(def.statistics?.length||def.progresses?.length||def.lists?.length||def.collapses?.length||def.timeRangeGroups?.length||def.alerts?.length||def.steps?.length||def.loadings?.length||def.headings?.length||def.dividers?.length||def.feedbacks?.length||def.table?.feedback||def.imageViewers?.length||def.timelines?.length){list.primaryAxisSizingMode='AUTO';const bottom=list.absoluteBoundingBox.y+list.height-root.absoluteBoundingBox.y+32,delta=Math.max(0,bottom-root.height);if(delta)for(const n of [root,one('页面主体'),one('运维菜单'),one('工作区')])n.resize(n.width,n.height+delta);}
    // DIVIDER_ORDER_START
    if(def.blocks?.length){
      const workspace=one('工作区'),ordered=autoFrame(workspace,'草稿内容顺序','VERTICAL',OUTER_WIDTH);
      ordered.itemSpacing=16;
      const optional=name=>walk(root).find(n=>n.name===name);
      for(const b of def.blocks.filter(b=>!b.navigation)){
        const box=autoFrame(ordered,'草稿区块/'+b.id,'VERTICAL',OUTER_WIDTH);
        box.paddingLeft=box.paddingRight=box.paddingTop=box.paddingBottom=16;
        await box.setFillStyleIdAsync(styleId(C.white));
        const move=name=>{const n=optional(name);if(n)box.appendChild(n);return n;};
        if(b.type==='divider'){
          const s=def.dividers.find(s=>s.id===b.id);
          await lib.renderDivider(figma,box,{...s,length:s.length??(s.orientation==='vertical'?40:CONTENT_WIDTH)});
        }
        // CASCADER_START
        else if(b.type==='cascader'){const n=await lib.renderCascader(figma,box,def.cascaders.find(s=>s.id===b.id),lib.cascaderDeps);if(n.width>CONTENT_WIDTH)throw Error('级联选择器超出正文宽度');}
        // CASCADER_END
        // TIMEPICKER_START
        else if(b.type==='timePicker'){const n=await lib.renderTimePicker(figma,box,def.timePickers.find(s=>s.id===b.id),lib.timePickerDeps);if(n.width>CONTENT_WIDTH)throw Error('时间选择器超出正文宽度');}
        // TIMEPICKER_END
        // SELECTFIELD_START
        else if(b.type==='selectField'){const n=await lib.renderSelect(figma,box,def.selectFields.find(s=>s.id===b.id),lib.selectDeps);if(n.width>CONTENT_WIDTH)throw Error('选择器超出正文宽度');}
        // SELECTFIELD_END
        // INPUTFIELD_START
        else if(b.type==='inputField'){const n=await lib.renderInputField(figma,box,def.inputFields.find(s=>s.id===b.id),lib.inputFieldDeps);if(n.width>CONTENT_WIDTH)throw Error('输入框超出正文宽度');}
        // INPUTFIELD_END
        // NUMBER_START
        else if(b.type==='number'){const n=await lib.renderInputNumber(figma,box,def.numbers.find(s=>s.id===b.id),lib.numberDeps);if(n.width>CONTENT_WIDTH)throw Error('数字输入超出正文宽度');}
        // NUMBER_END
        // CHECKBOX_START
        else if(b.type==='checkbox'){
          const n=await lib.renderCheckbox(figma,box,def.checkboxes.find(s=>s.id===b.id),lib.checkboxDeps);
          if(n.width>CONTENT_WIDTH)throw Error('多选组超出正文宽度：'+b.id);
        }
        // CHECKBOX_END
        else if(b.type==='radio'){
          const n=await lib.renderRadio(figma,box,def.radios.find(s=>s.id===b.id),lib.radioDeps);
          if(n.width>CONTENT_WIDTH)throw Error('单选组超出正文宽度：'+b.id);
        }else if(b.type==='link'){
          const n=await lib.renderLink(figma,box,def.links.find(s=>s.id===b.id));
          if(n.width>CONTENT_WIDTH)throw Error('链接超出正文宽度：'+b.id);
        }else if(b.type==='search'){
          const q=move('查询条件');q.resize(CONTENT_WIDTH,q.height);q.paddingLeft=q.paddingRight=0;
        }else if(b.type==='actions'){
          const row=autoFrame(box,'操作组/'+b.id,'HORIZONTAL',CONTENT_WIDTH);row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';
          for(const name of b.buttons)for(const key of [name,name+'/选择说明']){const n=optional(key);if(n)row.appendChild(n);}
          move('操作说明/'+b.id);
        }else if(b.type==='table'){
          for(const name of [def.table?.loading?'表格区域/'+b.layer:b.layer,'分页','反馈/table','加载失败','空结果'])move(name);
        }else{
          const prefix={statistic:'统计/',progress:'进度/',list:'列表/',collapse:'折叠面板/',timeRangeGroup:'时段组/',heading:'详情标题/',descriptions:'基本信息/',feedback:'反馈/',timeline:'日志时间线/',imageViewer:'图片查看/'};
          const n=move(b.type==='tabs'?'内容页签':prefix[b.type]+b.id);
          if(!n)throw Error('草稿区块未表达：'+b.id);
        }
      }
      list.remove();optional('区块间距')?.remove();
      const bottom=ordered.absoluteBoundingBox.y+ordered.height-root.absoluteBoundingBox.y+32;
      const delta=Math.max(0,bottom-root.height);
      if(delta)for(const n of [root,one('页面主体'),one('运维菜单'),workspace])n.resize(n.width,n.height+delta);
    }
    // DIVIDER_ORDER_END

    if (extra > 0) for (const n of [root, one('页面主体'), one('运维菜单'), one('工作区')]) n.resize(n.width, n.height + extra);
    for (const n of walk(root)) if ('strokes' in n) { if (n.strokeStyleId) await n.setStrokeStyleIdAsync(n.strokeStyleId); else n.strokes = copy(n.strokes); }
    // LAYOUT_SHELL_START
    if(def.layout){
      const workspace=one('工作区');
      const header=def.layout!=='side'?(await figma.getNodeByIdAsync('500:15989')).createInstance():null;
      const sidebar=def.layout!=='top'?(await figma.getNodeByIdAsync('500:16072')).createInstance():null;
      for(const n of [header,sidebar])if(n)preservedFontRoots.add(n.id);
      const result=lib.composeLayout(figma,page,{mode:def.layout,width:1440,height:Math.max(960,...workspace.children.filter(n=>n.visible).map(n=>n.y+n.height+(def.layout==='side'?0:64)+72)),name:board.name},{header,sidebar,content:workspace});
      for(const n of [...root.children].filter(n=>n.name.startsWith('图片大图/')))result.root.appendChild(n);result.root.x=root.x;result.root.y=root.y;root.remove();return result.root;
    }
    // LAYOUT_SHELL_END
    return root;
  }

  // ---------- 抽屉页面 ----------
  async function buildDrawer(def) {
    const root = figma.createFrame(); page.appendChild(root); root.name = board.name; root.fills = []; root.clipsContent = true;
    try {
    let height = 932;
    if (def.over) {
      const bg = page.children.find(n => n.name === def.over);
      if (!bg) throw Error('请先生成背景页面「' + def.over + '」');
      const c = bg.clone(); root.appendChild(c); c.name = '背景 / ' + bg.name.replace(/ · v\d+$/, ''); c.x = 0; c.y = 0; height = bg.height;
    }
    root.resize(1440, height); place(root);
    const main = await figma.getNodeByIdAsync(lib.drawer.variants[def.size]);
    await load(main);
    const inst = main.createInstance(); root.appendChild(inst);
    const result = await lib.updateDrawer(figma, inst, {size: def.size, footer: 'right', closeState: 'normal', viewportWidth: 1440, viewportHeight: height, title: def.title, confirm: def.confirm ?? '确定', cancel: def.cancel ?? '取消'}, lib.drawer);
    warnings.push(...result.warnings);
    const drawer = await figma.getNodeByIdAsync(result.nodeId); drawer.name = '抽屉 / ' + def.title; drawer.x = 0; drawer.y = 0;
    const panel = drawer.children.find(n => n.name === 'Drawer');
    if (panel.width !== def.width) { panel.resize(def.width, height); panel.x = 1440 - def.width; }
    const footer = panel.children.find(n => n.name === 'footer');
    for (const old of [...footer.children]) old.remove();
    footer.layoutMode='HORIZONTAL'; footer.primaryAxisSizingMode='FIXED'; footer.counterAxisSizingMode='FIXED'; footer.primaryAxisAlignItems='MAX'; footer.counterAxisAlignItems='CENTER'; footer.paddingLeft=footer.paddingRight=24; footer.paddingTop=footer.paddingBottom=12; footer.itemSpacing=8;
    footer.visible = def.buttons.length > 0;
    for(const b of def.buttons) {
      if(b.business){const n=await lib.renderBusinessButton(figma,footer,b.business,lib.buttonCatalog);n.name=b.layer;n.layoutPositioning='AUTO';continue;}
      const n = await instance(b.loading ? (b.primary ? '107:250':'107:254') : b.primary ? '107:86' : '107:124', footer, b.layer);
      n.layoutPositioning='AUTO';
      await buttonLabel(n,b.label); if (!b.loading) await buttonDisabled(n,b.disabled); else await n.setReactionsAsync([]); n.primaryAxisSizingMode='AUTO';
    }
    const content = panel.children.find(n => n.name === 'content');
    content.layoutMode = 'VERTICAL'; content.primaryAxisSizingMode = 'FIXED'; content.counterAxisSizingMode = 'FIXED';
    content.paddingLeft = content.paddingRight = content.paddingTop = content.paddingBottom = 24; content.itemSpacing = 0; content.clipsContent = true; content.overflowDirection = 'VERTICAL';
    if(def.buttons.some(b=>b.business))lib.fitButtonFooter(panel,footer,content);
    // 输入类控件铺满字段；开关、多选保留组件固有宽度，否则开关会被拉成整行。
    const STRETCH = ['input', 'textarea', 'select', 'date', 'date-range', 'time'];
    const body = autoFrame(content, '正文内容', 'VERTICAL', def.formWidth);
    const created = [];
    for (const [i, row] of def.rows.entries()) {
      for(const d of def.inserts??[])if(d.beforeRow===i){const n=await (d.type==='feedback'?lib.renderFeedback:d.type==='cascader'?lib.renderCascader:d.type==='timeRangeGroup'?lib.renderTimeRangeGroup:d.type==='timePicker'?lib.renderTimePicker:d.type==='selectField'?lib.renderSelect:d.type==='inputField'?lib.renderInputField:d.type==='number'?lib.renderInputNumber:d.type==='checkbox'?lib.renderCheckbox:d.type==='radio'?lib.renderRadio:d.type==='link'?lib.renderLink:lib.renderDivider)(figma,body,d,d.type==='feedback'?{autoFrame,normalize,setText,instance,buttonLabel,width:def.formWidth}:d.type==='cascader'?lib.cascaderDeps:d.type==='timeRangeGroup'?lib.timeGroupDeps:d.type==='timePicker'?lib.timePickerDeps:d.type==='selectField'?lib.selectDeps:d.type==='inputField'?lib.inputFieldDeps:d.type==='number'?lib.numberDeps:d.type==='checkbox'?lib.checkboxDeps:lib.radioDeps);if(n.width>def.formWidth)throw Error('正文插入组件超出抽屉宽度');}
      for (const g of def.groups ?? []) if (g.beforeRow === i) {
        const title = await text(body, g.layer, g.title, 'body', def.formWidth);
        title.fontName = await pick({family:'PingFang SC',style:'Medium'});
        title.layoutSizingVertical = 'HUG';
      }
      // DRAWER_UPLOAD_START
      if (row[0].kind === 'upload') {
        const f = row[0], block = autoFrame(body, f.layer, 'VERTICAL', f.width);
        const label = await text(block, 'label', (f.required ? '* ' : '') + f.label, 'body');
        if (f.required) label.setRangeFills(0, 1, copy(paints.find(p => p.name === C.error).paints));
        const entry = await instance(f.disabled ? '222:25':'222:19', block, '上传入口');
        const tips = entry.findOne(n => n.type === 'TEXT' && n.name === 'tips');
        if (f.help) await setText(tips, f.help); else tips.visible = false;
        if (f.value?.length) {
          await uploadFiles(block, Array.isArray(f.value) ? f.value : [f.value], f);
          if(f.disabled) {for(const item of block.children.filter(n=>n.name.startsWith('附件/'))) {const file=item.children.find(n=>n.name==='file'); for(const c of file?.children??[]) if(!visibleTexts(c).length) c.visible=false;}}
        }
        if (f.error && !Object.values(f.fileStates??{}).includes('fail')) {
          const failure=await instance('222:85',block,'上传失败');
          await setText(failure.findOne(n=>n.type==='TEXT'&&n.name==='tips'),f.error);
          const retry=failure.children.find(n=>n.type==='INSTANCE');await buttonLabel(retry,'重新上传');
          unsupported.push(f.layer+'：逐文件状态未指定，失败信息已表达但无法确定失败行，原需求未完成');
        }
        block.paddingBottom = 24;
        continue;
      }
      // DRAWER_UPLOAD_END
      const spec = {name: '表单行/' + (i + 1), layout: row.length > 1 ? 'HORIZONTAL' : 'VERTICAL', width: def.formWidth, fieldGap: 24,
        fields: row.map(f => ({componentId: f.variant, width: f.width, name: f.layer, content: {label: f.label, width: f.width, ...(STRETCH.includes(f.kind) ? {controlWidth: f.width} : {}), ...(f.help ? {help: f.help} : {})}}))};
      const r = await lib.composeForm(figma, body, spec, created);
      for (const [j, id] of r.fields.entries()) {
        const f = row[j];
        let node = await figma.getNodeByIdAsync(id); node.name = f.layer;
        node = await formValue(node, f);
      }
    }
    for(const d of def.inserts??[])if(d.beforeRow===def.rows.length){const n=await (d.type==='feedback'?lib.renderFeedback:d.type==='cascader'?lib.renderCascader:d.type==='timeRangeGroup'?lib.renderTimeRangeGroup:d.type==='timePicker'?lib.renderTimePicker:d.type==='selectField'?lib.renderSelect:d.type==='inputField'?lib.renderInputField:d.type==='number'?lib.renderInputNumber:d.type==='checkbox'?lib.renderCheckbox:d.type==='radio'?lib.renderRadio:d.type==='link'?lib.renderLink:lib.renderDivider)(figma,body,d,d.type==='feedback'?{autoFrame,normalize,setText,instance,buttonLabel,width:def.formWidth}:d.type==='cascader'?lib.cascaderDeps:d.type==='timeRangeGroup'?lib.timeGroupDeps:d.type==='timePicker'?lib.timePickerDeps:d.type==='selectField'?lib.selectDeps:d.type==='inputField'?lib.inputFieldDeps:d.type==='number'?lib.numberDeps:d.type==='checkbox'?lib.checkboxDeps:lib.radioDeps);if(n.width>def.formWidth)throw Error('正文插入组件超出抽屉宽度');}
    // DRAWER_POPUP_START
    for(const f of def.rows.flat().filter(f=>f.open)){
      let control=fieldControl(root.findOne(n=>n.name===f.layer));if(control.type==='INSTANCE')control=control.detachInstance();
      control.strokes=copy(lib.focusRules.strokes);control.effects=copy(lib.focusRules.effects);const arrow=control.children.find(n=>/chevron|箭头/i.test(n.name));if(arrow){const up=(await figma.getNodeByIdAsync('85:85')).clone();const index=control.children.indexOf(arrow);control.insertChild(index,up);arrow.remove();}
      const popup=await lib.renderMultiPopup(figma,root,{id:f.layer,width:f.width,options:f.options.map(o=>typeof o==='string'?{label:o,selected:(f.value??[]).includes(o)}:{...o,selected:(f.value??[]).includes(o.label)})},lib.multiRules,{autoFrame,instance,setText});popup.x=control.absoluteBoundingBox.x-root.absoluteBoundingBox.x;popup.y=control.absoluteBoundingBox.y-root.absoluteBoundingBox.y+control.height+4;
    }
    // DRAWER_POPUP_END
    for (const n of walk(root)) if ('strokes' in n) { if (n.strokeStyleId) await n.setStrokeStyleIdAsync(n.strokeStyleId); else n.strokes = copy(n.strokes); }
    return root;
    } catch(error) { if(!root.removed)root.remove();throw error; }
  }

  // ---------- 状态：复制默认画板后按 patch 修改 ----------
  async function buildState(st) {
    if (st.workbench) return await buildWorkbench(st.workbench);
    if (st.drawer) return await buildDrawer(st.drawer);
    throw Error('状态缺少完整页面定义');
  }

  // TIMEGROUP_FONT_START
  if(lib.timeGroupDeps)lib.timeGroupDeps.title.fontName=await pick(lib.timeGroupDeps.title.fontName);
  // TIMEGROUP_FONT_END
  let root;
  if (board.kind === 'workbench') root = await buildWorkbench(board.def);
  else if (board.kind === 'drawer') root = await buildDrawer(board.def);
  else root = await buildState(board.def);
  const dialogs=[];
  for(const s of board.dialogs??[])dialogs.push(await (s.children?.length?lib.renderComposedDialog:lib.renderDialog)(figma,root,s,{normalize,setText,buttonLabel,deps:lib.dialogDeps,...(s.children?.length?{autoFrame,pick,...lib}:{})}));
  // MESSAGE_BUILD_START
  const messageReceipts=[];for(const s of board.notices??[]){const n=await lib.renderMessage(figma,root,s);messageReceipts.push(await lib.inspectMessage(n));}
  // MESSAGE_BUILD_END
  // NOTIFICATION_BUILD_START
  const notificationReceipts=[];for(const s of board.notifications??[]){const n=await lib.renderNotification(figma,root,s);notificationReceipts.push(await lib.inspectNotification(n));}
  // NOTIFICATION_BUILD_END
  // POPCONFIRM_BUILD_START
  const popconfirmReceipts=[];for(const s of board.popconfirms??[]){const n=await lib.renderPopconfirm(figma,root,s);popconfirmReceipts.push(await lib.inspectPopconfirm(n));}
  // POPCONFIRM_BUILD_END
  // BADGE_BUILD_START
  const badgeReceipts=[];for(const s of board.badges??[]){const n=await lib.renderBadge(figma,root,s);badgeReceipts.push(await lib.inspectBadge(n,s,root.findOne(a=>a.name===s.anchorLayer)));}
  // BADGE_BUILD_END
  // TOOLTIP_BUILD_START
  const tooltipReceipts=[];for(const s of board.tooltips??[]){const n=await lib.renderTooltip(figma,root,s);tooltipReceipts.push(await lib.inspectTooltip(n));}
  // TOOLTIP_BUILD_END
  await normalize(root);
  const note = await annotate(root, [...board.notes, ...unsupported.map(u => '未表达：' + u), ...warnings.map(w => '提醒：' + w), ...(fallback.size ? ['字体：使用 ' + [...fallback].join('、') + ' 临时替代苹方，最终需替换并复核'] : [])]);
  const texts = [...new Set(visibleTexts(root).map(t => t.characters.trim()).filter(Boolean))];
  const instances = walk(root).filter(n => n.type === 'INSTANCE');
  const broken = []; for (const n of instances) if (!(await n.getMainComponentAsync())) broken.push(n.id);
  const missingTexts = board.expectTexts.filter(t => !texts.some(x => x.includes(t)));
  const def = board.def.workbench ?? (board.kind === 'workbench' ? board.def : null);
  let snapshot = null;
  // WORKBENCH_SNAPSHOT_START
  if (def) {
    const props = n => n?.type==='INSTANCE' ? {checked: n.componentProperties['checked 已选']?.value === 'true', mixed: n.componentProperties['indeterminate 半选']?.value === 'true', disabled: (n.componentProperties['disabled 禁用']??n.componentProperties['disable 禁用'])?.value === 'true'} : null;
    const table = walk(root).find(n => n.name.startsWith('表格/'));
    const rowData = row => ({selection: props(row.children.find(n => n.name === 'selection')?.children[0]), fits: Object.fromEntries(row.children.filter(n=>n.name.startsWith('cell/')).map(n=>[n.name.slice(5),visibleTexts(n).every(t=>t.textTruncation==='DISABLED'&&t.height<=n.height&&t.width<=n.width)])), cells: Object.fromEntries(row.children.filter(n => n.name.startsWith('cell/')).map(n => [n.name.slice(5), visibleTexts(n).map(t => t.characters)]))});
    snapshot = {
      contentTabsHeight: walk(root).find(n=>n.name==='内容页签')?.height ?? null,
      headings: walk(root).filter(n=>n.name.startsWith('详情标题/')).map(n=>({name:n.name,texts:visibleTexts(n).map(t=>t.characters)})),
      tags: await Promise.all(walk(root).filter(n=>n.type==='INSTANCE'&&n.name==='状态标签').map(async n=>({parent:n.parent.name,text:visibleTexts(n)[0]?.characters,mainId:(await n.getMainComponentAsync()).id,theme:(await n.getMainComponentAsync()).name.match(/theme 主题=(\w+)/)?.[1]}))),
      tabs: await Promise.all((def.tabs.placement === 'content' ? unique(root, '内容页签') : unique(root, '页签区')).children.filter(n=>n.type==='INSTANCE').map(async n=>({text:visibleTexts(n)[0]?.characters, selected:(await n.getMainComponentAsync()).name.includes('state 状态=select 选中')}))),
      buttons: await Promise.all(walk(root).filter(n => ['INSTANCE','FRAME'].includes(n.type) && n.name.startsWith('按钮/') && n.visible && def.buttons.some(b=>b.layer===n.name)).map(async n => {const b=def.buttons.find(b=>b.layer===n.name);if(b.business){const actual=await lib.inspectBusinessButton(n);return {name:n.name,business:actual,businessErrors:lib.verifyBusinessButton(b.business,actual)};}return {name:n.name,disabled:n.componentProperties['disabled 禁用']?.value==='true'};})),
      table: table ? {headerSelection: props(table.children.find(n => n.name === 'header')?.children.find(n => n.name === 'selection')?.children[0]), rows: table.children.filter(n => n.name.startsWith('row/')).map(rowData)} : null,
      texts, retry: walk(root).some(n => (n.name === '重试'||n.name==='反馈操作') && n.visible), paginationVisible: walk(root).some(n => n.name === '分页' && n.visible),
    };
  }
  // WORKBENCH_SNAPSHOT_END
  const form = board.def.drawer ?? (board.kind === 'drawer' ? board.def : null);
  if(form) {
    snapshot = {groups:visibleTexts(root).filter(n=>n.name.startsWith('分组/')).map(n=>({name:n.name,text:n.characters})), fields:[], buttons:[], texts, fieldNames:walk(root).filter(n=>n.name.startsWith('字段/')).map(n=>n.name)};
    for(const f of form.rows.flat()) {
      const matches = walk(root).filter(n=>n.name===f.layer), node = matches[0];
      const control = node && fieldControl(node);
      const props = control?.type==='INSTANCE' ? control.componentProperties : {};
      let readonlyVisual=null;
      if(f.disabled&&['textarea','time','number','radio'].includes(f.kind)){
        if(f.kind==='radio')readonlyVisual=control.children.every(n=>n.type==='INSTANCE'&&n.componentProperties['disable 禁用']?.value==='true');
        else {const ref=await figma.getNodeByIdAsync(f.kind==='textarea'?'436:2':f.kind==='time'?(f.value?'436:39':'436:33'):(f.value!=null?'436:15':'436:5'));readonlyVisual=JSON.stringify(control.fills)===JSON.stringify(ref.fills)&&JSON.stringify(visibleTexts(control)[0].fills)===JSON.stringify(visibleTexts(ref)[0].fills);}
      }
      snapshot.fields.push({name:f.layer,readonlyVisual,count:matches.length,texts:node?visibleTexts(node).map(t=>t.characters):[], controlName:control?.name,
        checked:props['checked 开关']?.value, mode:props['mode 类型']?.value,
        uploads:f.kind==='upload'?await Promise.all(node.children.filter(n=>n.name.startsWith('附件/')).map(async n=>({name:n.name,variant:(await n.getMainComponentAsync())?.name,retry:visibleTexts(n).some(t=>t.characters==='重新上传')}))):[],
        selected:control && ['radio','checkbox'].includes(f.kind) ? control.children.filter(item=>{
          if(f.kind==='checkbox') return item.children.find(n=>n.name==='selection')?.componentProperties['checked 已选']?.value==='true';
          if(item.type==='INSTANCE'&&item.componentProperties['checked 已选'])return item.componentProperties['checked 已选'].value==='true';const dot=item.findOne(n=>n.name==='Ellipse 7');return dot?.fills?.some(p=>p.type==='SOLID' && p.color.b>p.color.r+0.3);
        }).map(n=>visibleTexts(n)[0]?.characters) : null});
    }
    if(form.rows.flat().some(f=>f.open))snapshot.multiPopups=walk(root).filter(n=>n.name.startsWith('多选展开/')).map(p=>({name:p.name.slice(5),options:p.children.map(r=>{const ck=r.findOne(n=>n.name==='selection'),t=r.findOne(n=>n.type==='TEXT');return {label:t.characters,selected:ck.componentProperties['checked 已选'].value==='true',disabled:ck.componentProperties['disabled 禁用'].value==='true',disabledLabel:t.fills.some(p=>p.type==='SOLID'&&Math.abs(p.color.r-0.592156887)<0.0001),fits:t.width>0&&t.height<=r.height};})}));
    if(!def)snapshot.buttons = await Promise.all(walk(root).filter(n=>['INSTANCE','FRAME'].includes(n.type)&&n.name.startsWith('按钮/')&&form.buttons.some(b=>b.layer===n.name)).map(async n=>{const b=form.buttons.find(b=>b.layer===n.name);if(b.business)return {name:n.name,business:await lib.inspectBusinessButton(n)};return {name:n.name,disabled:n.componentProperties['disabled 禁用']?.value==='true',loading:n.componentProperties['loading 加载']?.value==='true'};}));
  }
  if(def?.timelines?.length)snapshot.timelines=walk(root).filter(n=>n.name.startsWith('日志时间线/')).map(b=>({id:b.name.slice(6),items:b.children.filter(n=>n.name.startsWith('日志项/')).map(n=>({id:n.name.slice(4),title:n.findOne(t=>t.name==='title')?.characters,time:n.findOne(t=>t.name==='date')?.characters,detail:n.findOne(t=>t.name==='日志说明')?.characters,line:!!n.findOne(t=>(t.name==='divider'||t.name==='连接线后')&&t.visible),fits:n.absoluteBoundingBox.y+n.height<=root.absoluteBoundingBox.y+root.height}))}));
  if(def?.statistics?.length)snapshot.statistics=await Promise.all(def.statistics.map(s=>{const n=walk(root).find(n=>n.name==='统计/'+s.id);return n?lib.inspectStatistic(n):null;}));
  if(def?.progresses?.length)snapshot.progresses=def.progresses.map(s=>{const n=walk(root).find(n=>n.name==='进度/'+s.id);return n?lib.inspectProgress(n,s):null;});
  if(def?.lists?.length)snapshot.lists=walk(root).filter(n=>n.name.startsWith('列表/')).map(n=>lib.inspectList(n));
  if(def?.collapses?.length)snapshot.collapses=await Promise.all(walk(root).filter(n=>n.name.startsWith('折叠面板/')).map(n=>lib.inspectCollapse(n)));
  if(def?.imageViewers?.length)snapshot.imageViewers=def.imageViewers.map(s=>{const b=root.findOne(n=>n.name==='图片查看/'+s.id);return {id:s.id,open:root.findOne(n=>n.name==='图片大图/'+s.id)?s.open:null,items:b?b.findAll(n=>n.name.startsWith('图片项/')).map(n=>({id:n.name.slice(4),filename:n.findOne(t=>t.name==='文件名')?.characters,error:!!n.findOne(t=>t.type==='TEXT'&&t.characters==='图片加载失败'),fits:n.absoluteBoundingBox.y+n.height<=root.absoluteBoundingBox.y+root.height})):[]};});
  if(def?.descriptions) snapshot.descriptions=walk(root).filter(n=>n.name.startsWith('基本信息/')).map(n=>({id:n.name.slice(5),title:n.findOne(t=>t.type==='TEXT'&&t.name==='标题')?.characters,items:n.findAll(x=>x.name.startsWith('信息项/')).map(x=>{const a=x.findOne(t=>t.type==='TEXT'&&t.name==='label'),v=x.findOne(t=>t.type==='TEXT'&&t.name==='value');return {id:x.name.slice(4),label:a?.characters,value:v?.characters,fits:!!v&&v.width<=x.width&&v.height<=x.height};})}));
  // TABS_VERIFY_START
  if(def?.tabs?.mainId){snapshot.tabsBar=await lib.inspectTabs(root.findOne(n=>n.name==='内容页签'));snapshot.tabs=snapshot.tabsBar.items;}
  // TABS_VERIFY_END
  const hasFeedback=form?.feedbacks?.length||def?.table?.feedback||def?.feedbacks?.length||def?.imageViewers?.some(s=>s.emptyFeedback);
  const feedbackSpecs=def?.table?.feedback&&!def.table.config.rows.length?[{id:'table',kind:def.table.error?'error':'empty',variant:def.table.feedback.variant??'compact',message:def.table.error||def.table.emptyText||'暂无数据',action:def.table.error?(def.table.retryLabel||'重试'):def.table.feedback.action}]:[];
  feedbackSpecs.push(...(form?.feedbacks??[]),...(def?.feedbacks??[]),...(def?.imageViewers??[]).filter(s=>s.emptyFeedback&&!s.items.length).map(s=>({id:s.id+'-empty',kind:'empty',message:'暂无附件',variant:s.emptyFeedback.variant??'compact'})));
  if(hasFeedback)snapshot.feedback=await Promise.all(walk(form?root.children.find(n=>n.name.startsWith('抽屉 / ')):root).filter(n=>n.name.startsWith('反馈/')).map(async b=>{const v=b.children.find(n=>n.name==='反馈视觉'),m=await v.getMainComponentAsync(),t=v.findOne(n=>n.type==='TEXT'),a=b.children.find(n=>n.name==='反馈操作');return {id:b.name.slice(3),message:t.characters,action:a?a.findOne(n=>n.type==='TEXT').characters:null,mainId:m.id,mainKey:m.key,closeVisible:!!v.findOne(n=>n.name==='item/closeBtn'&&n.visible),fits:t.height<=v.height&&b.absoluteBoundingBox.y+b.height<=root.absoluteBoundingBox.y+root.height};}));
  const semanticErrors = def ? verifyWorkbench(def, snapshot) : form ? verifyForm(form,snapshot) : ['缺少页面语义校验'];
  // PAGINATION_VERIFY_START
  if(def?.table?.pagination?.mainId&&def.table.config.rows.length){snapshot.pagination=await lib.inspectPagination(root.findOne(n=>n.name==='分页'));semanticErrors.push(...lib.verifyPagination(def.table.pagination,snapshot.pagination));}
  // PAGINATION_VERIFY_END
  if(hasFeedback)semanticErrors.push(...lib.verifyFeedback(feedbackSpecs,snapshot.feedback));
  if(form?.rows.flat().some(f=>f.open))semanticErrors.push(...lib.verifyMultiPopup(form.rows.flat().filter(f=>f.open),snapshot.multiPopups));
  if((def??form)?.numbers?.length)for(const s of (def??form).numbers){const n=root.findOne(x=>x.name==='数字输入/'+s.id);if(!n||n.findOne(t=>t.type==='TEXT')?.characters!==(s.value==null?(s.placeholder??'请输入'):String(s.value)))semanticErrors.push('数字输入缺失或值不符');}
  if((def??form)?.checkboxes?.length)for(const s of (def??form).checkboxes){const n=root.findOne(x=>x.name==='多选/'+s.id);if(!n||n.children.length!==s.options.length||s.options.some(o=>!n.findOne(t=>t.type==='TEXT'&&t.characters===o.label)))semanticErrors.push('多选组缺失或文字不符');}
  if((def??form)?.radios?.length)for(const s of (def??form).radios){const n=root.findOne(x=>x.name==='单选/'+s.id);if(!n||n.children.length!==s.options.length||s.options.some(o=>!n.findOne(t=>t.type==='TEXT'&&t.characters===o.label)))semanticErrors.push('单选组缺失或文字不符');}
  if((def??form)?.links?.length)for(const s of (def??form).links){const n=root.findOne(x=>x.name==='链接/'+s.id),t=n?.findOne(x=>x.type==='TEXT');if(!n||t?.characters!==(s.text??'跳转链接'))semanticErrors.push('链接缺失或文字不符');}
  if((def??form)?.dividers?.length)for(const s of (def??form).dividers){const n=root.findOne(x=>x.name==='分割线/'+s.id),t=n?.findOne(x=>x.type==='TEXT');if(!n||(s.text!==undefined&&t?.characters!==s.text))semanticErrors.push('分割线缺失或文字不符');}
  if(def?.statistics?.length)semanticErrors.push(...lib.verifyStatistics(def.statistics,snapshot.statistics,lib.statisticCatalog));
  if(def?.progresses?.length)semanticErrors.push(...lib.verifyProgresses(def.progresses,snapshot.progresses));
  if(def?.lists?.length)semanticErrors.push(...lib.verifyLists(def.lists,snapshot.lists));
  if(def?.collapses?.length)semanticErrors.push(...lib.verifyCollapses(def.collapses,snapshot.collapses));
  if(def?.timelines?.length)semanticErrors.push(...lib.verifyTimelines(def.timelines,snapshot.timelines));
  if(def?.imageViewers?.length)semanticErrors.push(...lib.verifyImageViewers(def.imageViewers,snapshot.imageViewers));
  if(def?.descriptions?.length)semanticErrors.push(...lib.verifyDescriptions(def.descriptions,snapshot.descriptions));
  if(board.dialogs?.length)semanticErrors.push(...lib.verifyDialogs(board.dialogs,dialogs,lib.dialogDeps));
  for(const d of dialogs)if(d.composition)semanticErrors.push(...d.composition.errors);
  // TIMEGROUP_VERIFY_START
  snapshot.timeRangeGroups=[];for(const s of (def??form)?.timeRangeGroups??[]){const a=await lib.inspectTimeRangeGroup(figma,root.findOne(x=>x.name==='时段组/'+s.id),s);snapshot.timeRangeGroups.push(a);semanticErrors.push(...a.errors);}
  // TIMEGROUP_VERIFY_END
  // TABLE_LOADING_VERIFY_START
  if(def?.table?.loading){snapshot.tableLoading=await lib.inspectTableLoading(figma,root.findOne(n=>n.name==='表格区域/'+def.table.config.name),def.table.loading);semanticErrors.push(...snapshot.tableLoading.errors);}
  // TABLE_LOADING_VERIFY_END
  // MESSAGE_VERIFY_START
  for(const [i,s]of (board.notices??[]).entries())semanticErrors.push(...lib.verifyMessage(s,messageReceipts[i]));
  // MESSAGE_VERIFY_END
  // IMAGE_VIEWER_EXT_VERIFY_START
  snapshot.imageViewerExtended=[];for(const s of def.imageViewers.filter(s=>s.extended)){const a=await lib.inspectImageViewerExtended(root,s);snapshot.imageViewerExtended.push(a);semanticErrors.push(...lib.verifyImageViewerExtended(s,a,lib.imageViewerDeps));}
  // IMAGE_VIEWER_EXT_VERIFY_END
  // TABLE_EXT_VERIFY_START
  snapshot.tableExtension=lib.inspectTableExtensions(root.findOne(n=>n.name===def.table.config.name),def.table.config);semanticErrors.push(...lib.verifyTableExtensions(def.table.config,snapshot.tableExtension));
  // TABLE_EXT_VERIFY_END
  // ALERT_VERIFY_START
  if(def?.alerts?.length){snapshot.alerts=await Promise.all(walk(root).filter(n=>n.name.startsWith('警告提示/')).map(n=>lib.inspectAlert(n)));semanticErrors.push(...lib.verifyAlerts(def.alerts,snapshot.alerts));}
  // ALERT_VERIFY_END
  // STEPS_VERIFY_START
  if(def?.steps?.length){snapshot.steps=walk(root).filter(n=>n.name.startsWith('步骤条/')).map(n=>lib.inspectSteps(n));semanticErrors.push(...lib.verifySteps(def.steps,snapshot.steps));}
  // STEPS_VERIFY_END
  // LOADING_VERIFY_START
  if(def?.loadings?.length){snapshot.loadings=await Promise.all(walk(root).filter(n=>n.name.startsWith('区域加载/')).map(n=>lib.inspectLoading(n)));semanticErrors.push(...lib.verifyLoading(def.loadings,snapshot.loadings));}
  // LOADING_VERIFY_END
  // NOTIFICATION_VERIFY_START
  for(const [i,s]of (board.notifications??[]).entries())semanticErrors.push(...lib.verifyNotification(s,notificationReceipts[i]));
  // NOTIFICATION_VERIFY_END
  // POPCONFIRM_VERIFY_START
  for(const [i,s]of (board.popconfirms??[]).entries())semanticErrors.push(...lib.verifyPopconfirm(s,popconfirmReceipts[i]));
  // POPCONFIRM_VERIFY_END
  // BADGE_VERIFY_START
  for(const [i,s]of (board.badges??[]).entries())semanticErrors.push(...lib.verifyBadge(s,badgeReceipts[i]));
  // BADGE_VERIFY_END
  // TOOLTIP_VERIFY_START
  for(const [i,s]of (board.tooltips??[]).entries())semanticErrors.push(...lib.verifyTooltip(s,tooltipReceipts[i]));
  // TOOLTIP_VERIFY_END
  const result = generationResult({missingTexts, brokenInstances: broken, unsupported, semanticErrors});
  return {...result, createdNodeIds: [...walk(root).map(n=>n.id), ...(note?[note.id]:[])], snapshot, dialogs, pageId: page.id, boardId: root.id, boardName: root.name, noteId: note?.id ?? null, size: [root.width, root.height],
    badges:badgeReceipts,notifications:notificationReceipts,popconfirms:popconfirmReceipts,tooltips:tooltipReceipts,notices:messageReceipts,missingTexts, semanticErrors, brokenInstances: broken, unsupported, warnings,
    fontFallback: [...fallback], createdCount: walk(root).length};
}
