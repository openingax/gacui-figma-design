import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import {join} from 'node:path';import {spawn,execFileSync} from 'node:child_process';import {once} from 'node:events';import {randomUUID} from 'node:crypto';
const root=fs.mkdtempSync(join(os.tmpdir(),'issues-api-'));let child;
try{
 const pkg=join(root,'pkg'),data=join(root,'data');fs.mkdirSync(join(data,'events'),{recursive:true});
 const e={id:randomUUID(),taskId:'b'.repeat(32),runId:randomUUID(),at:new Date().toISOString(),phase:'finish',operation:'check',outcome:'error',durationMs:1,before:1,after:1,build:'unknown',dirty:false,platform:'other',node:process.version,errorCode:'unexpected',context:{message:'synthetic issue'}};
 const file=join(data,'events','a'.repeat(64)+'-'+e.id+'.json');fs.writeFileSync(file,JSON.stringify(e));const original=fs.readFileSync(file,'utf8');
 execFileSync(process.execPath,['support/public-dashboard/prepare.mjs',pkg]);
 const start=async()=>{child=spawn(process.execPath,[join(pkg,'server.mjs')],{env:{...process.env,PORT:'0',DASHBOARD_MODE:'logs',DASHBOARD_DATA:data,DASHBOARD_TOKEN:'synthetic-issues'},stdio:['ignore','pipe','pipe']});const [line]=await once(child.stdout,'data');return 'http://127.0.0.1:'+String(line).match(/127\.0\.0\.1:(\d+)/)[1];};
 const stop=async()=>{const p=once(child,'exit');child.kill();await p;child=null;};
 let url=await start();
 const login=async()=>{const r=await fetch(url+'/auth',{method:'POST',body:'token=synthetic-issues',redirect:'manual'});return r.headers.get('set-cookie').split(';')[0];};
 let cookie=await login();const read=async()=>{const r=await fetch(url+'/report.json',{headers:{Cookie:cookie}});assert.equal(r.status,200);return r.json();};
 const issue=(await read()).issues[0],path='/api/issues/'+issue.id;
 const body=JSON.stringify({etag:issue.etag,state:'fixed_pending',actor:'synthetic reviewer',note:'test fix',fixVersion:'1.3.0'});
 const headers={Cookie:cookie,Origin:url,'X-Gacui-Issue-Action':'1','Content-Type':'application/json'};
 assert.equal((await fetch(url+path,{method:'POST',headers:{...headers,Cookie:''},body})).status,401);
 assert.equal((await fetch(url+path,{method:'POST',headers:{...headers,Origin:'https://other.test'},body})).status,403);
 assert.equal((await fetch(url+path,{method:'POST',headers:{...headers,'X-Gacui-Issue-Action':''},body})).status,403);
 assert.equal((await fetch(url+path,{method:'POST',headers,body})).status,200);
 assert.equal((await fetch(url+path,{method:'POST',headers,body})).status,409);
 assert.equal((await read()).issues[0].state,'fixed_pending');assert.equal(fs.readFileSync(file,'utf8'),original);
 await stop();url=await start();cookie=await login();assert.equal((await read()).issues[0].history.length,1,'重启保留处理记录');
 console.log('PASS issues API: packaged dependencies, authorization, CSRF, revision conflict, original data intact, restart persistence');
}finally{if(child){const p=once(child,'exit');child.kill();await p;}fs.rmSync(root,{recursive:true,force:true});}
