'use strict';

function finishOperation(o,result='success'){
 if(!o||!['running','unknown'].includes(o.status))return;clearInterval(timers.get(o.id));timers.delete(o.id);const p=pr(o.project),input=o.input,before=input.before||{},at=now();o.outcome=result;o.status=result==='start-failed'?'partial':result;o.ended=result==='unknown'?null:at;
 if(result==='success'){o.steps.forEach(s=>{s.status='success';s.note='此分项已核对（演示）'});o.message='本次约定的适用分项均已完成并核对。';}
 else if(result==='failed'){o.steps.forEach((s,i)=>{s.status=i===0?'failed':'pending';s.note=i===0?'明确失败，原操作确认结束':'前置失败，未执行'});o.message='本次操作明确失败，已记录失败点；不会自动重试或回退。';}
 else if(result==='unknown'){let unknownAt=Math.max(1,o.steps.length-2);o.steps.forEach((s,i)=>{s.status=i<unknownAt?'success':i===unknownAt?'unknown':'pending';s.note=i<unknownAt?'已有证据保留':i===unknownAt?'响应丢失，需要核对原操作':'是否执行尚不明确'});o.message='响应丢失，结果待核对。保留已有证据和必要的冲突保护，不盲目重放。';if(p&&sr(p.server))sr(p.server).state='unknown';}
 else{o.steps.forEach((s,i)=>{s.status=i===o.steps.length-1?'failed':'success';s.note=i===o.steps.length-1?'本分项失败；不会抹掉前面已完成结果':'已核对完成'});o.message='部分完成：已成功的分项保留，失败部分单独处理。';}
 if(p){
  if(['deploy','apply','update'].includes(o.kind)){
   if(result==='success'){p.life='installed';p.applied=clone(input.cfg);p.appliedRev=input.draftRev;if(input.binary){p.programUpdate=S.programs.some(b=>b.name===input.binary.name&&b.arch===input.binary.arch&&b.identity!==input.binary.identity);if(p.draftRev===input.draftRev)p.cfg.contentIdentity=input.binary.identity;}p.components=[];p.unsafe=false;p.runtime=p.desired==='running'?'running':'stopped';p.health=p.runtime==='running'?'healthy':'na';p.observed=at;p.dataStatus=p.dataStatus==='retained'?'in-place':p.dataStatus;notifyDependencies(p,o);}
   else if(result==='partial'){p.life=before.life==='installed'?'installed':'incomplete';p.components=[{name:'程序 / 镜像文件',result:'部分新内容已交付 '+input.cfg.version},{name:'配置与运行定义',result:'未完整核对，参照仍保留历史完整版本'}];o.message='程序或配置部分交付，尚未完整应用。不是全部旧版，也没有自动回退。';o.steps[o.steps.length-2].status='failed';o.steps[o.steps.length-1].status='pending';}
  }
  if(['start','stop','restart'].includes(o.kind)){
   if(result==='success'){p.desired=o.kind==='stop'?'stopped':o.kind==='start'?'running':p.desired;p.runtime=o.kind==='stop'?'stopped':'running';p.health=p.runtime==='running'?'healthy':'na';p.observed=at;}
   else if(result==='partial'){p.runtime=o.kind==='restart'?'stopped':'partial';p.health='unhealthy';p.observed=at;o.message=o.kind==='restart'?'停止已完成，随后启动失败；项目仍已部署。':'仅部分运行成员达到目标，需逐项处理。';}
   else if(result==='failed'){o.message=`${opLabels[o.kind]}失败；实际仍为${runtimeName[p.runtime]}。运行目标${p.desired==='running'?'运行':'停止'}，不会自动重试。`;}
  }
  if(o.kind==='backup'){
   if(['success','partial'].includes(result))addBackup(p,o);
   if(result==='unknown'){o.message='备份结果未知。临时停服上下文和实际服务观测单独保留；不自动重跑或放行冲突请求。';}
   else if(result==='partial'&&input.stop&&before.runtime==='running'){p.runtime='stopped';p.health='unhealthy';p.observed=at;o.message='备份产物已完成且可用，但恢复原运行的收尾启动失败。只处理启动，不重跑备份。';p.temporary=false;}
   else{
    const mayStart=input.stop&&before.runtime==='running'&&p.desired==='running'&&(result==='success'||(result==='failed'&&S.review.p2));
    if(mayStart){p.runtime='running';p.health='healthy';p.observed=at;}
    if(result==='failed'&&input.stop){p.temporary=false;o.message=S.review.p2?'备份明确失败；演示已证实原执行结束且数据安全，按待审收尾规则恢复原运行一次。':'备份明确失败；原型试验设置不自动恢复运行，实际仍停止，请人工处理。';}
    if(result==='partial'){o.steps[1].status='failed';o.steps[o.steps.length-1].status='success';o.message='前置清理失败；空间核对足够后继续备份，产物已验证可用。整次操作部分完成。';}
    if(result!=='unknown')p.temporary=false;
   }
  }
  if(o.kind==='restore'){
   const b=input.restoreSource||S.backups.find(b=>b.id===input.backupId);
   if(result==='success'||result==='start-failed'){
    o.dataRestored=true;p.unsafe=false;p.components=[];p.applied=clone(b?.config||p.applied);p.appliedRev=Math.max(1,p.appliedRev);p.dataStatus='in-place';
    if(before.life==='uninstalled'){p.life=S.review.p3?'installed':'uninstalled';p.runtime=S.review.p3?'stopped':'na';p.health='na';p.plansPaused=true;o.steps.at(-1).note='原项目已卸载，不自动启动；计划仍暂停。';}
    else if(result==='start-failed'&&before.runtime==='running'&&before.desired==='running'){p.runtime='stopped';p.health='unhealthy';o.status='partial';o.message='文件和选定数据库恢复完成，随后启动失败。后续只发起启动，不再次覆盖恢复。';}
    else{p.runtime=before.runtime==='running'&&before.desired==='running'?'running':'stopped';p.health=p.runtime==='running'?'healthy':'na';if(p.runtime==='stopped')o.steps.at(-1).note='恢复前已停止，本分支不自动启动。';}
    p.observed=at;notifyDependencies(p,o);
   }else if(result==='partial'){p.unsafe=true;p.runtime='stopped';p.health='unhealthy';p.components=[{name:'项目文件',result:'已覆盖'},{name:'数据库数据',result:'覆盖未完成'}];o.steps[2].status='failed';o.steps[3].status='pending';o.message='仅部分数据完成覆盖，不能自动启动；不得为重试启动掩盖不完整数据。';}
  }
  if(o.kind==='uninstall'&&['success','partial'].includes(result)){
   p.life='uninstalled';p.runtime='na';p.health='na';p.plansPaused=true;p.dataStatus=input.deleteData?'deleted':'retained';p.observed=at;p.components=[];p.temporary=false;
   const ds=input.dnsIds||[],fs=input.fwIds||[];
   if(result==='success'){S.dns=S.dns.filter(r=>!ds.includes(r.id));S.firewalls=S.firewalls.filter(r=>!fs.includes(r.id));o.message='核心已卸载，选择的分项已完成。历史备份和记录保留，此项目全部定时计划已暂停。';}
   else{o.message=ds.length||fs.length?'核心服务已卸载，选定网络清理失败。项目已卸载事实不回退，计划已暂停。':'核心服务已卸载；演示缺少选中的失败清理分项，因此本次没有可表示的网络失败，按核心成功记录。';if(!ds.length&&!fs.length){o.status='success';o.steps.forEach(s=>s.status='success');}}
  }
  if(o.kind==='replica'){
   if(result==='success'){p.replicaOf=input.primary;p.replication='healthy';p.hasBusinessData=true;p.initResidue=false;p.runtime='running';p.health='healthy';p.desired='running';p.observed=at;}
   if(result==='partial'){p.hasBusinessData=true;p.initResidue=true;p.replication='unhealthy';o.message='初始数据已导入，但复制建立未完成。后续须核对原初始化，不当作新空库覆盖重做。';}
  }
 }
 if(o.kind==='env'&&result==='success'){const s=sr(input.server);if(s)s.docker=true;o.message='缺失依赖已补齐（模拟）；未升级或替换任何已存在组件。';}
 if(o.kind==='network'&&result==='success')applyNetwork(input);
 if(o.status==='failed'&&['apply','update'].includes(o.kind))S.notifications.unshift({id:uid('ntf'),time:at,project:p.id,channel:'HTTP · 演示',status:'success',text:o.message});
 persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();toast(o.label+'：'+statusName[o.status],o.status==='success'?'success':o.status==='failed'?'error':'');
}
