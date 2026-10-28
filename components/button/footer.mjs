// 保留 Drawer 原有上下留白；按钮变高时压缩正文，不覆盖正文或裁切底栏。
export function fitButtonFooter(panel,footer,content){
 const buttons=footer.children.filter(n=>n.visible),border=footer.strokesIncludedInLayout&&footer.strokes.length?footer.strokeTopWeight+footer.strokeBottomWeight:0;
 const height=Math.max(56,...buttons.map(n=>n.height+footer.paddingTop+footer.paddingBottom+border));
 const width=buttons.reduce((sum,n)=>sum+n.width,0)+Math.max(0,buttons.length-1)*footer.itemSpacing+footer.paddingLeft+footer.paddingRight;
 if(width>panel.width+.01||height>panel.height-content.y)throw Error('Button底栏内容超出抽屉可用范围');
 footer.resize(panel.width,height);footer.y=panel.height-height;content.resize(panel.width,footer.y-content.y);
 return {footerId:footer.id,contentId:content.id,height,contentHeight:content.height};
}
