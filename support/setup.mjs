#!/usr/bin/env node
// 维护者一次性安装。令牌只写私有文件，绝不打印到终端或嵌入草稿。
import fs from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const [cmd,targetArg,outArg]=process.argv.slice(2),source=dirname(fileURLToPath(import.meta.url));
const write=(p,data)=>fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
try {
 if(!targetArg)throw Error('用法：server <独立服务目录> | enroll <服务目录> <新客户端配置文件> | client <配置文件>');
 const target=resolve(targetArg);
 if(cmd==='client') {
  if(outArg&&outArg!=='--enable-tuning')throw Error('client 仅支持 --enable-tuning 可选参数');
  const {config,configPath,setAutoUpload}=await import('./client.mjs');if(!config(target))throw Error('上传配置不存在');
  const dest=resolve(configPath());fs.mkdirSync(dirname(dest),{recursive:true,mode:0o700});
  fs.copyFileSync(target,dest,fs.constants.COPYFILE_EXCL);fs.chmodSync(dest,0o600);
  if(outArg==='--enable-tuning'){setAutoUpload(true,{collection:'tuning',authorization:'explicit-tuning-configuration'});console.log('上传凭据已配置，按显式配置开启详细调优日志。');}else{setAutoUpload(false,{ask:true,collection:'basic',authorization:null});console.log('上传凭据已配置，自动上传保持关闭。可按项目已有授权开启调优日志。');}
 } else if(cmd==='server') {
  if(fs.existsSync(target))throw Error('服务目录已存在，请使用审核后的发布流程更新，避免覆盖数据或配置');
  for(const dir of ['app','data','logs','private'])fs.mkdirSync(join(target,dir),{recursive:true,mode:0o700});
  for(const name of ['server.mjs','protocol.mjs','manage.mjs','analyze.mjs','diagnose.mjs'])fs.copyFileSync(join(source,name),join(target,'app',name));
  const token=randomBytes(32).toString('hex');let build='unknown';try{build=execFileSync('git',['rev-parse','HEAD'],{cwd:source,encoding:'utf8'}).trim()}catch{}
  write(join(target,'private','collector.json'),{dataDir:join(target,'data'),port:5186,tokenHashes:[createHash('sha256').update(token).digest('hex')],ticketSecret:randomBytes(32).toString('hex'),build,maxBytes:256*1024*1024});
  write(join(target,'private','first-client.json'),{endpoint:'http://127.0.0.1:5186',token});
  const plist=`<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>org.gacuiagent.public.logs</string><key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(target,'app','server.mjs'))}</string></array><key>EnvironmentVariables</key><dict><key>GAC_COLLECTOR_CONFIG</key><string>${xml(join(target,'private','collector.json'))}</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>5</integer><key>StandardOutPath</key><string>${xml(join(target,'logs','service.log'))}</string><key>StandardErrorPath</key><string>${xml(join(target,'logs','error.log'))}</string></dict></plist>`;
  fs.writeFileSync(join(target,'org.gacuiagent.public.logs.plist'),plist,{flag:'wx',mode:0o600});
  console.log('独立服务已准备，监听 127.0.0.1:5186。私有配置位于服务目录 private/。需安装 LaunchAgent 并配置域名隧道后验证。');
 } else if(cmd==='enroll') {
  if(!outArg)throw Error('需要新客户端配置文件路径');
  const p=join(target,'private','collector.json'),c=JSON.parse(fs.readFileSync(p,'utf8')),token=randomBytes(32).toString('hex');
  write(resolve(outArg),{endpoint:'http://127.0.0.1:5186',token});
  c.tokenHashes.push(createHash('sha256').update(token).digest('hex'));const tmp=p+'.tmp';write(tmp,c);fs.renameSync(tmp,p);
  console.log('已生成新客户端配置；重启日志服务加载新增凭据。请通过私有渠道配置试用电脑。');
 } else throw Error('未知命令');
} catch(e){console.error(e.message);process.exitCode=1;}
