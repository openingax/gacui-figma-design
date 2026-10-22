// 使用者/设备资料：内部试用排查用，接入成功后随设备上报。只读本机可见信息，不读凭据。
import fs from 'node:fs';
import os from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {supportHome} from './client.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const git=args=>{try{return execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:2000}).trim()||null}catch{return null}};
const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return null}};
const failureFile=()=>join(supportHome(),'connect-failures.json');
// agent 客户端只取相关环境变量名、少数无敏感值的标识，以及祖先进程的程序名（不含参数）。
const AGENT_ENV=/^(CLAUDECODE|CLAUDE_CODE_|CODEX_|CURSOR_|VSCODE_|WINDSURF_|TERM_PROGRAM)|(AGENT|BUDDY|CLAUDE|CODEX|CURSOR|COPILOT|GEMINI|TRAE|QODER|WINDSURF|ZED|OPENCODE|AIDER|KIRO|CLINE)/i;
const AGENT_VALUES=['CLAUDE_CODE_ENTRYPOINT','TERM_PROGRAM','TERM_PROGRAM_VERSION','__CFBundleIdentifier'];
function ancestors(){
 if(process.platform==='win32')return [];
 const names=[];let pid=process.ppid;
 for(let depth=0;depth<6&&pid>1;depth++){
  try{const [ppid,...comm]=execFileSync('ps',['-o','ppid=,comm=','-p',String(pid)],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:1000}).trim().split(/\s+/);names.push(comm.join(' ').split('/').pop().slice(0,80));pid=Number(ppid);}
  catch{break}
 }
 return names;
}
export function collectProfile(){
 let osUser=null;try{osUser=os.userInfo().username}catch{}
 const names=Object.keys(process.env).filter(k=>AGENT_ENV.test(k)).sort().slice(0,40);
 return {
  schema:1,
  osUser,hostname:os.hostname(),
  gitName:git(['config','--get','user.name']),gitEmail:git(['config','--get','user.email']),
  platform:process.platform,arch:process.arch,osRelease:os.release(),osVersion:typeof os.version==='function'?os.version():null,
  cpus:os.cpus().length,memoryGiB:Math.round(os.totalmem()/1073741824),locale:Intl.DateTimeFormat().resolvedOptions().locale,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,
  node:process.version,skillVersion:read(join(root,'skill-release.json'))?.version??null,build:git(['rev-parse','HEAD']),
  agent:{envNames:names,processes:ancestors(),...Object.fromEntries(AGENT_VALUES.filter(k=>process.env[k]).map(k=>[k,String(process.env[k]).slice(0,100)]))},
  connectFailures:read(failureFile())??[]
 };
}
export function recordConnectFailure(error){
 try{fs.mkdirSync(supportHome(),{recursive:true,mode:0o700});const list=[...(read(failureFile())??[]),{at:new Date().toISOString(),error:String(error).slice(0,300)}].slice(-20);fs.writeFileSync(failureFile(),JSON.stringify(list),{mode:0o600});}catch{}
}
export function clearConnectFailures(){fs.rmSync(failureFile(),{force:true});}
