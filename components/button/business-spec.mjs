export function needsBusinessButton(input){return ['appearance','theme','size','shape','icon','iconName','state','width','loadingTone'].some(k=>input[k]!==undefined)||input.loading===true;}
export function validateButton(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Button需要对象');
 if(typeof input.id!=='string'||!input.id||input.id.includes('/'))throw Error('Button需要稳定id');
 for(const key of ['primary','disabled','loading'])if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('Button '+key+' 必须为布尔值');
 const s={id:input.id,label:input.label,appearance:input.appearance??(input.primary?'base':'outline'),theme:input.theme??(input.primary?'primary':'default'),size:input.size??'medium',shape:input.shape??'rectangle',icon:input.icon??'none',iconName:input.iconName,state:input.state??'normal',disabled:input.disabled??false,loading:input.loading??false,loadingTone:input.loadingTone,width:input.width};
 for(const [key,values]of Object.entries({appearance:['base','outline','text','ghost'],theme:['primary','default','danger'],size:['small','medium','large'],shape:['rectangle','square','circle'],icon:['none','prefix','suffix','only'],state:['normal','hover','active']}))if(!values.includes(s[key]))throw Error('Button '+key+' 不支持');
 if(s.shape==='rectangle'?s.icon==='only':!['none','only'].includes(s.icon))throw Error('Button形状与图标位置组合不存在');
 if(s.disabled&&s.state!=='normal')throw Error('Button禁用只支持normal状态');
 s.label??=s.shape==='rectangle'||s.icon!=='none'?'按钮':'T';
 if(typeof s.label!=='string'||!s.label.trim()||/[\r\n]/.test(s.label))throw Error('Button文案必须为非空单行文字');
 if(s.icon==='none'){if(s.iconName!=null)throw Error('Button无图标时不接受iconName');s.iconName=null;}
 else{s.iconName??={prefix:'download',suffix:'chevron-down',only:'search'}[s.icon];if(!['download','chevron-down','search'].includes(s.iconName))throw Error('Button图标缺少精确来源');}
 if(s.width!==undefined&&(!Number.isFinite(s.width)||s.width<=0||s.shape!=='rectangle'))throw Error('Button指定宽度仅支持矩形正数');
 if(s.loadingTone!==undefined&&!['muted','normal','dark-text'].includes(s.loadingTone))throw Error('Button加载色阶不支持');
 if(s.loading){
  if(s.size!=='medium'||s.shape!=='rectangle'||s.state!=='normal')throw Error('Button Loading仅支持medium矩形normal静态配方');
  if(s.appearance==='text'&&s.theme==='default'&&s.loadingTone===undefined)throw Error('Button文字默认主题Loading需明确loadingTone为dark-text或normal');
  const allowed=s.appearance==='text'&&s.theme==='default'?['dark-text','normal']:['base','outline'].includes(s.appearance)?['muted']:['normal'];
  s.loadingTone??=allowed[0];if(!allowed.includes(s.loadingTone))throw Error('Button Loading色阶组合不存在');
 }
 return s;
}
