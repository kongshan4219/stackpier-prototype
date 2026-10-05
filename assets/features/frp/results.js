'use strict';
// FRP 模拟结果与迟到证据核对，不执行真实命令。
function frpFinish(o,result){
 if(o?.frp&&['start','stop','restart'].includes(o.input.operation))return frpFinishRuntime(o,result);
 if(!o||!o.frp||!['running','unknown'].includes(o.status))return;
 clearTimeout(timers.get(o.id));timers.delete(o.id);
 const wasUnknown=o.status==='unknown',at=now(),items=o.input.items,op=o.input.operation;
 o.frpCompleted||=[];o.frpResults||=[];
 let failure=items.findIndex(x=>x.role==='visitor');if(failure<0)failure=items.length>2?Math.floor(items.length/2):items.length-1;
 const completedBefore=new Set(o.frpCompleted);
 // 核对失败不能抹掉同一次执行里已经确认完成的角色或步骤。
 const hasEvidence=completedBefore.size>0||o.steps.slice(1).some(s=>s.status==='success');
 const targetStates=Object.values(o.input.targetOutcomes||{});const summary=targetStates.length?(targetStates.every(s=>s==='success')?'success':targetStates.includes('unknown')?'unknown':targetStates.every(s=>s==='failed')?'failed':'partial'):result==='failed'&&hasEvidence?'partial':result;
 o.status=summary;o.ended=result==='unknown'?null:at;o.protectionReleased=false;
 if(!wasUnknown)o.steps[0].status=result==='failed'?'failed':'success';
 items.forEach((x,i)=>{
  const p=pr(x.project);if(!p)return;
  if(completedBefore.has(x.project))return;
  const state=o.input.targetOutcomes?.[x.project]||(result==='success'||(!wasUnknown&&result==='partial'&&i!==failure)||(!wasUnknown&&result==='unknown'&&i<failure)?'success':result==='failed'?'failed':result==='unknown'&&i>failure?'pending':result);
  o.frpResults=o.frpResults.filter(row=>row.project!==x.project);o.frpResults.push({project:x.project,node:x.node,role:x.role,status:state});
  const count=['deploy','install'].includes(op)?3:1,offset=1+i*count;
  let anySuccess=false;
  for(let k=0;k<count;k++){
   const st=o.steps[offset+k];
   if(st.status==='success'){anySuccess=true;continue;}
   st.status=state==='success'?'success':state==='partial'?(k===0?'success':k===1?'failed':'pending'):state==='unknown'?(k===0?'unknown':'pending'):state==='failed'?(k===0?'failed':'pending'):'pending';
   st.note=st.status==='success'?'本分项已模拟核对':st.status==='unknown'?'缺少原执行证据，不自动重放':st.status==='failed'?'分项明确失败；保留此前已完成项':'未执行 / 尚无证据';
   if(st.status==='success')anySuccess=true;
  }
  if(state==='success')o.frpCompleted.push(x.project);
  // 已经有更新的受理操作时，迟到历史核对仅补记录，不覆盖较新的项目信息。
  if(p.frpLastOp&&p.frpLastOp!==o.id)return;
  if(state==='success'){
   if(['deploy','install'].includes(op)){p.life='installed';p.frpApplied=clone(x.snapshot);p.applied={...clone(x.cfg||{}),port:x.role==='server'?x.snapshot.node.bind_port:0,appConfig:x.files.toml,version:x.snapshot.program?'内容 R'+x.snapshot.program.revision+' · 元数据，未验证运行':'历史模拟程序条件，内容未知'};p.appliedRev=x.draftRev||x.snapshot.revision;p.frpAppliedProgramRef=clone(x.snapshot.programRef);p.frpReadSnapshot={files:clone(x.snapshot.files),program:clone(x.snapshot.program),at,source:'模拟部署后的文件读取'};p.runtime=op==='install'?'stopped':'running';p.desired=p.runtime;p.runtimeCheckStatus='verified';p.stopVerified=false;p.components=[];const n=frpNode(x.node);if(n.authMigration)n.authMigration.roles=n.authMigration.roles.filter(r=>r!==x.role);}
   else if(op==='uninstall'){p.life='uninstalled';p.runtime='na';p.monitorPaused=true;p.dataStatus='retained';p.components=[];}
   p.health='unknown';p.observed=at;p.lastCheck=at;
  }else if((state==='partial'||state==='failed'&&anySuccess)&&['deploy','install'].includes(op)){
   p.life=x.before.life==='installed'?'installed':'incomplete';p.components=[{name:'分项结果',result:'程序/TOML 已交付，后续未完整完成；未假定已激活，未自动回退'}];
  }else if(state==='unknown'){p.components=[{name:'原操作待核对',result:'保留已知事实；本角色的后续远端效果未知'}];}
  else if(state==='failed'&&wasUnknown){p.components=[{name:'核对结论',result:'原执行已结束，本角色未完成；已完成角色与步骤保持，不重放'}];}
 });
 o.message=summary==='success'?'选定角色均完成模拟；未自动更改网络或初始化数据库。隧道端到端可用性仍未核对。':summary==='partial'?'部分完成：已完成角色与步骤保留；后续分项未完成。未重跑成功部分，未自动回退。':summary==='unknown'?'后续角色结果未知。保留前面已完成项与冲突保护；先核对原执行，不自动重放。':['deploy','install'].includes(op)&&!wasUnknown?'前置明确失败，未交付、未启动；本次请求与实际观测分别保存。':'所选操作明确失败；实际运行观测不因失败而改写，不自动重试。';
 if(result==='success')for(const cleanup of o.input.cleanup||[]){if(S.frpGenerated)delete S.frpGenerated[cleanup.project];const visitor=pr(cleanup.project);if(visitor){visitor.life='uninstalled';visitor.runtime='na';visitor.frpCleanup={...clone(cleanup),at,stopped:true,unitRemoved:true,configRemoved:true,generatedRemoved:true};}}
 o.message+=' 逐目标结果：'+(o.frpResults||[]).map(row=>pname(row.project)+' '+row.status).join('；');
 frpSyncConfigs();persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();
}
function frpFinishRuntime(o,result){
 if(!o||!['running','unknown','failed','partial'].includes(o.status))return;
 clearTimeout(timers.get(o.id));timers.delete(o.id);const at=now(),op=o.input.operation,alreadyReleased=o.protectionReleased===true;
 const supplied=result&&typeof result==='object'?result:null;o.frpRuntimeResults||=[];o.frpRuntimeChecks||=[];
 const next=o.input.items.map((x,i)=>{
  const evidence=clone(supplied?.items?.[x.project]||supplied?.commandResult&&supplied||o.input.runtimeEvidence||{}),prior=o.frpRuntimeResults.find(row=>row.project===x.project);
  if(prior){evidence.commandResult=prior.evidence.commandResult;evidence.executionEnded=prior.evidence.executionEnded===true||evidence.executionEnded;}
  if(!Object.hasOwn(evidence,'observedAt'))evidence.observedAt=evidence.observedState&&evidence.observedState!=='unknown'?at:null;
  const latestObserved=o.frpRuntimeChecks.flatMap(check=>check.results).filter(row=>row.project===x.project&&row.assessment.canUpdateObservation).map(row=>row.evidence.observedAt).filter(Boolean).sort().at(-1);
  const assessment=assessRuntimeEvidence({...evidence,kind:op,requestedState:o.input.requestedState,notBefore:latestObserved&&Date.parse(latestObserved)>Date.parse(o.time)?latestObserved:o.time});
  o.steps[1+i*2].status=evidence.commandResult==='success'?'success':evidence.commandResult==='error'?'failed':'unknown';
  o.steps[1+i*2].note='命令返回独立记录；不直接作为操作结论。';
  o.steps[2+i*2].status=assessment.status;o.steps[2+i*2].note=assessment.reason;
  const p=pr(x.project);if(p&&(!p.frpLastOp||p.frpLastOp===o.id)){applyRuntimeObservation(p,assessment,{kind:op,operationId:o.id});p.health='unknown';p.components=assessment.status==='success'?[]:[{name:'实际状态核对',result:assessment.reason}];}
  return {project:x.project,role:x.role,evidence,assessment};
 });
 o.frpRuntimeResults=next;o.frpRuntimeChecks.push({at,results:clone(next)});
 const statuses=next.map(row=>row.assessment.status);o.status=statuses.includes('unknown')?'unknown':statuses.every(x=>x==='success')?'success':statuses.every(x=>x==='failed')?'failed':'partial';
 o.ended=o.status==='unknown'&&!alreadyReleased?null:o.ended||at;o.protectionReleased=alreadyReleased||o.status!=='unknown';o.message='按原unit实际核对判定：'+next.map(x=>frpRoles[x.role]+'：'+x.assessment.reason).join('；')+'。命令返回保留为独立证据，未重新执行命令。';
 persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();return o;
}
