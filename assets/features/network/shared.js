'use strict';

function networkDelete(m,type){const r=(type==='dns'?S.dns:S.firewalls).find(r=>r.id===m.id);if(!r){closeModal();return}const label=type==='dns'?r.name+'.'+r.zone:sname(r.server)+' / '+r.protocol+' '+r.port;layout('删除'+(type==='dns'?' DNS 记录':'防火墙规则'),'用途关联不能代替独占归属证明。',`<div class="stack">${notice(label,r.protected?'此规则是受保护管理通路，本原型拒绝删除。':'只删除选定条目，不卸载项目、不改变项目配置。',r.protected?'error':'warning')}${detail([['登记用途',h(r.projects.map(pname).join('、')||'未关联')]])}${r.projects.length>1?check('shared-ack','这是共享条目，已核对并接受其他项目也会受到影响',false):''}${check('delete-ack','确认删除此条目',false)}${outcomeField('success',[['success','删除结果已核对'],['failed','删除明确失败'],['unknown','响应丢失，删除结果未知']])}</div>`,btn('取消','closemodal')+(r.protected?'':'<button class="btn danger" type="submit">确认删除（演示）</button>'),false,'networkdelete');}

function applyNetwork(input){const key=input.netType==='dns'?'dns':'firewalls';if(input.action==='delete')S[key]=S[key].filter(r=>r.id!==input.targetId);else{const idx=S[key].findIndex(r=>r.id===input.record.id);if(idx>=0)S[key][idx]=clone(input.record);else S[key].push(clone(input.record));}}

function networkOperation(netType,action,r,outcome){const scope=[netType+':'+r.id],o=startOperation(null,'network',{label:(action==='delete'?'删除':'修改')+(netType==='dns'?' DNS ':'防火墙 ')+(netType==='dns'?r.name+'.'+r.zone:r.protocol+' '+r.port),netType,action,record:clone(r),targetId:r.id,resources:scope},outcome);return o;}

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["networkdelete"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'networkdelete':{const type=m.kind==='dnsdelete'?'dns':'firewall',r=(type==='dns'?S.dns:S.firewalls).find(r=>r.id===m.id);if(r.protected||!has('delete-ack')||(r.projects.length>1&&!has('shared-ack'))){modalError(r.protected?'不能删除受保护管理通路。':'请明确确认删除；共享条目需额外确认影响。');break;}networkOperation(type,'delete',r,get('outcome'));break;}
  }
});
