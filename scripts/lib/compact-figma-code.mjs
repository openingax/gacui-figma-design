// 固定的纯JS编译依赖；只压缩传输代码，消费者不需要安装npm包或平台二进制。
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{minify}=require('../vendor/uglify-js/tools/node.js');
export function compactFigmaCode(code){
 const prefix='async function gacuiExecution(){';
 const result=minify(prefix+code+'}',{compress:false,keep_fnames:true,mangle:{reserved:['figma']},output:{ascii_only:false,comments:false}});
 if(result.error)throw Error('Figma代码压缩失败：'+result.error.message);
 if(!result.code.startsWith(prefix)||!result.code.endsWith('}'))throw Error('Figma编译包装不符');
 const out=result.code.slice(prefix.length,-1);
 new (Object.getPrototypeOf(async function(){}).constructor)('figma',out);
 return out;
}
