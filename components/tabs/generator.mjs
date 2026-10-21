export function validateTabs(input){
 const s={placement:'content',orientation:'top',icon:false,active:0,...input};
 if(!['top','left'].includes(s.orientation)||typeof s.icon!=='boolean')throw Error('Tabs方向或图标配置无效');
 if(!Array.isArray(s.items)||s.items.some(x=>typeof x!=='string'||!x.trim())||s.items.length<2||s.items.length>8||s.orientation==='left'&&s.items.length!==8)throw Error('Tabs整栏仅支持top 2–8项、left 8项');
 if(!Number.isInteger(s.active)||s.active<0||s.active>=s.items.length)throw Error('Tabs选中索引无效');
 if(s.remove||s.disabled||s.iconName)throw Error('整栏源未提供关闭、禁用或自定义图标组合');
 return s;
}
export function tabsKey(s){return [s.orientation,s.items.length,s.icon].join('|');}
export async function updateTabs(figma,n,s){
 const ids=[n.id,...n.findAll(()=>true).map(x=>x.id)],main=n.type==='INSTANCE'?await n.getMainComponentAsync():await figma.getNodeByIdAsync(s.mainId);
 const text=x=>x.findOne(t=>t.type==='TEXT');
 async function paint(a,b){for(const k of ['fills','strokes'])a[k]=JSON.parse(JSON.stringify(b[k]));for(const k of ['strokeWeight','strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'])if(k in b&&typeof b[k]==='number')a[k]=b[k];for(const k of ['fill','stroke'])if(b[k+'StyleId'])await a[k==='fill'?'setFillStyleIdAsync':'setStrokeStyleIdAsync'](b[k+'StyleId']);}
 for(const [i,item]of n.children.entries()){
  const source=main.children[i===s.active?1:0],label=text(item);for(const p of label.getStyledTextSegments(['fontName']))await figma.loadFontAsync(p.fontName);label.characters=s.items[i];await paint(item,source);await paint(text(item),text(source));
  const vectors=item.findAll(x=>x.type==='VECTOR'),ref=source.findAll(x=>x.type==='VECTOR');for(let j=0;j<vectors.length;j++){const sourceVector=ref[Math.min(j,ref.length-1)];await paint(vectors[j],sourceVector);if(n.type!=='INSTANCE')await vectors[j].setVectorNetworkAsync(JSON.parse(JSON.stringify(sourceVector.vectorNetwork)));}
 }
 return {id:n.id,idsStable:JSON.stringify(ids)===JSON.stringify([n.id,...n.findAll(()=>true).map(x=>x.id)])};
}
export async function renderTabs(figma,parent,s,width){
 const main=await figma.getNodeByIdAsync(s.mainId);let n=main.createInstance();parent.appendChild(n);if(s.orientation==='left')n=n.detachInstance();n.name='内容页签';if(s.orientation==='top')n.resize(width,48);await updateTabs(figma,n,s);return n;
}
export async function inspectTabs(n){return {id:n.id,mainId:n.type==='INSTANCE'?(await n.getMainComponentAsync()).id:null,type:n.type,width:n.width,height:n.height,items:n.children.map(c=>{const t=c.findOne(x=>x.type==='TEXT');return {text:t.characters,selected:c.strokes.length>0&&(c.strokeBottomWeight===3||c.strokeRightWeight===3),fits:t.absoluteTransform[0][2]+t.width<=c.absoluteTransform[0][2]+c.width&&t.height<=c.height};})};}
export function arrangeLeftTabs(figma,list,width){
 const tabs=list.children.find(n=>n.name==='内容页签');if(!tabs||tabs.width!==160)return;
 const index=list.children.indexOf(tabs),rest=list.children.slice(index+1),row=figma.createFrame(),body=figma.createFrame();list.insertChild(index,row);row.name='左侧页签与内容';row.layoutMode='HORIZONTAL';row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';row.resize(width,600);row.counterAxisSizingMode='AUTO';row.fills=[];body.name='页签内容';body.layoutMode='VERTICAL';body.primaryAxisSizingMode='AUTO';body.counterAxisSizingMode='FIXED';body.resize(width-160,48);body.primaryAxisSizingMode='AUTO';body.fills=[];row.appendChild(tabs);row.appendChild(body);for(const n of rest){body.appendChild(n);if(n.name==='分页')n.resize(width-160,n.height);}return row;
}
export async function renderTopTabs(figma,parent,s,width){
 const m=await figma.getNodeByIdAsync(s.mainId),n=m.createInstance();parent.appendChild(n);n.name='内容页签';n.resize(width,48);
 for(const [i,c]of n.children.entries()){const a=m.children[i===s.active?1:0],t=c.findOne(x=>x.type==='TEXT'),u=a.findOne(x=>x.type==='TEXT');await figma.loadFontAsync(t.fontName);t.characters=s.items[i];c.strokes=JSON.parse(JSON.stringify(a.strokes));for(const k of ['strokeTopWeight','strokeBottomWeight','strokeLeftWeight','strokeRightWeight'])c[k]=a[k];t.fills=JSON.parse(JSON.stringify(u.fills));}
 return n;
}
