// Page structure is a business composition, not an old Figma frame to clone.
// Dimensions/spacing follow the existing workbench composition. No old business menu is copied.
export async function buildPortableShell(figma, page, def, helpers) {
  const {autoFrame, text, instance, buttonLabel} = helpers;
  const width=def.contentWidth??1192, outer=width+32;
  const root=autoFrame(page,'工作台','VERTICAL',1440);root.resize(1440,932);root.primaryAxisSizingMode='FIXED';root.itemSpacing=0;
  root.fills=[{type:'SOLID',color:{r:1,g:1,b:1}}];
  const header=autoFrame(root,'顶部导航','HORIZONTAL',1440);header.resize(1440,64);header.primaryAxisSizingMode='FIXED';header.paddingLeft=24;header.counterAxisAlignItems='CENTER';
  await text(header,'业务标题',def.pageTitle,'body');
  const body=autoFrame(root,'页面主体','HORIZONTAL',1440);body.resize(1440,868);body.primaryAxisSizingMode='FIXED';body.itemSpacing=0;
  const sidebar=autoFrame(body,'运维菜单','VERTICAL',184);sidebar.resize(184,868);sidebar.primaryAxisSizingMode='FIXED';sidebar.paddingTop=24;
  const content=autoFrame(sidebar,'content','VERTICAL',184),menu=autoFrame(content,'业务菜单','VERTICAL',184),item=autoFrame(menu,'当前页面','HORIZONTAL',184);item.paddingLeft=16;await text(item,'菜单名称',def.menuLeaf,'body');
  const workspace=autoFrame(body,'工作区','VERTICAL',1256);workspace.resize(1256,868);workspace.primaryAxisSizingMode='FIXED';workspace.paddingLeft=workspace.paddingRight=16;workspace.itemSpacing=0;
  const paints=await figma.getLocalPaintStylesAsync();const background=paints.find(s=>s.name==='Gray 中性/Gray1-浅色背景');if(background)await workspace.setFillStyleIdAsync(background.id);
  const tabs=autoFrame(workspace,'页签区','HORIZONTAL',outer);tabs.resize(outer,60);tabs.primaryAxisSizingMode='FIXED';tabs.counterAxisAlignItems='CENTER';
  const query=autoFrame(workspace,'查询条件','VERTICAL',outer);query.paddingTop=query.paddingBottom=query.paddingLeft=query.paddingRight=16;query.itemSpacing=16;query.fills=root.fills;query.cornerRadius=8;
  const row=autoFrame(query,'查询行/模板','HORIZONTAL',width);row.itemSpacing=24;row.primaryAxisSizingMode='FIXED';row.counterAxisSizingMode='AUTO';
  if(def.search){
    const input=await instance('56:2',row,'筛选/工单编号');input.resize((width-48)/3,32);
    const select=await instance('72:35',row,'筛选/场站类型');select.resize((width-48)/3,32);
    const actions=autoFrame(row,'查询操作','HORIZONTAL',(width-48)/3);actions.counterAxisSizingMode='AUTO';
    for(const [id,label] of [['107:86','查询'],['107:124','重置']]){const n=await instance(id,actions,label);await buttonLabel(n,label);n.primaryAxisSizingMode='AUTO';}
  }
  const spacer=autoFrame(workspace,'区块间距','VERTICAL',outer);spacer.resize(outer,16);spacer.primaryAxisSizingMode='FIXED';
  const list=autoFrame(workspace,'工单结果','VERTICAL',outer);list.paddingLeft=list.paddingRight=list.paddingTop=list.paddingBottom=16;list.itemSpacing=0;list.fills=root.fills;list.cornerRadius=8;
  const toolbar=autoFrame(list,'列表工具栏','HORIZONTAL',width);toolbar.primaryAxisAlignItems='SPACE_BETWEEN';toolbar.resize(width,32);toolbar.primaryAxisSizingMode='FIXED';
  const mainActions=autoFrame(toolbar,'主要操作','HORIZONTAL',width-40);mainActions.resize(width-40,32);autoFrame(toolbar,'列设置','HORIZONTAL',32);
  const gap=autoFrame(list,'工具栏下间距','VERTICAL',width);gap.resize(width,16);gap.primaryAxisSizingMode='FIXED';
  autoFrame(list,'工单列表','VERTICAL',width);
  if(def.table?.pagination){
    let pagination=await instance('55:27',list,'工单分页');pagination=pagination.detachInstance();pagination.resize(width,64);pagination.paddingLeft=pagination.paddingRight=0;pagination.primaryAxisAlignItems='MAX';
    const group=pagination.findOne(n=>n.name==='group');group.primaryAxisSizingMode='AUTO';
    const total=await text(group,'总数','共0 条');group.insertChild(0,total);
    const buttons=pagination.findOne(n=>n.name==='page btn');
    for(const [i,n] of buttons.children.entries())if(i>0&&i<buttons.children.length-1)n.name='页码/'+i;
  }else autoFrame(list,'工单分页','HORIZONTAL',width);
  return root;
}
