'use strict';
// 模拟操作受理与分项结果核对；保留未知结果和迟到核对保护。
function frpCompileItems(items,op='deploy'){return items.map(x=>{const n=frpNode(x.node),p=pr(frpPid(n,x.role)),snapshot=op==='deploy'?frpSnapshot(n,x.role):clone(p.frpApplied);if(!snapshot)throw Error('没有已应用运行载体参照，不能猜测启停或卸载目标');return {node:n.id,role:x.role,project:p.id,snapshot,before:{life:p.life,runtime:p.runtime,desired:p.desired},files:clone(snapshot.files)};});}
function frpRun(items,op,conditions){
 frpEnsure();if(!items.length){modalError('没有选中的适用角色。');return;}
 const p=pr(frpPid(frpNode(items[0].node),items[0].role)),errors=frpValidate();
 if(op==='deploy'&&errors.length)return rejectOperation(p,'frp-deploy',errors.join('；'));
 if((op==='deploy'||op==='start')&&!conditions.binary)return rejectOperation(p,'frp-'+op,'附件中的 frpc / frps 均为零字节占位文件：无法执行、无法验证真实架构或 FRP 配置。不下发、不启动。');
 if(!conditions.identity||!conditions.impact)return rejectOperation(p,'frp-'+op,'主机身份、授权或影响范围未确认。不自动接受 host key，不自动提权。');
 if(op==='uninstall'&&!conditions.remove)return rejectOperation(p,'frp-'+op,'请确认仅卸载所选角色，保留其他角色、共享程序及网络资源。');
 for(const item of items){const n=frpNode(item.node),r=item.role,x=pr(frpPid(n,r));
  if(op!=='deploy'&&x.life!=='installed')return rejectOperation(x,'frp-'+op,'所选角色没有完整部署，不能将生成文件当作已安装服务。');
  if(op==='deploy'&&r==='visitor'&&!n.proxies.some(x=>x.type==='stcp'))return rejectOperation(x,'frp-deploy','已没有 STCP 映射，不再生成新 visitor；已有运行载体需单独确认卸载。');
  if(op==='deploy'&&!['x86_64','aarch64','arm64'].includes(sr(frpHost(n,r))?.arch))return rejectOperation(x,'frp-deploy','目标架构未确定 / 不支持，不能猜测二进制。');
  if(op==='deploy'&&x.frpApplied&&x.life!=='uninstalled'&&(x.frpApplied.files.unitPath!==frpFiles(n,r).unitPath||x.frpApplied.root!==S.frp.root||x.frpApplied.host!==frpHost(n,r)))return rejectOperation(x,'frp-deploy','当前修改涉及既有 unit 身份、运行目录或执行主机改变，不能把普通应用当成隐式迁移 / 清理旧服务；本原型保留原部署事实。');
 }
 const fixed=frpCompileItems(items,op),resources=[...new Set(fixed.flatMap(x=>['project:'+x.project,'frp-node:'+x.node,'frp-bin:'+x.snapshot.host+':'+(x.role==='server'?'frps':'frpc')]))];
 const conflict=conflictFor(resources);if(conflict)return rejectOperation(p,'frp-'+op,'与 '+conflict.label+' 冲突；拒绝此次请求，不排队，不取消原操作。');
 const steps=[{title:'固定输入与模拟前置核对',status:'success'}];for(const x of fixed)for(const title of op==='deploy'?['交付程序和 TOML','登记 systemd 运行定义','按目标启停（不等于隧道连通）']:[(opLabels[op]||op)+'所选运行载体'])steps.push({title:frpNode(x.node).ip+' · '+frpRoles[x.role]+' · '+title,status:'pending'});
 if(steps[1])steps[1].status='running';
 const o=record('FRP '+(op==='deploy'?'应用 / 部署':opLabels[op])+' · '+fixed.length+' 个角色','frp-'+op,p.id,'running','输入已固定；仅模拟执行，不连接服务器。',{frp:true,ended:null,input:{items:fixed,goal:conditions.goal,operation:op,binaryCondition:conditions.binary?'虚构可用条件；附件仍为 0 B':'不执行程序'},resources,steps,outcome:conditions.outcome,hold:conditions.hold});
 for(const x of fixed){const q=pr(x.project);q.frpLastOp=o.id;if(op==='deploy')q.desired=conditions.goal;else if(['start','stop'].includes(op)&&S.review.p1==='accepted')q.desired=op==='start'?'running':'stopped';}
 persist();render();closeModal();openModal('opdetail',{id:o.id});if(!conditions.hold)timers.set(o.id,setTimeout(()=>frpFinish(o,o.outcome),1600));return o;
}
function frpFinish(o,result){
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
   if(op==='deploy'){p.life='installed';p.frpApplied=clone(x.snapshot);p.applied={...clone(p.cfg),port:x.role==='server'?x.snapshot.node.bind_port:0,appConfig:x.files.toml,version:'模拟程序条件（非附件二进制）'};p.appliedRev=x.snapshot.revision;p.runtime=o.input.goal==='running'?'running':'stopped';p.components=[];}
   else if(op==='uninstall'){p.life='uninstalled';p.runtime='na';p.plansPaused=true;p.dataStatus='retained';p.components=[];}
   else {p.runtime=op==='stop'?'stopped':'running';p.components=[];if(S.review.p1!=='accepted')p.desired=op==='stop'?'stopped':'running';}
   p.health='unknown';p.observed=at;p.lastCheck=at;
  }else if((state==='partial'||state==='failed'&&anySuccess)&&op==='deploy'){
   p.life=x.before.life==='installed'?'installed':'incomplete';p.components=[{name:'分项结果',result:'程序/TOML 已交付，后续未完整完成；未假定已激活，未自动回退'}];
  }else if(state==='unknown'){p.components=[{name:'原操作待核对',result:'保留已知事实；本角色的后续远端效果未知'}];}
  else if(state==='failed'&&wasUnknown){p.components=[{name:'核对结论',result:'原执行已结束，本角色未完成；已完成角色与步骤保持，不重放'}];}
 });
 o.message=summary==='success'?'选定角色均完成模拟；未自动更改网络或初始化数据库。隧道端到端可用性仍未核对。':summary==='partial'?'部分完成：已完成角色与步骤保留；后续分项未完成。未重跑成功部分，未自动回退。':summary==='unknown'?'后续角色结果未知。保留前面已完成项与冲突保护；先核对原执行，不自动重放。':op==='deploy'&&!wasUnknown?'前置明确失败，未交付、未启动；受理目标与实际观测分别保存。':'所选操作明确失败；实际运行观测不因失败而改写，不自动重试。';
 frpSyncConfigs();persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();
}
