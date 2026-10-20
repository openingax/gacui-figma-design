import fs from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
export function figmaLink(url){
 const u=new URL(url);if(u.protocol!=='https:'||!['figma.com','www.figma.com'].includes(u.hostname)||u.username||u.password)throw Error('需要有效 Figma HTTPS 链接');
 const m=u.pathname.match(/^\/design\/([A-Za-z0-9]+)(?:\/branch\/([A-Za-z0-9]+))?(?:\/|$)/);if(!m)throw Error('需要 Figma Design 文件链接');
 const node=u.searchParams.get('node-id');return {fileKey:m[2]??m[1],nodeId:node?.replace(/-/g,':')??null};
}
export function begin(request){
 const target=figmaLink(request.targetUrl),source=request.sourceUrl?figmaLink(request.sourceUrl):null;
 if(source?.fileKey===target.fileKey)throw Error('显式规范源文件保持只读，请选择独立出稿目标');
 if(typeof request.accountId!=='string'||!request.accountId||typeof request.authorization!=='string'||!request.authorization.trim())throw Error('先由 agent 核实连接账号和目标授权');
 const id=createHash('sha256').update(JSON.stringify([request.accountId,target.fileKey,source?.fileKey])).digest('hex').slice(0,20);
 return {schema:1,id,mode:'agent-native',accountId:request.accountId,authorization:request.authorization,target,source,requirements:[],inventories:[],bindings:{},probe:null,visual:null,status:'inspect'};
}
export function inspectCode(session,{source=false,pageId,offset=0,limit=30}={}){
 if(!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>30)throw Error('盘点分页无效');
 const key=(source?session.source:session.target)?.fileKey;if(!key)throw Error('未指定规范源');
 return `if(figma.fileKey!==${JSON.stringify(key)})throw Error('文件不符');
${pageId?`const page=await figma.getNodeByIdAsync(${JSON.stringify(pageId)});if(!page||page.type!=='PAGE')throw Error('Page不存在');await figma.setCurrentPageAsync(page);`:''}
const pages=figma.root.children.map(p=>({id:p.id,name:p.name}));
const all=${pageId?`page.findAllWithCriteria({types:['COMPONENT']}).map(n=>({id:n.id,key:n.key??null,name:n.name,setName:n.parent?.type==='COMPONENT_SET'?n.parent.name:null,variant:n.variantProperties??{},properties:(n.parent?.type==='COMPONENT_SET'?n.parent:n).componentPropertyDefinitions??{}}))`:'[]'};
const components=all.slice(${offset},${offset+limit});
const fonts=(await figma.listAvailableFontsAsync()).map(f=>f.fontName).filter(f=>['PingFang SC','Noto Sans SC'].includes(f.family));
return {schema:1,fileKey:figma.fileKey,pageId:${JSON.stringify(pageId??null)},pages,components,fonts,offset:${offset},nextOffset:${offset}+components.length<all.length?${offset}+components.length:null,total:all.length};`;
}
export function inventory(session,report){
 if(report.schema!==1||![session.target.fileKey,session.source?.fileKey].includes(report.fileKey)||!Array.isArray(report.components)||!Array.isArray(report.pages))throw Error('盘点回执不属于本次源或目标');
 if(report.components.length&&report.origin!=='library'&&(!report.pageId||!report.pages.some(p=>p.id===report.pageId)))throw Error('组件盘点需有真实 Page');
 if(report.origin==='library'&&(!report.assetKey||report.components.some(c=>!c.key)))throw Error('库组件需要真实asset key和变体key');
 const seen=new Set();for(const c of report.components){if(!c.id||!c.name||seen.has(c.id)||!c.variant||typeof c.variant!=='object'||(c.key!==null&&typeof c.key!=='string'))throw Error('组件记录无效');seen.add(c.id);}
 const prior=session.inventories.find(r=>r.fileKey===report.fileKey&&r.pageId===report.pageId&&r.assetKey===report.assetKey);
 if(report.offset&&(!prior||prior.nextOffset!==report.offset))throw Error('盘点分页不连续');
 const combined={...report,components:[...(report.offset?prior.components:[]),...report.components]};
 if(new Set(combined.components.map(c=>c.id)).size!==combined.components.length)throw Error('盘点节点重复');
 session.inventories=session.inventories.filter(r=>!(r.fileKey===report.fileKey&&r.pageId===report.pageId&&r.assetKey===report.assetKey));session.inventories.push(combined);
 session.bindings={};session.probe=null;session.visual=null;session.status='map';return session;
}
export function catalog(session){return session.inventories.filter(r=>r.nextOffset==null).flatMap(r=>r.components.map(c=>({...c,fileKey:r.fileKey,pageId:r.pageId,origin:r.origin??'local'})));}
export function match(session,requirements){
 if(!Array.isArray(requirements)||!requirements.length)throw Error('需要从实际页面提取至少一个组件角色');
 const roles=new Set();for(const r of requirements){if(!r.role||['__proto__','constructor','prototype'].includes(r.role)||roles.has(r.role)||!r.name)throw Error('角色名称必须唯一且包含实际组件名');roles.add(r.role);}
 requirements=[...new Map([...session.requirements,...requirements].map(r=>[r.role,r])).values()];
 session.requirements=requirements;session.bindings={};session.probe=null;session.visual=null;
 const rows=requirements.map(r=>{
  const candidates=catalog(session).filter(c=>(c.name===r.name||c.setName===r.name)&&Object.entries(r.variant??{}).every(([k,v])=>c.variant[k]===v));
  // 不靠模糊名称猜变体；冲突交给 agent 结合规范做语义判断。
  if(candidates.length===1&&(candidates[0].fileKey===session.target.fileKey||candidates[0].key))session.bindings[r.role]=candidates[0];
  return {role:r.role,status:session.bindings[r.role]?'matched':candidates.length?'agent-choice':'missing',candidates};
 });
 session.status=Object.keys(session.bindings).length===requirements.length?'probe':'map';return rows;
}
export function choose(session,choices){
 for(const [role,choice] of Object.entries(choices)){
  const requirement=session.requirements.find(r=>r.role===role);const c=catalog(session).find(c=>c.fileKey===choice.fileKey&&c.id===choice.id);
  if(!requirement||!c||!(c.name===requirement.name||c.setName===requirement.name)||!Object.entries(requirement.variant??{}).every(([k,v])=>c.variant[k]===v))throw Error('选择必须来自真实盘点并满足角色/变体');
  if(c.fileKey!==session.target.fileKey&&!c.key)throw Error('跨文件组件没有可导入 key；需 agent 处理发布库或构建路径，不让用户填写映射');
  session.bindings[role]=c;
 }
 session.probe=null;session.visual=null;session.status=Object.keys(session.bindings).length===session.requirements.length?'probe':'map';return session;
}
export function acceptProbe(session,receipt){
 if(!receipt||receipt.sessionId!==session.id||receipt.fileKey!==session.target.fileKey||receipt.status!=='verified'||!receipt.pageId||!receipt.frameId||!Array.isArray(receipt.instances))throw Error('接入写入/回读未通过');
 if(new Set(receipt.instances.map(e=>e.id)).size!==receipt.instances.length||receipt.instances.length!==session.requirements.length)throw Error('实例数量与接入角色不符');
 for(const [role,b] of Object.entries(session.bindings)){
  const e=receipt.instances.filter(x=>x.role===role);if(e.length!==1||e[0].type!=='INSTANCE'||!e[0].id||!(e[0].width>0)||!(e[0].height>0)||(b.fileKey===session.target.fileKey&&b.origin!=='library'?e[0].componentId!==b.id:e[0].componentKey!==b.key))throw Error('组件回读与映射不一致：'+role);
 }
 if(!session.requirements.length||Object.keys(session.bindings).length!==session.requirements.length)throw Error('组件尚未全部映射');
 session.probe=receipt;session.visual=null;session.status='visual';return session;
}
export function acceptVisual(session,result){
 if(!session.probe||result.frameId!==session.probe.frameId||result.passed!==true||typeof result.evidence!=='string'||!result.evidence.trim()||typeof result.observations!=='string'||!result.observations.trim())throw Error('需要实际截图检查证据和观察结果');
 session.visual=result;session.status='ready';return session;
}
export function readSession(file){const s=JSON.parse(fs.readFileSync(file,'utf8'));if(s.schema!==1||s.mode!=='agent-native')throw Error('连接格式无效');return s;}
export function saveSession(file,session){fs.mkdirSync(resolve(file,'..'),{recursive:true,mode:0o700});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(session,null,2)+'\n',{mode:0o600});fs.renameSync(tmp,file);}
export function summary(s){return {id:s.id,mode:s.mode,status:s.status,target:s.target.fileKey,required:s.requirements.length,mapped:Object.keys(s.bindings).length,next:{inspect:'agent 读取目标和规范目录',map:'agent 完成组件语义匹配或处理缺口',probe:'在授权目标创建校验实例并回读',visual:'获取并实际检查截图',ready:'使用 bindings 原生组件组合页面；新角色需增量接入'}[s.status]};}

