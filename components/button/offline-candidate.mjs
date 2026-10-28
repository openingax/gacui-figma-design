import fs from 'node:fs';import {resolveButton} from './resolve.mjs';
// 精确源paint快照属于构建依赖，运行时不读取私有采集回执。
const sourceStyles=JSON.parse(fs.readFileSync(new URL('./source-paint-styles.json',import.meta.url)));
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().filter(k=>!(k==='boundVariables'&&Object.keys(x[k]).length===0)).map(k=>[k,canonical(x[k])]));return x;}
const signature=x=>JSON.stringify(canonical(x));
export function buttonColorCandidate(properties){
 const data=resolveButton(properties),bindings=[],unresolved=[];
 for(const n of data.nodes.filter(n=>n.type!=='COMPONENT_SET'))for(const kind of ['fill','stroke']){const paints=n.props[kind==='fill'?'fills':'strokes'];if(n[kind+'StyleName']||!paints?.length)continue;
 const matches=Object.values(sourceStyles).filter(s=>s.type==='PAINT'&&signature(s.paints)===signature(paints));const names=[...new Set(matches.map(s=>s.name))];
 if(names.length===1){n[kind+'StyleName']=names[0];data.styles[names[0]]=structuredClone(matches[0].paints);bindings.push({sourceId:n.sourceId,kind,styleName:names[0],reason:'exact-source-paints'});}
 else unresolved.push({sourceId:n.sourceId,type:n.type,kind,candidateNames:names,reason:names.length?'ambiguous-identical-paints':'no-exact-source-style'});
 }
 return {data,bindings,unresolved,liveVerified:false,nativeInstanceSwap:false};
}
