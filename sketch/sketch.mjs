#!/usr/bin/env node
import {validateUpload} from '../components/upload/compose.mjs';
import {uploadPreview} from '../components/upload/preview.mjs';
import {validateTransfer,transferModel,transferHtml} from '../components/transfer/family.mjs';
import {validateCascader} from '../components/cascader/family.mjs';
import {validateTimePicker} from '../components/time-picker/family.mjs';
import {validateSelect} from '../components/select/family.mjs';
import {validateInputField} from '../components/input/family.mjs';
import {validateInputNumber} from '../components/input-number/generator.mjs';
import {validateCheckbox} from '../components/checkbox/family.mjs';
import {validateRadio} from '../components/radio/generator.mjs';
import {SIZE,STATE,validateLink} from '../components/link/generator.mjs';
import {validateDivider} from '../components/divider/generator.mjs';
import {randomUUID} from 'node:crypto';
import * as support from '../support/client.mjs';
import {captureConsole} from '../support/tuning.mjs';
import {validateFeedback} from '../components/feedback/generator.mjs';
import {validateTimeline} from '../components/timeline/generator.mjs';
// 草图命令行：check 校验、render 生成本地预览页面、diff 对比版本。格式见 docs/sketch-design.md。
import {validateImageViewer} from '../components/image-viewer/generator.mjs';
import {readFileSync, writeFileSync, statSync} from 'node:fs';
import {join, dirname, basename, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDescriptions} from '../components/descriptions/generator.mjs';
import {validateDialog} from '../components/dialog/generator.mjs';
import {check, diff, diffSummary, resolvePage} from './core.mjs';
import {readStore, digest, saveVersion, restoreVersion, updateLabel, confirmDraft, recoverVersion} from './store.mjs';
import {isMain} from '../support/entry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// Windows PowerShell 写出的 UTF-8 文件可能带 BOM。
const readJson = file => JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

/** 从边界状态清单的表格行读出 编号 → {topic, ask, recommend}；清单文档是问法的唯一来源。 */
export function loadChecklist(file = join(here, '../docs/state-checklist.md')) {
  const items = new Map();
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\|\s*([LFUSNG]\d+)\s*\|(.*)\|\s*$/);
    if (!m) continue;
    const [topic, ask, recommend = ''] = m[2].split('|').map(s => s.trim());
    items.set(m[1], {topic, ask, recommend});
  }
  return items;
}

/** 读取草图目录（v1.json、v2.json…，可选 versions.json）或单个草图文件。 */
export function loadVersions(target) {
  if (statSync(target).isFile()) {
    const data = readJson(target);
    return {title: data.task ?? basename(target, '.json'), confirmed: null, versions: [{v: 1, data}]};
  }
  const state = readStore(target);
  const {meta, versions, draftConfirmed, draftConfirmedVersions, warnings} = state;
  if (!versions.length) throw Error('草稿目录没有版本');
  return {title: meta.task ?? versions.at(-1).data.task ?? basename(resolve(target)), draftConfirmed, draftConfirmedVersions,
    confirmed: state.changed.includes(meta.confirmed) || state.orphans.includes(meta.confirmed) ? null : meta.confirmed ?? null,
    figmaPage: meta.figmaPage ?? null, warnings, versions};
}

