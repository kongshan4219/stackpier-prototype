'use strict';

const failedCleanupLabels={pending:'待清理',running:'清理中',success:'已清理',failed:'清理失败',partial:'部分清理',unknown:'清理结果未知',none:'无需清理'};
const failedResultLabels={failed:'明确失败',partial:'部分完成',unknown:'结果未知',rejected:'部署未开始'};

function failedCleanupStatus(failure){const value=failure.cleanup.status;return badge(failedCleanupLabels[value],value==='success'?'success':value==='failed'?'error':['unknown','partial','pending'].includes(value)?'warning':'');}
function projectListTabs(){return tabs([['list','项目列表'],['failures','失败记录'+(S.failedProjects?.length?` (${S.failedProjects.length})`:'')]],ui.projectsTab,'projectstab');}

function failedCleanupTargets(failure){
 if(failure.cleanup.status==='none')return notice('无需清理','部署在前置检查阶段已被拒绝，没有下发文件或创建数据。');
 return `<div class="server-file-list">${failure.deployment.targets.map(target=>{
  const result=failure.cleanup.items.find(item=>item.kind===target.kind&&item.path===target.path)?.status;
  return `<div class="server-file-item"><div class="between"><strong>${h(target.label)}</strong>${badge(result==='success'?'已清理':result==='failed'?'清理失败':result==='unknown'?'待核对':'待清理',result==='success'?'success':'warning')}</div><p class="cell-sub mono">${h(target.kind==='runtime'?(failure.deployment.project.type==='systemd'?failure.deployment.project.name+'.service':failure.deployment.project.name):target.path)}</p></div>`;
 }).join('')}</div>`;
}

function failedProjectsPage(){
 const rows=(S.failedProjects||[]).filter(failure=>(failure.deployment.project.name+' '+(failure.deployment.server?.name||'')+' '+failure.message).toLowerCase().includes(ui.q.toLowerCase())&&(ui.filter==='all'||failure.result===ui.filter));
 const filter=`<select class="filter" data-filter="filter" aria-label="失败类型">${[['all','全部失败'],...Object.entries(failedResultLabels)].map(([value,label])=>`<option value="${value}" ${ui.filter===value?'selected':''}>${label}</option>`).join('')}</select>`;
 const body=rows.length?`<section class="card"><div class="table-wrap"><table><thead><tr><th>项目 / 服务器</th><th>部署结果</th><th>失败时间 / 原因</th><th>残留处理</th><th class="right">操作</th></tr></thead><tbody>${rows.map(failure=>`<tr><td><button class="link cell-title" data-action="failedproject" data-id="${failure.id}">${h(failure.deployment.project.name)}</button><p class="cell-sub">${h(failure.deployment.server?.name||'未保留服务器信息')}</p></td><td>${badge(failedResultLabels[failure.result],failure.result==='failed'?'error':'warning')}</td><td style="max-width:360px"><span class="small">${fmt(failure.time)}</span><p class="cell-sub">${h(failure.message)}</p></td><td>${failedCleanupStatus(failure)}</td><td class="right"><div class="flex wrap" style="justify-content:flex-end">${btn('详情','failedproject',{id:failure.id},'small')}${needsFailedCleanup(failure)?btn(['running','unknown'].includes(failure.cleanup.status)?'查看清理':'清理残留',['running','unknown'].includes(failure.cleanup.status)?'opdetail':'failedcleanup',{id:['running','unknown'].includes(failure.cleanup.status)?failure.cleanup.operation:failure.id},'small'):''}</div></td></tr>`).join('')}</tbody></table></div><div class="table-total">共 ${rows.length} 条失败记录 · 清理完成后仍保留记录</div></section>`:`<section class="card">${empty('没有失败记录','部署失败、部分完成和结果未知的项目将在这里记录。')}</section>`;
 return heading('失败记录','部署未成功的项目集中保存在这里，可查看原因并清理服务器残留。','','WORKSPACE / PROJECTS / FAILURES')+projectListTabs()+searchFilter('搜索失败项目、服务器或原因…',filter)+body;
}

function failedProjectModal(m){
 const failure=failedProject(m.id);if(!failure){closeModal();return;}
 const deployment=failure.deployment,operation=S.operations.find(item=>item.id===failure.operation);
 layout('失败记录 · '+deployment.project.name,'此项目未加入项目列表。',`<div class="stack"><div class="between">${badge(failedResultLabels[failure.result],'warning')}${failedCleanupStatus(failure)}</div>${notice('部署未成功',failure.message,'warning')}${detail([['目标服务器',h(deployment.server?.name||'未保留')],['部署时地址',h(deployment.server?.host||'未保留')],['部署配置',h(deployment.templateName)],['记录时间',fmt(failure.time)],['原操作最新结论',operation?status(operation.status):'原操作记录缺失']])}<h3>服务器残留范围</h3>${failedCleanupTargets(failure)}${failure.cleanup.operation?btn('查看清理操作','opdetail',{id:failure.cleanup.operation},'small'):''}</div>`,btn('关闭','closemodal')+btn('查看部署操作','opdetail',{id:failure.operation})+(needsFailedCleanup(failure)?btn('清理残留','failedcleanup',{id:failure.id},'danger'):''),true);
}

registerPrototypeHandlers(prototypeModals,['failedproject'],failedProjectModal);
registerPrototypeHandlers(prototypeActions,['projectstab','failedprojects','failedproject','failedcleanup'],function(event,target,data,action){
 if(action==='projectstab'||action==='failedprojects'){
  closeModal();ui.projectsTab=action==='failedprojects'?'failures':data.id==='failures'?'failures':'list';navigate('projects');return;
 }
 openModal(action,{id:data.id});
});
