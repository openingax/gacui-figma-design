// 调优内容保留业务原文；只移除认证材料。不可把此函数称为业务脱敏。
import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {format} from 'node:util';
export const DETAIL_LIMIT=2*1024*1024;
const credentialKey=/^(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|api[-_]?key|access[-_]?token|refresh[-_]?token|client[-_]?secret|private[-_]?key|ticketSecret)$/i;
export function protectCredentials(value,secrets=[]) {
 const walk=v=>{
  if(Array.isArray(v))return v.map(walk);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,credentialKey.test(k)?'[credential removed]':walk(x)]));
  if(typeof v!=='string')return v;
  let s=v;for(const secret of secrets)if(typeof secret==='string'&&secret.length>=8)s=s.split(secret).join('[credential removed]');
  return s.replace(/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+ )?PRIVATE KEY-----/g,'[private key removed]')
   .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,'Bearer [credential removed]')
   .replace(/\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,})\b/g,'[credential removed]')
   .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,'$1[credential removed]@')
   .replace(/([?&](?:token|api_key|key|secret|password)=)[^&#\s]+/gi,'$1[credential removed]')
   .replace(/((?:["']?(?:password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)["']?)\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,'$1[credential removed]');
 };return walk(value);
}
export function captureFile(file) {
 const p=resolve(file);
 try{const st=fs.statSync(p);if(!st.isFile())return {path:p,omitted:'not-file'};
  if(st.size>700*1024)return {path:p,bytes:st.size,omitted:'file-over-700KiB'};
  const bytes=fs.readFileSync(p),raw=bytes.toString('utf8');let content=raw;
  try{content=JSON.parse(raw)}catch{}
  return {path:p,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),content};
 }catch(e){return {path:p,omitted:e.code??'read-failed'};}
}
export function snapshot(target) {
 try{const index=JSON.parse(fs.readFileSync(join(target,'versions.json'),'utf8'));const latest=Math.max(0,...index.versions.map(v=>v.v));return {version:latest,file:captureFile(join(target,`v${latest}.json`))};}catch{return null;}
}
export function commandDetails(command,target,args=[],{phase,error,output}={}) {
 const payload={command,args,target:resolve(target),snapshot:snapshot(target)};
 if(phase==='start'&&command==='save'&&args[1])payload.input=captureFile(args[1]);
 if(output)payload.output=output;
 if(error)payload.error={name:error.name??'Error',message:String(error.message??error),stack:error.stack??null,code:error.code??null};
 return {schema:1,kind:'draft-command',payload};
}
export function boundedDetails(details,secrets=[]) {
 const clean=protectCredentials(details,secrets),bytes=Buffer.byteLength(JSON.stringify(clean));
 if(bytes<=DETAIL_LIMIT)return clean;
 // 明确可见的缺失标记，不假装大内容已完整采集。
 return {schema:1,kind:details.kind,payload:{omitted:'details-over-2MiB',originalBytes:bytes}};
}
export function basicEvent(event){const {details,...basic}=event;return basic;}

// 只在独立 CLI 主过程执行期间捕获公开 console 输出；原输出仍原样发送。
export function captureConsole(){
 const original={log:console.log,warn:console.warn,error:console.error};
 const output={stdout:'',stderr:'',omittedBytes:0},limit=256*1024;
 for(const method of Object.keys(original))console[method]=function(...args){
  const key=method==='log'?'stdout':'stderr',line=format(...args)+'\n';
  const available=Math.max(0,limit-Buffer.byteLength(output[key])),bytes=Buffer.from(line);
  output[key]+=bytes.subarray(0,available).toString('utf8');output.omittedBytes+=Math.max(0,bytes.length-available);
  return Reflect.apply(original[method],console,args);
 };
 return ()=>{Object.assign(console,original);return output;};
}
