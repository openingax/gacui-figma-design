import {validatePagination} from '../pagination/generator.mjs';
import {validateLink} from '../link/generator.mjs';
export function validateList(input){
 const s={size:'medium',kind:'base',stripe:false,split:false,...input};
 if(!['large','medium','small'].includes(s.size)||!['base','multiline','meta'].includes(s.kind))throw Error('List 尺寸或类型无效');
 if(typeof s.stripe!=='boolean'||typeof s.split!=='boolean'||s.stripe&&s.split)throw Error('List 斑马纹与分割线不能同时启用');
 if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<=0))throw Error('List 宽度必须为正数');
 if(!Array.isArray(s.items)||!s.items.length)throw Error('List 需要至少一行；7行不是业务限制');
 if(s.pagination!==undefined){if(!s.pagination||typeof s.pagination!=='object')throw Error('List 分页需要明确配置');s.pagination=validatePagination(s.pagination);}
 const ids=new Set();s.items=s.items.map(p=>{if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))throw Error('List 行ID必须唯一');ids.add(p.id);
  if(typeof p.description!=='string'||!p.description.trim())throw Error('List 正文不能为空');
  if(s.kind==='base'&&p.title!==undefined||s.kind!=='base'&&(typeof p.title!=='string'||!p.title.trim()))throw Error('List 标题与类型不符');
  if(p.image!==undefined&&(s.kind!=='meta'||!p.image||!!p.image.base64===!!p.image.hash||p.image.base64!==undefined&&(typeof p.image.base64!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(p.image.base64))||p.image.hash!==undefined&&(typeof p.image.hash!=='string'||!/^[a-f0-9]{40}$/.test(p.image.hash))||typeof p.image.alt!=='string'||!p.image.alt.trim()))throw Error('List 图片只用于图文类型，需要base64或已转移图片hash及说明');
  if(p.actions!==undefined&&(!Array.isArray(p.actions)||new Set(p.actions.map(a=>a?.id)).size!==p.actions.length))throw Error('List 操作ID必须唯一');
  for(const a of p.actions??[]){if(!a||typeof a.id!=='string'||!a.id||typeof a.text!=='string'||!a.text.trim()||a.size&&a.size!=='medium'||a.prefix||a.suffix)throw Error('List 操作需要中号无图标文字链接');validateLink(a);}
  if(p.image?.mime!==undefined&&!['image/png','image/jpeg','image/webp','image/gif'].includes(p.image.mime))throw Error('List 图片格式仅支持PNG/JPEG/WebP/GIF');if(p.image?.scalingFactor!==undefined&&(!Number.isFinite(p.image.scalingFactor)||p.image.scalingFactor<=0))throw Error('List 图片缩放因子无效');return {...p,actions:p.actions??[]};
 });return s;
}
export async function fitListRow(figma,row,item,width){
 const slot=row.children.find(n=>n.name==='列表操作'),body=row.children.find(n=>n.name==='列表内容'||n.name==='content');
 const available=width-row.paddingLeft-row.paddingRight-(slot?slot.width+row.itemSpacing:0);
 if(available<24)throw Error('List 操作挤占正文');
 if(body){body.resize(available,body.height);body.layoutSizingHorizontal='FILL';}
 const picture=row.findOne(n=>n.name==='picture'||n.name.startsWith('列表图片/'));
 const textBox=row.findOne(n=>n.type==='FRAME'&&(n.name==='text content'||n.name==='列表内容'&&n.layoutMode==='VERTICAL'));
 const textWidth=available-(picture?picture.width+16:0)-(textBox?.paddingRight??0);
 if(textWidth<24)throw Error('List 文本可用宽度不足');
 if(textBox){textBox.resize(textWidth+textBox.paddingRight,textBox.height);textBox.primaryAxisSizingMode='AUTO';textBox.counterAxisSizingMode='FIXED';}
 for(const [name,value]of [['title',item.title],['description',item.description]]){const t=row.findOne(n=>n.type==='TEXT'&&n.name===name);if(value===undefined)continue;if(!t)throw Error('List 文字槽缺失');t.textAutoResize='WIDTH_AND_HEIGHT';t.layoutSizingHorizontal='HUG';t.characters=value;if(t.width>textWidth){t.textAutoResize='HEIGHT';t.resize(textWidth,t.height);}t.layoutSizingHorizontal=t.textAutoResize==='HEIGHT'?'FIXED':'HUG';}
 row.primaryAxisSizingMode=row.layoutMode==='HORIZONTAL'?'FIXED':'AUTO';row.counterAxisSizingMode=row.layoutMode==='HORIZONTAL'?'AUTO':'FIXED';
 for(const t of row.findAllWithCriteria({types:['TEXT']}))if(t.x<-.01||t.y<-.01||t.x+t.width>t.parent.width+.01||t.y+t.height>t.parent.height+.01)throw Error('List 文字越界');
}
export async function renderList(figma,parent,input,h){
 const s=validateList(input),deps=h.listDeps,width=s.width??h.width??1200;
 const entry=deps.items.find(n=>n.size===s.size&&n.kind===s.kind),main=entry&&await figma.getNodeByIdAsync(entry.id),divider=await figma.getNodeByIdAsync(deps.dividerId);
 if(main?.type!=='COMPONENT'||main.parent?.parent?.id!==deps.pageId||divider?.type!=='COMPONENT')throw Error('List 母件依赖缺失');
 const root=figma.createFrame();parent.appendChild(root);
 try{root.name='列表/'+s.id;root.resize(width,1);root.layoutMode='VERTICAL';root.primaryAxisSizingMode='AUTO';root.counterAxisSizingMode='FIXED';root.itemSpacing=0;root.fills=[];root.strokes=[];root.clipsContent=false;
  for(let i=0;i<s.items.length;i++){
   const p=s.items[i];let row=main.createInstance();root.appendChild(row);await h.normalize(row);row.resize(width,row.height);row.layoutSizingHorizontal='FILL';
   // 内容适配使用源母件实例；增加操作槽才按源活跃FRAME样例解除行实例。
   if(p.actions.length){row=row.detachInstance();row.layoutMode='HORIZONTAL';row.primaryAxisAlignItems=s.kind==='base'?'CENTER':'MIN';row.counterAxisAlignItems=s.kind==='base'?'MIN':'CENTER';row.itemSpacing=deps.actions.rowGap;
    let body;if(s.kind==='base'){body=figma.createFrame();row.appendChild(body);body.layoutMode='HORIZONTAL';body.primaryAxisSizingMode='FIXED';body.counterAxisSizingMode='AUTO';body.fills=[];body.strokes=[];body.itemSpacing=16;const t=row.children.find(n=>n.type==='TEXT');if(!t)throw Error('正文缺失');const textBox=figma.createFrame();body.appendChild(textBox);textBox.name='text content';textBox.layoutMode='VERTICAL';textBox.primaryAxisSizingMode='AUTO';textBox.counterAxisSizingMode='FIXED';textBox.paddingRight=48;textBox.itemSpacing=8;textBox.fills=[];textBox.strokes=[];textBox.layoutSizingHorizontal='FILL';textBox.appendChild(t);row.insertChild(0,body);}else body=row.children[0];body.name='列表内容';body.layoutSizingHorizontal='FILL';
    const slot=figma.createFrame();row.appendChild(slot);slot.name='列表操作';slot.layoutMode='HORIZONTAL';slot.primaryAxisSizingMode='AUTO';slot.counterAxisSizingMode='AUTO';slot.itemSpacing=deps.actions.gap;slot.fills=[];slot.strokes=[];for(const action of p.actions){const link=await h.renderLink(figma,slot,{...action,size:'medium',prefix:false,suffix:false});link.cornerRadius=deps.actions.linkCornerRadius;}
   }
   row.name='列表项/'+p.id;if(s.stripe&&i%2)row.fills=JSON.parse(JSON.stringify(deps.stripeFills));
   if(p.image){const picture=row.findOne(n=>n.name==='picture');if(!picture)throw Error('图片槽缺失');const image=p.image.hash?figma.getImageByHash(p.image.hash):figma.createImage(figma.base64Decode(p.image.base64));if(!image)throw Error('List 图片尚未转移到目标');picture.fills=[{type:'IMAGE',imageHash:image.hash,scaleMode:'FILL',scalingFactor:p.image.scalingFactor??1}];picture.name='列表图片/'+p.image.alt;}
   await fitListRow(figma,row,p,width);
   if(s.split&&i<s.items.length-1){const line=divider.createInstance();root.appendChild(line);line.name='列表分割线';line.resizeWithoutConstraints(width,0);line.layoutSizingHorizontal='FILL';}
  }if(s.pagination){if(!h.renderPagination||!h.inspectPagination||!h.verifyPagination)throw Error('List 分页适配缺失');const line=divider.createInstance();root.appendChild(line);line.name='列表分页分隔线';line.resizeWithoutConstraints(width,0);line.layoutSizingHorizontal='FILL';const p=await h.renderPagination(figma,root,s.pagination,width);p.name='列表分页';const errors=h.verifyPagination(s.pagination,await h.inspectPagination(p));if(errors.length)throw Error(errors.join(','));}
  root.resizeWithoutConstraints(width+1,root.height);root.resizeWithoutConstraints(width,root.height);assertListFits(root);return root;
 }catch(error){root.remove();throw error;}
}
export function assertListFits(root){
 for(const n of root.findAll(n=>'width'in n&&'height'in n)){let visible=true;for(let p=n;p&&p!==root;p=p.parent)if(p.visible===false)visible=false;if(!visible)continue;const p=n.parent,t=n.relativeTransform,points=[[0,0],[n.width,0],[0,n.height],[n.width,n.height]].map(([x,y])=>[t[0][0]*x+t[0][1]*y+t[0][2],t[1][0]*x+t[1][1]*y+t[1][2]]);if(points.some(([x,y])=>x<-.01||y<-.01||x>p.width+.01||y>p.height+.01))throw Error('List 内容越界 '+n.name);}
}
export async function updateList(figma,root,input,h){
 const before=validateList(h.beforeSpec),next=validateList(input);
 const structure=s=>JSON.stringify({id:s.id,size:s.size,kind:s.kind,stripe:s.stripe,split:s.split,width:s.width,pagination:s.pagination,items:s.items.map(p=>({id:p.id,image:p.image,actions:p.actions.map(a=>({...a,text:undefined}))}))});
 if(root.name!=='列表/'+before.id)throw Error('List 根身份变化');
 if(structure(before)!==structure(next))throw Error('List 结构或数量变化使用对应状态画板；原位入口用于同结构文字修改');
 const rows=root.children.filter(n=>n.name.startsWith('列表项/'));if(rows.length!==before.items.length||rows.some((r,i)=>r.name!=='列表项/'+before.items[i].id))throw Error('List 行身份变化');
 for(const t of root.findAllWithCriteria({types:['TEXT']}))for(const f of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(f.fontName);
 async function apply(s){for(let i=0;i<rows.length;i++){const p=s.items[i],r=rows[i],slot=r.children.find(n=>n.name==='列表操作');for(const a of p.actions){const n=slot?.children.find(n=>n.name==='链接/'+a.id);if(!n)throw Error('List 操作槽缺失');await h.updateLink(figma,n,{...a,size:'medium',prefix:false,suffix:false});}await fitListRow(figma,r,p,root.width);}const width=root.width;root.resizeWithoutConstraints(width+1,root.height);root.resizeWithoutConstraints(width,root.height);assertListFits(root);}
 try{await apply(next);}catch(error){try{await apply(before);}catch(rollback){throw Error('List 回滚失败 '+String(rollback)+'; 原错误 '+String(error));}throw error;}
 return {mutatedNodeIds:[root.id,...root.findAll(n=>true).map(n=>n.id)]};
}
export function inspectList(root){
 const pager=root.children.find(n=>n.name==='列表分页');const pagination=pager?{id:pager.id,type:pager.type,height:pager.height,texts:pager.findAllWithCriteria({types:['TEXT']}).filter(n=>{for(let p=n;p&&p!==pager;p=p.parent)if(p.visible===false)return false;return true;}).map(n=>n.characters)}:null;let fits=true;try{assertListFits(root);}catch{fits=false;}
 return {id:root.name.slice(3),width:root.width,height:root.height,fits,pagination,rows:root.children.filter(n=>n.name.startsWith('列表项/')).map(n=>({id:n.name.slice(4),nodeId:n.id,type:n.type,width:n.width,height:n.height,title:n.findOne(n=>n.type==='TEXT'&&n.name==='title')?.characters,description:n.findOne(n=>n.type==='TEXT'&&n.name==='description')?.characters,actions:(n.children.find(n=>n.name==='列表操作')?.children??[]).map(n=>({id:n.name.slice(3),text:n.findAllWithCriteria({types:['TEXT']}).map(t=>t.characters).join('')})),image:n.findOne(n=>n.name.startsWith('列表图片/'))?.fills?.find(p=>p.type==='IMAGE')?.imageHash??null,imageAlt:n.findOne(n=>n.name.startsWith('列表图片/'))?.name.slice(5)??null})),dividers:root.children.filter(n=>n.name==='列表分割线').length};
}
export function verifyLists(specs,actual){
 const errors=[];if(specs.length!==actual?.length)return ['List 可见数量不符'];
 for(const s of specs){const a=actual.find(a=>a.id===s.id);if(!a||!a.fits||a.rows.length!==s.items.length||a.dividers!==(s.split?s.items.length-1:0)){errors.push('List 行数、分割线或边界不符 '+s.id);continue;}
  if(s.pagination){const p=s.pagination,expected=[...(p.totalContent?['共 '+p.total+' 项数据']:[]),...(p.pagesize?[p.pageSize+' 条/页']:[]),...(p.theme==='simple'||p.jumper?[String(p.current),'/'+p.pageCount+' 页']:[]),...(p.pages??[]).filter(x=>x!=='…').map(String)];if(a.pagination?.type!=='INSTANCE'||a.pagination.height!==64||expected.some(t=>!a.pagination.texts.includes(t)))errors.push('List 分页内容不符 '+s.id);}else if(a.pagination)errors.push('List 多余分页 '+s.id);
  s.items.forEach((p,i)=>{const q=a.rows[i];if(q.id!==p.id||q.title!==p.title||q.description!==p.description||JSON.stringify(q.actions)!==JSON.stringify(p.actions.map(a=>({id:a.id,text:a.text})))||(p.image&&(q.image!==(p.image.hash??p.image.expectedHash)||q.imageAlt!==p.image.alt))||!p.image&&q.image!==null)errors.push('List 内容、图片或操作不符 '+p.id);});
 }return errors;
}
