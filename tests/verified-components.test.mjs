import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {checkPlan,acceptReceipt,LOCAL_CONFIG} from '../scripts/figma/target.mjs';
import {loadVersions,renderHtml} from '../sketch/sketch.mjs';import {assetFor,portablePlan} from '../scripts/figma/portable.mjs';
const key='A'.repeat(22),p=checkPlan(key),before=fs.existsSync(LOCAL_CONFIG)?fs.readFileSync(LOCAL_CONFIG):null,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'verified-components-'));
const receipts=p.batches.map(b=>({schema:2,fileKey:key,fingerprint:p.fingerprint,batch:b.index,totalBatches:p.batches.length,checkedIds:b.ids,missing:[],wrongTypes:[],...(b.index===0?{pages:[{id:'1:1',name:'库',empty:false,draftOnly:false}]}:{})}));
try{
acceptReceipt(key,{...p,receipts});const {plan,code}=await import('../sketch/figma.mjs');const base=JSON.parse(fs.readFileSync('examples/draft-first/v2.json'));base.task='合成组件验证';base.request={text:'合成静态验证',sources:[]};base.states=[];base.questions=[];base.gaps=[];base.judgments=[];base.decisions.forEach(d=>d.text='合成静态验证');
const cases=[],read=f=>JSON.parse(fs.readFileSync('components/'+f+'/catalog.json'));
for(const size of ['medium','small'])for(const shape of ['circle','round'])cases.push({type:'badge',size,shape,text:'999+',anchor:'page/actions/a',offset:[-14,-8]});
cases.push({type:'badge',size:'small',shape:'circle',dot:true,anchor:'page/actions/a',offset:[-8,-4]});
for(const placement of ['left','right','none'])for(const borderless of [false,true])cases.push({type:'collapse',placement,borderless,items:[{id:'a',title:'演示标题',expanded:true,content:'演示内容'},{id:'b',title:'禁用',disabled:true,content:'禁用说明'}]});
for(const size of ['small','medium','large'])for(const kind of ['base','multiline','meta'])cases.push({type:'list',size,kind,split:true,items:[{id:'a',description:'演示内容',...(kind==='base'?{}:{title:'演示标题'})}]});
for(const r of read('progress').rows)cases.push({type:'progress',theme:r.theme,size:r.size,status:r.status,percent:r.status==='success'?100:37});
for(const r of read('statistic').rows)cases.push({type:'statistic',formal:r.formal,trendPlacement:r.trendPlacement,color:r.color,title:'演示指标',value:'82.76'});
let maximum=0;
for(const [i,s] of cases.entries()){
const dir=path.join(tmp,String(i));fs.mkdirSync(dir);base.pages=[{id:'page',type:'page',title:'合成页面',frame:'workbench',from:'判断',children:[{id:'actions',type:'actions',from:'判断',buttons:[{id:'a',label:'查看详情',kind:'default'}]},{id:'sample',from:'判断',...s}]}];
fs.writeFileSync(path.join(dir,'v1.json'),JSON.stringify({...base,v:1}));fs.writeFileSync(path.join(dir,'versions.json'),JSON.stringify({confirmed:1,figmaPage:'合成验证',validationOnly:true,versions:[{v:1,label:'合成'}]}));
assert.equal(plan(dir).boards.length,1);const js=code(dir,'page');new Function('return async function(){'+js+'}');assert.ok(js.length<48000,s.type+' length '+js.length);maximum=Math.max(maximum,js.length);assert.ok(!js.includes('UNCONFIGURED_FIGMA_TARGET'));
const html=renderHtml(loadVersions(dir));new Function(html.match(/<script>([\s\S]*)<\/script>/)[1]);const portable=portablePlan(dir,key);if(s.type==='badge')assert.equal(portable.complete,true,JSON.stringify(portable.skippedBoards));else {assert.equal(portable.complete,false);assert.match(portable.notice,/尚未验证|尚未支持|暂未支持/);}
}
for(const r of read('badge'))assert.equal(assetFor(r.id).type,'COMPONENT');
for(const f of ['components/menu','components/form/workbench-roundtrip.mjs','components/upload/workbench.mjs'])assert.ok(!fs.existsSync(f));
console.log(`PASS verified components: ${cases.length} plans/code/previews; maxLength=${maximum}; Badge assets and explicit migration isolation`);
}finally{if(before)fs.writeFileSync(LOCAL_CONFIG,before);else fs.rmSync(LOCAL_CONFIG,{force:true});fs.rmSync(tmp,{recursive:true,force:true});}
