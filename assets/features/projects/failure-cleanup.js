'use strict';

function failedCleanupBlock(failure){
 if(!failure)return '失败记录已不存在。';
 if(!needsFailedCleanup(failure))return failure.cleanup.status==='none'?'部署未开始，无需清理。':'残留已清理，无需重复执行。';
 if(failure.deployment.targets.some(t=>t.ownership==='unknown'))return '历史资源归属待核对；不能从旧路径猜测已清理或属于此项目。';
 const deployment=failure.deployment,original=S.operations.find(item=>item.id===failure.operation);
 if(!original||original.status==='running'||original.status==='unknown'&&!original.protectionReleased)return '原部署尚未确认结束，请先核对原操作，确认不会继续写入。';
 const server=sr(deployment.project.server);
 if(!server||!deployment.server?.fp)return '缺少原服务器身份记录，无法确认清理目标。';
 if(server.fp!==deployment.server.fp||server.state!=='online')return '请先检查原服务器的连接与主机身份，再清理残留。';
 const unsafe=deployment.targets.find(item=>item.kind!=='runtime'&&(targetFilePathError(item.path)||['/etc','/usr','/var','/srv','/opt','/home','/etc/systemd/system','/var/lib/docker','/srv/stackpier-demo'].includes(item.path)));
 if(unsafe)return `清理路径 ${unsafe.path} 范围不明确，不能执行。`;
 const owner=S.projects.find(project=>project.server===deployment.project.server&&[project.cfg,project.applied].filter(Boolean).some(cfg=>deploymentScopesOverlap(deployment,{project,targets:deploymentCleanupTargets(project,cfg)})));
 if(owner)return `清理范围已被项目 ${owner.name} 使用，不能删除其文件或数据。`;
 const conflict=activeDeploymentConflict(deployment);
 if(conflict)return `“${conflict.label}”尚未确认结束，请先核对该操作，不能重复清理。`;
 return '';
}

function startFailedCleanup(failure,outcome='success'){
 const error=failedCleanupBlock(failure);if(error){modalError(error);return null;}
 if(!['success','failed','partial','unknown'].includes(outcome)){modalError('请选择有效的演示结果。');return null;}
 const completed=failure.cleanup.items.filter(item=>item.status==='success');
 const targets=failure.deployment.targets.filter(target=>!completed.some(item=>item.kind===target.kind&&item.path===target.path));
 const titles=['核对服务器、原执行与资源归属',...(targets.some(target=>target.kind==='runtime')?['停止并移除本项目运行实体']:[]),'清理残留文件及项目数据','核对清理结果'];
 const operation={id:uid('op'),kind:'failed-cleanup',failure:failure.id,project:failure.deployment.project.id,label:'清理失败项目 '+failure.deployment.project.name,status:'running',time:now(),input:{deployment:clone(failure.deployment),targets:clone(targets)},resources:targets.map(target=>target.path),outcome,steps:titles.map((title,index)=>({title,status:index===0?'running':'pending'})),message:'已固定清理范围；只执行浏览器模拟。'};
 failure.cleanup={...failure.cleanup,status:'running',operation:operation.id};
 S.operations.unshift(operation);persist();render();openModal('opdetail',{id:operation.id});
 timers.set(operation.id,setInterval(()=>tick(operation.id),900));return operation;
}

function finishFailedCleanup(operation,result){
 if(!operation||!['running','unknown'].includes(operation.status)||!['success','failed','partial','unknown'].includes(result))return;
 const failure=failedProject(operation.failure);if(!failure||failure.cleanup.operation!==operation.id)return;
 clearInterval(timers.get(operation.id));timers.delete(operation.id);
 const targets=operation.input.targets,previous=failure.cleanup.items.filter(item=>item.status==='success');
 const items=targets.map((target,index)=>({...target,status:result==='success'?'success':result==='failed'?'pending':result==='partial'?(index<targets.length-1?'success':'failed'):'unknown'}));
 operation.status=result;operation.ended=result==='unknown'?null:now();operation.protectionReleased=result!=='unknown';
 operation.message={success:'本次失败部署的运行实体、残留文件与数据已清理，并完成核对（模拟）。',failed:'清理未完成，残留范围已保留，可以重试。',partial:'仅部分残留已清理，未完成的分项继续保留。',unknown:'清理响应丢失，结果未知；先核对原清理操作，不重复执行。'}[result];
 operation.steps.forEach((step,index)=>{step.status=result==='success'?'success':result==='failed'?(index===0?'failed':'pending'):index<operation.steps.length-2?'success':index===operation.steps.length-2?result==='partial'?'failed':'unknown':'pending';step.note=operation.message;});
 failure.cleanup={status:result,operation:operation.id,items:[...previous,...items],time:now()};
 persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===operation.id)renderModal();
 toast(operation.message,result==='success'?'success':result==='failed'?'error':'');
}

