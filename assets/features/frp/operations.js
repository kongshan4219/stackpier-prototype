'use strict';
// 模拟操作受理与分项结果核对；保留未知结果和迟到核对保护。
function frpCompileItems(items,op='deploy'){return items.map(x=>{const n=frpNode(x.node),p=pr(frpPid(n,x.role)),snapshot=op==='deploy'?frpSnapshot(n,x.role):clone(p.frpApplied);if(!snapshot)throw Error('没有已应用运行载体参照，不能猜测启停或卸载目标');return {node:n.id,role:x.role,project:p.id,snapshot,cfg:clone(p.cfg),draftRev:p.draftRev,before:{life:p.life,runtime:p.runtime,desired:p.desired},files:clone(snapshot.files)};});}
function frpRun(items,op,conditions){
 frpEnsure();if(!items.length){modalError('没有选中的适用角色。');return;}
 const p=pr(frpPid(frpNode(items[0].node),items[0].role)),errors=frpValidate();
 if(conditions.previewBinding&&conditions.previewBinding!==frpPreviewBinding(items,op))return rejectOperation(p,'frp-'+op,'预览后配置或已应用参照已变化，请重新打开预览并确认；不使用新内容替换原确认。');
 if(op==='deploy'&&errors.length)return rejectOperation(p,'frp-deploy',errors.join('；'));
 if((op==='deploy'||op==='start')&&!conditions.binary)return rejectOperation(p,'frp-'+op,'附件中的 frpc / frps 均为零字节占位文件：无法执行、无法验证真实架构或 FRP 配置。不下发、不启动。');
 if(!conditions.identity||!conditions.impact)return rejectOperation(p,'frp-'+op,'主机身份、授权或影响范围未确认。不自动接受 host key，不自动提权。');
 if(op==='uninstall'&&!conditions.remove)return rejectOperation(p,'frp-'+op,'请确认仅卸载所选角色，保留其他角色、共享程序及网络资源。');
 if(op==='deploy'&&frpAuthImpact(items).length){
  if(!conditions.authChange)return rejectOperation(p,'frp-deploy','全局认证与所选角色的旧参照不同，请明确确认认证变化后再应用。');
  const nodes=new Set(items.map(x=>x.node));
  const missing=frpAffectedRoles().filter(x=>nodes.has(x.node.id)&&x.project?.life==='installed'&&frpAuthChange(x.node,x.role)&&!items.some(item=>item.node===x.node.id&&item.role===x.role));
  if(missing.length)return rejectOperation(p,'frp-deploy','同一连接的配对角色仍使用旧认证：'+missing.map(x=>x.node.ip+' '+frpRoles[x.role]).join('、')+'。请明确选择“应用该连接全部角色”，不能形成未确认的认证分叉。');
 }
 for(const item of items){const n=frpNode(item.node),r=item.role,x=pr(frpPid(n,r));
  if(op!=='deploy'&&x.life!=='installed')return rejectOperation(x,'frp-'+op,'所选角色没有完整部署，不能将生成文件当作已安装服务。');
  if(op==='deploy'&&r==='visitor'&&!n.proxies.some(x=>x.type==='stcp'))return rejectOperation(x,'frp-deploy','已没有 STCP 映射，不再生成新 visitor；已有运行载体需单独确认卸载。');
  if(op==='deploy'&&!['x86_64','aarch64','arm64'].includes(sr(frpHost(n,r))?.arch))return rejectOperation(x,'frp-deploy','目标架构未确定 / 不支持，不能猜测二进制。');
  if(op==='deploy'&&x.frpApplied&&x.life!=='uninstalled'&&(x.frpApplied.files.unitPath!==frpFiles(n,r).unitPath||x.frpApplied.root!==S.frp.root||x.frpApplied.host!==frpHost(n,r)))return rejectOperation(x,'frp-deploy','当前修改涉及既有 unit 身份、运行目录或执行主机改变，不能把普通应用当成隐式迁移 / 清理旧服务；本原型保留原部署事实。');
 }
 const fixed=frpCompileItems(items,op),resources=[...new Set(fixed.flatMap(x=>['project:'+x.project,'frp-node:'+x.node,'frp-bin:'+x.snapshot.host+':'+(x.role==='server'?'frps':'frpc')]))];
 const conflict=conflictFor(resources);if(conflict)return rejectOperation(p,'frp-'+op,'与 '+conflict.label+' 冲突；拒绝此次请求，不排队，不取消原操作。');
 const steps=[{title:'固定输入与模拟前置核对',status:'success'}];for(const x of fixed)for(const title of op==='deploy'?['交付程序和 TOML','登记 systemd 运行定义','按目标启停（不等于隧道连通）']:['start','stop','restart'].includes(op)?['执行'+(opLabels[op]||op)+'命令','核对原unit实际状态']:[(opLabels[op]||op)+'所选运行载体'])steps.push({title:frpNode(x.node).ip+' · '+frpRoles[x.role]+' · '+title,status:'pending'});
 if(steps[1])steps[1].status='running';
 const o=record('FRP '+(op==='deploy'?'应用 / 部署':opLabels[op])+' · '+fixed.length+' 个角色','frp-'+op,p.id,'running','输入已固定；仅模拟执行，不连接服务器。',{frp:true,ended:null,input:{items:fixed,goal:conditions.goal,requestedState:op==='stop'?'stopped':'running',operation:op,runtimeEvidence:clone(conditions.runtimeEvidence||null),binaryCondition:conditions.binary?'虚构可用条件；附件仍为 0 B':'不执行程序'},resources,steps,outcome:conditions.outcome,hold:conditions.hold});
 for(const x of fixed){const q=pr(x.project);q.frpLastOp=o.id;if(['start','stop','restart'].includes(op))q.lastRuntimeOperation=o.id;if(['start','restart'].includes(op))q.stopVerified=false;}
 persist();render();closeModal();openModal('opdetail',{id:o.id});if(!conditions.hold)timers.set(o.id,setTimeout(()=>frpFinish(o,o.outcome),1600));return o;
}
function frpFinish(o,result){
 if(o?.frp&&['start','stop','restart'].includes(o.input.operation))return frpFinishRuntime(o,result);
 if(!o||!o.frp||!['running','unknown'].includes(o.status))return;
 clearTimeout(timers.get(o.id));timers.delete(o.id);
 const wasUnknown=o.status==='unknown',at=now(),items=o.input.items,op=o.input.operation;
 o.frpCompleted||=[];
 let failure=items.findIndex(x=>x.role==='visitor');if(failure<0)failure=items.length-1;
 const completedBefore=new Set(o.frpCompleted);
 // 核对失败不能抹掉同一次执行里已经确认完成的角色或步骤。
 const hasEvidence=completedBefore.size>0||o.steps.slice(1).some(s=>s.status==='success');
 const summary=result==='failed'&&hasEvidence?'partial':result;
 o.status=summary;o.ended=result==='unknown'?null:at;o.protectionReleased=false;
 if(!wasUnknown)o.steps[0].status=result==='failed'?'failed':'success';
 items.forEach((x,i)=>{
  const p=pr(x.project);if(!p)return;
  if(completedBefore.has(x.project))return;
  const state=result==='success'||(!wasUnknown&&result!=='failed'&&i<failure)?'success':result==='failed'?'failed':i>failure?'pending':result;
  const count=op==='deploy'?3:1,offset=1+i*count;
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
   if(op==='deploy'){p.life='installed';p.frpApplied=clone(x.snapshot);p.applied={...clone(x.cfg||{}),port:x.role==='server'?x.snapshot.node.bind_port:0,appConfig:x.files.toml,version:'模拟程序条件（非附件二进制）'};p.appliedRev=x.draftRev||x.snapshot.revision;p.runtime=o.input.goal==='running'?'running':'stopped';p.desired=o.input.goal;p.runtimeCheckStatus='verified';p.stopVerified=p.runtime==='stopped';p.components=[];const n=frpNode(x.node);if(n.authMigration)n.authMigration.roles=n.authMigration.roles.filter(r=>r!==x.role);}
   else if(op==='uninstall'){p.life='uninstalled';p.runtime='na';p.monitorPaused=true;p.dataStatus='retained';p.components=[];}
   p.health='unknown';p.observed=at;p.lastCheck=at;
  }else if((state==='partial'||state==='failed'&&anySuccess)&&op==='deploy'){
   p.life=x.before.life==='installed'?'installed':'incomplete';p.components=[{name:'分项结果',result:'程序/TOML 已交付，后续未完整完成；未假定已激活，未自动回退'}];
  }else if(state==='unknown'){p.components=[{name:'原操作待核对',result:'保留已知事实；本角色的后续远端效果未知'}];}
  else if(state==='failed'&&wasUnknown){p.components=[{name:'核对结论',result:'原执行已结束，本角色未完成；已完成角色与步骤保持，不重放'}];}
 });
 o.message=summary==='success'?'选定角色均完成模拟；未自动更改网络或初始化数据库。隧道端到端可用性仍未核对。':summary==='partial'?'部分完成：已完成角色与步骤保留；后续分项未完成。未重跑成功部分，未自动回退。':summary==='unknown'?'后续角色结果未知。保留前面已完成项与冲突保护；先核对原执行，不自动重放。':op==='deploy'&&!wasUnknown?'前置明确失败，未交付、未启动；受理目标与实际观测分别保存。':'所选操作明确失败；实际运行观测不因失败而改写，不自动重试。';
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
