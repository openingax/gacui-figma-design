import http from 'node:http';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {exactKeys,validEvent,validFeedback,TASK} from './protocol.mjs';
import {isMain} from './entry.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function createCollector({dataDir,tokenHashes,ticketSecret,maxBytes=256*1024*1024,build='local',now=()=>Date.now(),autoEnroll=false,maxDevices=100,maxDeviceBytes=16*1024*1024}) {
 if(!dataDir||!Array.isArray(tokenHashes)||!tokenHashes.length||tokenHashes.some(t=>!/^[a-f0-9]{64}$/.test(t))||typeof ticketSecret!=='string'||ticketSecret.length<32)throw Error('collector configuration invalid');
 for(const d of ['events','reports','profiles'])fs.mkdirSync(join(dataDir,d),{recursive:true,mode:0o700});
 const deviceFile=join(dataDir,'devices.json');
 const devices=fs.existsSync(deviceFile)?JSON.parse(fs.readFileSync(deviceFile,'utf8')):{};
 const authorized=()=>[...tokenHashes,...Object.values(devices).filter(device=>!device.revoked).map(device=>device.tokenHash)];
 // 单进程接收器，所有落盘操作在一个同步临界区内；多进程不得共用目录。
 let used=0;const deviceBytes=new Map();for(const d of ['events','reports'])for(const f of fs.readdirSync(join(dataDir,d))){const size=fs.statSync(join(dataDir,d,f)).size;used+=size;const owner=f.slice(0,64);deviceBytes.set(owner,(deviceBytes.get(owner)??0)+size);}
 const rates=new Map();function limit(key,max){const slot=Math.floor(now()/60000);for(const [k,v]of rates)if(v.slot!==slot)rates.delete(k);const v=rates.get(key)??{slot,n:0};v.n++;rates.set(key,v);return v.n<=max;}
 const sign=s=>createHmac('sha256',ticketSecret).update(s).digest('base64url');
 const verify=t=>{try{const [payload,signature,...extra]=t.split('.');if(extra.length||!same(sign(payload),signature))return null;const p=JSON.parse(Buffer.from(payload,'base64url'));if(!TASK.test(p.taskId)||!authorized().includes(p.client)||p.exp<now())return null;return p;}catch{return null}};
 function put(dir,key,value){const file=join(dataDir,dir,key+'.json'),text=JSON.stringify(value);if(fs.existsSync(file)){if(fs.readFileSync(file,'utf8')!==text)throw Object.assign(Error('conflict'),{status:409});return;}const size=Buffer.byteLength(text),owner=key.slice(0,64);if(used+size>maxBytes)throw Object.assign(Error('quota'),{status:507,error:'storage_full'});if((deviceBytes.get(owner)??0)+size>maxDeviceBytes)throw Object.assign(Error('quota'),{status:507,error:'device_quota'});fs.writeFileSync(file,text,{flag:'wx',mode:0o600});used+=size;deviceBytes.set(owner,(deviceBytes.get(owner)??0)+size);}
 const server=http.createServer(async(req,res)=>{
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Referrer-Policy':'no-referrer'};
  const reply=(code,data)=>{res.writeHead(code,headers);res.end(JSON.stringify(data));};
  const path=req.url;
  if(req.method==='GET'&&path==='/healthz')return reply(200,{service:'gacuiagent-log',schema:1,build,features:['tuning-events-v1','device-profile-v1',...(autoEnroll?['device-enrollment-v1']:[])]});
  if(!['/v1/events','/v2/events','/v1/tickets','/v1/feedback','/v1/profile',...(autoEnroll?['/v1/enroll']:[])].includes(path))return reply(404,{error:'not_found'});
  if(req.method==='OPTIONS')return reply(204,{});
  if(req.method!=='POST')return reply(405,{error:'method'});
  if(!limit('global',240))return reply(429,{error:'rate_limit'});
  const token=(req.headers.authorization??'').replace(/^Bearer /,'');
  const client=hash(token),ticket=path==='/v1/feedback'?verify(token):null;
  const enrolling=path==='/v1/enroll';
  if(!enrolling&&(path==='/v1/feedback'?!ticket:!authorized().some(t=>same(t,client))))return reply(401,{error:'unauthorized'});
  if(!limit(enrolling?'enrollment':path==='/v1/feedback'?'feedback:'+ticket.client:'client:'+client,enrolling?10:path==='/v1/feedback'?20:120))return reply(429,{error:'rate_limit'});
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return reply(415,{error:'content_type'});
  const max=enrolling?2048:['/v1/feedback','/v2/events'].includes(path)?4*1024*1024:64*1024;
  if(Number(req.headers['content-length'])>max)return reply(413,{error:'too_large'});
  try{
   let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>max){reply(413,{error:'too_large'});return;}chunks.push(chunk);}
   const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   if(enrolling){
    exactKeys(body,['installationId','tokenHash']);
    if(typeof body.installationId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.installationId)||typeof body.tokenHash!=='string'||!/^[a-f0-9]{64}$/.test(body.tokenHash))throw Error('invalid enrollment');
    const prior=devices[body.installationId];
    if(prior){if(prior.revoked||prior.tokenHash!==body.tokenHash)return reply(409,{error:'device_conflict'});}
    else{
     if(Object.keys(devices).length>=maxDevices)return reply(503,{error:'device_capacity'});
     if(authorized().includes(body.tokenHash))return reply(409,{error:'credential_reused'});
     const next={...devices,[body.installationId]:{tokenHash:body.tokenHash,createdAt:new Date(now()).toISOString(),revoked:false}};
     const temporary=deviceFile+'.'+randomUUID();fs.writeFileSync(temporary,JSON.stringify(next),{flag:'wx',mode:0o600});fs.renameSync(temporary,deviceFile);devices[body.installationId]=next[body.installationId];
    }
    return reply(200,{accepted:body.installationId});
   }
   if(path==='/v1/events'||path==='/v2/events'){
    exactKeys(body,['events']);if(!Array.isArray(body.events)||body.events.length<1||body.events.length>50)throw Error('invalid batch');body.events.forEach(validEvent);
    // 全批先验证，持久化后才回执；部分磁盘失败时可安全重放。
    for(const e of body.events)put('events',client+'-'+e.id,e);
    return reply(200,{accepted:body.events.map(e=>e.id)});
   }
   if(path==='/v1/profile'){
    // 每设备只保留最新资料与首次/最近时间，覆盖写入，不计入事件额度。
    exactKeys(body,['profile']);if(!body.profile||typeof body.profile!=='object'||Array.isArray(body.profile)||Buffer.byteLength(JSON.stringify(body.profile))>32*1024)throw Error('invalid profile');
    const file=join(dataDir,'profiles',client+'.json');let firstSeen=new Date(now()).toISOString();try{firstSeen=JSON.parse(fs.readFileSync(file,'utf8')).firstSeen??firstSeen}catch{}
    const temporary=file+'.'+randomUUID();fs.writeFileSync(temporary,JSON.stringify({client,firstSeen,lastSeen:new Date(now()).toISOString(),profile:body.profile}),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);
    return reply(200,{accepted:true});
   }
   if(path==='/v1/tickets'){
    exactKeys(body,['taskId']);if(typeof body.taskId!=='string'||!TASK.test(body.taskId))throw Error('invalid task');
    const exp=now()+7*86400000;const p=Buffer.from(JSON.stringify({taskId:body.taskId,client,exp,nonce:randomUUID()})).toString('base64url');
    return reply(200,{ticket:p+'.'+sign(p),expiresAt:new Date(exp).toISOString()});
   }
   validFeedback(body);if(body.taskId!==ticket.taskId)return reply(403,{error:'task_mismatch'});
   put('reports',ticket.client+'-'+body.id,body);return reply(200,{accepted:body.id});
  }catch(e){return reply(e.status??(e.code?500:400),{error:e.status===409?'id_conflict':e.status===507?e.error:e.code?'storage_error':'invalid_payload'});}
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.maxRequestsPerSocket=100;
 return server;
}
if(isMain(import.meta.url)){
 const c=JSON.parse(fs.readFileSync(process.env.GAC_COLLECTOR_CONFIG,'utf8'));
 const server=createCollector(c);server.listen(c.port??5186,'127.0.0.1',()=>console.log('gacuiagent-log ready'));
 process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
}
