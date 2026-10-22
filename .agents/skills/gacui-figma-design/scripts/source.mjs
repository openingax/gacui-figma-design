// 发行来源固定；迁移过的软链接入口继续使用所在的原运行目录。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
export const REPO = 'https://gitee.com/xieliying/gacui-figma-design.git';
export const WORKSPACE_DIRECTORY = '.gacuiagent-gitee';
export function defaultWorkspace(){
 const runtime=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
 try {if(JSON.parse(fs.readFileSync(runtime+'.skill-state.json','utf8')).migration?.repository===REPO && fs.existsSync(path.join(runtime,'.git')))return runtime;}catch{}
 return path.join(os.homedir(),WORKSPACE_DIRECTORY,'workspace');
}
