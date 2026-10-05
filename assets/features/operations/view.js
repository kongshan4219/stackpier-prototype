'use strict';

function operationTable(rows){return `<section class="card"><div class="table-wrap"><table><thead><tr><th>操作</th><th>触发时间</th><th>执行结果</th><th>已知事实</th><th class="right">详情</th></tr></thead><tbody>${rows.map(o=>`<tr><td><button class="link cell-title" data-action="opdetail" data-id="${h(o.id)}">${h(o.label)}</button><p class="cell-sub mono">${h(o.id)}</p></td><td>${fmt(o.time)}</td><td>${status(o.status)}${o.status==='running'?`<div class="progress"><i style="width:${Math.round(o.steps.filter(s=>s.status==='success').length/o.steps.length*100)}%"></i></div>`:''}</td><td style="max-width:330px"><span class="small muted">${h(o.message||'已固定本次输入，分项执行中。')}</span></td><td class="right">${btn(o.status==='unknown'?'核对原操作':'查看','opdetail',{id:o.id},'small','arrow')}</td></tr>`).join('')}</tbody></table></div>${!rows.length?empty('还没有记录','拒绝与跳过也会留有原因，但不会排队。'):''}</section>`}

function operationsPage(){const rows=S.operations.filter(o=>(o.label+' '+o.id+' '+o.message).toLowerCase().includes(ui.q.toLowerCase())&&(ui.filter==='all'||o.status===ui.filter));return heading('操作记录','查看一次操作完成了哪些部分，哪些失败，哪些结果尚不明确。','','OPERATIONS / HISTORY')+searchFilter('搜索操作、项目或记录编号…',`<select class="filter" data-filter="filter" aria-label="操作结果">${[['all','全部结果'],['running','执行中'],['success','成功'],['failed','明确失败'],['partial','部分完成'],['unknown','待核对'],['rejected','已拒绝'],['skipped','已跳过'],['missed','已错过']].map(([v,t])=>`<option value="${v}" ${ui.filter===v?'selected':''}>${t}</option>`).join('')}</select>`)+operationTable(rows)}

function runtimeEvidenceFields(kind,requestedState,evidence={},readOnlyCommand=false){
 return `<div class="form-section stack">${notice('演示命令返回与实际核对','以下仅注入虚构证据；真实产品会读取原执行结果和目标实际状态，不让用户直接选成功。')}${readOnlyCommand?detail([['原命令返回（保持不变）',h({success:'成功',error:'报错',unknown:'响应未知'}[evidence.commandResult]||'响应未知')]]):select('runtime-command','命令返回（演示）',[['success','命令返回成功'],['error','命令报错'],['unknown','命令响应未知']],evidence.commandResult||'success')}${select('runtime-observed','只读核对实际状态（演示）',[['running','已核实：运行中'],['stopped','已核实：已停止'],['partial','已核实：仅部分运行成员符合请求'],['unknown','未取得实际状态']],evidence.observedState||requestedState)}${check('runtime-ended','已取得本次原执行结束证据',evidence.executionEnded??true,'仅有运行/停止快照不能证明命令已经结束。')}${check('runtime-identity','核对的是本次操作的目标与运行载体',evidence.identityVerified??true)}${kind==='restart'?check('runtime-restarted','已核实本次停止再启动或新进程身份',evidence.restartVerified??true,'仅看到运行中，不足以证明本次重启完成。'):''}</div>`;
}

function readRuntimeEvidence(get,has,kind){
 return {commandResult:get('runtime-command'),observedState:get('runtime-observed'),executionEnded:has('runtime-ended'),identityVerified:has('runtime-identity'),restartVerified:kind==='restart'&&has('runtime-restarted')};
}

function runtimeEvidenceSummary(o){
 if(!isRuntimeAction(o.kind)||o.status==='rejected')return '';
 const checks=o.runtimeChecks||[];
 return `<div class="stack">${detail([['本次请求',h(opLabels[o.kind]+' → '+runtimeName[o.input.requestedState])],['原命令返回',h({success:'成功',error:'报错',unknown:'响应未知'}[o.commandResult]||'尚未返回')],['核对次数',checks.length]])}${checks.map((entry,index)=>`<div class="feedback-note"><strong class="small">第 ${index+1} 次只读核对 · ${statusName[entry.assessment.status]}</strong><p>${h(entry.assessment.reason)}</p><span class="tiny muted">${fmt(entry.checkedAt)} · ${entry.assessment.canUpdateObservation?'实际 '+h(runtimeName[entry.evidence.observedState]):'未取得新观测'} · ${entry.evidence.executionEnded?'原执行已结束':'原执行未证实结束'}</span></div>`).join('')}</div>`;
}

