#!/usr/bin/env node
// 一次性桥接：只快进已有 Git 目录；不复制、删除或重建用户任务和配置。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import known from './legacy-entry-hashes.json' with {type:'json'};
export const LEGACY='https://github.com/openingax/gacui-figma-design.git';
export const TARGET='https://gitee.com/xieliying/gacui-figma-design.git';
const sha=s=>createHash('sha256').update(s).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2)+'\n',{mode:0o600});fs.renameSync(p+'.tmp',p);};
const skillPath='.agents/skills/gacui-figma-design';
// URL override is for isolated integration tests only; the CLI exposes no override.
export function migrate({workspace,entry,repo=TARGET,legacy=LEGACY}={}) {
 if(!workspace||!entry)throw Error('必须提供 --workspace 原运行目录 和 --entry 原 Skill 目录');
 workspace=fs.realpathSync(workspace);entry=fs.realpathSync(entry);
 const git=(...args)=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim();
 const stateFile=workspace+'.skill-state.json',journalFile=workspace+'.gitee-migration.json',lock=workspace+'.skill-lock';
 // 与 sync 共用锁；失败不猜测是否可以接管，用户可按管理器的锁恢复规则处理。
 fs.writeFileSync(lock,JSON.stringify({pid:process.pid,hostname:os.hostname(),startedAt:new Date().toISOString()}),{flag:'wx'});
 try {
  const state=read(stateFile),origin=git('config','--get','remote.origin.url');
  if(![legacy,repo].includes(origin))throw Error('origin 不符；拒绝迁移');
  if(state.pin)throw Error('已固定版本；保留固定选择，用户明确解除后才能迁移');
  if(git('status','--porcelain','--untracked-files=no'))throw Error('存在本地代码修改；保留现场');
  let journal=fs.existsSync(journalFile)?read(journalFile):null;
  const head=git('rev-parse','HEAD');
  if(head!==state.commit && !(journal && head===journal.targetCommit && state.commit===journal.originalCommit))throw Error('存在本地提交或状态不符；保留现场');
  const manager=path.join(entry,'scripts/manage.mjs'),inline=entry===fs.realpathSync(path.join(workspace,skillPath));
  const wrapper=`#!/usr/bin/env node\n// Gitee migration: preserve the existing runtime and all local configuration.\nimport {execFileSync} from 'node:child_process';\nconst workspace=${JSON.stringify(workspace)};\nconst args=process.argv.slice(2);\ntry { execFileSync(process.execPath,[workspace+${JSON.stringify('/'+skillPath+'/scripts/manage.mjs')},...args,...(args.includes('--workspace')?[]:['--workspace',workspace])],{stdio:'inherit'}); } catch(e) { process.exitCode=e.status||1; }\n`;
  const current=fs.readFileSync(manager,'utf8');
  if(!inline && current!==wrapper && !known.manager.includes(sha(current.replace(/\r\n/g,'\n'))))throw Error('Skill 入口有未知修改；不覆盖，请维护者核对');
  if(journal && (journal.entry!==entry||journal.repository!==repo||journal.workspace!==workspace))throw Error('迁移记录与本次目录不符');
  if(journal?.complete){if(origin!==repo||current!==wrapper&&!inline)throw Error('已迁移配置发生变化；请维护者核对');return {workspace,entry,version:state.version,migrated:true,alreadyComplete:true,repository:repo};}
  // 固定桥接目标，未来更新由 Gitee 的正常 sync 负责。
  const ref='refs/tags/skill-v1.2.3';
  git('fetch','--no-tags',repo,ref);
  const targetCommit=git('rev-parse','FETCH_HEAD');
  const release=JSON.parse(git('show',`${targetCommit}:skill-release.json`));
  if(release.version!=='1.2.3'||release.protocol!==1||release.channel!=='stable'||release.nodeMajor>Number(process.versions.node.split('.')[0]))throw Error('Gitee 目标版本或协议不符');
  if(journal && journal.targetCommit!==targetCommit)throw Error('已记录的迁移目标发生变化');
  if(git('rev-parse','--is-shallow-repository')==='true')git('fetch','--unshallow','--no-tags',repo);
  git('merge-base','--is-ancestor',head,targetCommit);
  // Git 自身保护与目标文件冲突的未跟踪文件；不用 reset、clean 或强制 checkout。
  if(!journal){journal={workspace,entry,repository:repo,originalCommit:head,targetCommit,complete:false};write(journalFile,journal);}
  if(!inline && current!==wrapper){
   const backup=manager+'.pre-gitee-backup';
   if(fs.existsSync(backup)&&sha(fs.readFileSync(backup))!==sha(current))throw Error('入口备份已存在且内容不符');
   if(!fs.existsSync(backup))fs.writeFileSync(backup,current,{flag:'wx',mode:0o600});
  }
  git('merge','--ff-only',targetCommit);
  // 断电后可用同一命令恢复：journal 允许已快进但 state 尚未写入的 HEAD。
  git('remote','set-url','origin',repo);
  if(!inline && current!==wrapper){fs.writeFileSync(manager+'.gitee-tmp',wrapper);fs.renameSync(manager+'.gitee-tmp',manager);}
  state.commit=targetCommit;state.version='1.2.3';state.migration={repository:repo,from:legacy,workspace};write(stateFile,state);
  journal.complete=true;write(journalFile,journal);
  return {workspace,entry,version:state.version,migrated:true,repository:repo,notice:'已原位切换至 Gitee；草稿、配置、日志偏好沿用。继续从原 Skill 入口 sync，并展示 V1.2.3 更新说明后 ack。'};
 } finally {fs.unlinkSync(lock);}
}
if(process.argv[1] && fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url))){
 try {const args=process.argv.slice(2),options={};while(args.length){const k=args.shift();if(!['--workspace','--entry'].includes(k)||!args.length)throw Error('仅支持 --workspace 和 --entry');options[k.slice(2)]=args.shift();}console.log(JSON.stringify(migrate(options),null,2));}
 catch(e){console.error(JSON.stringify({error:e.status!==undefined?'Git 操作失败，未删除用户数据；检查网络/文件冲突后以同一迁移命令恢复':e.message}));process.exitCode=1;}
}