function failedCleanupModal(m){
 const failure=failedProject(m.id);if(!failure){closeModal();return;}
 const block=failedCleanupBlock(failure),original=S.operations.find(item=>item.id===failure.operation),cleanup=S.operations.find(item=>item.id===failure.cleanup.operation);
 const unresolved=[original,cleanup].find(operation=>operation?.status==='unknown'&&!operation.protectionReleased);
 const body=`<div class="stack">${detail([['项目',h(failure.deployment.project.name)],['目标服务器',h(failure.deployment.server?.name||'未保留')]])}${block?notice('暂不能清理',block,'warning'):notice('清理失败部署的残留','停止并移除归属本次部署的服务或容器，删除下列文件和项目数据。')}${failedCleanupTargets(failure)}<p class="small muted">仅处理本次部署登记的资源；共享镜像、外部数据卷及其他项目数据不在清理范围内。</p>${block?'':check('cleanup-confirm','确认清理以上残留文件和项目数据')+outcomeField()}</div>`;
 const server=sr(failure.deployment.project.server);
 const actions=btn('取消','closemodal')+(failure.migrationProject&&failure.deployment.targets.some(t=>t.ownership==='unknown')?btn('核对历史资源归属','history-cleanup-review',{id:failure.id},'primary'):'')+(block?(unresolved?btn('核对原操作','verifyop',{id:unresolved.id},'primary'):server&&server.state!=='online'?btn('检查服务器','servercheck',{id:server.id},'primary'):''):'<button class="btn danger" type="submit">清理文件和数据</button>');
 layout('清理失败项目',failure.deployment.project.name+' · 仅模拟服务器清理',body,actions,true,'failedcleanup');
}

registerPrototypeHandlers(prototypeModals,['failedcleanup'],failedCleanupModal);
registerPrototypeHandlers(prototypeForms,['failedcleanup'],function(event,form,fd,get,has,all,m){
 if(!has('cleanup-confirm')){modalError('请确认清理列出的残留文件和项目数据。');return;}
 startFailedCleanup(failedProject(m.id),get('outcome'));
});

registerPrototypeHandlers(prototypeActions,['history-cleanup-review'],(event,target,d)=>openModal('history-cleanup-review',{id:d.id}));
registerPrototypeHandlers(prototypeModals,['history-cleanup-review'],m=>{const f=failedProject(m.id);if(!f)return closeModal();m.binding=JSON.stringify(f.deployment);layout('核对历史资源归属 · '+f.deployment.project.name,'只注入虚构的归属核对证据；不恢复项目、不执行清理。',notice('未知历史不能直接成功','逐项确认原服务器和资源专属归属；公共文件、共享程序、外部目录和网络关联不能因此被认作专属。','warning')+failedCleanupTargets(f)+check('history-identity','已模拟核对原服务器身份和原执行不会继续写入')+check('history-owned','已模拟核对所有列出资源均专属此历史服务'),btn('取消','closemodal')+'<button class="btn primary" type="submit">记录归属核对，再查看清理确认</button>',true,'historycleanupreview');});
registerPrototypeHandlers(prototypeForms,['historycleanupreview'],(event,form,fd,get,has,all,m)=>{const f=failedProject(m.id);if(!f||JSON.stringify(f.deployment)!==m.binding)return modalError('证据已变化，请重新核对。');if(!has('history-identity')||!has('history-owned'))return modalError('未知归属继续阻止清理，请核对全部证据。');const p=f.deployment.project,plan={server:serverOperationSnapshot(p.server),remaining:f.deployment.targets.map(t=>({...t,ownership:'project'}))};if(!f.deployment.server?.fp||sr(p.server)?.fp!==f.deployment.server.fp)return modalError('原服务器身份无法匹配，保留未知。');const error=projectCleanupError({...p,cleanup:null},plan);if(error)return modalError(error);f.deployment.targets=clone(plan.remaining);f.ownershipCheckedAt=now();const e=S.serviceMigration.evidence.find(e=>e.projectId===f.migrationProject);if(e)e.reason='已模拟核对资源归属；仍须单独确认清理，未宣称已清理。';persist();openModal('failedcleanup',{id:f.id});});
