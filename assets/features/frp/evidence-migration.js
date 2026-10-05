'use strict';

// 增量迁移不提高全站版本；原操作快照优先，缺少身份 / 路径证据时保守占用并阻断写入。
function migrateFrpEvidence(){
 S.frpConfigurationAttempts||=[];
 const operations=S.operations.filter(o=>o.kind==='frp-config'&&o.input?.nodeId).slice().reverse();
 for(const o of operations){
  if(!frpAttempt(o)){
   if(!o.input.items?.length){
    const bindings=o.input.bindings||{};
    const items=Object.entries(bindings).map(([role,id])=>({role,projectId:id,serverTarget:null,files:{tomlPath:''},identityReview:true,readOnly:role==='server'}));
    const node=frpNode(o.input.nodeId);if(!items.length&&node)node.evidenceReview||={operationId:o.id,message:'旧操作没有固定目标或绑定证据；不能假定已清理，也不能借当前绑定猜测旧目标。'};
    frpRegisterAttempt({...o,input:{...clone(o.input),items}});
   }
   frpRecordEvidence(o,o.status,true);
  }
 }
 for(const p of S.projects.filter(p=>p.frpWritePending)){
  const pending=p.frpWritePending,operation=S.operations.find(o=>o.id===pending.operationId);
  if(frpUnresolvedTargets().some(t=>t.projectId===p.id&&t.files?.tomlPath===pending.path)||frpAttempt({id:pending.operationId}))continue;
  const id='legacy-frp-evidence:'+p.id+':'+pending.operationId;
  if(S.operations.some(o=>o.id===id))continue;
  const nodeId=operation?.input?.nodeId||'frp-review:'+p.id,role=p.frpService?.role||'client';
  const o={id,kind:'frp-config',status:'unknown',time:operation?.time||p.observed||null,ended:null,protectionReleased:true,label:'旧 FRP 写入证据待核对 · '+p.name,message:'原执行快照缺失；不使用当前服务器和正文猜测原目标。保留占用与原记录。',resources:['project:'+p.id],steps:[],input:{nodeId,revision:operation?.input?.revision||null,bindings:{[role]:p.id},items:[{projectId:p.id,role,serverTarget:null,files:{tomlPath:pending.path||''},identityReview:true}]}};
  S.operations.push(o);frpRecordEvidence(o,'unknown',true);
 }
 // 只接受逐项成功且覆盖相同固定目标的后续完成；旧 resolved 标记本身不证明清理。
 for(const o of operations)frpResolveEvidence(o);
 for(const a of S.frpConfigurationAttempts){const o=S.operations.find(o=>o.id===a.operationId);if(o?.resolved&&a.targets.some(t=>frpTargetUnresolved(a,t))){delete o.resolved;delete o.resolution;}}
 frpSyncWritePending();S.frpEvidenceSchema=1;
}
