'use strict';

function resolveOperationHistory(o,completed,reason='专属资源全部清理并核对'){
 if(!o||o.id===completed.id)return;
 o.resolved=true;o.resolution={operationId:completed.id,kind:completed.kind,reason,at:completed.ended||completed.time};
 completed.resolves||=[];if(!completed.resolves.includes(o.id))completed.resolves.push(o.id);
}
function completeFailureResolution(failure,cleanup){
 const targets=failure.deployment.targets;
 if(!targets?.length||cleanup.status!=='success'||failure.cleanup.status!=='success'||!targets.every(t=>failure.cleanup.items.some(i=>resourceKey(i)===resourceKey(t)&&i.status==='success')))return false;
 failure.resolved=true;failure.resolvedBy=cleanup.id;
 for(const o of S.operations.filter(o=>o.id===failure.operation||o.failure===failure.id))resolveOperationHistory(o,cleanup);
 if(failure.migrationOperation){const original=S.operations.find(o=>o.id===failure.migrationOperation);if(original){original.cleanupReview.resolvedBy=cleanup.id;for(const o of S.operations.filter(o=>o.kind==='uninstall'&&o.project===original.project&&o.time<=original.time&&o.input?.cleanupPlan?.targets?.length&&o.input.cleanupPlan.targets.every(t=>cleanupEvidenceCovers(failure.cleanup.items,t))))resolveOperationHistory(o,cleanup);}}
 const evidence=S.serviceMigration?.evidence.find(e=>e.projectId===failure.migrationProject);if(evidence){evidence.needsReview=false;evidence.resolvedBy=cleanup.id;}
 return true;
}
function cleanupEvidenceScope(completed){
 const targets=[...(completed.input?.cleanupPlan?.targets||[])];
 for(const o of S.operations.filter(o=>o.project===completed.project&&o.time<=completed.time&&['deploy','apply','update'].includes(o.kind)&&['success','partial','unknown'].includes(o.status))){
  for(const t of o.input?.resourceTargets||o.input?.deployment?.targets||[])if(resourceOwnership(t)==='project'&&!targets.some(x=>resourceKey(x)===resourceKey(t)))targets.push(clone(t));
 }
 return targets;
}
function cleanupEvidenceCovers(items,t){return items.some(i=>i.status==='success'&&(resourceKey(i)===resourceKey(t)||i.kind==='directory'&&t.kind==='file'&&t.path.startsWith(i.path+'/')));}
function completeUninstallResolution(completed){
 if(!completed.completeCleanup||completed.status!=='success'||!completed.input?.cleanupPlan||!completed.cleanupResults?.length)return;
 const plan=completed.input.cleanupPlan,items=completed.cleanupResults;
 if(!plan.targets?.length||!cleanupEvidenceScope(completed).every(t=>cleanupEvidenceCovers(items,t)))return;
 for(const o of S.operations.filter(o=>o.kind==='uninstall'&&o.project===completed.project&&o.id!==completed.id&&o.time<=completed.time)){
  const old=o.input?.cleanupPlan;
  if(old?.targets?.length&&old.server?.id===plan.server.id&&['host','user','arch'].every(key=>old.server[key]!==undefined&&old.server[key]===plan.server[key])&&['fp','port'].every(key=>!Object.hasOwn(old.server,key)||!Object.hasOwn(plan.server,key)||old.server[key]===plan.server[key])&&old.targets.every(t=>cleanupEvidenceCovers(items,t)))resolveOperationHistory(o,completed);
 }
}
function retainLegacyCleanupGaps(o){
 if(!o.completeCleanup||o.status!=='success'||pr(o.project)||!o.input?.cleanupPlan||!o.cleanupResults?.length)return;
 const scope=cleanupEvidenceScope(o),missing=scope.filter(t=>!cleanupEvidenceCovers(o.cleanupResults,t));if(!missing.length)return;
 if(S.failedProjects.some(f=>f.migrationOperation===o.id))return;
 const deployment=clone(o.input.deployment);if(!deployment?.project)return;deployment.targets=scope;if(!deployment.server?.fp)deployment.targets.forEach(t=>t.ownership='unknown');
 const review=record('历史清理漏项待核对 · '+deployment.project.name,'migration-review',o.project,'unknown','原卸载清单遗漏历史交付资源；不恢复项目，保留完整证据并继续清理。',{input:{deployment:clone(deployment)},protectionReleased:true});
 const failure={id:uid('failure'),operation:review.id,migrationOperation:o.id,time:review.time,result:'unknown',message:review.message,deployment,cleanup:{status:'pending',items:clone(o.cleanupResults)}};review.failure=failure.id;o.cleanupReview={operationId:review.id,failureId:failure.id};S.failedProjects.push(failure);
 for(const old of S.operations.filter(x=>x.kind==='uninstall'&&x.project===o.project&&x.time<=o.time)){delete old.resolved;delete old.resolution;}
}
function migrateOperationResolutions(){
 for(const f of S.failedProjects||[]){const o=S.operations.find(o=>o.id===f.cleanup?.operation);if(o&&o.failure===f.id&&o.input?.deployment?.server?.id===f.deployment.server?.id&&o.input?.deployment?.server?.fp===f.deployment.server?.fp)completeFailureResolution(f,o);}
 for(const o of S.operations.filter(o=>o.kind==='uninstall')){retainLegacyCleanupGaps(o);completeUninstallResolution(o);}
 S.operationResolutionSchema=1;
}
