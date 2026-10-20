#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile, execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const REPO = 'https://github.com/openingax/gacui-figma-design.git';
const versionPattern = /^\d+\.\d+\.\d+$/;
const compare = (a,b) => { const x=a.split('.').map(Number), y=b.split('.').map(Number); for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]-y[i]; return 0; };
const compatible = (a,b) => a.split('.')[0] === b.split('.')[0] && (a.split('.')[0] !== '0' || a.split('.')[1] === b.split('.')[1]);
function run(args, cwd) { return execFileSync('git', args, {cwd,encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trim(); }
function json(file) { return JSON.parse(fs.readFileSync(file,'utf8')); }
function write(file, value) { const tmp=file+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600}); fs.renameSync(tmp,file); }
function manifest(cwd, ref) {
  const m=JSON.parse(run(['show',`${ref}:skill-release.json`],cwd));
  if(!versionPattern.test(m.version) || m.protocol!==1 || m.channel!=='stable' || !Number.isInteger(m.nodeMajor) || m.nodeMajor>Number(process.versions.node.split('.')[0])) throw Error('发布清单或运行协议不兼容');
  return m;
}
// repo 参数仅供本地集成测试；CLI 不接受远程覆盖。
export function manage({command='sync', workspace=path.join(os.homedir(),'.gacuiagent-public','workspace'), version, acceptBreaking=false, repo=REPO}={}) {
  if(Number(process.versions.node.split('.')[0])<20) throw Error('需要 Node.js 20+');
  if(version && !versionPattern.test(version)) throw Error('版本必须是 X.Y.Z');
  workspace=path.resolve(workspace);
  const stateFile=workspace+'.skill-state.json', lock=workspace+'.skill-lock';
  fs.mkdirSync(path.dirname(workspace),{recursive:true});
  // 锁不自动过期，避免另一进程仍在执行时覆盖；中断后由维护者核实再删除。
  const fd=fs.openSync(lock,'wx'); fs.closeSync(fd);
  let state=fs.existsSync(stateFile)?json(stateFile):{};
  const output={workspace};
  try {
    if(!['sync','status','ack','pin','unpin'].includes(command)) throw Error('未知命令');
    if(fs.existsSync(workspace)) {
      if(!fs.existsSync(path.join(workspace,'.git'))) throw Error('目录已存在但不是受管 Git 目录；请选择新的空路径');
      if(run(['remote','get-url','origin'],workspace)!==repo) throw Error('origin 不符；拒绝更新');
      if(!state.commit) throw Error('目录不是此安装器创建的；保留原目录并选择新路径');
      output.version=manifest(workspace,'HEAD').version;
      output.commit=run(['rev-parse','HEAD'],workspace);
    }
    if(command==='ack') {
      if(!version || version!==output.version) throw Error('只能确认已展示的当前版本');
      state.ack=version;write(stateFile,state);return {...output,acknowledged:version};
    }
    if(command==='pin') {
      if(!version || !output.version || version!==output.version) throw Error('仅可固定当前版本；切换历史版本请安装到新目录');
      state.pin=version;write(stateFile,state);
    }
    if(command==='unpin') { delete state.pin;write(stateFile,state); }
    if(command==='sync') {
      let tags;
      try { tags=run(['ls-remote','--tags',repo,'refs/tags/skill-v*']).split('\n').map(l=>l.match(/refs\/tags\/skill-v(\d+\.\d+\.\d+)$/)?.[1]).filter(Boolean).sort(compare); }
      catch { if(!output.version) throw Error('无法读取公开仓库：请检查网络和发布标签'); output.blocked='无法检查远程版本；继续使用已安装版本'; }
      if(tags) {
        const desired=version || state.pin || tags.at(-1);
        if(!desired || !tags.includes(desired)) throw Error('没有对应正式发布标签');
        output.latest=tags.at(-1);output.available=desired;
        if(state.pin && output.latest!==state.pin) output.blocked=`已固定 ${state.pin}；有新版本 ${output.latest}，解除固定后才更新`;
        if(output.version && desired!==output.version && !compatible(output.version,desired) && !acceptBreaking) output.blocked=`${output.version} → ${desired} 为不兼容系列；阅读更新日志后明确接受再升级`;
        else if(output.version && compare(desired,output.version)<0) output.blocked='回退请使用新的独立目录，不覆盖当前任务';
        else if(desired!==output.version) {
          if(output.version && (run(['status','--porcelain','--untracked-files=no'],workspace) || output.commit!==state.commit)) output.blocked='存在本地代码修改或提交；保留现有版本，请维护者处理';
          else {
            const ref=`refs/tags/skill-v${desired}`;
            if(!output.version) {
              // clone 失败只清理本次临时目录，绝不删除已有用户目录。
              const staging=workspace+'.installing';
              if(fs.existsSync(staging)) throw Error('存在中断安装目录；请维护者检查');
              try {
                run(['clone','--depth','1','--branch',`skill-v${desired}`,'--single-branch',repo,staging]);
                const m=manifest(staging,'HEAD'); if(m.version!==desired) throw Error('标签与版本不一致');
                run(['switch','-c','skill-runtime'],staging);
                fs.renameSync(staging,workspace);
              } catch(e) { fs.rmSync(staging,{recursive:true,force:true}); throw e; }
            } else {
              run(['fetch','--no-tags','origin',`${ref}:${ref}`],workspace);
              if(manifest(workspace,ref).version!==desired) throw Error('标签与版本不一致');
              // 浅克隆升级需要完整祖先；只在已有浅仓库中补全。
              if(run(['rev-parse','--is-shallow-repository'],workspace)==='true') run(['fetch','--unshallow','--no-tags','origin'],workspace);
              run(['merge','--ff-only',ref],workspace);
            }
            state.commit=run(['rev-parse','HEAD'],workspace); state.version=desired;
            // 更新说明只面向升级用户；全新安装没有可对比的旧版本，直接视为已读。
            if(!output.version) state.ack=desired;
            if(version) state.pin=version;
            write(stateFile,state);output.version=desired;output.commit=state.commit;output.updated=true;
          }
        }
      }
    }
    if(output.version && state.ack!==output.version) {
      output.notice={version:output.version,summary:manifest(workspace,'HEAD').notice,changelog:path.join(workspace,'CHANGELOG.md')};
    }
    if(state.pin) output.pinned=state.pin;
    return output;
  } finally { fs.unlinkSync(lock); }
}
// 在已安装运行目录执行日志接入；失败只报告，不阻断草稿。endpoint 仅供本地集成测试。
export async function connectLogging(workspace, {disable=false, endpoint}={}) {
  const script=path.join(workspace,'support',disable?'cli.mjs':'connect.mjs');
  if(!fs.existsSync(script)) return {state:'unavailable',reason:'当前运行版本不含日志接入'};
  const r=await new Promise(done=>execFile(process.execPath,disable?[script,'auto-upload','off']:[script,...(endpoint?[endpoint]:[])],{cwd:workspace,encoding:'utf8',timeout:30000},(error,stdout,stderr)=>done({error,stdout,stderr})));
  if(disable) return r.error?{state:'connection-failed',error:'关闭日志失败'}:{state:'disabled',reason:'explicit-user-choice'};
  try { return JSON.parse((r.error?r.stderr:r.stdout).trim().split('\n').at(-1)); } catch { return {state:'connection-failed',error:r.error?.killed?'timeout':'无法读取接入结果'}; }
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const args=process.argv.slice(2), options={command:args.shift()||'sync'};
    let noLogging=false;
    while(args.length) { const key=args.shift(); if(key==='--accept-breaking') options.acceptBreaking=true;
      else if(key==='--no-logging') noLogging=true;
      else if(['--workspace','--version'].includes(key) && args.length) options[key.slice(2)]=args.shift();
      else throw Error('参数不支持或缺少值'); }
    const output=manage(options);
    if(options.command==='sync' && output.version) output.logging=await connectLogging(output.workspace,{disable:noLogging});
    console.log(JSON.stringify(output,null,2));
  } catch(e) { console.error(JSON.stringify({error:e.code==='EEXIST'?'另一接入进程或残留锁存在；核实后再试':(e.status!==undefined?'Git 操作失败；已保留现场，请检查权限、网络或合并冲突':e.message)})); process.exitCode=1; }
}
