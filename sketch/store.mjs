// 本地草稿存储。不连接 Figma（仅记录出稿请求）；完整快照不可覆盖，元数据单文件原子替换。
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, openSync, closeSync, unlinkSync, renameSync} from 'node:fs';
import {join} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const readJson = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export const digest = data => createHash('sha256').update(JSON.stringify(data)).digest('hex');
const versionNumber = v => Number.isSafeInteger(v) && v > 0;
const fail = message => { throw Error(message); };

export function readStore(dir) {
  const numbers = readdirSync(dir).flatMap(f => /^v([1-9]\d*)\.json$/.test(f) ? [Number(f.slice(1,-5))] : []).sort((a,b)=>a-b);
  const meta = existsSync(join(dir,'versions.json')) ? readJson(join(dir,'versions.json')) : {};
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) fail('版本索引必须是对象');
  if (meta.storeVersion !== undefined && meta.storeVersion !== 1) fail('不支持的版本存储格式');
  if (meta.versions !== undefined && !Array.isArray(meta.versions)) fail('versions 必须是数组');
  const seen = new Set();
  for (const entry of meta.versions ?? []) {
    if (!entry || !versionNumber(entry.v) || seen.has(entry.v)) fail('版本编号无效或重复');
    seen.add(entry.v);
    if (!numbers.includes(entry.v)) fail(`索引引用的 v${entry.v}.json 不存在`);
    if (entry.basedOn !== undefined && (!versionNumber(entry.basedOn) || entry.basedOn >= entry.v || (meta.storeVersion === 1 && !numbers.includes(entry.basedOn)))) fail(`v${entry.v} 的 basedOn 无效`);
    if (entry.label !== undefined && typeof entry.label !== 'string') fail('版本名称必须是文字');
    if (entry.star !== undefined && typeof entry.star !== 'boolean') fail('星标必须是布尔值');
    if (meta.storeVersion === 1 && !/^[a-f0-9]{64}$/.test(entry.hash ?? '')) fail(`v${entry.v} 缺少内容摘要`);
  }
  for (const key of ['confirmed','draftConfirmed']) if (meta[key] != null && (!versionNumber(meta[key]) || !numbers.includes(meta[key]))) fail(`${key} 指向不存在的版本`);
  const versions = numbers.map(v=>({...meta.versions?.find(e=>e.v===v),v,data:readJson(join(dir,`v${v}.json`))}));
  const orphans = meta.storeVersion === 1 ? numbers.filter(v=>!seen.has(v)) : [];
  const changed = versions.filter(v=>v.hash && v.hash!==digest(v.data)).map(v=>v.v);
  const warnings = [
    ...versions.filter(v=>v.basedOn && !numbers.includes(v.basedOn)).map(v=>`历史摘录 v${v.v} 缺少基线 v${v.basedOn}；可读取，不可直接写入`),
    ...orphans.map(v=>`v${v} 是未登记快照，请检查后使用 recover 登记；未自动确认`),
    ...changed.map(v=>`v${v} 内容与保存摘要不同，请恢复原文件；停止写入`),
  ];
  let draftConfirmed = null;
  if (meta.draftConfirmed != null) {
    const v = versions.find(v=>v.v===meta.draftConfirmed);
    if (meta.draftConfirmation?.v===v.v && meta.draftConfirmation.hash===digest(v.data) && !changed.includes(v.v) && !orphans.includes(v.v)) draftConfirmed=v.v;
    else warnings.push(`v${v.v} 的草稿确认未通过内容核验，需重新确认`);
  }
  if (meta.draftConfirmations !== undefined && !Array.isArray(meta.draftConfirmations)) fail('草稿确认历史必须是数组');
  const confirmations = [...(meta.draftConfirmations ?? []), ...(meta.draftConfirmation ? [meta.draftConfirmation] : [])];
  const draftConfirmedVersions = [...new Set(confirmations.filter(c => c && versions.some(v => v.v===c.v && c.hash===digest(v.data) && !changed.includes(v.v) && !orphans.includes(v.v))).map(c=>c.v))];
  return {meta, versions, orphans, changed, warnings, draftConfirmed, draftConfirmedVersions};
}

function locked(dir, action) {
  mkdirSync(dir,{recursive:true});
  const lock=join(dir,'.draft-write.lock');
  let fd;
  try { fd=openSync(lock,'wx'); } catch(e) { if(e.code==='EEXIST') fail('草稿正被写入或上次中断留锁；先确认没有其他写入进程，再由维护者移除 .draft-write.lock'); throw e; }
  try { writeFileSync(fd,JSON.stringify({pid:process.pid,at:new Date().toISOString()})); return action(); }
  finally { closeSync(fd); unlinkSync(lock); }
}
function writeMeta(dir,meta) {
  const tmp=join(dir,`.versions-${randomUUID()}.tmp`);
  try { writeFileSync(tmp,JSON.stringify(meta,null,2)+'\n',{flag:'wx'}); renameSync(tmp,join(dir,'versions.json')); }
  finally { if(existsSync(tmp)) unlinkSync(tmp); }
}
function writable(state, {allowOrphans=false}={}) {
  if(state.versions.some(v=>v.basedOn && !state.versions.some(x=>x.v===v.basedOn))) fail("历史摘录缺少基线，先恢复完整草稿目录再写入");
  if(state.changed.length) fail(state.warnings.join('\n'));
  if(state.orphans.length && !allowOrphans) fail(state.warnings.join('\n'));
}
function managed(state) {
  return {...state.meta,storeVersion:1,versions:state.versions.filter(v=>!state.orphans.includes(v.v)).map(({data,...entry})=>({...entry,hash:digest(data)}))};
}

