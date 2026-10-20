#!/usr/bin/env node
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {begin,inspectCode,libraryCode,verifyCode,inventory,match,choose,acceptProbe,acceptVisual,readSession,saveSession,summary} from './connection.mjs';
import {composeNative,editNativeText} from './runtime.mjs';
import {scopeCode,acceptScope,seedPlan,seedCode,seedReceipt} from './bootstrap.mjs';
export function composeCode(s,layout,{probe=false}={}){
 if(probe?s.status!=='probe'&&s.status!=='visual'&&s.status!=='ready':s.status!=='ready')throw Error('请先完成组件映射和接入验证');
 const roles=Object.keys(s.bindings).sort();
 if(probe){const signature=createHash('sha256').update(JSON.stringify(roles.map(role=>({role,id:s.bindings[role].id,key:s.bindings[role].key,fileKey:s.bindings[role].fileKey,origin:s.bindings[role].origin})))).digest('hex').slice(0,12);layout={id:'接入校验-'+signature,direction:'VERTICAL',gap:16,items:roles.map(role=>({role}))};}
 if(!layout||typeof layout.id!=='string'||!layout.id.trim()||!['HORIZONTAL','VERTICAL'].includes(layout.direction)||!Number.isFinite(layout.gap)||layout.gap<0||!Array.isArray(layout.items)||!layout.items.length)throw Error('布局格式无效');
 for(const item of layout.items){if(!s.bindings[item.role]||item.text&&Object.values(item.text).some(v=>typeof v!=='string'))throw Error('组件角色或文字无效');}
 const bindings=Object.fromEntries([...new Set(layout.items.map(i=>i.role))].map(role=>[role,s.bindings[role]]));
 const request={sessionId:s.id,fileKey:s.target.fileKey,pageId:s.probe?.pageId??s.scope?.pageId??null,bindings,layout};
 return `return await (${composeNative.toString()})(figma,${JSON.stringify(request)});`;
}
export function editCode(s,edits){
 if(s.status!=='ready'||!Array.isArray(edits)||!edits.length||edits.some(e=>!e.instanceId||!e.layer||typeof e.before!=='string'||typeof e.after!=='string'))throw Error('连接或修改参数无效');
 return `return await (${editNativeText.toString()})(figma,${JSON.stringify({sessionId:s.id,fileKey:s.target.fileKey,pageId:s.probe.pageId,edits})});`;
}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const args=process.argv.slice(2);const oi=args.indexOf('--out');let output;if(oi>=0){output=args[oi+1];if(!output)throw Error('--out 缺少路径');args.splice(oi,2);}const [cmd,file,input,...rest]=args;if(rest.length)throw Error('多余参数');
  if(cmd==='start'){
   const s=begin(json(file));const root=resolve(fileURLToPath(new URL('../../',import.meta.url)));const dest=join(root,'.local','figma-connections',s.id+'.json');
   if(fs.existsSync(dest)){const old=readSession(dest);console.log(JSON.stringify({...summary(old),sessionFile:dest,reused:true}));}
   else{saveSession(dest,s);console.log(JSON.stringify({...summary(s),sessionFile:dest}));}
  }else{
   const s=readSession(file);let code,result,changed=false;
   if(cmd==='status')result=summary(s);
   else if(cmd==='verify-code')code=verifyCode(s);
   else if(cmd==='reset'){const archived=file+'.'+Date.now()+'.previous';fs.copyFileSync(file,archived,fs.constants.COPYFILE_EXCL);const fresh=begin({targetUrl:'https://figma.com/design/'+s.target.fileKey+'/target',sourceUrl:s.source?'https://figma.com/design/'+s.source.fileKey+'/source':undefined,accountId:s.accountId,authorization:s.authorization});saveSession(file,fresh);result={...summary(fresh),archived};}
   else if(cmd==='scope-code')code=scopeCode(s);
   else if(cmd==='scope-receipt'){acceptScope(s,json(input));changed=true;result=s.scope;}
   else if(cmd==='seed-plan')result=seedPlan(s);
   else if(cmd==='seed-code')code=seedCode(s,input);
   else if(cmd==='seed-receipt'){seedReceipt(s,json(input));changed=true;result={saved:true};}
   else if(cmd==='library-code')code=libraryCode(s,json(input));
   else if(cmd==='inspect-code')code=inspectCode(s,input?json(input):{});
   else if(cmd==='inventory'){inventory(s,json(input));changed=true;result=summary(s);}
   else if(cmd==='match'){result=match(s,json(input));changed=true;}
   else if(cmd==='choose'){choose(s,json(input));changed=true;result=summary(s);}
   else if(cmd==='probe-code')code=composeCode(s,null,{probe:true});
   else if(cmd==='probe-receipt'){acceptProbe(s,json(input));changed=true;result=summary(s);}
   else if(cmd==='visual-receipt'){acceptVisual(s,json(input));changed=true;result=summary(s);}
   else if(cmd==='compose-code')code=composeCode(s,json(input));
   else if(cmd==='edit-code')code=editCode(s,json(input));
   else throw Error('用法：start <请求.json> | status/inspect-code/inventory/match/choose/probe-code/probe-receipt/visual-receipt/compose-code/edit-code <session.json> [输入.json]');
   if(changed)saveSession(file,s);
   if(code){if(output){fs.writeFileSync(output,code,{flag:'wx'});console.log('代码已生成');}else process.stdout.write(code);}
   else console.log(JSON.stringify(result,null,2));
  }
 }catch(e){console.error(e.message);process.exitCode=1;}
}
