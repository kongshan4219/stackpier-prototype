'use strict';

function frpConfigurationPlan(n){
 const roles=['client','server',...(n.proxies.some(x=>x.type==='stcp')||n.serviceBindings?.visitor?['visitor']:[])],errors=[],items=[],affected=new Set([n.id]);
 errors.push(...frpValidate(),...frpBindingErrors(n));
 if(frpNeedsDetach(n)&&!frpSameBindings(n.appliedConfiguration.bindings,n.serviceBindings))errors.push('当前编辑绑定与上次应用不同；先解除旧配置并核对，再应用新服务。');
 for(const role of roles){
  const p=frpBoundService(n,role);if(!p||p.cleanup){errors.push('尚无可用 '+frpRoles[role]+' 服务；请前往工作空间 / 项目部署或核对绑定。');continue;}
  const block=serverOperationError(p.server);if(block)errors.push(p.name+'：'+block);
  if(role==='visitor'&&p.server!==frpBoundService(n,'server')?.server)errors.push('visitor 必须运行在对应 FRPS 主机。');
  const snapshot=p.frpApplied;if(!snapshot?.programRef)errors.push(p.name+'：历史程序引用缺少完整参照，先在项目采用有效公共程序修订并单独应用。');else errors.push(...frpResolveProgram(snapshot.programRef,p.server).errors.map(e=>p.name+'：'+e));
  const settings=n.sourceSettings||frpSettingsSnapshot(),f=frpFiles(n,role,settings);
  if(!snapshot?.files?.tomlPath||!snapshot.files.unitPath){errors.push(p.name+'：运行配置落点缺失，不能通过保存连接隐式建立服务。');continue;}
  f.tomlPath=snapshot.files.tomlPath;f.unitPath=snapshot.files.unitPath;f.binaryPath=snapshot.files.binaryPath;f.unit=snapshot.files.unit;f.generatedToml=snapshot.files.generatedToml||f.generatedToml;
  for(const other of S.frp.nodes.filter(x=>x.serviceBindings?.server===n.serviceBindings.server))affected.add(other.id);
  if(items.some(x=>x.projectId===p.id))continue;
  items.push({projectId:p.id,role,serverTarget:serverOperationSnapshot(p.server),files:clone(f),before:clone(snapshot.files),appliedRevision:p.appliedRev,programRef:clone(snapshot.programRef||null),restart:p.runtime==='running'});
 }
 if(n.serviceBindings?.client&&S.frp.nodes.some(x=>x.id!==n.id&&!x.deletedConfig&&x.serviceBindings?.client===n.serviceBindings.client))errors.push('此 FRPC 服务已绑定其他连接；单个 FRPC 服务不能隐式切换服务端。');
 const connectionSnapshots=[{nodeId:n.id,revision:n.revision,proxies:clone(n.proxies),bindings:clone(n.serviceBindings||{}),settings:clone(n.sourceSettings||frpSettingsSnapshot())}];
 const serverItem=items.find(x=>x.role==='server'),tokenLine=text=>String(text).match(/^\s*auth\.token\s*=.*$/m)?.[0]?.trim();
 if(serverItem&&tokenLine(serverItem.before.toml)!==tokenLine(serverItem.files.toml)){
  for(const linked of S.frp.nodes.filter(x=>x.id!==n.id&&x.serviceBindings?.server===n.serviceBindings?.server)){
   if((linked.sourceSettings?.token||S.frp.token)!==(n.sourceSettings?.token||S.frp.token)){errors.push('共享 FRPS 认证影响连接 '+linked.ip+' / '+linked.id+'；先明确采用相同公共认证到相关连接草稿，不能让其他连接静默失效。');continue;}
   connectionSnapshots.push({nodeId:linked.id,revision:linked.revision,proxies:clone(linked.proxies),bindings:clone(linked.serviceBindings||{}),settings:clone(linked.sourceSettings||frpSettingsSnapshot())});
   for(const role of ['client',...(linked.proxies.some(x=>x.type==='stcp')||linked.serviceBindings.visitor?['visitor']:[])]){const p=frpBoundService(linked,role);if(!p||p.cleanup){errors.push('关联连接缺少 '+frpRoles[role]+' 服务');continue;}const program=frpResolveProgram(p.frpApplied.programRef,p.server);errors.push(...program.errors);if(serverOperationError(p.server))errors.push(serverOperationError(p.server));if(items.some(x=>x.projectId===p.id))continue;const files=frpFiles(linked,role,linked.sourceSettings||frpSettingsSnapshot());Object.assign(files,{tomlPath:p.frpApplied.files.tomlPath,unitPath:p.frpApplied.files.unitPath,binaryPath:p.frpApplied.files.binaryPath,unit:p.frpApplied.files.unit});items.push({projectId:p.id,role,serverTarget:serverOperationSnapshot(p.server),files,before:clone(p.frpApplied.files),appliedRevision:p.appliedRev,programRef:clone(p.frpApplied.programRef),restart:p.runtime==='running'});}
  }
 }
 return {connectionSnapshots,nodeId:n.id,revision:n.revision,bindings:clone(n.serviceBindings||{}),proxies:clone(n.proxies),settings:clone(n.sourceSettings||frpSettingsSnapshot()),deleted:!!n.deletedConfig,items,serviceIds:items.map(x=>x.projectId),affectedConnections:[...affected],errors:[...new Set(errors)]};
}
function frpConfigurationPlanBody(plan){return `<div class="stack">${notice('仅应用配置，服务生命周期由项目管理','本次写入以下固定文件；运行中的关联服务需模拟重载 / 重启并核对，由本次确认授权。不会安装程序、建立服务、卸载项目或改 DNS / 防火墙。')}${plan.mode==='detach'?notice('本次解除的旧映射',(plan.previousApplied.proxies||[]).map(x=>x.name+' · '+x.type.toUpperCase()).join('、')||'原配置无映射','warning'):''}${detail([['连接修订','C'+plan.revision],['受影响连接',h(plan.affectedConnections.map(id=>frpNode(id)?.ip||id).join('、'))],['服务资源去重',plan.items.length+' 个唯一服务实例']])}${plan.items.map(x=>`<article class="asset-reference"><strong>${h(pname(x.projectId))} · ${h(sname(x.serverTarget.id))}</strong><code>${h(x.files.tomlPath)}</code><p class="small">${h(x.action||'应用此服务配置')} · ${x.readOnly?'保留共享配置，仅核对':x.restart?'配置生效将重载 / 重启此运行中服务（模拟）':'写入配置并核对；保持已停止状态'}</p><details><summary>配置差异与固定 unit</summary><div class="diff-grid"><pre class="code asset-text">${h(frpMask(x.before.toml))}</pre><pre class="code asset-text">${h(frpMask(x.files.toml))}</pre></div><pre class="code asset-text">${h(x.files.unit)}</pre></details></article>`).join('')}${plan.errors.map(e=>notice('阻止应用',e,'error')).join('')}${plan.mode!=='detach'&&plan.items.some(x=>x.role==='visitor')&&!plan.proxies.some(x=>x.type==='stcp')?notice('清空 visitor 映射配置','不再生成任何 visitor 条目；已部署 visitor 服务仍保留。如需完全卸载，请单独前往项目确认。','warning'):''}</div>`;}
function startFrpConfiguration(plan,outcome='success',hold=false){
 const n=frpNode(plan.nodeId);if(!n||JSON.stringify(plan.mode==='detach'?frpDetachPlan(n):frpConfigurationPlan(n))!==JSON.stringify(plan))return modalError('确认后的配置、服务或目标变化，请重新预览。');
 if(plan.errors.length)return modalError(plan.errors.join('；'));
 const resources=plan.serviceIds.map(id=>'project:'+id),conflict=conflictFor(resources);if(conflict)return modalError('与 '+conflict.label+' 冲突，请先核对原操作。');
 const o=record((plan.mode==='detach'?'解除旧 FRP 配置 · ':'应用 FRP 配置 · ')+n.ip,'frp-config',null,'running','固定配置与服务目标，仅执行浏览器模拟。',{ended:null,input:clone(plan),resources,outcome,steps:['固定关联服务、文件和影响连接','逐服务写入配置（共享 FRPS 仅一次）','必要重载 / 重启并逐目标核对','确认已应用配置参照'].map((title,i)=>({title,status:i===0?'running':'pending'}))});
 n.pendingOperation=o.id;persist();render();openModal('opdetail',{id:o.id});if(!hold)timers.set(o.id,setInterval(()=>tick(o.id),900));return o;
}
function finishFrpConfiguration(o,result){
 if(!o||!['running','unknown'].includes(o.status))return;
 clearInterval(timers.get(o.id));timers.delete(o.id);
 const plan=o.input,n=frpNode(plan.nodeId);if(!n)return;
 if(result==='success'&&(frpBindingErrors(n).length||!frpSameBindings(plan.mode==='detach'?n.appliedConfiguration?.bindings:n.serviceBindings,plan.bindings)))result='unknown';
 if(result==='success'&&plan.items.some(x=>serverSnapshotError(x.serverTarget)||!frpServiceProject(x.projectId,x.role)||pr(x.projectId).appliedRev!==x.appliedRevision))result='unknown';
 o.status=result;o.ended=result==='unknown'?null:now();o.protectionReleased=result!=='unknown';
 o.results=plan.items.map((x,i)=>({projectId:x.projectId,server:x.serverTarget.id,path:x.files.tomlPath,status:result==='partial'?(i<plan.items.length-1?'success':'failed'):result}));
 o.steps.forEach((s,i)=>s.status=result==='success'?'success':i===0?'success':i===2?result:'pending');
 if(result==='success'){
  for(const x of plan.items){if(x.readOnly)continue;const p=pr(x.projectId);delete p.frpWritePending;const hadPending=pending(p),fixed=(plan.connectionSnapshots||[]).find(n=>n.bindings[x.role]===p.id);p.frpApplied.files=clone(x.files);if(plan.mode==='detach')p.frpApplied.node.proxies=[];if(fixed){p.frpApplied.node.proxies=clone(fixed.proxies);p.frpApplied.node.revision=fixed.revision;p.frpApplied.settings=clone(fixed.settings);}p.applied.frpSnapshot=clone(p.frpApplied);p.applied.appConfig=x.files.toml;p.appliedRev++;recordProjectResources(p,{...o,project:p.id},'success',deploymentCleanupTargets(p,p.applied));p.frpReadSnapshot={files:clone(x.files),at:now(),source:'配置应用后的模拟读取核对'};if(!hadPending){p.cfg.frpSnapshot=clone(p.frpApplied);p.cfg.appConfig=x.files.toml;p.frpDraft=clone(p.frpApplied);p.draftRev=p.appliedRev;}}
  for(const fixed of plan.connectionSnapshots||[]){const related=frpNode(fixed.nodeId);if(related&&related.id!==n.id){related.appliedConfiguration={revision:fixed.revision,proxies:clone(fixed.proxies),settings:clone(fixed.settings),bindings:clone(fixed.bindings),serviceIds:Object.values(fixed.bindings),at:now(),source:'明确确认的共享认证应用'};related.configurationResult='success';}}
  if(plan.mode==='detach'){n.bindingHistory||=[];if(!n.bindingHistory.some(e=>e.operationId===o.id))n.bindingHistory.push({operationId:o.id,applied:clone(plan.previousApplied),at:now()});}
  n.appliedConfiguration={detached:plan.mode==='detach',revision:plan.revision,proxies:clone(plan.proxies),settings:clone(plan.settings),bindings:plan.mode==='detach'?{}:clone(plan.bindings),serviceIds:plan.mode==='detach'?[]:clone(plan.serviceIds),at:now(),source:'模拟应用并读取核对'};n.configurationResult='success';
  o.message=plan.mode==='detach'?'旧连接的客户端 / visitor 映射配置已清空并核对（模拟）；旧服务及共享 FRPS 保留，可编辑新绑定。':'配置已模拟应用并核对；服务运行事实保持，隧道与业务健康未验证。';
  for(const previous of S.operations.filter(x=>x.kind==='frp-config'&&x.id!==o.id&&x.input?.nodeId===n.id&&x.time<=o.time&&['failed','partial','unknown'].includes(x.status)&&frpSameBindings(x.input.bindings,plan.bindings)))resolveOperationHistory(previous,o,'此连接配置已完整核对');
  if(plan.deleted){S.frp.deletedHistory||=[];S.frp.deletedHistory.push({id:n.id,applied:clone(n.appliedConfiguration),operation:o.id});S.frp.nodes=S.frp.nodes.filter(x=>x.id!==n.id);FRP.tab='connections';}
 }else{for(const x of plan.items.filter(x=>!x.readOnly)){const service=pr(x.projectId);if(service&&['partial','unknown'].includes(result))service.frpWritePending={operationId:o.id,result,path:x.files.tomlPath};}n.configurationResult=result;o.message='配置'+({failed:'应用失败',partial:'部分写入未完整核对',unknown:'结果未知'}[result]||'未完成')+'；保留此前已应用参照与固定目标，查看逐服务结果并核对。';}
 persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();
}
registerPrototypeHandlers(prototypeModals,['frp-configapply'],m=>{
 const n=frpNode(m.node);if(!n)return closeModal();m.plan||=frpConfigurationPlan(n);
 layout('确认应用 FRP 配置 · '+n.ip,'配置修订和目标已固定；取消不会执行。',frpConfigurationPlanBody(m.plan)+outcomeField()+check('fc-confirm','确认文件变更及必要重载 / 重启影响',false)+check('fc-hold','保持模拟执行中',false),btn('取消','closemodal')+`<button class="btn primary" type="submit" ${m.plan.errors.length?'disabled':''}>确认应用配置</button>`,true,'frpconfigapply');
});
registerPrototypeHandlers(prototypeForms,['frpconfigapply'],(e,f,fd,get,has,all,m)=>{if(!has('fc-confirm'))return modalError('请确认本次配置及重载影响。');startFrpConfiguration(m.plan,get('outcome'),has('fc-hold'));});
