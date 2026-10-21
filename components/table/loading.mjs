import {validateLoading} from '../loading/generator.mjs';
export function validateTableLoading(input){
 if(input===undefined)return undefined;if(typeof input==='boolean')return {active:input,...validateLoading({})};
 if(!input||typeof input!=='object'||Array.isArray(input)||input.active!==undefined&&typeof input.active!=='boolean')throw Error('表格loading须为布尔或Loading配置');
 return {...validateLoading(input),active:input.active??true};
}
export async function updateTableLoading(figma,region,s){
 if(region.type!=='FRAME'||!region.name.startsWith('表格区域/'))throw Error('只允许修改表格区域副本');
 figma.skipInvisibleInstanceChildren=false;
 const before=[region.id,...region.findAll(()=>true).map(n=>n.id)];
 const content=region.children.filter(n=>n.name!=='表格加载遮罩'),height=content.reduce((h,n)=>h+n.height,0),width=content[0].width;
 region.resize(width,height);region.primaryAxisSizingMode='FIXED';region.counterAxisSizingMode='FIXED';
 let overlay=region.children.find(n=>n.name==='表格加载遮罩');
 if(!s.active){if(overlay)overlay.visible=false;return {active:false,nodeId:region.id,createdNodeIds:[],mutatedNodeIds:[region.id,...(overlay?[overlay.id]:[])]};}
 const main=await figma.getNodeByIdAsync(s.mainId);if(main?.type!=='COMPONENT')throw Error('表格Loading依赖缺失');
 if(!overlay){overlay=figma.createAutoLayout('HORIZONTAL');region.appendChild(overlay);overlay.name='表格加载遮罩';overlay.layoutPositioning='ABSOLUTE';overlay.fills=JSON.parse(JSON.stringify(content[0].fills));overlay.primaryAxisAlignItems=overlay.counterAxisAlignItems='CENTER';}
 overlay.visible=true;overlay.resize(width,height);overlay.primaryAxisSizingMode=overlay.counterAxisSizingMode='FIXED';overlay.x=overlay.y=0;
 let n=overlay.children[0];if(!n){n=main.createInstance();overlay.appendChild(n);}else if((await n.getMainComponentAsync()).id!==main.id)n.swapComponent(main);
 const t=n.findOne(n=>n.type==='TEXT');if(t){for(const seg of t.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);t.characters=s.label;}
 if(n.width>width||n.height>height)throw Error('表格Loading内容超出区域');
 const after=[region.id,...region.findAll(()=>true).map(n=>n.id)];return {active:true,nodeId:region.id,overlayId:overlay.id,mainId:main.id,createdNodeIds:after.filter(id=>!before.includes(id)),mutatedNodeIds:after};
}
export async function inspectTableLoading(figma,region,s){
 if(!region)return {errors:['表格区域缺失']};const overlay=region.children.find(n=>n.name==='表格加载遮罩'),active=!!overlay?.visible,errors=[];if(active!==s.active)errors.push('表格Loading可见性不符');
 if(active){const n=overlay.children[0];if(!n||(await n.getMainComponentAsync()).id!==s.mainId||n.findOne(n=>n.type==='TEXT')?.characters!==(s.variant==='spinner'?undefined:s.label))errors.push('表格Loading组件或内容不符');if(overlay.x!==0||overlay.y!==0||Math.abs(overlay.width-region.width)>.1||Math.abs(overlay.height-region.height)>.1)errors.push('表格Loading区域不符');}
 return {nodeId:region.id,overlayId:overlay?.id,active,width:region.width,height:region.height,errors};
}
