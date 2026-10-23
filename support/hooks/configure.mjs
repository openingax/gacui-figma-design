import fs from 'node:fs';
import {join,resolve,dirname,basename,isAbsolute,relative,sep} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {isMain} from '../entry.mjs';

// Source schemas: https://learn.chatgpt.com/docs/hooks and
// https://code.claude.com/docs/en/hooks (checked 2026-10-23).
// WorkBuddy's project settings discovery has not been verified: render only.
const EVENTS={
 codex:['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop','Interrupt','SessionEnd'],
 claude:['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','Stop','StopFailure','SessionEnd'],
 workbuddy:['UserPromptSubmit','PreToolUse','PostToolUse','Stop']
};
const PATHS={codex:['.codex','hooks.json'],claude:['.claude','settings.local.json'],workbuddy:['.workbuddy','settings.local.json']};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const inside=(root,path)=>{const r=relative(root,path);return r===''||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
function destination(path){
 path=resolve(path);if(fs.existsSync(path))return fs.realpathSync(path);
 const parent=dirname(path);return parent===path?path:join(destination(parent),basename(path));
}
const home=()=>destination(process.env.GAC_SUPPORT_HOME||join(homedir(),'.gacuiagent-public','support'));
const capture=resolve(dirname(fileURLToPath(import.meta.url)),'capture.mjs');

export function projectPath(project){
 if(typeof project!=='string'||!isAbsolute(project))throw Error('--project 必须是现有项目的绝对路径');
 const path=fs.realpathSync(project);if(!fs.statSync(path).isDirectory())throw Error('--project 必须是目录');return path;
}
function identity(project,client){
 if(!Object.hasOwn(EVENTS,client))throw Error('--client 必须为 codex、claude 或 workbuddy');
 return createHash('sha256').update(project+'\0'+client).digest('hex');
}
function marker(project,client){return 'GACUIAgent diagnostics '+identity(project,client).slice(0,24);}
export function renderHooks(project,client){
 project=projectPath(project);identity(project,client);
 // Only base64 and fixed JavaScript enter the shell. No project, script, stdin,
 // or environment text is shell-interpolated; Node launches capture via argv.
 // This command also works with cmd.exe/PowerShell on Windows with node on PATH.
 const argv=Buffer.from(JSON.stringify([capture,'--project',project,'--client',client])).toString('base64');
 const js="const a=JSON.parse(Buffer.from('"+argv+"','base64').toString());const r=require('node:child_process').spawnSync(process.execPath,a,{stdio:'inherit'});process.exit(r.status===null?1:r.status)";
 const command='node -e "'+js+'"';
 return {hooks:Object.fromEntries(EVENTS[client].map(event=>[event,[{hooks:[{type:'command',command,...(client==='codex'?{commandWindows:command}:{}),timeout:3,statusMessage:marker(project,client)+' '+event}]}]]))};
}
function targetPath(project,client){
 const target=join(project,...PATHS[client]);
 // Never follow a local settings symlink into global or another project's config.
 for(let path=target;path!==project;path=dirname(path)){
  const stat=fs.lstatSync(path,{throwIfNoEntry:false});
  if(stat?.isSymbolicLink())throw Error('项目 hook 配置及父目录不可为符号链接');
  if(stat&&!inside(project,fs.realpathSync(path)))throw Error('hook 配置不在当前项目内');
 }
 return target;
}
function read(file){
 if(!fs.existsSync(file))return {raw:null,value:{}};
 const raw=fs.readFileSync(file,'utf8');let value;try{value=JSON.parse(raw);}catch{throw Error('现有 hook 配置不是有效 JSON，未修改');}
 if(!object(value)||(value.hooks!==undefined&&!object(value.hooks)))throw Error('现有 hooks 结构无效，未修改');
 if(value.hooks)for(const groups of Object.values(value.hooks))if(!Array.isArray(groups)||groups.some(g=>!object(g)||!Array.isArray(g.hooks)))throw Error('现有 hook 分组结构无效，未修改');
 return {raw,value};
}
function statePath(project,client){return join(home(),'hooks','registrations',identity(project,client)+'.json');}
function readState(project,client){
 const file=statePath(project,client);if(!fs.existsSync(file))return null;
 const state=JSON.parse(fs.readFileSync(file,'utf8'));
 if(state.schema!==1||state.project!==project||state.client!==client||!Array.isArray(state.handlers))throw Error('本机 hook 注册记录不匹配，未修改');
 return state;
}
function privateDir(path){fs.mkdirSync(path,{recursive:true,mode:0o700});fs.chmodSync(path,0o700);}
function atomic(file,text,expected){
 if((fs.existsSync(file)?fs.readFileSync(file,'utf8'):null)!==expected)throw Error('配置已被其他进程修改，请重新检查');
 const temp=file+'.gacui-'+randomUUID()+'.tmp';
 try{
  fs.writeFileSync(temp,text,{flag:'wx',mode:0o600});
  // Another editor does not participate in our installer lock. Recheck after
  // writing the temporary file to detect intervening changes before rename.
  if((fs.existsSync(file)?fs.readFileSync(file,'utf8'):null)!==expected)throw Error('配置已被其他进程修改，请重新检查');
  fs.renameSync(temp,file);
 }finally{fs.rmSync(temp,{force:true});}
}
function owned(handler,state,event){return state?.handlers.some(h=>h.event===event&&same(h.handler,handler))===true;}
function strip(value,state){
 if(!state||!value.hooks)return value;
 const hooks={};
 for(const [event,groups] of Object.entries(value.hooks)){
  const kept=groups.flatMap(group=>{const handlers=group.hooks.filter(h=>!owned(h,state,event));return handlers.length?[{...group,hooks:handlers}]:group.hooks.length===0?[group]:[];});
  if(kept.length||groups.length===0)hooks[event]=kept;
 }
 const output={...value};if(Object.keys(hooks).length)output.hooks=hooks;else delete output.hooks;return output;
}
export function hookStatus(project,client){
 project=projectPath(project);identity(project,client);const target=targetPath(project,client),{value}=read(target),state=readState(project,client);
 const expected=renderHooks(project,client),found=Object.entries(expected.hooks).filter(([event,groups])=>value.hooks?.[event]?.some(g=>g.hooks.some(h=>same(h,groups[0].hooks[0])))).map(([event])=>event);
 return {project,client,configurationPath:target,state:found.length===EVENTS[client].length?'installed':found.length?'partial':'absent',registered:found.length,expected:EVENTS[client].length,events:found,managed:!!state,runtimeVerified:false,
  notice:client==='codex'?'仅检查配置；需在受信任项目中通过 /hooks 审阅，未修改 features 或信任。':client==='workbuddy'?'候选配置，WorkBuddy 配置位置与运行能力未实测；不可安装。':'仅检查配置，不代表当前会话已加载或真实 hook 已触发。'};
}
export function configureHooks(action,project,client){
 project=projectPath(project);identity(project,client);
 if(action==='status')return hookStatus(project,client);
 if(!['install','remove'].includes(action))throw Error('操作必须为 install、status、remove 或 render');
 if(client==='workbuddy')throw Error('WorkBuddy 项目 hook 接口未实测；仅支持 render 候选配置，不写入项目。');
 if(action==='install'&&!fs.statSync(capture,{throwIfNoEntry:false})?.isFile())throw Error('缺少同目录 capture.mjs，未安装 hook');
 if(inside(project,home()))throw Error('GAC_SUPPORT_HOME 必须位于项目之外，避免本机配置备份进入仓库');
 const target=targetPath(project,client),registration=statePath(project,client);
 privateDir(dirname(registration));const lock=registration+'.lock';let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw Error('此项目的 hook 配置正在操作，请稍后重试');throw e;}
 try{
  const old=read(target),state=readState(project,client);
  if(action==='remove'&&!state)return {...hookStatus(project,client),changed:false};
  let next=strip(old.value,state);const rendered=renderHooks(project,client);
  if(action==='install'){
   next={...next,hooks:{...next.hooks}};
   for(const [event,groups] of Object.entries(rendered.hooks)){
    const existing=next.hooks[event]??[];
    // An identical unowned hook may be user-authored: do not claim/remove it.
    if(existing.some(g=>g.hooks.some(h=>same(h,groups[0].hooks[0]))))throw Error('存在相同但不属于本安装器的 hook，未修改');
    next.hooks[event]=[...existing,...groups];
   }
  }
  const changed=!same(old.value,next),backups=[];
  let installedManifest=null;
  // Persist ownership before touching settings. If this write fails, settings
  // remain untouched; if the later settings write fails, retry/remove can use
  // this recoverable record. Status always checks the actual settings as well.
  if(action==='install'){
   installedManifest={schema:1,project,client,target,createdFile:state?.createdFile??old.raw===null,handlers:Object.entries(rendered.hooks).flatMap(([event,groups])=>groups.flatMap(g=>g.hooks.map(handler=>({event,handler}))))};
   // An upgrade may change executable paths or command format. Until settings
   // commit, retain both old and new ownership so a failed upgrade is removable.
   const handlers=[...(state?.handlers??[]),...installedManifest.handlers].filter((handler,index,all)=>all.findIndex(other=>same(other,handler))===index);
   const manifest={...installedManifest,handlers};
   const previous=fs.existsSync(registration)?fs.readFileSync(registration,'utf8'):null,text=JSON.stringify(manifest,null,2)+'\n';if(previous!==text)atomic(registration,text,previous);
  }
  if(changed){
   if(old.raw!==null){const dir=join(home(),'hooks','backups');privateDir(dir);const backup=join(dir,identity(project,client)+'-'+Date.now()+'-'+randomUUID()+'.json');fs.writeFileSync(backup,old.raw,{flag:'wx',mode:0o600});backups.push(backup);}
   fs.mkdirSync(dirname(target),{recursive:true,mode:0o700});
   // Preserve original empty files; only remove a file created by this installer.
   if(action==='remove'&&state.createdFile&&Object.keys(next).length===0){
    if(fs.readFileSync(target,'utf8')!==old.raw)throw Error('配置已被其他进程修改，请重新检查');fs.unlinkSync(target);
   }else atomic(target,JSON.stringify(next,null,2)+'\n',old.raw);
  }
  if(action==='install'){
   const previous=fs.readFileSync(registration,'utf8'),text=JSON.stringify(installedManifest,null,2)+'\n';
   if(previous!==text)atomic(registration,text,previous);
  }
  if(action==='remove')fs.rmSync(registration,{force:true});
  return {...hookStatus(project,client),changed,backups};
 }finally{fs.closeSync(fd);fs.rmSync(lock,{force:true});}
}
function toml(value){
 if(Array.isArray(value))return '['+value.map(toml).join(', ')+']';
 if(object(value))return '{ '+Object.entries(value).map(([k,v])=>JSON.stringify(k)+' = '+toml(v)).join(', ')+' }';
 return JSON.stringify(value);
}
export function main(args=process.argv.slice(2)){
 const [action,...rest]=args,options={};
 for(let i=0;i<rest.length;i+=2){if(!['--project','--client','--format'].includes(rest[i])||!rest[i+1]||Object.hasOwn(options,rest[i]))throw Error('用法：install|status|remove|render --project ABS --client codex|claude|workbuddy [--format json|toml]');options[rest[i]]=rest[i+1];}
 if(!options['--project']||!options['--client']||!['install','status','remove','render'].includes(action))throw Error('必须指定操作、--project ABS 与 --client');
 if(action==='render'){
  const value=renderHooks(options['--project'],options['--client']),format=options['--format']??'json';
  if(!['json','toml'].includes(format))throw Error('--format 必须为 json 或 toml');
  if(options['--client']==='workbuddy')console.error('WorkBuddy 仅生成候选配置；项目配置位置及 hook 运行能力未实测，不代表已接入。');
  return format==='toml'?'hooks = '+toml(value.hooks):JSON.stringify(value,null,2);
 }
 if(options['--format'])throw Error('--format 仅用于 render');
 return JSON.stringify(configureHooks(action,options['--project'],options['--client']),null,2);
}
if(isMain(import.meta.url))try{console.log(main());}catch(error){console.error(error.message);process.exitCode=1;}
