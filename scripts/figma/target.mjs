#!/usr/bin/env node
// 草稿出稿的目标适配：只读核对目标文件是否包含出稿所需的已导入组件，回执通过后写本机 .local/figma-pages.json。
// 本脚本不写 Figma，不把规范源当目标，也不把历史映射当作新使用者的授权；账号与写权限由 agent 用实际工具核实。
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from '../../support/entry.mjs';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
export const SOURCE_FILE_KEY='jNf9icrxfw8B7QkSQa9g33';
export const LOCAL_CONFIG=join(root,'.local','figma-pages.json');

export function fileKeyOf(input){
 const m=String(input??'').match(/figma\.com\/(?:design|file)\/([0-9a-zA-Z]{22,128})/);
 const key=m?m[1]:String(input??'').trim();
 if(!/^[0-9a-zA-Z]{22,128}$/.test(key))throw Error('无法识别 Figma 文件链接或 fileKey');
 if(key===SOURCE_FILE_KEY)throw Error('规范源只读，不能作为出稿目标');
 return key;
}

// 出稿代码按节点 ID 引用目标文件中已导入的组件。目标文件 ID 前缀较短；规范源节点前缀为五位数，不计入目标依赖。
// generator 中少数短 ID 是规范源图标引用（Link 的 75:2123、75:2074），不属于目标依赖，单独排除。
const TARGET_ID=/["']([1-9]\d{0,3}:\d+)["']/g, SOURCE_REFS=new Set(['75:2123','75:2074']);
export function requiredIds(){
 const files=['sketch/figma-runtime.mjs','sketch/figma.mjs','pages/work-orders/build.mjs'];
 for(const d of readdirSync(join(root,'components'),{withFileTypes:true}))if(d.isDirectory())
  for(const f of readdirSync(join(root,'components',d.name)))if(/dependencies.*\.json$|^generator\.mjs$|^family\.mjs$/.test(f))files.push(`components/${d.name}/${f}`);
 const ids=new Set();
 for(const f of files){const p=join(root,f);if(!existsSync(p))continue;for(const m of readFileSync(p,'utf8').matchAll(TARGET_ID))if(!SOURCE_REFS.has(m[1]))ids.add(m[1]);}
 // 公开包随附的出稿映射（sketch/maps）：只取出稿按 ID 实例化的表单字段变体与抽屉部件；映射内其余子节点 ID 不作依赖。
 const read=f=>{const p=join(root,'sketch','maps',f);return existsSync(p)?JSON.parse(readFileSync(p,'utf8')):null;};
 const form=existsSync(join(root,'sketch','maps','form-top'))?readdirSync(join(root,'sketch','maps','form-top')).filter(f=>f.endsWith('.json')):[];
 for(const f of form)for(const v of read('form-top/'+f).variants??[])ids.add(v.id);
 const drawer=read('drawer.json');
 if(drawer)for(const group of [drawer.variants,drawer.footerIds,drawer.closeIds])for(const id of Object.values(group??{}))ids.add(id);
 return [...ids].sort();
}

// 交给 use_figma 在目标文件执行的只读代码：核对依赖节点存在，列出 Page 以及哪些 Page 只含草稿出稿画板。
export function checkCode(target){
 const fileKey=fileKeyOf(target),ids=requiredIds();
 return `if(figma.fileKey!==${JSON.stringify(fileKey)})throw Error('当前文件不是指定的出稿目标');
const ids=${JSON.stringify(ids)},missing=[];
for(const id of ids){if(!(await figma.getNodeByIdAsync(id)))missing.push(id);}
const pages=[];
for(const p of figma.root.children){await p.loadAsync();pages.push({id:p.id,name:p.name,empty:p.children.length===0,draftOnly:p.children.length>0&&p.children.every(n=>/ · v\\d+$/.test(n.name)||n.name.startsWith('说明 / '))});}
return {fileKey:figma.fileKey,checked:ids.length,missing,pages};`;
}

export function acceptReceipt(target,receipt,{now=new Date().toISOString(),write=true}={}){
 const fileKey=fileKeyOf(target),ids=requiredIds();
 if(!receipt||receipt.fileKey!==fileKey)throw Error('回执不是指定目标文件的结果');
 if(receipt.checked!==ids.length)throw Error('回执核对的依赖数量与当前版本不符，请重新生成核对代码');
 if(!Array.isArray(receipt.missing)||receipt.missing.length)throw Error('目标缺少出稿所需组件：'+(receipt.missing??[]).slice(0,20).join('、')+'；该文件不能直接用于草稿出稿，见 docs/figma-adapter.md');
 if(!Array.isArray(receipt.pages)||!receipt.pages.length)throw Error('回执缺少 Page 列表');
 if(receipt.pages.some(p=>typeof p.empty!=='boolean'||typeof p.draftOnly!=='boolean'))throw Error('回执 Page 信息不完整，请用当前版本重新核对');
 // 出稿运行时拒绝写入任何含非草稿内容的 Page；名单只需保护空 Page，避免同名空页被当作任务页写入。
 const config={fileKey,sourceFileKey:SOURCE_FILE_KEY,adapterVerified:true,verifiedAt:now,requiredIds:ids.length,
  contentPages:receipt.pages.filter(p=>!p.empty&&!p.draftOnly).length,
  pages:receipt.pages.filter(p=>p.empty).map(p=>({name:p.name,pageId:p.id,packages:[]}))};
 if(write){mkdirSync(dirname(LOCAL_CONFIG),{recursive:true});writeFileSync(LOCAL_CONFIG,JSON.stringify(config,null,2)+'\n');}
 return config;
}

export function status(){
 if(!existsSync(LOCAL_CONFIG))return {ready:false,message:'尚未适配出稿目标'};
 const c=JSON.parse(readFileSync(LOCAL_CONFIG,'utf8'));
 const ready=c.adapterVerified===true&&!!c.fileKey&&c.fileKey!==SOURCE_FILE_KEY&&c.requiredIds===requiredIds().length;
 return {ready,fileKey:c.fileKey,verifiedAt:c.verifiedAt,contentPages:c.contentPages??null,emptyPagesProtected:c.pages?.length??0,message:ready?'已适配，可按草稿出稿':'适配记录与当前版本不符，请重新核对'};
}

if(isMain(import.meta.url)){
 const [cmd,a,b]=process.argv.slice(2);
 try{
  if(cmd==='check-code'&&a)process.stdout.write(checkCode(a)+'\n');
  else if(cmd==='receipt'&&a&&b){const c=acceptReceipt(a,JSON.parse(readFileSync(b,'utf8')));console.log(JSON.stringify({ready:true,fileKey:c.fileKey,requiredIds:c.requiredIds,contentPages:c.contentPages,emptyPagesProtected:c.pages.length}));}
  else if(cmd==='status')console.log(JSON.stringify(status()));
  else{console.log(`用法：
  node scripts/figma/target.mjs check-code <目标文件链接或fileKey>   输出交给 use_figma 的只读核对代码
  node scripts/figma/target.mjs receipt <目标文件链接或fileKey> <回执.json>   核对通过后写 .local/figma-pages.json
  node scripts/figma/target.mjs status`);process.exitCode=2;}
 }catch(e){console.error(e.message);process.exitCode=1;}
}
