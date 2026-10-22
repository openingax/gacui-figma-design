import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {readStore,saveVersion,restoreVersion,confirmDraft,updateLabel,recoverVersion,digest} from '../sketch/store.mjs';
import {diff,check} from '../sketch/core.mjs';
import {loadChecklist,loadVersions} from '../sketch/sketch.mjs';
mkdirSync('tmp',{recursive:true});
const dir=mkdtempSync('tmp/draft-test-');
const data=JSON.parse(readFileSync('sketch/examples/work-order.json','utf8'));
const validate=d=>{assert.deepEqual(check(d,loadChecklist()).errors,[]);};
const cli=(...args)=>spawnSync(process.execPath,['sketch/sketch.mjs',...args],{encoding:'utf8'});
try {
  assert.equal(saveVersion(dir,data,{expected:0,validate}),1);
  const before=readFileSync(join(dir,'v1.json'),'utf8');
  confirmDraft(dir,1,digest(data),validate);
  assert.equal(readStore(dir).draftConfirmed,1);
  assert.equal(readStore(dir).meta.confirmed,undefined,'草稿确认不能请求 Figma');
  const second=structuredClone(data);second.pages[0].title='新的工单标题';
  assert.equal(saveVersion(dir,second,{base:1,expected:1,validate}),2);
  assert.equal(readStore(dir).draftConfirmed,1,'新版不继承确认');
  assert.throws(()=>saveVersion(dir,second,{base:1,expected:1,validate}),/版本已变化/);
  assert.equal(readFileSync(join(dir,'v1.json'),'utf8'),before);
  updateLabel(dir,1,{label:'方案A',star:true});
  assert.equal(readFileSync(join(dir,'v1.json'),'utf8'),before);
  assert.equal(restoreVersion(dir,1,2,validate),3);
  assert.deepEqual(readStore(dir).versions.at(-1).data,data);
  assert.equal(readStore(dir).versions.at(-1).basedOn,1);
  assert.throws(()=>confirmDraft(dir,2,'wrong',validate),/确认内容已变化/);
  // 模拟快照完成、索引写入前进程中断。
  writeFileSync(join(dir,'v4.json'),JSON.stringify(second));
  assert.deepEqual(readStore(dir).orphans,[4]);
  assert.throws(()=>saveVersion(dir,data,{base:3,expected:4,validate}),/未登记快照/);
  recoverVersion(dir,4,3,validate);
  assert.equal(readStore(dir).versions.at(-1).basedOn,3);
  assert.deepEqual(readStore(dir).orphans,[]);
  assert.equal(readStore(dir).draftConfirmed,1);
  writeFileSync(join(dir,'.draft-write.lock'),'test');
  assert.throws(()=>updateLabel(dir,1,{label:'blocked'}),/正被写入/);
  rmSync(join(dir,'.draft-write.lock'));
  writeFileSync(join(dir,'v1.json'),JSON.stringify(second));
  assert.equal(readStore(dir).draftConfirmed,null,'外部修改使确认失效');
  assert.throws(()=>updateLabel(dir,1,{label:'blocked'}),/内容与保存摘要不同/);
  writeFileSync(join(dir,'v1.json'),before);
  const meta=readFileSync(join(dir,'versions.json'),'utf8');
  writeFileSync(join(dir,'versions.json'),'{broken');assert.throws(()=>readStore(dir));
  writeFileSync(join(dir,'versions.json'),meta);
  for(const bad of [
    {...JSON.parse(meta),confirmed:99},
    {...JSON.parse(meta),versions:[{v:1,basedOn:2}]},
    {...JSON.parse(meta),versions:[{v:1},{v:1}]},
  ]) {writeFileSync(join(dir,'versions.json'),JSON.stringify(bad));assert.throws(()=>readStore(dir));}
  writeFileSync(join(dir,'versions.json'),meta);
  const exported=join(dir,'selected.html');
  assert.equal(cli('export',dir,'2',exported).status,0);
  const bundle=JSON.parse(readFileSync(exported,'utf8').match(/const BUNDLE = (.*);\n/)[1]);
  assert.deepEqual(bundle.versions.map(v=>v.v),[2]);
  assert.equal(cli('export',dir,'2',exported).status,1,'不得覆盖已有导出');
  // CLI 讨论稿、严格确认和缺口确认各有门槛。
  const incomplete=structuredClone(data);incomplete.decisions=[];
  const candidate=join(dir,'candidate.json');writeFileSync(candidate,JSON.stringify(incomplete));
  assert.equal(cli('check',candidate,'--discussion').status,0);
  assert.equal(cli('check',candidate,'--final').status,1);
  assert.equal(cli('save',join(dir,'new'),candidate,'0').status,0);
  assert.equal(cli('confirm',join(dir,'new'),'1',digest(incomplete)).status,1);
  assert.equal(cli('confirm',dir,'2',digest(second)).status,1,'未接受缺口不能确认');
  const accepted=structuredClone(data);for(const d of accepted.decisions)if(d.decision==='本轮不做'&&!d.text)d.text='测试范围延期说明，不代表真实产品确认';for(const g of accepted.gaps)g.acceptedFrom='产品:自动化测试模拟确认，非用户验收';
  writeFileSync(candidate,JSON.stringify(accepted));
  assert.equal(cli('save',dir,candidate,'4').status,0);
  assert.equal(cli('confirm',dir,'5',digest(accepted)).status,0);
  assert.equal(loadVersions(dir).draftConfirmed,5);
  assert.deepEqual(loadVersions(dir).draftConfirmedVersions.sort(),[1,5]);
  assert.equal(cli('render',dir,join(dir,'v1.json')).status,1);
  const changed=structuredClone(data);changed.task='任务更名';changed.demo='新演示说明';changed.pages.reverse();
  assert.ok(diff(data,changed).changed.some(c=>c.key==='draft:metadata'));
  // 无索引的旧目录兼容；未经摘要确认不伪装成有效确认。
  const legacy=join(dir,'legacy');mkdirSync(legacy);writeFileSync(join(legacy,'v1.json'),JSON.stringify(data));
  writeFileSync(join(legacy,'versions.json'),JSON.stringify({confirmed:1,draftConfirmed:1}));
  assert.equal(loadVersions(legacy).confirmed,1);
  assert.equal(loadVersions(legacy).draftConfirmed,null);
  assert.match(loadVersions(legacy).warnings.join(),/未通过内容核验/);
  console.log('draft-store ok: append, stale write, restore, tamper, lock, interrupted recovery, export, gates, legacy');
} finally {rmSync(dir,{recursive:true,force:true});}
