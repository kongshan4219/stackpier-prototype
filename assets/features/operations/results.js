'use strict';

function finishOperation(o,result='success'){
 if(!o||!['running','unknown'].includes(o.status))return;clearInterval(timers.get(o.id));timers.delete(o.id);const p=pr(o.project),input=o.input,before=input.before||{},at=now();o.outcome=result;o.status=result;o.ended=result==='unknown'?null:at;
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
  if(o.kind==='uninstall'&&['success','partial'].includes(result)){
   p.life='uninstalled';p.runtime='na';p.health='na';p.monitorPaused=true;p.dataStatus=input.deleteData?'deleted':'retained';p.observed=at;p.components=[];
   const ds=input.dnsIds||[],fs=input.fwIds||[];
   if(result==='success'){S.dns=S.dns.filter(r=>!ds.includes(r.id));S.firewalls=S.firewalls.filter(r=>!fs.includes(r.id));o.message='核心已卸载，选择的分项已完成。操作记录保留，此项目定时巡检已暂停。';}
   else{o.message=ds.length||fs.length?'核心服务已卸载，选定网络清理失败。项目已卸载事实不回退，定时巡检已暂停。':'核心服务已卸载；演示缺少选中的失败清理分项，因此本次没有可表示的网络失败，按核心成功记录。';if(!ds.length&&!fs.length){o.status='success';o.steps.forEach(s=>s.status='success');}}
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
