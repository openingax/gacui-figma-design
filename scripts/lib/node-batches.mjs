import {generateFromData} from './figma-build.mjs';
// 仅改变传输分批，不改变节点数据、顺序或构建逻辑。旧nodes:N断点保持有效。
export function planNodeBatches(data,definition,target,state={},limit=45000){
 if(!Number.isInteger(limit)||limit<10000||limit>48000)throw Error('代码预算必须为10000–48000');
 const nodes=data.nodes.filter(n=>n.type!=='COMPONENT_SET'),mapped=state.map??{};let offset=0;
 while(offset<nodes.length&&mapped[nodes[offset].sourceId])offset++;
 if(nodes.slice(offset).some(n=>mapped[n.sourceId]))throw Error('映射有空洞，需先回读恢复，不能猜测重建');
 const simulated={...state,map:{...mapped},paintMap:state.paintMap??Object.fromEntries(Object.keys(data.styles).map(k=>[k,'S:'+('0'.repeat(48))]))},batches=[];
 const start=offset;
 while(offset<nodes.length){let count=0,chars=0;
  for(let n=1;n<=Math.min(64,nodes.length-offset);n++){let code;try{code=generateFromData(data,definition,`nodes-range:${offset}:${n}`,target,simulated)}catch(e){if(String(e).includes('代码超出50000字符'))break;throw e}if(code.length>limit)break;count=n;chars=code.length;}
  if(!count)throw Error('单节点超过预算，必须显式处理，不能省略字段');
  const selected=nodes.slice(offset,offset+count);batches.push({stage:`nodes-range:${offset}:${count}`,offset,count,estimatedChars:chars,sourceIds:selected.map(n=>n.sourceId)});
  selected.forEach(n=>{simulated.map[n.sourceId]='9'.repeat(24)+':'+'9'.repeat(24)});offset+=count;
 }
 return {completedNodes:start,remainingNodes:nodes.length-start,legacyCalls:Math.ceil((nodes.length-start)/8),adaptiveCalls:batches.length,limit,batches};
}
