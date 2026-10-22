import {readFileSync,existsSync} from 'node:fs';
export function targetConfig(){const local=new URL('../../.local/figma-pages.json',import.meta.url);return JSON.parse(readFileSync(existsSync(local)?local:new URL('../../config/figma-pages.json',import.meta.url),'utf8'));}
export function componentTarget(kind){const c=targetConfig();if(!c.fileKey||c.fileKey===c.sourceFileKey)throw Error('请配置自己的独立 Figma 目标，见 docs/figma-adapter.md');const p=c.pages.find(p=>p.packages.includes(kind));if(!p?.pageId)throw Error('组件尚无授权分类Page '+kind);return {fileKey:c.fileKey,pageId:p.pageId};}