function operationModal(m){const p=pr(m.id),kind=m.op||m.operation;m.op=kind;if(!p||!Object.hasOwn(opLabels,kind)){closeModal();return}const scope=resourcesFor(p,kind);let body=`<div class="stack">${detail([['项目',h(p.name)],['服务器',h(sname(p.server))],['当前状态',lifeName[p.life]+' · '+runtimeBadge(p)],['操作',opLabels[kind]],['本次资源范围',`<code>${h(scope.join('\n'))}</code>`]])}`;
 if(['apply','update','deploy'].includes(kind))body+=`<div class="diff-grid"><div><h3>最后完整应用参照</h3><pre class="code">
${h(configText(p,p.applied))}</pre></div><div><h3>本次固定输入 · D${p.draftRev}</h3><pre class="code">
${h(configText(p))}</pre></div></div>${notice('本次输入在受理时固定','之后保存的新草稿不影响这次执行；成功后仍保留后续待应用内容。')}${kind==='deploy'&&p.dataStatus==='retained'?check('reuse-data','已核对保留数据来源，并确认本次复用','',p.cfg.dataDir+'；不会按同名目录自动决定。'):''}`;
 if(kind==='stop')body+=notice('停止不是卸载','停止成功后保留项目与数据；只免除对应停止造成的不可用告警。命令成功或报错后都核对实际状态；核实已停止后才免除相应不可用告警。');
 if(kind==='restart')body+=notice('重启需要核实本次动作','主动停止的项目请使用明确的“启动”。仅看到运行中，不能证明本次停止再启动已经完成。');
 if(kind==='uninstall'){m.cleanupPlan||=projectCleanupPlan(p);m.cleanupBinding||=JSON.stringify(m.cleanupPlan);const block=projectCleanupError(p,m.cleanupPlan);body+=cleanupPlanBody(m.cleanupPlan)+(block?notice('清理阻塞',block,'error'):'')+check('cleanup-data-confirm','确认删除上述项目专属配置、目录、数据卷及数据',false)+field('uninstall-name','输入项目名称以确认','',p.name,'text','required');}

 const opts=kind==='uninstall'?[['success','全部专属资源与数据清理并核对'],['failed','清理明确失败'],['partial','部分清理，保留残留'],['unknown','清理结果未知']]:null;
 body+=(isRuntimeAction(kind)?runtimeEvidenceFields(kind,kind==='stop'?'stopped':'running'):outcomeField(m.outcome||ui.nextOutcome,opts))+'</div>';layout(opLabels[kind]+' · '+p.name,'确认只触发模拟执行，不会访问真实服务器。',body,btn('取消','closemodal')+`<button type="submit" class="btn ${kind==='uninstall'?'danger':'primary'}">确认${opLabels[kind]}（演示）</button>`,['apply','update','deploy','uninstall'].includes(kind),'projectop');}

