'use strict';

// 服务实体、未完成操作和程序准备元数据各自保存；不修改全站存储版本。
function migrateServiceProjects(){
 S.serviceMigration||={schema:1,evidence:[],retiredIds:[]};S.frpInstallMetadata||=[];
 const migration=S.serviceMigration;
 const retain=(p,reason)=>{if(!migration.evidence.some(e=>e.projectId===p.id))migration.evidence.push({projectId:p.id,server:p.server,name:p.name,reason,snapshot:clone(p),at:p.observed||null,needsReview:true});};
 for(const p of [...S.projects]){
  const ops=S.operations.filter(o=>o.project===p.id),pureProgram=p.frpInstallation?.role==='client'&&!p.frpApplied?.files?.unit;
  if(pureProgram){if(!S.frpInstallMetadata.some(i=>i.projectId===p.id))S.frpInstallMetadata.push({projectId:p.id,server:p.server,programRef:clone(p.frpApplied?.programRef||p.frpDraft?.programRef||null),snapshot:clone(p),source:'历史程序准备，不是服务'});}
  else if(p.life==='draft'||p.creationPending||p.life==='incomplete'&&!p.applied){
   const operation=ops.find(o=>o.kind==='deploy'||o.frp||o.frpInstallation);
   if(operation){operation.newProject=true;operation.input||={};operation.input.deployment||=deploymentSnapshot(p);if(['failed','partial','unknown','rejected'].includes(operation.status))archiveFailedDeployment(operation,p);}
   else if(p.cfg){retain(p,'从未部署对象的独有配置及关联已保留供核对，不作为项目或草稿箱。');}
  }else if(p.life==='uninstalled'){
   const cleaned=ops.find(o=>o.kind==='uninstall'&&o.status==='success'&&(o.completeCleanup||o.input?.deleteData===true)&&!p.components?.length);
   if(!cleaned){retain(p,'旧卸载未证明专属数据全部清理；残留归属待核对。');
    if(!S.failedProjects.some(f=>f.migrationProject===p.id)){const deployment=deploymentSnapshot(p,p.applied||p.cfg);deployment.targets.forEach(t=>t.ownership='unknown');const operation=record('历史清理待核对 · '+p.name,'migration-review',p.id,'failed','旧卸载未证明专属数据清理；先核对归属，再单独确认继续清理。',{input:{deployment:clone(deployment)},protectionReleased:true});S.operations.shift();S.operations.push(operation);const failure={id:uid('failure'),operation:operation.id,migrationProject:p.id,time:now(),result:'unknown',message:operation.message,deployment,cleanup:{status:'pending',items:[]}};operation.failure=failure.id;S.failedProjects.push(failure);}
   }
  }else{
   p.components||=[];p.cfg||={};
   if(p.frpRef||p.frpInstallation){
    const role=p.frpRef?.role||p.frpInstallation.role;
    p.frpService||={role,legacy:true};
    if(p.frpApplied){p.cfg.frpSnapshot||=clone(p.frpDraft||p.frpApplied);p.applied&& (p.applied.frpSnapshot||=clone(p.frpApplied));}
   }
   if(p.runtime==='na'){p.runtime='unknown';p.runtimeCheckStatus='unknown';}
   if(p.life==='uninstalling'&&!p.cleanup){retain(p,'历史清理未完成；保留服务和专属资源待核对。');}
   continue;
  }
  S.projects=S.projects.filter(x=>x.id!==p.id);if(!migration.retiredIds.includes(p.id))migration.retiredIds.push(p.id);
 }
 // 仅以旧稳定项目 ID 推导引用；纯安装 ID 不冒充连接服务。
 for(const F of [S.frp,...Object.values(S.frpProfiles||{})].filter(Boolean))for(const n of F.nodes){
  n.serviceBindings||={};for(const role of Object.keys(frpRoles)){const id=n.roleProjects?.[role]||'frp-'+n.id+'-'+role;if(!n.serviceBindings[role]&&pr(id)?.frpService)n.serviceBindings[role]=id;}
  if(n.clientInstallation){n.programInstallationRef??=n.clientInstallation;delete n.clientInstallation;}
  n.sourceSettings||=frpSettingsSnapshot();
  // 旧已应用参照只能从真实保存的完整快照迁移，不能用当前草稿冒充。
  if(!n.appliedConfiguration&&!n.configurationManaged&&!n.configurationResult&&!S.operations.some(o=>o.kind==='frp-config'&&o.input?.nodeId===n.id)){const roles=['client','server',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])];if(roles.every(role=>pr(n.serviceBindings[role])?.frpApplied))n.appliedConfiguration={revision:pr(n.serviceBindings.client).frpApplied.node?.revision||n.revision,proxies:clone(pr(n.serviceBindings.client).frpApplied.node?.proxies||[]),serviceIds:roles.map(role=>n.serviceBindings[role]),source:'迁移历史模拟参照',at:pr(n.serviceBindings.client).observed};}
 }
 S.serviceSchema=1;
}
function projectPendingOperations(){return S.operations.filter(o=>(o.newProject||o.frp||o.frpInstallation||o.kind==='uninstall'||o.kind==='frp-config'||o.kind==='migration-review')&&['running','failed','partial','unknown','rejected'].includes(o.status)&&!o.resolved);}
function projectOperationBanner(){const pending=projectPendingOperations(),reviews=S.serviceMigration?.evidence.filter(e=>e.needsReview)||[];return (pending.length?notice('部署 / 清理待处理 · '+pending.length,'未完成的部署不会作为服务项目出现；查看固定目标、日志及恢复入口。','warning')+operationTable(pending.slice(0,5)):'')+(reviews.length?`<details class="card mb"><summary>历史归属待核对 · ${reviews.length}</summary><div class="card-body">${reviews.map(e=>`<article class="asset-reference"><strong>${h(e.name)}</strong><p>${h(e.reason)}</p><p class="cell-sub">${h(sname(e.server))}</p>${btn('查看保留证据','migration-evidence',{id:e.projectId},'small')}</article>`).join('')}</div></details>`:'');}
registerPrototypeHandlers(prototypeActions,['migration-evidence'],(e,t,d)=>openModal('migration-evidence',{id:d.id}));
registerPrototypeHandlers(prototypeModals,['migration-evidence'],m=>{const e=S.serviceMigration.evidence.find(x=>x.projectId===m.id);if(!e)return closeModal();layout('历史归属待核对 · '+e.name,'只保存排错证据，不是可管理的项目。',notice(e.reason,'公共资产、DNS、防火墙和关联历史全部保留。','warning')+detail([['原稳定 ID',h(e.projectId)],['原服务器',h(sname(e.server))],['配置来源',h(e.snapshot.template||'未知')]])+`<details><summary>原配置与状态证据</summary><pre class="code asset-text">${h(JSON.stringify(e.snapshot,null,2))}</pre></details>`,btn('关闭','closemodal'),true);});

function retainLegacyFrpResult(o){
 if(!o||!['running','unknown'].includes(o.status))return;
 o.status='unknown';o.message='旧专用 FRP 操作的归属与残留待核对；保留原输入和步骤，不能用新规则推断已部署或完整卸载。请从项目服务和历史证据核对。';persist();render();if(ui.modal?.kind==='opdetail')renderModal();
}
