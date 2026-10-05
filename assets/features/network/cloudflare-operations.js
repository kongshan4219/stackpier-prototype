'use strict';

function cloudflareNetworkOperation(action,r,outcome,target){
 const error=cfTargetError(target)||(!r||r.accountId!==target.accountId||r.zoneId!==target.zoneId?'记录与确认目标不一致':'');
 if(error){modalError(error);return null;}
 const current=S.dns.find(x=>x.id===r.id);if(current&&(current.accountId!==target.accountId||current.zoneId!==target.zoneId)){modalError('不能跨账号 / Zone 修改已有记录');return null;}
 const input={label:(action==='delete'?'删除':'修改')+' DNS '+dnsRecordLabel(r),netType:'dns',action,record:clone(r),before:clone(current||null),targetId:r.id,baseRevision:S.cloudflare.recordVersions[r.id]||0,cfTarget:clone(target),resources:['dns:'+r.id,'cf-connection:'+target.connectionId]};
 return startOperation(null,'network',input,['success','failed','unknown'].includes(outcome)?outcome:'unknown');
}
function applyCloudflareRecord(input){
 const t=input.cfTarget,r=input.record;if((S.cloudflare.recordVersions[input.targetId]||0)!==input.baseRevision)return false;if(!t||r.accountId!==t.accountId||r.zoneId!==t.zoneId)return false;
 const idx=S.dns.findIndex(x=>x.id===input.targetId);if(idx>=0&&(S.dns[idx].accountId!==t.accountId||S.dns[idx].zoneId!==t.zoneId))return false;
 S.cloudflare.recordVersions[input.targetId]=(input.baseRevision||0)+1;
 if(input.action==='delete'){if(idx>=0)S.dns.splice(idx,1);return true;}
 const updated={...clone(r),providerConfirmedAt:now(),propagation:'unverified'};if(idx>=0)S.dns[idx]=updated;else S.dns.push(updated);return true;
}
function finishCloudflareOperation(o,result,{reconcile=false}={}){
 if(!o||!['running','unknown'].includes(o.status))return;
 clearInterval(timers.get(o.id));timers.delete(o.id);
 if(o.input.cfNeedsReview){o.status='unknown';o.message='历史账号归属待核对，不据名称猜测目标或重放修改。';persist();render();return;}
 const err=result==='success'?cfTargetError(o.input.cfTarget,{write:!reconcile,fixedRevision:!reconcile}):'';
 if(err){result='unknown';o.message='无法核对固定目标：'+err+'；保留原记录和冲突保护。';}
 else o.message=result==='success'?'Cloudflare 已确认选定记录（模拟）；公网传播未验证。':result==='failed'?'Cloudflare 明确拒绝（模拟），原记录保持不变，不自动重试。':'响应丢失，结果未知；只读核对原账号及 Zone，不重新发送修改。';
 if(result==='success'&&!applyCloudflareRecord(o.input)){result='unknown';o.message='目标记录身份已改变，保留未知，不能写到另一账号。';}
 o.status=result;o.outcome=result;o.ended=result==='unknown'?null:now();o.protectionReleased=o.protectionReleased||result!=='unknown';
 o.steps.forEach((s,i)=>{s.status=result==='success'?'success':result==='failed'?(i===1?'failed':i<1?'success':'pending'):(i===1?'unknown':i<1?'success':'pending');s.note='仅浏览器模拟 · '+o.message;});
 if(reconcile){o.cfChecks||=[];o.cfChecks.push({at:now(),accountId:o.input.cfTarget.accountId,zoneId:o.input.cfTarget.zoneId,result});}
 persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();toast(o.message,result==='failed'?'error':'');
}
function cfOperationSummary(o){if(o.input?.netType!=='dns')return '';return `<div class="stack">${dnsTargetSummary(o.input.cfTarget)}${o.input.record?dnsRecordSummary(o.input.record,o.input.before):''}${detail([['公网传播','未验证，模拟成功不代表全球生效']])}${o.input.cfNeedsReview?notice('历史归属待核对','保留原历史，不按名称分配账号。','warning'):''}</div>`;}
function cfVerifyModal(m,o){layout('读取核对原 DNS 操作','只核对固定账号、Zone 与记录，不重新提交修改。',`<div class="stack">${cfOperationSummary(o)}${notice('核对证据（模拟）','未读取到结果时保留未知；确定不会继续写入但无法证明历史结果时，仅释放保护。','warning')}${select('verify-result','模拟读取证据',[['working','仍未知 / 仍可能写入'],['success','读取确认本次目标结果'],['failed','确认原操作明确拒绝，未修改'],['ended-unknown','执行已结束，历史结果仍无法证明']])}${check('verify-evidence','已核对原账号、Zone、记录及原执行结束证据',false)}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">记录模拟核对</button>',false,'verifyop');}
function cfVerifySubmit(o,get,has){const v=get('verify-result');if(v==='working'){o.message='仍未取得充分证据，保留未知和保护。';persist();openModal('opdetail',{id:o.id});return;}
 if(!has('verify-evidence')){modalError('请确认原目标身份与执行结束证据');return;}
 if(v==='ended-unknown'){o.protectionReleased=true;o.ended=now();o.message='模拟核对确认不会继续写入；历史结果仍未知，未改写缓存为成功。';persist();render();openModal('opdetail',{id:o.id});return;}
 if(o.input.cfNeedsReview){modalError('旧操作归属无法确定，仅能核对结束并保留历史未知，不能猜测账号');return;}
 if(!['success','failed'].includes(v)){modalError('无效核对结果');return;}
 if(v==='success'){const err=cfTargetError(o.input.cfTarget,{write:false,fixedRevision:false});if(err){modalError('读取核对失败：'+err);return;}}
 openModal('opdetail',{id:o.id});finishCloudflareOperation(o,v,{reconcile:true});
}
function prepareDnsCleanup(input){
 input.dnsTargets=[];for(const id of input.dnsIds||[]){const r=S.dns.find(r=>r.id===id),target=r&&cfTarget(r);if(!target)return '选定 DNS 没有写权限或连接失效，请保留该条目';input.dnsTargets.push({...target,recordId:id});}
 input.extraResources=[...(input.extraResources||[]),...input.dnsTargets.map(t=>'cf-connection:'+t.connectionId),...(input.dnsIds||[]).map(id=>'dns:'+id)];return '';
}
function dnsCleanupError(input){
 if((input.dnsIds||[]).length!==(input.dnsTargets||[]).length||input.cfNeedsReview)return '历史 DNS 清理归属待核对';
 return (input.dnsTargets||[]).map(t=>{const r=S.dns.find(r=>r.id===t.recordId);return cfTargetError(t)||(r&&(r.accountId!==t.accountId||r.zoneId!==t.zoneId)?'记录归属已改变':'');}).find(Boolean)||'';
}

function dnsCleanupChoice(r){const access=cfAccess(r.zoneId,true),hint=cfAccountName(r.accountId)+' / '+r.zone+'；'+(access.ok?(r.projects.length>1?'共享用途：'+r.projects.map(pname).join('、'):'须核对归属'):access.reason);const html=check('dns-'+r.id,dnsRecordLabel(r),false,hint);return access.ok?html:html.replace('<input ','<input disabled ');}