export function renderHtml(bundle, checklist = loadChecklist()) {
  const versions = bundle.versions.map(version => {
    try { validateDraft(version.data, false, checklist); } catch(e) { throw Error(`v${version.v} 未通过检查：\n${e.message}`); }
    const result = check(version.data, checklist);
    if (result.errors.length) throw Error(`v${version.v} 未通过检查：\n${result.errors.join('\n')}`);
    return {...version, missing: result.missing.map(m => m.code), missingDetails: result.missing};
  });
  const data = JSON.stringify({...bundle, support:bundle.support ?? {taskId:randomUUID().replaceAll('-',''),runId:null,events:[]}, versions}).replace(/</g, '\\u003c');
  const core = 'const UPLOAD_ROOTS='+JSON.stringify(JSON.parse(readFileSync(join(here,'../components/upload/build-data.json'),'utf8')).roots.filter(r=>r.properties)).replace(/</g,'\\u003c')+';\n'+validateUpload.toString()+'\nfunction resolveUpload(spec){return validateUpload(spec,UPLOAD_ROOTS)}\n'+uploadPreview.toString()+'\n'+'const TRANSFER_CATALOG='+readFileSync(join(here,'../components/transfer/recipes.json'),'utf8').replace(/</g,'\\u003c')+';\n'+[validateTransfer,transferModel,transferHtml].map(f=>f.toString()).join('\n')+'\n'+'const FEEDBACK_ICONS='+JSON.stringify(Object.fromEntries(['empty','error'].map(k=>[k,readFileSync(join(here,'../components/feedback/'+k+'.svg'),'utf8')]))).replace(/</g,'\\u003c')+';\nconst SIZE='+JSON.stringify(SIZE)+';const STATE='+JSON.stringify(STATE)+';\n'+validateLink.toString()+'\n'+validateCascader.toString()+'\n'+validateTimePicker.toString()+'\n'+validateSelect.toString()+'\n'+validateInputField.toString()+'\n'+validateInputNumber.toString()+'\n'+validateCheckbox.toString()+'\n'+validateRadio.toString()+'\n'+validateDivider.toString()+'\n'+validateFeedback.toString() + '\n' + validateTimeline.toString() + '\n' + validateImageViewer.toString() + '\n' + validateDescriptions.toString() + '\n' + validateDialog.toString() + '\n' + readFileSync(join(here, 'core.mjs'), 'utf8').replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
  const script = readFileSync(join(here, 'preview.js'), 'utf8');
  const feedback = readFileSync(join(here, '../support/preview.js'), 'utf8');
  const css = readFileSync(join(here, 'preview.css'), 'utf8');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(bundle.title)} · 草稿</title><style>${css}</style></head><body><div id="app"></div><script>const BUNDLE = ${data};\n${core}\n${script}\n${feedback}</script></body></html>`;
}

function printCheck(result, label) {
  if (result.errors.length) console.log(`${label} 有 ${result.errors.length} 个错误：\n- ${result.errors.join('\n- ')}`);
  if (result.missing.length) console.log(`${label} 有 ${result.missing.length} 个清单项没有结论（写进 decisions；需要产品决定的同时写进 questions）：\n${result.missing.map(m => `- ${m.code} ${m.topic}｜问法：${m.ask}｜推荐：${m.recommend}`).join('\n')}`);
  if (result.pending.length) console.log(`待产品回答：\n- ${result.pending.join('\n- ')}`);
  if (!result.errors.length && !result.missing.length) console.log(`${label} 通过检查。`);
  return result.errors.length || result.missing.length ? 1 : 0;
}

function validateDraft(data, final = false, checklist = loadChecklist()) {
  const result = check(data, checklist, {final});
  const failures = [...result.errors, ...(final ? result.missing.map(m => m.code + ' 尚无结论') : [])];
  // 默认页也必须解析：无 states 的页面同样可能有非法选项、条件或数值。
  for (const page of data.pages ?? []) resolvePage(page);
  for (const state of data.states ?? []) {
    const resolved = {...data, states:[], pages:data.pages.map(p => p.id===state.page ? resolvePage(p,state.patch) : p)};
    failures.push(...check(resolved,checklist).errors.map(e=>'状态 '+state.id+'：'+e));
  }
  if (final) {
    for (const q of data.questions ?? []) if(typeof q.answer==='string' && !q.answer.trim()) failures.push('问题 '+q.id+' 回答为空');
    for (const d of data.decisions ?? []) if(d.decision==='本轮不做' && !d.text?.trim()) failures.push('延期项 '+d.code+' 必须说明范围与影响');
    for (const g of [...(data.gaps ?? []), ...data.pages.flatMap(p => (p.children ?? []).filter(n => n.type === 'gap'))]) {
      if (!g.handling || !/^产品:.+/.test(g.acceptedFrom ?? '')) failures.push('缺口“' + g.need + '”需产品确认本轮处理方式 acceptedFrom: 产品:<出处>');
    }
  }
  if (failures.length) throw Error(failures.join('\n'));
}

async function main([command, ...args], run) {
  const num = value => { const v = Number(String(value).replace(/^v/, '')); if (!Number.isSafeInteger(v) || v < 0) throw Error('版本号无效'); return v; };
  if (command === 'status' && args[0]) {
    const state = readStore(args[0]);
    console.log(JSON.stringify({task: state.meta.task ?? state.versions.at(-1)?.data.task, latest: state.versions.at(-1)?.v ?? 0,
      draftConfirmed: state.draftConfirmed, draftConfirmedVersions: state.draftConfirmedVersions, warnings: state.warnings,
      versions: state.versions.map(v => ({v:v.v,basedOn:v.basedOn,label:v.label,star:v.star,hash:digest(v.data),...check(v.data,loadChecklist())}))},null,2)); return 0;
  }
  if (command === 'save' && args.length >= 3) {
    const v = saveVersion(args[0], readJson(args[1]), {expected:num(args[2]),base:args[3] ? num(args[3]) : (num(args[2]) || undefined),validate:validateDraft});
    console.log('已保存草稿 v'+v+'，尚未确认'); return 0;
  }
  if (command === 'restore' && args.length === 3) {
    console.log('已从旧版继续为 v'+restoreVersion(args[0],num(args[1]),num(args[2]),validateDraft)); return 0;
  }
  if (command === 'label' && args.length === 3) { updateLabel(args[0],num(args[1]),{label:args[2]}); return 0; }
  if (command === 'star' && args.length === 3) { if (!['true','false'].includes(args[2])) throw Error('星标只能 true / false'); updateLabel(args[0],num(args[1]),{star:args[2]==='true'}); return 0; }
  if (command === 'confirm' && args.length === 3) { confirmDraft(args[0],num(args[1]),args[2],data=>validateDraft(data,true));console.log('草稿已确认 v'+num(args[1])+'；未请求 Figma');return 0; }
  if (command === 'recover' && args.length >= 2) { recoverVersion(args[0],num(args[1]),args[2] ? num(args[2]) : undefined,validateDraft);console.log('快照已登记，未自动确认');return 0; }
  if (command === 'export' && args.length === 3) {
    const bundle=loadVersions(args[0]), version=bundle.versions.find(v=>v.v===num(args[1]));
    if(!version) throw Error('指定版本不存在');
    const out=resolve(args[2]);if(!out.endsWith('.html')) throw Error('导出路径必须是 .html');
    writeFileSync(out,renderHtml({...bundle,support:await safeContext(args[0],run),title:version.data.task ?? bundle.title,versions:[version],exported:true}),{flag:'wx'});
    console.log('已导出仅含 v'+version.v+' 的只读预览；续改请保留完整草稿目录');return 0;
  }
  const discussion = args.includes('--discussion');
  args = args.filter(a => a !== '--discussion');
  const final = args.includes('--final');
  args = args.filter(a => a !== '--final');
  if (command === 'check' && args[0]) {
    const {versions} = loadVersions(args[0]);
    const latest = versions.at(-1);
    if (discussion && final) throw Error('--discussion 与 --final 不可同时使用');
    const result=check(latest.data, loadChecklist(), {final});
    try { validateDraft(latest.data); } catch(e) { for(const error of e.message.split('\n')) if(!result.errors.includes(error)) result.errors.push(error); }
    const code=printCheck(result, 'v'+latest.v);
    if(discussion) {console.log('讨论稿允许保留未决问题和未覆盖清单；不代表已确认');return result.errors.length ? 1 : 0;}
    return code;
  }
  if (command === 'render' && args[0]) {
    const bundle = loadVersions(args[0]);
    const out = args[1] ?? (statSync(args[0]).isFile() ? args[0].replace(/\.json$/, '') + '.html' : join(args[0], '预览.html'));
    if (!out.endsWith('.html')) throw Error('预览输出必须是 .html，不得覆盖草稿数据');
    writeFileSync(out, renderHtml({...bundle,support:await safeContext(args[0],run)}));
    console.log(`已生成 ${out}（${bundle.versions.length} 个版本）`);
    return 0;
  }
  if (command === 'diff' && args[0]) {
    let before, after, label;
    if (args.length === 2 && statSync(args[0]).isFile()) {
      [before, after] = args.map(readJson);
      label = `${args[1]} 相对 ${args[0]}`;
    } else {
      const {versions} = loadVersions(args[0]);
      const find = v => versions.find(x => x.v === Number(String(v).replace(/^v/, ''))) ?? (() => { throw Error(`没有版本 ${v}`); })();
      const b = args[2] ? find(args[2]) : versions.at(-1);
      const a = args[1] ? find(args[1]) : find(b.basedOn ?? b.v - 1);
      [before, after, label] = [a.data, b.data, `v${b.v} 相对 v${a.v}`];
    }
    console.log(`${label}：${diffSummary(diff(before, after))}`);
    return 0;
  }
  console.log(`用法：
  node sketch/sketch.mjs save <目录> <候选.json> <预期最新版本，首版0> [基于版本]
  node sketch/sketch.mjs status <目录>
  node sketch/sketch.mjs restore <目录> <旧版本> <预期最新版本>
  node sketch/sketch.mjs label <目录> <版本> <名称>
  node sketch/sketch.mjs star <目录> <版本> <true|false>
  node sketch/sketch.mjs confirm <目录> <版本> <status中的hash>
  node sketch/sketch.mjs recover <目录> <未登记版本> [基于版本]
  node sketch/sketch.mjs export <目录> <版本> <新输出.html>
  node sketch/sketch.mjs check <草图目录或文件> [--final|--discussion]   校验最新版本；--final 用于确认出稿前
  node sketch/sketch.mjs render <草图目录或文件> [输出.html]  生成本地预览页面
  node sketch/sketch.mjs diff <草图目录> [旧版本] [新版本]     默认对比最新版和它的上一版
  node sketch/sketch.mjs diff <旧.json> <新.json>`);
  return 2;
}

async function safeContext(target,run) {try{return await support.previewContext(target,run?.runId??null)}catch{return undefined}}
if (isMain(import.meta.url)) {
  const args=process.argv.slice(2);let run,error,output,code=1;
  try { run=support.begin(args[0],args[1]??'.',args.slice(1)); } catch { console.error('运行日志不可用；草稿操作继续。'); }
  const stopCapture=support.tuningEnabled()?captureConsole():null;
  try { code=await main(args,run); } catch(e) { error=e;console.error(e.message); } finally { output=stopCapture?.(); }
  process.exitCode=code;
  try { if(run) support.finish(run,code,error,output);const result=await support.flush();if(result.state==='unconfigured'&&code!==0)console.error('可让 AI 导出反馈包；尚未配置自动上传。'); } catch { console.error('日志暂未上传，已保存的本地记录将在下次运行补传。'); }
}
