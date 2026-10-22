import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {check, requiredCodes, diff, diffSummary} from '../sketch/core.mjs';
import {loadChecklist, renderHtml} from '../sketch/sketch.mjs';

const checklist = loadChecklist();
const read = name => JSON.parse(readFileSync(new URL(`../sketch/examples/${name}.json`, import.meta.url), 'utf8'));
const errorsOf = s => check(s, checklist).errors.join('\n');

// 现有页面写成的草图全部通过，且清单项都有结论。
for (const name of ['work-order', 'settlement']) {
  const result = check(read(name), checklist);
  assert.deepEqual(result.errors, [], name);
  assert.deepEqual(result.missing, [], name);
}
assert.equal(check(read('settlement'), checklist, {final: true}).errors.length, 4, '待决策项和未回答问题在出稿前被拦下');

// 脚本引用的清单编号都存在于清单文档。
const everything = {pages: [
  {id: 'a', frame: 'workbench', children: [
    {id: 's', type: 'search', fields: [{kind: 'select'}, {kind: 'date'}]},
    {id: 't', type: 'table', selection: true, pagination: true, columns: [{kind: 'operations'}]},
    {id: 'b', type: 'actions', buttons: [{opens: 'b'}]}]},
  {id: 'b', frame: 'drawer', children: [{id: 'f', type: 'form', fields: [{kind: 'upload'}]}]}]};
for (const code of requiredCodes(everything)) assert.ok(checklist.has(code), `清单缺少 ${code}`);

// 典型错误都能拦下。
const broken = (mutate, pattern) => {
  const s = read('work-order');
  mutate(s);
  assert.match(errorsOf(s), pattern);
};
broken(s => s.pages[0].children.push({id: 'modal', type: 'modal'}), /不在草图词汇内/);
broken(s => s.pages[0].children.push({id: 'search', type: 'note', text: 'x'}), /list\/search：id 重复/);
broken(s => { s.pages[0].children[1].buttons[0].opens = 'detail'; }, /opens 指向不存在的页面 detail/);
broken(s => { s.decisions[0] = {code: 'L1', decision: '已明确', text: '点查询', from: '推荐'}; }, /“已明确”必须写需求出处/);
broken(s => { delete s.decisions.find(d => d.decision === '本轮不做').from; }, /“本轮不做”必须写 from/);
broken(s => { s.decisions[0] = {code: 'L1', decision: '按推荐', from: '推荐'}; }, /缺少结论内容/);
broken(s => { s.decisions[0].decision = '待决策'; }, /“待决策”必须有一个未回答/);
broken(s => { s.states[0].patch['list/table/missing'] = {value: 1}; }, /patch 路径 list\/table\/missing 不存在/);
broken(s => { s.states[0].patch['list/table'].color = 'red'; }, /patch 不支持 color/);
broken(s => { s.pages[1].children[0].fields[0].kind = 'unknown'; }, /字段 kind 只能是/);
broken(s => { s.questions.push({id: 'Q1', ask: '要不要导出？'}); }, /必须附推荐答案/);
{
  const s = read('work-order');
  s.decisions = s.decisions.filter(d => d.code !== 'U2');
  assert.deepEqual(check(s, checklist).missing.map(m => m.code), ['U2']);
  assert.match(check(s, checklist).missing[0].ask, /整批拒绝/);
}

// 版本差异：子项增删不会再把父节点重复报告为修改。
{
  const a = read('work-order'), b = structuredClone(a);
  b.pages[0].children[1].buttons.pop();
  b.pages[0].children[0].fields.push({id: 'overdue', label: '超时时长', kind: 'select'});
  b.pages[0].children[2].columns[6].title = '所在城市';
  const d = diff(a, b);
  assert.deepEqual(d.added.map(x => x.key), ['list/search/overdue']);
  assert.deepEqual(d.removed.map(x => x.key), ['list/toolbar/bulk']);
  assert.deepEqual(d.changed.map(x => [x.key, x.props]), [['list/table/city', ['title：城市 → 所在城市']]]);
  b.pages[0].children[0].fields.reverse();
  assert.match(diffSummary(diff(a, b)), /查询区（顺序）/);
  assert.equal(diffSummary(diff(a, a)), '无变化');
}

// 预览页面：数据里的 </script> 被转义，未通过检查的版本拒绝生成。
{
  const s = read('work-order');
  s.pages[0].title = '列表</script><script>alert(1)</script>';
  const html = renderHtml({title: 't', versions: [{v: 1, data: s}]}, checklist);
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.ok(!/^export /m.test(html));
  s.pages[0].frame = 'modal';
  assert.throws(() => renderHtml({title: 't', versions: [{v: 1, data: s}]}, checklist), /v1 未通过检查/);
}
console.log('sketch ok');
