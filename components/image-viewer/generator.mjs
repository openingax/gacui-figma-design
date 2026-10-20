import{validateFeedback}from'../feedback/generator.mjs';
export function validateImageViewer(s){if(s.emptyFeedback)validateFeedback({id:s.id+'-empty',kind:'empty',message:'暂无附件',variant:s.emptyFeedback.variant});if(!Array.isArray(s.items))throw Error('图片查看器需要items');const ids=new Set();for(const i of s.items){if(!i.id||ids.has(i.id)||!i.filename||!['normal','hover','error'].includes(i.state??'normal'))throw Error('图片项需要唯一id、filename和有效state');ids.add(i.id);}if(s.open&&!s.items.some(i=>i.id===s.open&&i.state!=='error'))throw Error('查看大图必须指向可读取图片');if(s.gallery)throw Error('图库模式尚未导入');return s;}
export async function renderImageViewer(figma,root,parent,s,h){
 const {autoFrame,text,instance,normalize,setText,buttonLabel}=h,width=h.width??1192,columns=Math.max(1,Math.floor((width+24)/192));
 const block=autoFrame(parent,'图片查看/'+s.id,'VERTICAL',width);block.itemSpacing=16;
 await text(block,'附件标题',s.title||'附件查看','body',width);
 if(!s.items.length){if(s.emptyFeedback)await h.renderFeedback(figma,block,{id:s.id+'-empty',kind:'empty',message:'暂无附件',variant:s.emptyFeedback.variant??'compact'},h);else await text(block,'无附件','暂无附件');return block;}
 let row;for(const [idx,item]of s.items.entries()){
 if(idx%columns===0){row=autoFrame(block,'图片行/'+idx,'HORIZONTAL',width);row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';row.itemSpacing=24;}
 const cell=autoFrame(row,'图片项/'+item.id,'VERTICAL',168);cell.itemSpacing=8;
 const main=await figma.getNodeByIdAsync(item.state==='error'?'422:13':item.state==='hover'?'422:6':'422:3');const view=main.createInstance();cell.appendChild(view);view.name='缩略图';await normalize(view);
 if(item.state==='error'){const t=view.findOne(n=>n.type==='TEXT');await setText(t,'图片加载失败');}else {const img=view.findOne(n=>n.name==='image'),hash=item.imageHash||'43621e4f096140e8706686167dcbe771f046a043';if(!figma.getImageByHash(hash))throw Error('图片资产缺失');img.fills=img.fills.map(p=>p.type==='IMAGE'?{...p,imageHash:hash}:p);}
 await text(cell,'文件名',item.filename,'body',168);
 const b=await instance('107:124',cell,item.state==='error'?'重新加载':'查看原图');await buttonLabel(b,item.state==='error'?'重新加载':'查看原图');b.primaryAxisSizingMode='AUTO';
 }
 if(s.demo)await text(block,'演示资产说明',s.demo,'secondary',width);
 if(s.open){const item=s.items.find(i=>i.id===s.open),main=await figma.getNodeByIdAsync('422:18');let n=main.createInstance();root.appendChild(n);n=n.detachInstance();n.name='图片大图/'+s.id;n.layoutPositioning='ABSOLUTE';await normalize(n);n.x=(root.width-1200)/2;n.y=100;const t=n.findOne(n=>n.type==='TEXT');await setText(t,item.filename);t.textAutoResize='HEIGHT';t.resize(900,t.height);const bg=t.parent;bg.resize(916,t.height+10);bg.x=(1200-bg.width)/2;const img=n.findOne(n=>n.name==='image');img.fills=img.fills.map(p=>p.type==='IMAGE'?{...p,imageHash:item.imageHash||'43621e4f096140e8706686167dcbe771f046a043'}:p);}
 return block;
}
export function verifyImageViewers(specs,actual){const errors=[];for(const s of specs){const a=actual.find(n=>n.id===s.id);if(!a){errors.push('图片查看器缺失');continue;}if(JSON.stringify(a.items.map(i=>({id:i.id,filename:i.filename,error:i.error})))!==JSON.stringify(s.items.map(i=>({id:i.id,filename:i.filename,error:i.state==='error'}))))errors.push('附件集合、文件名或失败状态不符');if(a.items.some(i=>!i.fits))errors.push('附件内容越界');if(a.open!==(s.open||null))errors.push('大图状态不符');}return errors;}
