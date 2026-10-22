import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
// Node 以真实路径加载主模块，argv[1] 可能带软链接（npx skills 默认安装、macOS /tmp）；两侧都取真实路径再比较。
export function isMain(url){
 try{return !!process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(url));}
 catch{return false;}
}
