import {validateLink,linkVariant,SOURCE_VARIANTS} from './generator.mjs';
export function portableLinkDependencies(specs){
 return Object.fromEntries(specs.map(spec=>{
  const s=validateLink(spec);if(s.prefix||s.suffix)throw Error('Link图标槽位尚未支持新文件初始化');
  const name=linkVariant(s),v=SOURCE_VARIANTS.find(v=>linkVariant(v)===name);if(!v)throw Error('Link变体缺失');return [name,v.id];
 }));
}
export async function renderPortableLink(figma,parent,s){
 const spec=validateLink(s),name=linkVariant(spec);
 if(spec.prefix||spec.suffix)throw Error('Link图标槽位尚未支持新文件初始化');
 const main=await figma.getNodeByIdAsync(PORTABLE_LINK_IDS[name]);
 if(main?.type!=='COMPONENT'||main.name!==name)throw Error('Link目标变体缺失');
 const node=main.createInstance();parent.appendChild(node);node.name='链接/'+spec.id;
 const label=node.findOne(n=>n.type==='TEXT'&&n.name==='text');if(!label)throw Error('Link文字槽缺失');
 for(const seg of label.getStyledTextSegments(['fontName']))await figma.loadFontAsync(seg.fontName);
 if(spec.text!==undefined)label.characters=spec.text;
 label.textAutoResize='WIDTH_AND_HEIGHT';node.primaryAxisSizingMode='AUTO';return node;
}
