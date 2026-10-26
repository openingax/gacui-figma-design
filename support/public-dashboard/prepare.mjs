#!/usr/bin/env node
// 仅白名单打包，不复制本机配置、凭据或原始日志。
import fs from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),dest=resolve(process.argv[2]);
if(fs.existsSync(dest))throw Error('目标目录已存在，请指定新目录');
fs.mkdirSync(join(dest,'public'),{recursive:true});
for(const name of ['server.mjs','snapshot.mjs','ui.mjs','package.json','public/app.js','public/app.css'])fs.copyFileSync(join(here,name),join(dest,name));
for(const name of ['report.mjs','protocol.mjs','workflow-state.mjs','event-semantics.mjs','issues.mjs'])fs.copyFileSync(join(here,'..',name),join(dest,name));
console.log('已准备发布目录（需单独配置既有访问口令和同步凭据）');
