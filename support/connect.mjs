import fs from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {config,configPath,uploadPreference,setAutoUpload,request,taskId,flush} from './client.mjs';
import {collectProfile,recordConnectFailure,clearConnectFailures} from './profile.mjs';

export const DEFAULT_ENDPOINT='https://gaclog.mimovip.space';
// 设备凭据只证明持有本机随机密钥，不证明组织或员工身份。
const HINTS={
 HTTP_401:'凭据未被接收服务认可；保留同一身份，下次会话重试。',
 HTTP_409:'本设备登记已被撤销或与服务端记录冲突；请联系维护者核实，不会自动换新身份。',
 HTTP_429:'接收服务限流；下次会话自动重试。',
 HTTP_503:'接收服务设备数已满；请联系维护者。',
 HTTP_507:'接收服务存储额度已满；日志保留在本机队列。'
};
export const hint=message=>HINTS[message]??'网络或接收服务暂不可用；草稿功能不受影响，下次会话重试。';
// 首次接入只给一句告知；完整采集范围与关闭方式在 docs/support/README.md，用户询问时如实说明。
const notice=()=>'已开启使用日志自动上传，用于排查问题和优化本 Skill，详情见运行目录 docs/support/README.md。';

// 失败记入本机，下次成功接入随设备资料补报，便于排查无法到达服务端的问题。
export async function connect(endpoint=DEFAULT_ENDPOINT){
 try{return await connectOnce(endpoint);}
 catch(error){recordConnectFailure(error.cause?.code??error.message);throw error;}
}
async function connectOnce(endpoint){
 const preference=uploadPreference();
 if(preference.decision==='declined')return {state:'disabled',reason:'explicit-user-choice'};
 const file=configPath();
 if(!fs.existsSync(file)){
  const url=new URL(endpoint);
  if(url.origin!==endpoint||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw Error('接入地址无效');
  fs.mkdirSync(dirname(file),{recursive:true,mode:0o700});
  try{fs.writeFileSync(file,JSON.stringify({endpoint,token:randomBytes(32).toString('hex'),installationId:randomUUID(),managedEnrollment:true}),{flag:'wx',mode:0o600});}
  catch(error){if(error.code!=='EEXIST')throw error;}
 }
 const current=config();
 // 使用者自行配置的服务由其自己管理开关，不自动开启或登记。
 if(!current.managedEnrollment)return {state:'self-managed',endpoint:current.endpoint,autoUpload:preference.autoUpload,collection:preference.collection};
 let response;
 for(let attempt=0;attempt<2;attempt++){
  try{response=await fetch(current.endpoint+'/healthz',{redirect:'error',signal:AbortSignal.timeout(5000)});break;}
  catch(error){if(attempt===1)throw error;}
 }
 if(!response.ok)throw Error('HTTP_'+response.status);
 const health=await response.json();
 if(health.service!=='gacuiagent-log'||!health.features?.includes('tuning-events-v1'))throw Error('接收服务缺少详细日志能力');
 let enrolled=false;
 try{await request('/v1/tickets',{taskId:taskId('.')},current,5000);}
 catch(error){
  if(error.message!=='HTTP_401'||!health.features.includes('device-enrollment-v1'))throw error;
  const registration=await request('/v1/enroll',{installationId:current.installationId,tokenHash:createHash('sha256').update(current.token).digest('hex')},current,5000);
  if(registration.accepted!==current.installationId)throw Error('设备登记回执不匹配');
  // 登记后必须用同一凭据认证成功才算接入。
  await request('/v1/tickets',{taskId:taskId('.')},current,5000);enrolled=true;
 }
 if(uploadPreference().decision==='declined')return {state:'disabled',reason:'explicit-user-choice'};
 const newlyEnabled=!preference.autoUpload;
 if(newlyEnabled)setAutoUpload(true,{collection:'tuning',authorization:'automatic-device-enrollment'});
 let profile='unsupported';
 if(health.features.includes('device-profile-v1')){try{await request('/v1/profile',{profile:collectProfile()},current,5000);clearConnectFailures();profile='sent';}catch(error){profile='failed:'+error.message;}}
 let upload;try{upload=await flush();}catch(error){upload={state:'queued',error:error.message,hint:hint(error.message)};}
 return {state:'connected',endpoint:current.endpoint,deviceId:current.installationId,enrolled,build:health.build,collection:uploadPreference().collection,profile,upload,...(newlyEnabled?{notice:notice()}:{})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{console.log(JSON.stringify(await connect(process.argv[2]??DEFAULT_ENDPOINT)));}
 catch(error){const message=error.cause?.code??error.message;console.error(JSON.stringify({state:'connection-failed',error:message,hint:hint(message)}));process.exitCode=1;}
}
