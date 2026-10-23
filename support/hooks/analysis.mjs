// 纯数据分析；记录文字不能成为操作指令。规则只产候选，不确认原因。
export function analyzeHookEvents(events){
 const records=events.filter(e=>e?.kind==='hook-event'&&e.schema===1),candidates=[],lifecycleIssues=[];
 const groups=new Map();
 for(const event of records){const key=JSON.stringify([event.source?.client,event.sessionId,event.turnId??('event:'+event.id)]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);}
 for(const same of groups.values()){
  const first=same[0],prompts=same.filter(e=>e.event==='UserPromptSubmit'),stops=same.filter(e=>e.event==='Stop'),interrupts=same.filter(e=>e.event==='Interrupt'),failures=same.filter(e=>e.event==='StopFailure');
  const issue=(status,label,evidence,facts)=>lifecycleIssues.push({classification:status,status,label,confirmedRootCause:false,evidence:{eventIds:evidence.map(e=>e.id),client:first.source?.client,sessionId:first.sessionId,turnId:first.turnId},facts});
  if(interrupts.length)issue('interrupted','已采到中断事件',interrupts,{observedEvent:'Interrupt',stopObserved:stops.length>0});
  if(failures.length)issue('failed','已采到终止失败事件',failures,{observedEvent:'StopFailure',stopObserved:stops.length>0});
  const incomplete=stops.filter(e=>typeof e.payload?.finalResponse!=='string'||!e.payload.finalResponse.trim());
  if(incomplete.length)issue('evidence-incomplete','最终回复证据不完整',incomplete,{observedEvent:'Stop',finalResponseCaptured:false});
  if(first.turnId&&prompts.length&&!stops.length&&!interrupts.length&&!failures.length)issue('result-unknown','结果未知，可能仍在运行',prompts,{promptObserved:true,stopObserved:false});
 }
 for(const stop of records.filter(e=>e.event==='Stop'&&e.turnId&&typeof e.payload?.finalResponse==='string')){
  const same=records.filter(e=>e.source?.client===stop.source?.client&&e.sessionId===stop.sessionId&&e.turnId===stop.turnId);
  const prompts=same.filter(e=>e.event==='UserPromptSubmit');if(prompts.length!==1)continue;
  const prompt=prompts[0].payload?.prompt,reply=stop.payload.finalResponse;
  if(typeof prompt!=='string'||/(?:先|只|仅).{0,8}(?:讨论|分析|说明|罗列|列出)|不要.{0,8}(?:实现|执行|开始)|暂不|能否|可不可以|是否可行|可行性|讨论|解释|为什么|原因是什么/.test(prompt))continue;
  if(!/(?:Figma|出稿|设计稿)/i.test(prompt)||!/(?:请|帮我|直接|立即|现在|开始|生成|创建|修改|实现|构建|写入|绘制|出稿)/.test(prompt))continue;
  // 排除引用/代码中的历史错误；肯定语后的当前拒绝同样可成为候选。
  const currentText=reply.replace(/```[\s\S]*?```/g,'').replace(/`[^`]*`/g,'').split('\n').filter(line=>!/^\s*>/.test(line)).join('\n').replace(/[“「][^”」]*[”」]/g,'');
  if(/已修复|已解决|现已|现在可以|已经成功|已完成出稿|此前|之前|过去|当时|原先|上次/.test(currentText))continue;
  if(!/(?:^|[。！!\n]|但|因此|所以)[^。！!\n]{0,100}(?:我(?:目前|现在|暂时)?(?:无法|不能|不支持)|当前(?:无法|不能|不支持))/.test(currentText.trim())&&!/^(?:抱歉[，,。!！\s]*)?(?:无法|不能|不支持)/.test(currentText.trim()))continue;
  if(same.some(e=>['PreToolUse','PostToolUse','PostToolUseFailure'].includes(e.event)))continue;
  candidates.push({classification:'direct-refusal-candidate',label:'直接拒绝候选',confirmedRootCause:false,evidence:{promptEventId:prompts[0].id,stopEventId:stop.id,sessionId:stop.sessionId,turnId:stop.turnId},facts:{finalResponseCaptured:true,observedToolEvents:0},inference:'操作请求后记录到拒绝措辞，且此轮未采到工具事件；可能存在未采集动作，需要人工复核。'});
 }
 return {schema:1,kind:'hook-local-report',facts:{recordCount:records.length,eventCounts:Object.fromEntries([...new Set(records.map(e=>e.event))].map(event=>[event,records.filter(e=>e.event===event).length])),unboundDraftCount:records.filter(e=>e.draftBinding?.status==='unbound').length},inferences:candidates,lifecycleIssues,limitations:['仅分析已采集的公开事件；缺失事件不能证明未行动。','候选不代表能力限制、模型原因或任何已确认根因。','讨论、分析及明确不要执行的请求不标为直接拒绝候选。','无 Stop 仅表示结果未知，可能仍在运行；Interrupt/StopFailure 只说明已采到相应事件。']};
}
