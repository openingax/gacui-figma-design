import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {createCollector} from '../support/server.mjs';
import {connect} from '../support/connect.mjs';
import {recordConnectFailure} from '../support/profile.mjs';
import * as client from '../support/client.mjs';
import {buildReport,renderHtml,serve,sourceKind} from '../support/dashboard.mjs';

const directory=fs.mkdtempSync(join(tmpdir(),'gac-dashboard-'));
const dataDir=join(directory,'data');
const server=createCollector({dataDir,tokenHashes:[createHash('sha256').update(randomUUID()).digest('hex')],ticketSecret:randomUUID(),autoEnroll:true});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const endpoint='http://127.0.0.1:'+server.address().port;
const useDevice=name=>{process.env.GAC_SUPPORT_HOME=join(directory,name,'state');process.env.GAC_SUPPORT_CONFIG=join(directory,name,'config.json');};
let page;
try{
 // 接入失败先记入本机，下次成功接入随资料补报并清除。
 useDevice('offline');
 await assert.rejects(connect('http://127.0.0.1:9'));
 assert.equal(JSON.parse(fs.readFileSync(join(directory,'offline','state','connect-failures.json'),'utf8')).length,1);

 useDevice('product');
 recordConnectFailure('ECONNRESET');
 const connected=await connect(endpoint);
 assert.equal(connected.profile,'sent');assert.match(connected.notice,/docs\/support\/README.md/);
 assert.ok(!fs.existsSync(join(directory,'product','state','connect-failures.json')));
 const tokenHash=createHash('sha256').update(client.config().token).digest('hex');
 const stored=JSON.parse(fs.readFileSync(join(dataDir,'profiles',tokenHash+'.json'),'utf8'));
 assert.equal(stored.profile.osUser,os.userInfo().username);assert.equal(stored.profile.hostname,os.hostname());
 assert.equal(stored.profile.connectFailures[0].error,'ECONNRESET');
 assert.ok(!JSON.stringify(stored).includes(client.config().token),'资料不得包含凭据');
 const firstSeen=stored.firstSeen;await connect(endpoint);
 assert.equal(JSON.parse(fs.readFileSync(join(dataDir,'profiles',tokenHash+'.json'),'utf8')).firstSeen,firstSeen);

 // 草稿命令、带来源链接的需求轮次、连续工具失败（阻塞）与一个正常任务。
 const draft=join(directory,'draft'),blocked=join(directory,'blocked');fs.mkdirSync(draft);fs.mkdirSync(blocked);
 const run=client.begin('save',draft,['save',draft,'candidate.json']);client.finish(run,0);
 const failed=client.begin('check',draft,['check',draft]);client.finish(failed,1,Object.assign(Error('校验未通过：缺少申请人'),{}));
 const ok=client.begin('check',draft,['check',draft]);client.finish(ok,0);
 client.trace(draft,{kind:'agent-turn',payload:{input:'按这个需求做 https://xxx.feishu.cn/docx/AbC123 ，参考 https://www.figma.com/design/KEY/name?node-id=1-2。<script>alert(1)</script>',output:'已生成',model:null}});
 client.trace(blocked,{kind:'tool-call',outcome:'error',payload:{tool:'render',error:'ENOENT'}});
 client.trace(blocked,{kind:'tool-call',outcome:'error',payload:{tool:'render',error:'ENOENT again'}});
 await client.flush();assert.equal(client.pending().length,0);

 const report=buildReport(dataDir);
 assert.equal(report.totals.people,1);
 const person=report.people[0];
 assert.equal(person.osUser,os.userInfo().username);assert.equal(person.hostname,os.hostname());
 assert.equal(person.saves,1);assert.equal(person.commands,3);assert.equal(person.errors,3);assert.equal(person.errorCodes.validation,1);
 assert.equal(person.agentTurns,1);assert.equal(person.toolErrors,2);assert.equal(person.blockedTasks,1);assert.equal(person.connectFailures,0,'最新资料在补报后已清空失败记录');
 assert.deepEqual(person.sources,{feishu:1,figma:1,other:0});
 assert.equal(report.tasks.find(t=>t.target===blocked)?.status,'阻塞');
 assert.equal(report.tasks.find(t=>t.target===draft)?.status,'正常');
 assert.equal(report.tasks.find(t=>t.status==='阻塞').target,blocked,'trace 记录带任务目录');
 assert.deepEqual(report.sources.map(s=>s.kind).sort(),['Figma','飞书']);
 assert.equal(sourceKind('https://a.larksuite.com/wiki/x'),'飞书');
 assert.ok(report.recentErrors.some(e=>e.message.includes('缺少申请人')));
 assert.equal(report.daily.length,30);

 const html=renderHtml(report);
 assert.ok(!html.includes('<script>alert(1)</script>'),'日志内容必须转义');
 assert.match(html,/飞书/);

 page=await serve(dataDir,0);const port=page.address().port;
 const home=await fetch(`http://127.0.0.1:${port}/`);assert.equal(home.status,200);assert.match(await home.text(),/GACUI 使用情况/);
 assert.equal((await fetch(`http://127.0.0.1:${port}/report.json`)).status,200);
 const rebinding=await new Promise(done=>{import('node:http').then(({request})=>{const r=request({host:'127.0.0.1',port,path:'/',headers:{Host:'evil.example'}},res=>done(res.statusCode));r.end();});});
 assert.equal(rebinding,403);
 assert.equal(page.address().address,'127.0.0.1');
 console.log('PASS dashboard: profile upload, connect failure backfill, per-person/task metrics, blocked status, Feishu/Figma links, escaping and localhost-only page');
}finally{
 await new Promise(r=>server.close(r));if(page)await new Promise(r=>page.close(r));
 fs.rmSync(directory,{recursive:true,force:true});
}