// validate 在 CLI 传入，存储层不另造业务检查逻辑。
export function saveVersion(dir,data,{base,expected,validate}={}) {
  validate?.(data);
  return locked(dir,()=>{
    const state=readStore(dir); writable(state);
    const latest=state.versions.at(-1)?.v ?? 0;
    if(expected!==latest) fail(`版本已变化或未指定基线：当前 v${latest}，请先读取 status 再保存`);
    if(latest && !state.versions.some(v=>v.v===base)) fail('必须指定有效的 basedOn 版本');
    if(!latest && base!==undefined) fail('首版不能指定 basedOn');
    const v=latest+1, meta=managed(state);
    // 先登记现有快照，确保首次升级存储后中断的新快照也可被发现。
    writeMeta(dir,meta);
    writeFileSync(join(dir,`v${v}.json`),JSON.stringify(data,null,2)+'\n',{flag:'wx'});
    meta.versions.push({v,...(base ? {basedOn:base}:{}),hash:digest(data)});
    // 此处若失败，快照保留为 orphan，下一次写入会拒绝，等待显式恢复。
    writeMeta(dir,meta);
    return v;
  });
}
export function restoreVersion(dir,v,expected,validate) {
  const old=readStore(dir).versions.find(x=>x.v===v);
  if(!old) fail(`没有版本 v${v}`);
  return saveVersion(dir,old.data,{base:v,expected,validate});
}
export function updateLabel(dir,v,{label,star}) {
  return locked(dir,()=>{
    const state=readStore(dir);writable(state);const meta=managed(state);
    const entry=meta.versions.find(x=>x.v===v);if(!entry) fail(`没有版本 v${v}`);
    if(label!==undefined) {if(typeof label!=='string') fail('名称必须是文字');entry.label=label;}
    if(star!==undefined) {if(typeof star!=='boolean') fail('星标必须是布尔值');entry.star=star;}
    writeMeta(dir,meta);
  });
}
export function confirmDraft(dir,v,expectedHash,validate) {
  return locked(dir,()=>{
    const state=readStore(dir);writable(state);
    const entry=state.versions.find(x=>x.v===v);if(!entry) fail(`没有版本 v${v}`);
    if(expectedHash!==digest(entry.data)) fail('确认内容已变化，请重新查看指定版本');
    validate(entry.data);
    const meta=managed(state);
    meta.draftConfirmations=[...(meta.draftConfirmations ?? []), ...(meta.draftConfirmation ? [meta.draftConfirmation] : [])];
    meta.draftConfirmations=meta.draftConfirmations.filter((c,i,all)=>all.findIndex(x=>x.v===c.v&&x.hash===c.hash)===i);
    meta.draftConfirmed=v;meta.draftConfirmation={v,hash:expectedHash,at:new Date().toISOString()};
    writeMeta(dir,meta);return v;
  });
}
// 出稿请求只能指向已通过内容核验的草稿确认版本；Page 名由用户/agent 为本任务指定。
export function requestFigma(dir,v,page) {
  if(typeof page!=='string'||!page.trim()) fail('请指定本任务的 Figma Page 名称');
  return locked(dir,()=>{
    const state=readStore(dir);writable(state);
    if(state.draftConfirmed!==v) fail(`v${v} 不是当前已确认的草稿版本；先确认该版本再请求出稿`);
    const meta=managed(state);meta.confirmed=v;meta.figmaPage=page.trim();meta.figmaRequest={v,hash:digest(state.versions.find(x=>x.v===v).data),page:page.trim(),at:new Date().toISOString()};
    writeMeta(dir,meta);return v;
  });
}
export function recoverVersion(dir,v,base,validate) {
  return locked(dir,()=>{
    const state=readStore(dir);writable(state,{allowOrphans:true});
    if(!state.orphans.includes(v)) fail(`v${v} 不是未登记快照`);
    if(base!==undefined && (!state.versions.some(x=>x.v===base) || state.orphans.includes(base) || base>=v)) fail('恢复基线必须是更早的已登记版本');
    if(state.versions.some(x=>x.v<v) && base===undefined) fail('请明确恢复快照的 basedOn');
    const entry=state.versions.find(x=>x.v===v);validate(entry.data);
    const meta=managed(state);meta.versions.push({v,...(base?{basedOn:base}:{}),hash:digest(entry.data)});meta.versions.sort((a,b)=>a.v-b.v);
    writeMeta(dir,meta);return v;
  });
}
