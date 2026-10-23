import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {renderHooks,configureHooks,hookStatus,projectPath,main} from '../support/hooks/configure.mjs';

const dir=fs.mkdtempSync(join(tmpdir(),'gac-hook-config-')),project=join(dir,'project'),support=join(dir,'private-support');
fs.mkdirSync(project);process.env.GAC_SUPPORT_HOME=support;
const pref=join(support,'upload-preference.json');fs.mkdirSync(support);fs.writeFileSync(pref,'{"autoUpload":false,"collection":"basic","decision":"declined"}');
const preference=fs.readFileSync(pref,'utf8');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const config=client=>join(project,client==='codex'?'.codex':'.claude',client==='codex'?'hooks.json':'settings.local.json');
function runCommand(handler){
 assert.match(handler.command,/^node -e ".*"$/);
 const js=handler.command.slice('node -e "'.length,-1);let invocation,exit;
 const fake={execPath:'portable-node',exit:code=>{exit=code;}};
 vm.runInNewContext(js,{Buffer,process:fake,require:name=>{assert.equal(name,'node:child_process');return {spawnSync:(...args)=>{invocation=args;return {status:0};}};}});
 assert.equal(exit,0);assert.equal(invocation[0],'portable-node');assert.equal(invocation[2].stdio,'inherit');return Array.from(invocation[1]);
}
try{
 for(const client of ['codex','claude']){
  const target=config(client);fs.mkdirSync(join(project,client==='codex'?'.codex':'.claude'));
  const existing={permissions:{allow:['Read(*)']},hooks:{Stop:[{matcher:'',hooks:[{type:'command',command:'echo existing'}]}],Custom:[{hooks:[]}]}};
  fs.writeFileSync(target,JSON.stringify(existing));
  if(client==='codex')fs.writeFileSync(join(project,'.codex','config.toml'),'model = "unchanged"\n');
  const before=fs.readFileSync(target,'utf8');const result=configureHooks('install',project,client);
  assert.equal(result.changed,true);assert.equal(result.state,'installed');assert.equal(result.runtimeVerified,false);assert.equal(result.backups.length,1);
  assert.equal(fs.readFileSync(result.backups[0],'utf8'),before);
  if(process.platform!=='win32')assert.equal(fs.statSync(result.backups[0]).mode&0o777,0o600);
  let value=read(target);assert.deepEqual(value.permissions,existing.permissions);assert.deepEqual(value.hooks.Custom,existing.hooks.Custom);assert.deepEqual(value.hooks.Stop[0],existing.hooks.Stop[0]);
  const bytes=fs.readFileSync(target,'utf8'),backups=fs.readdirSync(join(support,'hooks','backups')).length;
  assert.equal(configureHooks('install',project,client).changed,false);assert.equal(fs.readFileSync(target,'utf8'),bytes);assert.equal(fs.readdirSync(join(support,'hooks','backups')).length,backups);
  // A new user handler in our group survives uninstall.
  value=read(target);value.hooks.Stop.at(-1).hooks.push({type:'command',command:'echo after-install'});value.newUserKey={keep:true};fs.writeFileSync(target,JSON.stringify(value));
  const removed=configureHooks('remove',project,client);assert.equal(removed.state,'absent');assert.equal(removed.changed,true);
  value=read(target);assert.deepEqual(value.permissions,existing.permissions);assert.deepEqual(value.newUserKey,{keep:true});assert.deepEqual(value.hooks.Stop.flatMap(g=>g.hooks).map(h=>h.command),['echo existing','echo after-install']);
  const after=fs.readFileSync(target,'utf8');assert.equal(configureHooks('remove',project,client).changed,false);assert.equal(fs.readFileSync(target,'utf8'),after);
 }
 assert.equal(fs.readFileSync(join(project,'.codex','config.toml'),'utf8'),'model = "unchanged"\n');
 assert.equal(fs.readFileSync(pref,'utf8'),preference,'安装和卸载不能开启日志偏好');
 const fresh=join(dir,'fresh');fs.mkdirSync(fresh);configureHooks('install',fresh,'claude');configureHooks('remove',fresh,'claude');assert.equal(fs.existsSync(join(fresh,'.claude','settings.local.json')),false);
 // Existing empty settings are preserved rather than removed.
 fs.writeFileSync(join(fresh,'.claude','settings.local.json'),'{}');configureHooks('install',fresh,'claude');configureHooks('remove',fresh,'claude');assert.deepEqual(read(join(fresh,'.claude','settings.local.json')),{});
 const untouched=fs.readdirSync(project);assert.throws(()=>configureHooks('install',project,'workbuddy'),/仅支持 render/);assert.deepEqual(fs.readdirSync(project),untouched);
 assert.equal(hookStatus(project,'workbuddy').runtimeVerified,false);assert.deepEqual(Object.keys(renderHooks(project,'workbuddy').hooks),['UserPromptSubmit','PreToolUse','PostToolUse','Stop']);
 assert.ok(!Object.hasOwn(renderHooks(project,'codex').hooks,'PostToolUseFailure'));assert.ok(Object.hasOwn(renderHooks(project,'codex').hooks,'Interrupt'));
 assert.ok(Object.hasOwn(renderHooks(project,'claude').hooks,'StopFailure'));assert.ok(Object.hasOwn(renderHooks(project,'claude').hooks,'PostToolUseFailure'));
 // Neither POSIX shell substitutions nor Windows metacharacters enter commands.
 const unusual=join(dir,process.platform==='win32'?"spaces & quotes ' !":"spaces ' $() ` & ;");fs.mkdirSync(unusual);
 for(const client of ['codex','claude','workbuddy']){
  const rendered=renderHooks(unusual,client),handler=rendered.hooks.Stop[0].hooks[0],argv=runCommand(handler);
  assert.deepEqual(argv.slice(1),['--project',fs.realpathSync(unusual),'--client',client]);
  assert.equal(argv[0],fileURLToPath(new URL('../support/hooks/capture.mjs',import.meta.url)));assert.ok(!handler.command.includes(unusual));
  if(client==='codex')assert.equal(handler.commandWindows,handler.command);
 }
 // CLI render is raw settings JSON, ready for isolated --settings; no writes.
 const cli=fileURLToPath(new URL('../support/hooks/configure.mjs',import.meta.url));
 const rendered=spawnSync(process.execPath,[cli,'render','--project',project,'--client','claude'],{encoding:'utf8'});assert.equal(rendered.status,0,rendered.stderr);assert.deepEqual(JSON.parse(rendered.stdout),renderHooks(project,'claude'));
 assert.match(main(['render','--project',project,'--client','codex','--format','toml']),/^hooks = \{/);
 assert.throws(()=>projectPath('.'),/绝对路径/);assert.throws(()=>renderHooks(project,'unknown'),/--client/);assert.throws(()=>main(['install','--project',project,'--client','codex','--format','json']),/仅用于 render/);
 // Deterministically edit the target after atomic's temp write. The late user
 // change must survive, the registration must not be claimed, and temp cleaned.
 const raceProject=join(dir,'concurrent');fs.mkdirSync(join(raceProject,'.claude'),{recursive:true});const raceFile=join(raceProject,'.claude','settings.local.json');
 fs.writeFileSync(raceFile,'{"original":true}');const realRaceFile=fs.realpathSync(raceFile),write=fs.writeFileSync,userText='{"userEdit":"after-temp-write","hooks":{}}';let injected=false;
 fs.writeFileSync=function(file,...args){const result=Reflect.apply(write,this,[file,...args]);if(String(file).startsWith(realRaceFile+'.gacui-')&&String(file).endsWith('.tmp')){Reflect.apply(write,this,[raceFile,userText]);injected=true;}return result;};
 try{assert.throws(()=>configureHooks('install',raceProject,'claude'),/其他进程修改/);}finally{fs.writeFileSync=write;}
 assert.equal(injected,true);assert.equal(fs.readFileSync(raceFile,'utf8'),userText);assert.deepEqual(fs.readdirSync(join(raceProject,'.claude')),['settings.local.json']);assert.equal(hookStatus(raceProject,'claude').state,'absent');
 // Ownership is a write-ahead record, so a failed settings commit is recoverable.
 assert.equal(hookStatus(raceProject,'claude').managed,true);assert.equal(configureHooks('install',raceProject,'claude').state,'installed');configureHooks('remove',raceProject,'claude');assert.equal(read(raceFile).userEdit,'after-temp-write');
 // Full disk when saving ownership must leave the project unchanged. Failure
 // when saving settings must leave ownership usable by retry and by uninstall.
 const failProject=join(dir,'manifest-failure');fs.mkdirSync(join(failProject,'.claude'),{recursive:true});const failFile=join(failProject,'.claude','settings.local.json');fs.writeFileSync(failFile,'{"preserve":"mine"}');
 const originalFail=fs.readFileSync(failFile,'utf8');
 fs.writeFileSync=function(file,...args){if(String(file).includes(join('hooks','registrations'))&&String(file).endsWith('.tmp'))throw Object.assign(Error('injected full disk'),{code:'ENOSPC'});return Reflect.apply(write,this,[file,...args]);};
 try{assert.throws(()=>configureHooks('install',failProject,'claude'),/injected full disk/);}finally{fs.writeFileSync=write;}
 assert.equal(fs.readFileSync(failFile,'utf8'),originalFail);assert.equal(hookStatus(failProject,'claude').managed,false);assert.equal(configureHooks('install',failProject,'claude').state,'installed');configureHooks('remove',failProject,'claude');
 const realFailFile=fs.realpathSync(failFile);
 fs.writeFileSync=function(file,...args){if(String(file).startsWith(realFailFile+'.gacui-')&&String(file).endsWith('.tmp'))throw Object.assign(Error('injected settings full disk'),{code:'ENOSPC'});return Reflect.apply(write,this,[file,...args]);};
 try{assert.throws(()=>configureHooks('install',failProject,'claude'),/injected settings full disk/);}finally{fs.writeFileSync=write;}
 assert.equal(hookStatus(failProject,'claude').managed,true);assert.equal(hookStatus(failProject,'claude').state,'absent');configureHooks('remove',failProject,'claude');assert.equal(hookStatus(failProject,'claude').managed,false);assert.equal(read(failFile).preserve,'mine');
 // An interrupted upgrade must retain ownership of the previous executable's
 // handlers as well as the new version, until the settings commit succeeds.
 const upgradeProject=join(dir,'upgrade');fs.mkdirSync(join(upgradeProject,'.claude'),{recursive:true});const upgradeFile=join(upgradeProject,'.claude','settings.local.json');fs.writeFileSync(upgradeFile,'{"userField":"keep"}');
 const registrationFor=projectPath=>fs.readdirSync(join(support,'hooks','registrations')).map(name=>join(support,'hooks','registrations',name)).find(path=>path.endsWith('.json')&&read(path).project===fs.realpathSync(projectPath));
 function installLegacy(){
  configureHooks('install',upgradeProject,'claude');const registration=registrationFor(upgradeProject),manifest=read(registration),settings=read(upgradeFile);
  for(const entry of manifest.handlers){const prior=entry.handler;const group=settings.hooks[entry.event].find(g=>g.hooks.some(h=>JSON.stringify(h)===JSON.stringify(prior)));const index=group.hooks.findIndex(h=>JSON.stringify(h)===JSON.stringify(prior));const legacy={...prior,command:prior.command+' ',statusMessage:prior.statusMessage+' legacy'};group.hooks[index]=legacy;entry.handler=legacy;}
  fs.writeFileSync(registration,JSON.stringify(manifest));fs.writeFileSync(upgradeFile,JSON.stringify(settings));return registration;
 }
 for(const recovery of ['remove','retry','finalize']){
  const registration=installLegacy(),legacy=read(registration),priorSettings=fs.readFileSync(upgradeFile,'utf8'),realUpgrade=fs.realpathSync(upgradeFile),realRegistration=fs.realpathSync(registration);
  let manifestWrites=0;
  fs.writeFileSync=function(file,...args){const path=String(file);if(recovery==='finalize'&&path.startsWith(realRegistration+'.gacui-')&&path.endsWith('.tmp')&&++manifestWrites===2)throw Error('injected upgrade finalize failure');if(recovery!=='finalize'&&path.startsWith(realUpgrade+'.gacui-')&&path.endsWith('.tmp'))throw Error('injected upgrade settings failure');return Reflect.apply(write,this,[file,...args]);};
  try{assert.throws(()=>configureHooks('install',upgradeProject,'claude'),/injected upgrade (settings|finalize) failure/);}finally{fs.writeFileSync=write;}
  if(recovery==='finalize')assert.equal(hookStatus(upgradeProject,'claude').state,'installed');else assert.equal(fs.readFileSync(upgradeFile,'utf8'),priorSettings);const pending=read(registration);assert.equal(pending.handlers.length,legacy.handlers.length*2);assert.ok(legacy.handlers.every(h=>pending.handlers.some(p=>JSON.stringify(h)===JSON.stringify(p))));
  if(recovery==='retry'){assert.equal(configureHooks('install',upgradeProject,'claude').state,'installed');assert.equal(read(registration).handlers.length,legacy.handlers.length);}
  configureHooks('remove',upgradeProject,'claude');assert.deepEqual(read(upgradeFile),{userField:'keep'});
 }
 // Invalid JSON/structure is never overwritten, even if install was requested.
 const corrupt=config('claude');fs.writeFileSync(corrupt,'{broken');assert.throws(()=>configureHooks('install',project,'claude'),/有效 JSON/);assert.equal(fs.readFileSync(corrupt,'utf8'),'{broken');
 fs.writeFileSync(corrupt,'{"hooks":{"Stop":{}}}');assert.throws(()=>configureHooks('install',project,'claude'),/结构无效/);
 // Refuse config symlinks (including dangling links) rather than editing elsewhere.
 if(process.platform!=='win32'){
  fs.unlinkSync(corrupt);const outside=join(dir,'outside-settings.json');fs.writeFileSync(outside,'{}');fs.symlinkSync(outside,corrupt);assert.throws(()=>configureHooks('install',project,'claude'),/符号链接/);assert.equal(fs.readFileSync(outside,'utf8'),'{}');fs.unlinkSync(corrupt);
  fs.symlinkSync(join(dir,'missing.json'),corrupt);assert.throws(()=>configureHooks('install',project,'claude'),/符号链接/);fs.unlinkSync(corrupt);
  const alias=join(dir,'project-alias');fs.symlinkSync(project,alias);assert.equal(projectPath(alias),fs.realpathSync(project));assert.deepEqual(renderHooks(alias,'codex'),renderHooks(project,'codex'));
 }
 process.env.GAC_SUPPORT_HOME=join(project,'.private');assert.throws(()=>configureHooks('install',project,'codex'),/项目之外/);process.env.GAC_SUPPORT_HOME=support;
 console.log('hook configure passed: project-only merge/remove, idempotence, private backups, preference preservation, safe argv, render, schema events, symlink rejection');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
