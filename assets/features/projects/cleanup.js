'use strict';

function projectCleanupPlan(p){
 const cfg=p.applied||p.cfg,snapshot=deploymentSnapshot(p,cfg),root='/srv/stackpier-demo/'+p.name;
 const owned=clone(p.ownedResources||snapshot.targets),targets=[],preserved=[];
 // 配置目录可以独立删除；外部挂载和 FRP 共享根目录绝不递归清理。
 for(const resource of owned){
  if(resource.shared||resource.ownership==='external'||resource.path===p.frpApplied?.files?.binaryPath)preserved.push({...resource,reason:'共享程序 / 外部挂载，不属于专属清理范围'});
  else targets.push({...resource,ownership:resource.ownership||'project'});
 }
 if(!p.frpService&&!targets.some(t=>t.kind==='directory'&&t.path===root))targets.push({kind:'directory',path:root,label:'独立部署目录（含专属数据）',ownership:'project'});
 if(p.frpApplied?.files.binaryPath&&!preserved.some(t=>t.path===p.frpApplied.files.binaryPath))preserved.push({kind:'file',path:p.frpApplied.files.binaryPath,reason:'共享 FRP 程序，始终保留'});
 const completed=p.cleanup?.items?.filter(t=>t.status==='success')||[];
 const remaining=targets.filter(t=>!completed.some(x=>x.kind===t.kind&&x.path===t.path));
 const network=[...S.dns.filter(r=>r.projects.includes(p.id)).map(r=>({kind:'DNS',id:r.id,label:r.name+'.'+r.zone,projects:clone(r.projects)})),...S.firewalls.filter(r=>r.projects.includes(p.id)).map(r=>({kind:'防火墙',id:r.id,label:sname(r.server)+' '+r.protocol+' '+r.port+' '+r.address,projects:clone(r.projects)}))];
 const frpConnections=(S.frp?.nodes||[]).filter(n=>Object.values(n.serviceBindings||{}).includes(p.id)).map(n=>({id:n.id,ip:n.ip,services:clone(n.serviceBindings)}));
 return {frpConnections,projectId:p.id,name:p.name,server:serverOperationSnapshot(p.server),targets,remaining,preserved,network,completed};
}
function projectCleanupError(p,plan){
 const hostError=serverSnapshotError(plan.server);if(hostError)return hostError;
 if(p.cleanup?.status==='unknown'&&!S.operations.find(o=>o.id===p.cleanup.operation)?.protectionReleased)return '清理结果未知，请先核对原操作是否结束，不重复执行。';
 const inflight=activeOps(p).find(o=>o.kind==='uninstall');if(inflight)return '原清理尚未结束，先核对原操作。';
 if(p.frpService?.role==='server'){const dependents=(S.frp?.nodes||[]).filter(n=>n.serviceBindings?.server===p.id).flatMap(n=>['client','visitor'].map(role=>pr(n.serviceBindings?.[role])).filter(Boolean));if(dependents.length)return '共享 FRPS 仍被已部署服务 '+[...new Set(dependents.map(x=>x.name))].join('、')+' 引用；先在配置和项目中明确处理这些依赖，不能误删共享服务。';}
 for(const target of plan.remaining){
  if(target.ownership!=='project')return '资源归属不明：'+target.path+'；阻止清理。';
  if(target.kind!=='runtime'&&target.kind!=='volume'&&(targetFilePathError(target.path)||['/','/srv','/srv/services/frp','/srv/stackpier-demo','/etc/systemd/system','/var/lib/docker'].includes(target.path)))return '清理范围不安全或归属不明：'+target.path;
  const dedicatedFrp=p.frpService&&target.path===p.frpApplied?.root+'/projects/'+p.name;
  if(target.kind==='directory'&&!dedicatedFrp&&!target.path.startsWith('/srv/stackpier-demo/'+p.name+'/')&&target.path!=='/srv/stackpier-demo/'+p.name)return '外部目录归属不明，不能递归删除：'+target.path;
  for(const other of S.projects.filter(x=>x.id!==p.id&&x.server===p.server)){
   const resources=other.ownedResources||deploymentCleanupTargets(other,other.applied||other.cfg);
   if(resources.some(x=>cleanupTargetsOverlap(target,x)))return '资源仍被项目 '+other.name+' 引用：'+target.path+'；不能清理。';
  }
 }
 const roots=plan.remaining.filter(t=>t.kind==='directory');
 for(const meta of S.frpInstallMetadata||[])if(meta.server===p.server&&roots.some(t=>meta.snapshot?.frpApplied?.files?.binaryPath?.startsWith(t.path+'/')))return '目录包含共享 FRP 程序，不能递归清理。';
 return '';
}
function cleanupPlanBody(plan){return `<div class="stack">${detail([['目标项目',h(plan.name)],['固定服务器',h(plan.server?.name||'未知')],['删除数据','项目专属数据将被删除；不提供默认保留数据卸载']])}<h3>本次必需清理项 · ${plan.remaining.length}</h3>${plan.targets.map(t=>`<article class="asset-reference"><strong>${h(t.label)}</strong><code>${h(t.path)}</code>${plan.completed.some(x=>x.kind===t.kind&&x.path===t.path)?badge('此前已清理','success'):badge('必须清理','warning')}</article>`).join('')}${plan.frpConnections?.length?notice('受影响 FRP 连接',plan.frpConnections.map(n=>n.ip+' · '+n.id).join('、')+'；卸载服务后绑定会失效，不自动删除连接或其他项目。','warning'):''}<h3>保留的共享资源与网络</h3>${plan.preserved.map(t=>`<p>${h(t.path)} · ${h(t.reason)}</p>`).join('')}${plan.network.map(t=>`<p>${h(t.kind+' · '+t.label)} · ${t.projects.length>1?'共享关联':'关联不代表独占'}，只解除本项目关联，不删除条目。</p>`).join('')}${notice('公共文件和配置始终保留','不会删除公共资产、其他服务共享的程序、外部挂载或 DNS / 防火墙记录。')}</div>`;}
function finishProjectCleanup(o,p,result){
 const plan=o.input.cleanupPlan;if(!p||!plan){o.status='unknown';o.message='缺少原清理范围，不能推断完整卸载。';return;}
 const currentError=projectCleanupErrorDuringExecution(p,plan,o.id);if(result==='success'&&currentError){result='unknown';o.status=result;o.ended=null;o.message=currentError;}
 const previous=p.cleanup?.items?.filter(t=>t.status==='success')||[];
 const items=plan.remaining.map((t,i)=>({...t,status:result==='success'?'success':result==='partial'?(i<plan.remaining.length-1?'success':'failed'):result==='unknown'?'unknown':'pending'}));
 p.cleanup={operation:o.id,status:result,items:[...previous,...items],at:now()};o.cleanupResults=clone(p.cleanup.items);o.protectionReleased=result!=='unknown';
 if(result==='success'&&plan.targets.every(t=>p.cleanup.items.some(x=>x.path===t.path&&x.kind===t.kind&&x.status==='success'))){
  o.completeCleanup=true;o.message='所有必需专属资源与数据已清理并核对（模拟），项目实体已移除；公共资产和共享网络保留。';
  for(const rows of [S.dns,S.firewalls])for(const row of rows)if(row.projects.includes(p.id)){row.historicalProjects||=[];if(!row.historicalProjects.some(x=>x.id===p.id))row.historicalProjects.push({id:p.id,name:p.name,removedAt:now()});row.projects=row.projects.filter(id=>id!==p.id);}
  S.projects=S.projects.filter(x=>x.id!==p.id);if(ui.page==='project'&&ui.project===p.id){ui.page='projects';ui.project='';}
 }else{
  p.life='uninstalling';p.runtimeCheckStatus='unknown';p.monitorPaused=true;
  o.message=({failed:'清理失败',partial:'部分专属资源已清理',unknown:'清理结果未知'}[result]||'清理未完整核对')+'；保留项目、残留清单与恢复入口。';
 }
}
function projectCleanupErrorDuringExecution(p,plan,operationId){
 if(serverSnapshotError(plan.server))return '固定主机不可操作，清理结果待核对。';
 const copy={...clone(p),cleanup:null};const saved=S.operations;S.operations=S.operations.filter(o=>o.id!==operationId);try{return projectCleanupError(copy,plan);}finally{S.operations=saved;}
}
