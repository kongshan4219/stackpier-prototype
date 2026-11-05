'use strict';

// 每次受理保存独立目标；核对追加事实，后续操作只能逐目标解决，不能覆盖旧证据。
const frpEvidenceLabel={written:'确认写入',notWritten:'明确未写入',possible:'可能写入',unknown:'结果未知',checked:'只读核对完成'};
function frpTargetKey(x){return JSON.stringify([x.projectId,x.role,...['id','host','fp','port','user','arch'].map(k=>x.serverTarget?.[k]),x.files?.tomlPath]);}
function frpAttempt(o){return (S.frpConfigurationAttempts||[]).find(a=>a.operationId===o.id);}
function frpRegisterAttempt(o){
 S.frpConfigurationAttempts||=[];let a=frpAttempt(o);if(a)return a;
 const plan=o.input;a={operationId:o.id,nodeId:plan.nodeId,revision:plan.revision,mode:plan.mode||'apply',time:o.time,bindings:clone(plan.bindings||{}),snapshot:clone(plan),targets:(plan.items||[]).map(x=>({...clone(x),identityReview:!!x.identityReview||!x.serverTarget?.id||!x.serverTarget?.host||!x.files?.tomlPath||!!targetFilePathError(x.files.tomlPath)||!frpRoles[x.role]||!x.projectId,ownerNodeId:(plan.connectionSnapshots||[]).find(n=>n.bindings?.[x.role]===x.projectId)?.nodeId||plan.nodeId,key:frpTargetKey(x)})),checks:[],resolutions:[]};
 S.frpConfigurationAttempts.push(a);return a;
}
function frpRecordEvidence(o,result,legacy=false){
 const a=frpRegisterAttempt(o),rows=a.targets.map((x,i)=>{
  const r=(o.results||[]).find(r=>r.projectId===x.projectId&&r.path===x.files?.tomlPath),status=r?.status||result;
  const write=r?.writeEvidence||(status==='success'?(x.readOnly?'checked':'written'):status==='unknown'?'unknown':legacy?'possible':status==='failed'?'notWritten':'possible');
  return {key:x.key,status,writeEvidence:write,executionEnded:o.protectionReleased===true||!['running','unknown'].includes(result),identityVerified:status==='success'&&!!r};
 });
 if(JSON.stringify(a.checks.at(-1)?.results)===JSON.stringify(rows)&&a.checks.at(-1)?.result===result)return a;
 a.checks.push({result,results:rows,at:o.ended||o.time||null});return a;
}
function frpTargetUnresolved(a,t){
 if(a.resolutions.some(r=>r.key===t.key))return false;
 const check=a.checks.at(-1),row=check?.results.find(r=>r.key===t.key);
 if(!row)return true;
 if(check.result==='success'&&row.identityVerified&&!t.identityReview)return false;
 return row.writeEvidence!=='notWritten';
}
function frpUnresolvedTargets(nodeId){
 const targets=new Map();
 for(const a of S.frpConfigurationAttempts||[])for(const t of a.targets.filter(t=>(!nodeId||(t.ownerNodeId||a.nodeId)===nodeId)&&frpTargetUnresolved(a,t))){
  const previous=targets.get(t.key),row=a.checks.at(-1)?.results.find(r=>r.key===t.key);
  targets.set(t.key,{...clone(t),nodeId:t.ownerNodeId||a.nodeId,operationIds:[...new Set([...(previous?.operationIds||[]),a.operationId])],writeEvidence:row?.writeEvidence||'possible',revision:a.revision});
 }
 return [...targets.values()];
}
function frpEvidenceSignature(nodeId){return JSON.stringify((S.frpConfigurationAttempts||[]).filter(a=>a.nodeId===nodeId||a.targets.some(t=>t.ownerNodeId===nodeId)).map(a=>[a.operationId,a.checks,a.resolutions]));}
function frpResolveEvidence(o){
 if(o.status!=='success'||!o.results?.length||o.results.some(r=>r.status!=='success'))return;
 const current=frpAttempt(o);if(!current)return;
 for(const a of S.frpConfigurationAttempts)if(a.operationId!==o.id){
  const previous=S.operations.find(p=>p.id===a.operationId);
  for(const t of a.targets){
   const matching=current.targets.find(x=>x.key===t.key);
   // 清理只解决本连接，正常重试只解决同一连接同一路径；共享认证不猜测其他连接完成。
   const earlier=S.operations.findIndex(p=>p.id===a.operationId),later=S.operations.findIndex(p=>p.id===o.id);
   if((t.ownerNodeId||a.nodeId)!==(matching?.ownerNodeId||current.nodeId)||earlier<0||earlier<=later||t.identityReview||!matching||a.resolutions.some(r=>r.key===t.key)||!frpTargetUnresolved(a,t))continue;
   if(previous&&['running','unknown'].includes(previous.status)&&!previous.protectionReleased)continue;
   a.resolutions.push({key:t.key,operationId:o.id,action:o.input.mode==='detach'?'cleaned':'verified',at:o.ended});
  }
  if(previous&&(a.nodeId===current.nodeId||a.targets.some(t=>t.ownerNodeId===current.nodeId))&&!a.targets.some(t=>frpTargetUnresolved(a,t))&&['failed','partial','unknown'].includes(previous.status))resolveOperationHistory(previous,o,'固定旧目标已全部核对或清理，原失败历史保留');
 }
}
function frpSyncWritePending(){
 for(const p of S.projects){
  const targets=frpUnresolvedTargets().filter(t=>t.projectId===p.id&&!t.readOnly),operations=[...new Set(targets.flatMap(t=>t.operationIds))];
  if(targets.length)p.frpWritePending={operationId:operations.at(-1),operationIds:operations,path:targets[0].files?.tomlPath,result:'unknown'};
  else if(p.frpWritePending&&frpAttempt({id:p.frpWritePending.operationId}))delete p.frpWritePending;
 }
}
function frpPendingEvidenceBody(nodeId){
 const targets=frpUnresolvedTargets(nodeId),review=frpNode(nodeId)?.evidenceReview;
 if(!targets.length)return review?notice('原目标证据待核实',review.message,'warning')+btn('查看缺失证据的原操作','opdetail',{id:review.operationId}):'';
 return notice('旧目标未解决 · '+targets.length,'尚有配置可能存在，不能改绑、删除连接或复用客户端 / visitor。请先核对原执行是否已结束，再重试当前配置或清理固定旧目标。','warning')+targets.map(t=>`<article class="asset-reference"><strong>${h(pname(t.projectId))} · ${h(t.serverTarget?.name||t.serverTarget?.id||'身份待核对')}</strong><code>${h(t.files?.tomlPath||'路径待核对')}</code><p class="small">C${t.revision} · ${h(frpEvidenceLabel[t.writeEvidence])}</p>${t.operationIds.map(id=>btn('查看原操作','opdetail',{id},'small')).join('')}</article>`).join('')+btn('恢复 / 清理固定旧目标','frp-binding-detach',{node:nodeId},'primary');
}