function opDetail(m){const o=S.operations.find(o=>o.id===m.id);if(!o){closeModal();return}const completed=o.steps.filter(s=>isRuntimeAction(o.kind)&&o.runtimeChecks?.length?['success','failed','partial'].includes(s.status):s.status==='success').length;layout(o.label,'操作结果与当前服务状态分别保存，不自动重跑整单。',`<div class="stack"><div class="between">${status(o.status)}<span class="tiny muted mono">${h(o.id)}</span></div>${o.resolution?notice('原失败已解决，历史结果保留',o.resolution.reason)+btn('查看后续完成操作','opdetail',{id:o.resolution.operationId},'small'):''}${o.cleanupReview&&!o.cleanupReview.resolvedBy?notice('旧清理范围存在漏项','原卸载结果作为历史保留；后续交付资源尚未证明清理。','warning')+btn('查看清理漏项核对','opdetail',{id:o.cleanupReview.operationId},'small'):''}${notice(o.message||'本次输入已固定，执行中…',o.status==='unknown'?'核对原操作，不按固定超时认定远端已结束。':o.status==='rejected'?'此次请求没有受理，不排队，也不会在冲突解除后偷偷执行。':'已完成的分项不会因为后续失败而消失。',o.status==='failed'?'error':['partial','unknown','rejected'].includes(o.status)?'warning':'')}<div><div class="progress"><i style="width:${o.steps.length?Math.round(completed/o.steps.length*100):0}%"></i></div><p class="tiny muted">已核对 ${completed} / ${o.steps.length} 个分项 · ${fmt(o.time)}</p></div><div class="step-list">${o.steps.map((s,i)=>`<div class="step-item"><span class="step-circle ${s.status}">${s.status==='success'?I('check'):s.status==='failed'?I('close'):i+1}</span><div class="grow"><strong class="step-label">${h(s.title)}</strong><p class="step-note">${h(s.note||({success:'此分项已核对',failed:'此分项明确失败',pending:'尚未执行',running:'执行中',unknown:'缺少足够证据'}[s.status]||s.status))}</p></div>${status(s.status)}</div>`).join('')}</div>${o.input?.deployment?detail([['固定服务器',h(o.input.deployment.server?.name||'历史身份待核对')],['部署输入项目名',h(o.input.deployment.project.name)],['配置来源',h(o.input.deployment.templateName)]])+`<details><summary>本次固定正文及落点</summary><pre class="code asset-text">${h(o.input.cfg?.source||o.input.cfg?.appConfig||'未记录正文')}</pre><pre class="code">${h(o.input.deployment.targets.map(t=>t.label+' · '+t.path).join('\n'))}</pre></details>`:''}${o.results?o.results.map(r=>`<article class="asset-reference"><strong>${h(pname(r.projectId))} · ${h(sname(r.server))}</strong>${status(r.status)}<code>${h(r.path)}</code></article>`).join(''):''}${pr(o.project)?detail([['项目当前部署阶段',h(lifeName[pr(o.project)?.life]||'—')],['项目当前运行观测',pr(o.project)?runtimeBadge(pr(o.project))+'<p class="tiny muted">'+fmt(pr(o.project).observed)+'</p>':'—'],['本次固定输入',h(o.input?.cfg?'D'+o.input.draftRev+' / '+o.input.cfg.version:'按确认时的范围')]]):''}${o.newProject&&!pr(o.project)?notice('项目未建立',o.status==='running'?'仅操作记录正在执行，全部成功核对后才创建服务项目。':'本次部署未全部核对成功，请查看失败记录与恢复入口。'):''}${o.input?.cleanupPlan?cleanupPlanBody(o.input.cleanupPlan):''}${o.cleanupResults?'<pre class="code">'+h(o.cleanupResults.map(t=>t.label+' · '+t.path+' · '+statusName[t.status]).join('\n'))+'</pre>':''}${o.kind==='uninstall'&&pr(o.project)&&['failed','partial'].includes(o.status)?btn('继续清理未完成项','projectop',{id:o.project,kind:'uninstall'},'danger'):''}${runtimeEvidenceSummary(o)}${frpRecoveryActions(o)}${cfOperationSummary(o)}${o.input?.netType==='firewall'&&o.input.record?firewallSummary(o.input.record,o.input.before):''}${o.resources?.length?`<div><h3 class="mb">影响范围</h3><pre class="code">${h(o.resources.join('\n'))}</pre></div>`:''}</div>`,btn('关闭','closemodal')+(pr(o.project)?btn('查看项目','project',{id:o.project}):'')+((o.newProject&&!pr(o.project)||o.failure)?btn('查看失败记录','failedprojects'):'' )+(o.status==='running'?btn('原型：完成本次演示','finishdemo',{id:o.id},'primary'):o.frp&&isRuntimeAction(o.input.operation)&&['failed','partial','unknown'].includes(o.status)?btn('再次核对实际状态','frp-reconcile',{id:o.id},'primary'):o.status==='unknown'||isRuntimeAction(o.kind)&&['failed','partial'].includes(o.status)?btn(isRuntimeAction(o.kind)?'再次核对实际状态':'核对原操作','verifyop',{id:o.id},'primary'):''),false);}

