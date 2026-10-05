'use strict';

// 增量字段，不改全局版本、不重新填示例；账号只白名单保存非敏感输入。
function interactionDraftKey(kind,id){return kind+'|'+(id||'new');}
function clearInteractionDraft(kind,id){if(S.interactionDrafts)delete S.interactionDrafts[interactionDraftKey(kind,id)];persist();}
function saveInteractionDraft(m=ui.modal){
 if(!m||m.saved)return;
 let kind=m.kind,id=m.id,data;
 const form=dialog.querySelector('form');
 const fd=form?new FormData(form):null,get=n=>String(fd?.get(n)||'').trim();
 if(kind==='cfconnect'){
  const nonSecret=form?.dataset.form==='cfcheck'?{name:get('cf-name'),accountId:get('cf-target'),profile:get('cf-profile')}:m.nonSecret;
  if(nonSecret)data={nonSecret:{name:nonSecret.name,accountId:nonSecret.accountId,profile:nonSecret.profile}};
 }else if(kind==='dnsconfirm'){kind='dnsedit';id=m.editorId;data={record:clone(m.record),expectedTarget:clone(m.target),baseRevision:m.baseRevision,outcome:m.outcome};}
 else if(kind==='dnsedit'&&fd&&form.dataset.form==='dnsedit'){
  const z=cfZone(get('dns-zone')||m.expectedTarget?.zoneId);
  if(z)data={record:{...(m.record||{}),zoneId:z.id,zone:z.name,accountId:z.accountId,type:get('dns-type'),name:get('dns-name'),content:get('dns-content'),ttl:get('dns-ttl'),proxy:fd.has('dns-proxy'),projects:fd.getAll('dns-project').map(String)},expectedTarget:clone(m.expectedTarget),baseRevision:m.baseRevision,outcome:get('outcome')};
 }else if(kind==='firewallconfirm'){kind='firewalledit';id=m.editor.id;data={...m.editor,record:clone(m.record),outcome:m.outcome};}
 else if(kind==='firewalledit'&&fd){data={copyId:m.copyId,server:m.server,record:{...(m.record||{}),server:get('fw-server')||m.before?.server||'',direction:get('fw-direction'),protocol:get('fw-protocol'),port:get('fw-port'),address:get('fw-address'),action:get('fw-action'),scope:get('fw-scope'),projects:fd.getAll('fw-project').map(String)},outcome:get('outcome')};}
 else if(kind==='newproject'&&fd){data={template:get('np-template'),server:get('np-server'),name:get('np-name'),projectConfig:m.projectConfig,frpValues:{bind:get('np-frp-bind'),port:get('np-frp-port'),serverService:get('np-frp-server-service'),connection:get('np-frp-connection')}};}
 else if(kind==='deploymentpreview'){kind='newproject';id=null;data={...m.origin,projectConfig:m.draft.cfg.projectLocal?clone(m.draft.cfg):undefined,frpValues:clone(m.draft.cfg.frpInputs||m.origin.frpValues||{})};}
 if(kind==='firewalledit'&&!id&&!data?.record?.port&&!data?.record?.address)return;
 if(kind==='newproject'&&!data?.name)return;
 if(kind==='dnsedit'&&!id&&!data?.record?.name&&!data?.record?.content)return;
 if(data){S.interactionDrafts||={};S.interactionDrafts[interactionDraftKey(kind,id)]=data;persist();}
}
const interactionOpen=openModal,interactionClose=closeModal;
openModal=function(kind,data={}){
 saveInteractionDraft();data=Object.fromEntries(Object.entries(data).filter(([,value])=>value!==undefined));let saved=S.interactionDrafts?.[interactionDraftKey(kind,data.id)];
 // 显式目标优先；其他字段从原编辑恢复。复制始终开启新操作。
 if(kind==='dnsedit'&&!data.id&&saved?.record&&((ui.cfAccount!=='all'&&saved.record.accountId!==ui.cfAccount)||(ui.zone!=='all'&&saved.record.zoneId!==ui.zone)))saved=null;
 if(saved&&!data.copyId)data={...clone(saved),...data};
 if(kind==='firewalledit'&&data.freshTarget&&data.record)data.record={...data.record,server:data.server};
 return interactionOpen(kind,data);
};
closeModal=function(){saveInteractionDraft();return interactionClose();};
document.addEventListener('input',()=>saveInteractionDraft());
document.addEventListener('change',()=>saveInteractionDraft());
registerPrototypeHandlers(prototypeActions,['interaction-discard','interaction-discard-confirm','interaction-discard-back'],(event,target,d,a)=>{
 const m=ui.modal;if(a==='interaction-discard'){saveInteractionDraft();openModal('interaction-discard',{previous:clone(m)});return;}
 if(a==='interaction-discard-back'){ui.modal=m.previous;renderModal();return;}
 const prev=m.previous,kind=prev.kind==='dnsconfirm'?'dnsedit':prev.kind==='firewallconfirm'?'firewalledit':prev.kind,id=prev.editorId||prev.editor?.id||prev.id;clearInteractionDraft(kind,id);m.saved=true;closeModal();
});
registerPrototypeHandlers(prototypeModals,['interaction-discard'],m=>layout('放弃本次编辑？','已保存的数据保持不变；删除这份未提交草稿。',notice('尚未提交操作','返回修改保留输入，明确放弃后清除本次草稿。','warning'),btn('返回修改','interaction-discard-back')+btn('确认放弃','interaction-discard-confirm',{},'danger')));
