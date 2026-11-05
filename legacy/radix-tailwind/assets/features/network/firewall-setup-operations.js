'use strict';

function firewallSetupCurrentError(o){
 const plan=o.input.plan,host=firewallHost(plan.server.id);
 if(serverSnapshotError(plan.server))return '服务器身份或连接配置已改变，保留原操作核对。';
 if(!host||host.operationId!==o.id||host.revision!==plan.before.revision||JSON.stringify(S.firewalls.filter(r=>r.server===plan.server.id))!==JSON.stringify(plan.allRules))return '检测到外部配置或规则变化，不能覆盖当前状态。';
 const configuration=value=>JSON.stringify([value.manager,value.backend,value.configuration,value.serviceManager,value.defaultPolicy,value.zones,value.preserved,value.blockers]);
 if(configuration(host)!==configuration(plan.before))return '检测到外部管理配置变化，继续保留恢复保护。';
 return '';
}
function finishFirewallSetup(o,result='success'){
 if(!o||!['running','unknown'].includes(o.status))return;
 clearInterval(timers.get(o.id));timers.delete(o.id);
 const plan=o.input.plan,host=firewallHost(plan.server.id),error=firewallSetupCurrentError(o);
 if(error)result='unknown';
 o.status=['success','failed','rolled-back'].includes(result)?result:'unknown';o.ended=o.status==='unknown'?null:now();o.protectionReleased=o.status!=='unknown';
 if(o.status==='success'){
  S.firewallHosts[plan.server.id]={...clone(plan.before),state:'ready',manager:'firewalld',backend:'nftables',configuration:'consistent',defaultPolicy:plan.mode==='install'?plan.targetPolicy:plan.before.defaultPolicy,zones:clone(plan.zones),revision:plan.before.revision+1,captured:now(),reason:'已完成统一接入；新 SSH 与运行／永久配置已核对（模拟）。'};
  o.message='统一接入完成。现有入站规则已保留，Docker / VPN 等软件规则保持原归属。';
 }else if(o.status==='failed'||o.status==='rolled-back'){
  S.firewallHosts[plan.server.id]={...clone(plan.before),captured:now(),reason:o.status==='failed'?'接入失败，已核实恢复原配置与服务状态；可重新检查后生成新计划。':'已沿原操作核实恢复原配置和服务状态；当前未完成统一接入。'};
  o.message=o.status==='failed'?'安装或切换失败；原配置及服务状态已恢复并核实（模拟）。':'已恢复原配置与服务状态，并解除本次恢复保护（模拟）。';
 }else{
  if(host){host.state='unknown';host.reason=error||'切换响应丢失，继续保留恢复保护；请核对原操作。';}
  o.message=error||'执行结果未知；原配置、固定计划和恢复保护保留，不重新提交安装或迁移。';
 }
 o.steps.forEach((step,i)=>{step.status=o.status==='success'?'success':o.status==='unknown'?(i<2?'success':i===2?'unknown':'pending'):i<2?'success':i===2?'failed':'pending';step.note=o.status==='success'?'已核对（模拟）':o.status==='unknown'?'保留已知证据，等待核对':'失败及恢复结果单独记录';});
 if(['failed','rolled-back'].includes(o.status))o.steps.push({title:'恢复原配置与服务状态',status:'success',note:'恢复已核实，已解除本次保护（模拟）'});
 o.firewallChecks||=[];o.firewallChecks.push({at:now(),result:o.status,message:o.message});persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();return o;
}
function firewallSetupOperationSummary(o){
 if(o.input?.action!=='setup')return '';
 return `<details><summary>固定接入计划与保留范围</summary>${firewallSetupSummary(o.input.plan,true)}</details>${o.firewallChecks?.length?'<ul>'+o.firewallChecks.map(check=>`<li>${fmt(check.at)} · ${h(check.message)}</li>`).join('')+'</ul>':''}<p>${o.protectionReleased?'本次恢复保护已核实解除。':'远端恢复保护仍保留；关闭页面不会取消。'}</p>${o.status==='unknown'?'<div class="row">'+btn('核对原操作','fw-setup-inspect',{id:o.id},'primary')+btn('请求恢复原配置','fw-setup-recover',{id:o.id},'danger')+'</div>':''}`;
}
function firewallSetupDetail(o){
 const completed=o.steps.filter(step=>step.status==='success').length;
 layout(o.label,'安装迁移与端口规则操作分别记录；不重放未知操作。',`<div class="stack"><div class="between">${status(o.status)}<code>${h(o.id)}</code></div>${notice(o.message||'已固定接入计划',o.status==='unknown'?'请核对原操作或请求恢复；不会重新安装。':'浏览器模拟不代表真实服务器已验收。',o.status==='failed'?'error':o.status==='unknown'?'warning':'')}<div class="progress"><i style="width:${Math.round(completed/o.steps.length*100)}%"></i></div><ol class="firewall-setup-steps">${o.steps.map(step=>`<li><strong>${h(step.title)}</strong>${status(step.status)}<p class="tiny muted">${h(step.note)}</p></li>`).join('')}</ol>${firewallSetupOperationSummary(o)}</div>`,btn('关闭','closemodal')+(o.status==='running'?btn('原型：完成本次演示','finishdemo',{id:o.id},'primary'):''),true);
}
registerPrototypeHandlers(prototypeActions,['fw-setup-inspect','fw-setup-recover'],(event,target,d,a)=>{
 const o=S.operations.find(item=>item.id===d.id);if(!o||o.input?.action!=='setup'||o.status!=='unknown')return;
 if(a==='fw-setup-recover'){openModal('fw-setup-recover',{id:o.id});return;}
 const evidence=ui.firewallRecheck||'unknown';
 if(evidence==='unknown'){o.message='尚未取得足够的执行结束与配置证据；继续保留原操作和恢复保护。';persist();openModal('opdetail',{id:o.id});return;}
 finishFirewallSetup(o,evidence);openModal('opdetail',{id:o.id});
});
registerPrototypeHandlers(prototypeModals,['fw-setup-recover'],m=>{
 const o=S.operations.find(item=>item.id===m.id);if(!o)return closeModal();
 layout('恢复原防火墙配置','沿本次固定迁移操作恢复，不重新提交安装或迁移。',notice(o.input.plan.server.name,'仅撤销本操作已确认的配置和服务变更；发现外部变化时保留待核对，不盲目覆盖。','warning')+check('fw-recover-ack','确认恢复本次迁移前的配置与服务状态',false),btn('取消','closemodal')+'<button class="btn danger" type="submit">请求恢复（演示）</button>',false,'fw-setup-recover');
});
registerPrototypeHandlers(prototypeForms,['fw-setup-recover'],(event,form,fd,get,has,all,m)=>{
 if(!has('fw-recover-ack'))return modalError('请确认本次恢复范围。');
 const o=S.operations.find(item=>item.id===m.id);if(!o||o.status!=='unknown')return modalError('原操作状态已变化，请重新核对。');
 finishFirewallSetup(o,'rolled-back');openModal('opdetail',{id:o.id});
});
