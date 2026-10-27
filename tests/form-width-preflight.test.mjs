import assert from 'node:assert/strict';
import * as form from '../components/form/generator.mjs';
const {fitFieldContent}=form;

// 直接调用和序列化后的正式函数都必须在加载字体、查源、detach 或 resize 前拒绝非法宽度。
// 不依赖真实文件 ID；此测试随窄范围公开补丁发布。
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const serialized=form.serializedFitFieldContent?.()??fitFieldContent.toString();
for(const invoke of [fitFieldContent,new AsyncFunction('figma','node','content',`${serialized};return fitFieldContent(figma,node,content);`)]){
 let calls=0;
 const rejectCall=()=>{calls++;throw Error('不应进入 Figma 读写');};
 const node={id:'field',width:584,height:86,type:'INSTANCE',children:[],resize:rejectCall,getMainComponentAsync:rejectCall,findAllWithCriteria:rejectCall,detachInstance:rejectCall};
 const figma={getNodeByIdAsync:rejectCall,loadFontAsync:rejectCall};
 for(const content of [{controlWidth:123},{width:700,controlWidth:584},{sourceComponentId:'source',controlWidth:400}]){
  await assert.rejects(invoke(figma,node,content),/控件宽度 .* 不受支持/);
  assert.equal(calls,0);
  assert.equal(node.width,584);
  assert.equal(node.height,86);
 }
 // 允许同宽或省略宽度时继续原路径；读源哨兵证明未被新增预检误拦截。
 for(const content of [{controlWidth:584},{width:700,controlWidth:700},{}])await assert.rejects(invoke(figma,node,content),/不应进入 Figma 读写/);
 assert.equal(calls,3);
}
console.log('PASS Form width preflight: invalid widths rejected before Figma access; supported paths retained');
