'use strict';

function networkDelete(m,type){if(type==='dns')return dnsDeleteModal(m);const r=m.record||S.firewalls.find(r=>r.id===m.id);if(r&&!m.record)m.record=clone(r);if(!r){closeModal();return}const label=sname(r.server)+' / '+r.protocol+' '+r.port;layout('删除端口规则','固定当前服务器和选定的已有端口规则。',`<div class="stack">${notice(label,firewallProtected(r)?'此规则是受保护管理通路，本原型拒绝删除。':'只删除选定条目，不卸载项目、不改变项目配置。',firewallProtected(r)?'error':'warning')}${firewallSummary(r)}${r.projects.length>1?check('shared-ack','这是共享条目，已核对并接受其他项目也会受到影响',false):''}${check('delete-ack','确认删除此条目',false)}${outcomeField('success',[['success','删除结果已核对'],['failed','删除明确失败'],['unknown','响应丢失，删除结果未知']])}</div>`,btn('取消','closemodal')+(firewallProtected(r)?'':'<button class="btn danger" type="submit">确认删除（演示）</button>'),false,'networkdelete');}

function applyNetwork(input){if(input.netType==='dns')return applyCloudflareRecord(input);if(input.action==='port-batch'){const error=firewallBatchError(input);if(error)throw Error(error);if(input.mode==='delete')S.firewalls=S.firewalls.filter(r=>!input.records.some(old=>old.id===r.id));else S.firewalls.push(...clone(input.records));return;}if(input.record?.id!==input.targetId)throw Error('防火墙规则 ID 与固定目标不一致');const existing=S.firewalls.find(r=>r.id===input.targetId);if(existing&&existing.server!==input.record?.server)throw Error('拒绝隐式更换防火墙规则归属服务器');if(existing&&firewallProtected(existing))throw Error('受保护规则不可修改');const key='firewalls';if(input.action==='delete')S[key]=S[key].filter(r=>r.id!==input.targetId);else{const idx=S[key].findIndex(r=>r.id===input.record.id);if(idx>=0)S[key][idx]=clone(input.record);else S[key].push(clone(input.record));}}

function networkOperation(netType,action,r,outcome,target){if(netType==='dns')return cloudflareNetworkOperation(action,r,outcome,target);const error=serverOperationError(r.server),existing=S.firewalls.find(item=>item.id===r.id);if(error||existing&&existing.server!==r.server)return rejectOperation(null,'network',error||'编辑不能更换服务器',{input:{netType,action,record:clone(r),targetId:r.id}});const scope=[netType+':'+r.id],o=startOperation(null,'network',{label:(action==='delete'?'删除':'修改')+(netType==='dns'?' DNS ':'防火墙 ')+(netType==='dns'?r.name+'.'+r.zone:r.protocol+' '+r.port),netType,action,record:clone(r),before:clone(existing||null),serverTarget:serverOperationSnapshot(r.server),targetId:r.id,resources:scope},outcome);return o;}

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["networkdelete"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'networkdelete':{const type='firewall',r=m.record;if(!r)return modalError('删除目标已失效');const current=S.firewalls.find(item=>item.id===r.id);if(JSON.stringify(current)!==JSON.stringify(r))return modalError('原规则已变化，请重新核对删除目标');if(r.protected||!has('delete-ack')||(r.projects.length>1&&!has('shared-ack'))){modalError(firewallProtected(r)?'不能删除受保护管理通路。':'请明确确认删除；共享条目需额外确认影响。');break;}networkOperation(type,'delete',r,get('outcome'));break;}
  }
});

function firewallSummary(r,before){
 const props=x=>[['服务器',sname(x.server)],['方向',x.direction==='in'?'入站':'出站'],['协议',x.protocol],['端口 / 范围',x.port],['地址 / CIDR',x.address],['处理动作',x.action==='allow'?'允许':'拒绝'],['作用范围',x.scope==='container'?'容器发布端口':'主机服务'],['描述',x.description||'—']];
 return detail(props(r).map(([k,v],i)=>[k,before&&props(before)[i][1]!==v?`<del>${h(props(before)[i][1])}</del> → <strong>${h(v)}</strong>`:h(v)]));
}

function firewallBatchError(input){
 if(!input.serverTarget||JSON.stringify(serverOperationSnapshot(input.targetId))!==JSON.stringify(input.serverTarget)||!Array.isArray(input.records)||!input.records.length||input.records.length>50||input.records.some(r=>r.server!==input.targetId))return '批量服务器或固定目标已变化';
 if(!['add','delete'].includes(input.mode))return '未知批量操作';
 if(input.mode==='delete'&&(JSON.stringify(input.records)!==JSON.stringify(input.before)||input.before.some(r=>firewallProtected(r)||JSON.stringify(S.firewalls.find(old=>old.id===r.id))!==JSON.stringify(r))))return '批量规则已变化，不能执行旧意图';
 if(input.mode==='add'&&input.records.some(r=>S.firewalls.some(old=>old.id===r.id||old.server===r.server&&JSON.stringify(firewallTransferRule(old))===JSON.stringify(firewallTransferRule(r)))))return '导入规则已存在';
 return '';
}
function firewallBatchSummary(input){return detail([['固定服务器',h(input.serverTarget?.name||'待核对')],['端口规则数量',String(input.records.length)]])+`<div class="table-wrap"><table><thead><tr><th>协议</th><th>端口</th><th>来源</th><th>策略</th></tr></thead><tbody>${input.records.map(r=>`<tr><td>${h(r.protocol)}</td><td>${h(r.port)}</td><td>${h(r.address)}</td><td>${r.action==='allow'?'允许':'拒绝'}</td></tr>`).join('')}</tbody></table></div>`;}
