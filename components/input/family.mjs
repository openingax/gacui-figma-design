export function validateInputField(spec){
 if(!['input','input-focus','input-password','textarea','input-addon'].includes(spec.family))throw Error('输入组件家族无效');
 if(typeof spec.variant!=='string'||!spec.variant.trim())throw Error('须选择源中存在的完整变体名');
 for(const key of ['value','placeholder','tips','prepend','append'])if(spec[key]!==undefined&&typeof spec[key]!=='string')throw Error(key+' 必须是文字');
 if(spec.width!==undefined&&(!Number.isFinite(spec.width)||spec.width<120))throw Error('输入框宽度至少120');
 if(spec.limit!==undefined&&(!Number.isInteger(spec.limit)||spec.limit<1))throw Error('字符上限必须是正整数');
 return {...spec};
}
export async function renderInputField(figma,parent,spec,deps,existing=null){
 const s=validateInputField(spec);if(figma.fileKey!==deps.fileKey)throw Error('输入框目标文件不符');
 const recipe=deps.families[s.family]?.find(r=>r.name===s.variant);if(!recipe)throw Error('输入变体不在规范清单');
 const master=await figma.getNodeByIdAsync(recipe.id);if(master?.type!=='COMPONENT')throw Error('输入框母组件缺失');
 const name='输入组件/'+s.id+'/'+recipe.sourceId;
 if(existing&&(existing.parent!==parent||existing.name!==name))throw Error('原位编辑须保持同一输入变体');
 let n=existing;if(!n){const instance=master.createInstance();parent.appendChild(instance);n=instance.detachInstance();n.name=name;}
 async function text(node,value){if(!node)return;try{await figma.loadFontAsync(node.fontName)}catch{await figma.loadFontAsync({family:'Noto Sans SC',style:'Regular'});node.fontName={family:'Noto Sans SC',style:'Regular'}}node.characters=value;}
 const at=path=>path?.reduce((node,i)=>node?.children?.[i],n);
 const label=at(recipe.bindings.value);
 if(s.value!==undefined||s.placeholder!==undefined)await text(label,s.value??s.placeholder);
 if(s.tips!==undefined)await text(at(recipe.bindings.tips),s.tips);
 if(s.prepend!==undefined)await text(at(recipe.bindings.prepend),s.prepend);
 if(s.append!==undefined)await text(at(recipe.bindings.append),s.append);
 if(s.family==='input-password'&&s.value!==undefined){const mask=at(recipe.bindings.mask);if(mask){const dots=mask.children.filter(t=>t.type==='ELLIPSE'),count=Array.from(s.value).length;const template=dots[0];if(!template)throw Error('密码遮罩缺少源圆点');for(let i=1;i<dots.length;i++)if(i>=count)dots[i].remove();template.visible=count>0;for(let i=dots.length;i<count;i++)mask.appendChild(template.clone());mask.clipsContent=true;}}
 if(s.family==='textarea'){const counters=recipe.bindings.counter.map(at);for(const c of counters)await text(c,Array.from(s.value??label?.characters??'').length+'/'+(s.limit??150));}
 if(s.width!==undefined)n.resize(s.width,n.height);
 return n;
}
