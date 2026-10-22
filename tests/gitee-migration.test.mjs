import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {migrate} from '../scripts/distribution/migrate-gitee.mjs';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gac-migrate-')),source=path.join(root,'github'),target=path.join(root,'gitee');
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:'pipe'}).trim();
const skill='.agents/skills/gacui-figma-design',manager=fs.readFileSync('tests/fixtures/legacy-manage.mjs','utf8');
const commit=(cwd,message)=>{git(cwd,'add','.');git(cwd,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','-m',message);};
const release=(cwd,v)=>fs.writeFileSync(path.join(cwd,'skill-release.json'),JSON.stringify({version:v,protocol:1,nodeMajor:20,channel:'stable',notice:v}));
let n=0;
try {
 fs.mkdirSync(source);git(source,'init');fs.mkdirSync(path.join(source,skill,'scripts'),{recursive:true});fs.writeFileSync(path.join(source,skill,'scripts/manage.mjs'),manager);fs.writeFileSync(path.join(source,'.gitignore'),'tasks/\n.local/\n.env\n');release(source,'1.2.1');commit(source,'old');git(source,'tag','skill-v1.2.1');
 git(root,'clone',source,target);release(source,'1.2.2');commit(source,'bridge');git(source,'tag','skill-v1.2.2');
 release(target,'1.2.3');fs.writeFileSync(path.join(target,'new-file'),'target');fs.writeFileSync(path.join(target,skill,'scripts/manage.mjs'),manager.replace('https://github.com/openingax/gacui-figma-design.git',pathToFileURL(target).href));commit(target,'Gitee');
 git(target,'fetch',source,'HEAD');git(target,'-c','user.name=Test','-c','user.email=test@example.invalid','merge','--no-edit','-s','ours','FETCH_HEAD');git(target,'tag','skill-v1.2.3');
 const legacy=pathToFileURL(source).href,repo=pathToFileURL(target).href;
 function client(){const workspace=path.join(root,'client'+ ++n),entry=path.join(root,'entry'+n);git(root,'clone','--depth','1','--branch','skill-v1.2.2',legacy,workspace);git(workspace,'switch','-c','skill-runtime');fs.mkdirSync(path.join(entry,'scripts'),{recursive:true});fs.writeFileSync(path.join(entry,'scripts/manage.mjs'),manager);const state={commit:git(workspace,'rev-parse','HEAD'),version:'1.2.2',ack:'1.2.1',custom:'preserve'};fs.writeFileSync(workspace+'.skill-state.json',JSON.stringify(state));fs.mkdirSync(path.join(workspace,'tasks'));fs.mkdirSync(path.join(workspace,'.local'));fs.writeFileSync(path.join(workspace,'tasks/draft.json'),'draft bytes');fs.writeFileSync(path.join(workspace,'.local/config.json'),'private config');fs.writeFileSync(path.join(workspace,'.env'),'local setting');git(workspace,'config','custom.keep','yes');return {workspace,entry,repo,legacy};}
 const x=client();const out=migrate(x);assert.equal(out.version,'1.2.3');assert.equal(git(x.workspace,'config','--get','remote.origin.url'),repo);assert.equal(git(x.workspace,'config','custom.keep'),'yes');for(const [f,s] of [['tasks/draft.json','draft bytes'],['.local/config.json','private config'],['.env','local setting']])assert.equal(fs.readFileSync(path.join(x.workspace,f),'utf8'),s);assert.equal(JSON.parse(fs.readFileSync(x.workspace+'.skill-state.json')).custom,'preserve');assert.ok(migrate(x).alreadyComplete);
 const run=JSON.parse(execFileSync(process.execPath,[path.join(x.entry,'scripts/manage.mjs'),'sync','--no-logging'],{encoding:'utf8'}));assert.equal(run.workspace,fs.realpathSync(x.workspace));assert.equal(run.version,'1.2.3');assert.equal(fs.readFileSync(path.join(x.entry,'scripts/manage.mjs.pre-gitee-backup'),'utf8'),manager);
 const dirty=client();fs.appendFileSync(path.join(dirty.workspace,'skill-release.json'),' ');assert.throws(()=>migrate(dirty),/本地代码修改/);
 const pinned=client(),sf=pinned.workspace+'.skill-state.json',state=JSON.parse(fs.readFileSync(sf));state.pin='1.2.2';fs.writeFileSync(sf,JSON.stringify(state));assert.throws(()=>migrate(pinned),/固定/);
 const edited=client();fs.appendFileSync(path.join(edited.entry,'scripts/manage.mjs'),'\n// custom');assert.throws(()=>migrate(edited),/未知修改/);
 const foreign=client();git(foreign.workspace,'remote','set-url','origin','https://example.invalid');assert.throws(()=>migrate(foreign),/origin/);
 const local=client();git(local.workspace,'-c','user.name=Test','-c','user.email=test@example.invalid','commit','--allow-empty','-m','local');assert.throws(()=>migrate(local),/本地提交/);
 const collision=client();fs.writeFileSync(path.join(collision.workspace,'new-file'),'user file');assert.throws(()=>migrate(collision));assert.equal(fs.readFileSync(path.join(collision.workspace,'new-file'),'utf8'),'user file');assert.equal(git(collision.workspace,'config','--get','remote.origin.url'),legacy);fs.renameSync(path.join(collision.workspace,'new-file'),path.join(collision.workspace,'tasks/preserved-file'));assert.equal(migrate(collision).version,'1.2.3');
 const resumed=client();git(resumed.workspace,'fetch',repo,'refs/tags/skill-v1.2.3');const targetCommit=git(resumed.workspace,'rev-parse','FETCH_HEAD'),originalCommit=git(resumed.workspace,'rev-parse','HEAD');git(resumed.workspace,'fetch','--unshallow',repo);fs.writeFileSync(resumed.workspace+'.gitee-migration.json',JSON.stringify({workspace:fs.realpathSync(resumed.workspace),entry:fs.realpathSync(resumed.entry),repository:repo,originalCommit,targetCommit,complete:false}));git(resumed.workspace,'merge','--ff-only',targetCommit);assert.equal(migrate(resumed).version,'1.2.3');
 const linked=client();const link=path.join(root,'symlink');fs.symlinkSync(path.join(linked.workspace,skill),link,process.platform==='win32'?'junction':'dir');assert.equal(migrate({...linked,entry:link}).version,'1.2.3');assert.equal(git(linked.workspace,'status','--porcelain','--untracked-files=no'),'');
 const offline=client();assert.throws(()=>migrate({...offline,repo:pathToFileURL(path.join(root,'missing')).href}));assert.equal(git(offline.workspace,'config','--get','remote.origin.url'),legacy);
 console.log('PASS Gitee migration: unrelated platform histories joined, shallow fast-forward, original workspace/config/drafts, entry wrapper/symlink, pin/dirty/local commit/origin/entry/offline/collision protection, journal resume, idempotence');
}finally{fs.rmSync(root,{recursive:true,force:true});}