function verifyOpModal(m){const o=S.operations.find(o=>o.id===m.id);if(!o){closeModal();return;}if(o.kind==='network'&&o.input?.netType==='dns'){cfVerifyModal(m,o);return;}if(isRuntimeAction(o.kind)){layout('再次核对实际状态','只读核对原操作，不重新发送启停命令。',notice(o.label,'本次请求保持不变；原命令报错也不能代替实际状态核对。')+runtimeEvidenceFields(o.kind,o.input.requestedState||'running',{...(o.runtimeChecks?.at(-1)?.evidence||{}),commandResult:o.commandResult||'unknown'},true),btn('取消','closemodal')+'<button class="btn primary" type="submit">记录本次核对</button>',false,'verifyop');return;}layout('核对原操作','这里只注入模拟核对证据，不提供生产环境的“强制成功”。',`<div class="stack">${o.input?.netType==='firewall'&&o.input.record?firewallSummary(o.input.record):''}${notice(o.label,'确认执行是否仍可能继续写入，再核对各项结果。不会重新运行原命令。','warning')}${select('verify-result','模拟取得的核对证据',[['working','仍在执行，继续保留保护'],['success','确认原执行已结束，全部分项成功'],['partial','确认原执行已结束，部分完成'],['failed','确认原执行已结束，明确失败'],['ended-unknown','确认不会继续写入且当前资源安全，但历史结果无法证明']])}${check('verify-evidence','已核对原操作身份、停止写入证据及当前相关资源',false,'没有充分证据时继续保持未知。')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">记录模拟核对结论</button>',false,'verifyop');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["projectop","opdetail","verifyop"], function(m, p) {
  switch (m.kind) {
case'projectop':operationModal(m);break;
case'opdetail':opDetail(m);break;
case'verifyop':verifyOpModal(m);break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["projectop","finishdemo"], function(event, target, d, a) {
  switch (a) {
case'projectop':openModal('projectop',{id:d.id,op:d.kind});break;
case'finishdemo':{const o=S.operations.find(o=>o.id===d.id);finishOperation(o,o.outcome);break;}
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["projectop","verifyop"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'projectop':{
  const op=m.op,outcome=isRuntimeAction(op)?readRuntimeEvidence(get,has,op):get('outcome'),input={};
  if(op==='deploy'&&p.dataStatus==='retained'&&!has('reuse-data')){modalError('请核对并确认复用保留数据，不按同名目录自动判断。');break;}
  if(op==='uninstall'){
   if(get('uninstall-name')!==p.name){modalError('请输入完全一致的项目名称。');break;}
   if(!has('cleanup-data-confirm')){modalError('请确认删除全部项目专属数据。');break;}
   if(JSON.stringify(projectCleanupPlan(p))!==m.cleanupBinding){modalError('清理范围或引用在确认后变化，请重新查看计划。');break;}
   input.cleanupPlan=clone(m.cleanupPlan);input.deleteData=true;

  }
  startOperation(p,op,input,outcome);break;}
case'verifyop':{const o=S.operations.find(o=>o.id===m.id);if(!o)break;if(o.kind==='network'&&o.input?.netType==='dns'){cfVerifySubmit(o,get,has);break;}if(isRuntimeAction(o.kind)){openModal('opdetail',{id:o.id});finishRuntimeOperation(o,readRuntimeEvidence(get,has,o.kind),{recheck:true});break;}const v=get('verify-result');if(v==='working'){o.message='演示核对发现原执行尚未结束，结果继续待核对；保护保持。';persist();openModal('opdetail',{id:o.id});break;}if(!has('verify-evidence')){modalError('请先核对原操作身份、停止写入与当前资源证据。');break;}if(v==='ended-unknown'){o.protectionReleased=true;o.ended=now();o.message='已证实原执行不会继续写入且当前资源安全；历史结果仍无法证明，保留未知，不伪造成功。';persist();render();openModal('opdetail',{id:o.id});}else{openModal('opdetail',{id:o.id});finishOperation(o,v);}break;}
  }
});