export function libraryCode(s,asset){
 if(!['component','component_set'].includes(asset.type)||typeof asset.key!=='string'||!asset.key.trim())throw Error('使用实际库搜索返回的componentKey/componentSetKey');
 return `if(figma.fileKey!==${JSON.stringify(s.target.fileKey)})throw Error('目标不符');
const root=await figma.${asset.type==='component_set'?'importComponentSetByKeyAsync':'importComponentByKeyAsync'}(${JSON.stringify(asset.key)});
const nodes=root.type==='COMPONENT_SET'?root.children.filter(n=>n.type==='COMPONENT'):[root];
const components=nodes.map(n=>({id:n.id,key:n.key,name:n.name,setName:n.parent?.type==='COMPONENT_SET'?n.parent.name:null,variant:n.variantProperties??{},properties:(n.parent?.type==='COMPONENT_SET'?n.parent:n).componentPropertyDefinitions??{}}));
return {schema:1,fileKey:figma.fileKey,pageId:null,origin:'library',assetKey:${JSON.stringify(asset.key)},pages:figma.root.children.map(p=>({id:p.id,name:p.name})),components,nextOffset:null,importedNodeIds:[root.id,...nodes.map(n=>n.id)],createdNodeIds:[]};`;
}
export function verifyCode(s){
 if(s.status!=='ready'||!s.probe)throw Error('接入尚未完成');
 return `if(figma.fileKey!==${JSON.stringify(s.target.fileKey)})throw Error('目标文件不符');const p=await figma.getNodeByIdAsync(${JSON.stringify(s.probe.pageId)});if(!p||p.type!=='PAGE')throw Error('连接已失效，重新盘点');await figma.setCurrentPageAsync(p);const frame=await figma.getNodeByIdAsync(${JSON.stringify(s.probe.frameId)});if(!frame||frame.parent!==p)throw Error('校验画板已变化，重新盘点');const expected=${JSON.stringify(s.probe.instances)};for(const e of expected){const n=await figma.getNodeByIdAsync(e.id);if(!n||n.type!=='INSTANCE'||n.parent!==frame)throw Error('校验实例失效，重新盘点');const main=await n.getMainComponentAsync();if(!main||main.id!==e.componentId)throw Error('组件引用已变化，重新盘点');}return {verified:true,sessionId:${JSON.stringify(s.id)},fileKey:figma.fileKey,components:expected.length};`;
}
