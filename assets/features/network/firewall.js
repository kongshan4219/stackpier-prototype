'use strict';

function firewallPage(){let rules=S.firewalls.filter(r=>(ui.server==='all'||r.server===ui.server)&&(r.port+' '+r.address+' '+sname(r.server)).toLowerCase().includes(ui.q.toLowerCase()));return heading('主机防火墙','保留既有规则；明确确认后才提交单次修改，不随项目部署自动变更。',btn('新增规则','firewalledit',{},'primary','plus'),'NETWORK / FIREWALL')+searchFilter('搜索地址、端口或服务器…',`<select class="filter" data-filter="server" aria-label="防火墙服务器"><option value="all">全部服务器</option>${S.servers.map(s=>`<option value="${s.id}" ${ui.server===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select>`)+`<section class="card"><div class="table-wrap"><table><thead><tr><th>服务器 / 来源</th><th>方向 / 作用对象</th><th>协议与端口</th><th>来源或目标地址</th><th>动作 / 用途</th><th class="right">操作</th></tr></thead><tbody>${rules.map(r=>`<tr><td>${h(sname(r.server))}<p class="cell-sub">${h(r.origin)}</p></td><td>${r.direction==='in'?'入站访问':'出站访问'}<p class="cell-sub">${r.scope==='container'?'容器发布端口':'主机服务'}</p></td><td><span class="mono">${h(r.protocol)} / ${h(r.port)}</span></td><td><code>${h(r.address)}</code><p class="cell-sub">${r.direction==='in'?'访问来源':'连接目标'}</p></td><td>${badge(r.action==='allow'?'允许':'拒绝',r.action==='allow'?'success':'warning')}<p class="cell-sub">${r.protected?'管理通路保护':r.projects.length?r.projects.map(pname).map(h).join('、'):'未登记项目用途'}</p></td><td class="right">${btn('编辑','firewalledit',{id:r.id},'small ghost')}${btn('复制','firewallcopy',{id:r.id},'small ghost')}${btn('删除','firewalldelete',{id:r.id},'small ghost','trash')}</td></tr>`).join('')}</tbody></table></div>${!rules.length?empty('暂无匹配规则','本原型不会清空或重置现有规则。'):''}</section><div class="mt">${notice('主机防火墙，不是云安全组','只演示入站 / 出站和容器发布端口访问控制。不提供整体清空、替换防火墙工具或通用默认策略编辑。')}</div>`}

function firewallEditor(m){
 const old=S.firewalls.find(r=>r.id===m.id),source=m.copyId&&S.firewalls.find(r=>r.id===m.copyId);
 const r=m.record||old||(source?{...clone(source),id:undefined,server:'',protected:false}:{server:selectedServer(m.server),direction:'in',protocol:'TCP',port:'',address:'',action:'allow',scope:'host',projects:[],origin:'栈桥登记'});
 if(m.id&&!old){layout('规则关联失效','原规则已不存在。',notice('无法编辑','请关闭后返回列表核对。','error'));return;}
 m.before=m.before||clone(old||null);
 if(!old)m.server=r.server;
 layout(old?'修改防火墙规则':source?'复制到其他服务器':'新增防火墙规则','单条规则；编辑不能换机器，复制使用新 ID，原规则保持。',`<div class="stack">${r.protected?notice('这条规则保护当前管理通路','原型不允许破坏性修改。','warning'):''}<div class="field-row">${select('fw-server','服务器',[['','请选择目标服务器'],...S.servers.map(s=>[s.id,s.name])],r.server,'',old?'disabled':'required')}${select('fw-direction','访问方向',[['in','入站访问'],['out','出站访问']],r.direction)}</div>${r.server&&serverOperationError(r.server)?notice('阻止执行',serverOperationError(r.server),'error'):''}<div class="field-row">${select('fw-protocol','协议',['TCP','UDP'],r.protocol)}${field('fw-port','目标端口或端口范围',r.port,'例如 8080 或 8000-8010。','text','required')}</div>${field('fw-address','入站来源 / 出站目标地址',r.address,'IP 或 CIDR，例 192.0.2.0/24。','text','required')}<div class="field-row">${select('fw-action','处理动作',[['allow','允许'],['deny','拒绝']],r.action)}${select('fw-scope','作用对象',[['host','主机服务'],['container','容器发布端口']],r.scope)}</div><h3>关联项目用途</h3>${projectChecks('fw-project',r.projects)}${check('network-ack','已核对影响范围，确认不破坏当前 SSH 管理通路',false)}${outcomeField(m.outcome||'success',[['success','规则写入并核对成功'],['failed','权限不足，明确失败'],['unknown','响应丢失，结果待核对']])}</div>`,btn('放弃编辑','interaction-discard')+'<button class="btn primary" type="submit">查看提交确认</button>',false,'firewalledit');
}
registerPrototypeHandlers(prototypeModals,['firewalledit','firewalldelete','firewallconfirm'],m=>{
 if(m.kind==='firewalledit')return firewallEditor(m);
 if(m.kind==='firewalldelete')return networkDelete(m,'firewall');
 layout('确认防火墙变更','操作目标和内容已固定；切换筛选不会改变本次提交。',firewallSummary(m.record,m.before)+check('fw-confirm','确认上述服务器、规则和关联项目影响',false),btn('返回修改','firewall-back-edit')+btn('放弃编辑','interaction-discard')+'<button class="btn primary" type="submit">确认并提交（演示）</button>',false,'firewallcommit');
});
registerPrototypeHandlers(prototypeActions,['firewallcopy','firewall-back-edit'],(event,target,d,a)=>{
 if(a==='firewallcopy')return openModal('firewalledit',{copyId:d.id,server:''});
 const m=ui.modal;if(m?.kind==='firewallconfirm')openModal('firewalledit',{...m.editor,record:clone(m.record),before:m.before,outcome:m.outcome});
});
registerPrototypeHandlers(prototypeForms,['firewalledit','firewallcommit'],(event,form,fd,get,has,all,m,p,kind)=>{
 if(kind==='firewallcommit'){if(m.kind!=='firewallconfirm'||!has('fw-confirm'))return modalError('请确认固定目标及变更内容。');const old=S.firewalls.find(r=>r.id===m.record.id);if(JSON.stringify(old||null)!==JSON.stringify(m.before))return modalError('原规则在预览后变化，请返回重新核对。');const err=serverOperationError(m.record.server);if(err)return modalError(err);m.saved=true;clearInteractionDraft('firewalledit',m.editor.id);return networkOperation('firewall','upsert',m.record,m.outcome);}
 if(m.kind!=='firewalledit')return;
 const old=S.firewalls.find(r=>r.id===m.id);if(old?.protected)return modalError('受保护的 SSH 管理通路不允许在此原型直接修改。');
 if(old&&fd.has('fw-server')&&get('fw-server')!==old.server)return modalError('编辑规则不能更换服务器；请使用复制，再独立确认删除原规则。');
 const server=old?.server||get('fw-server'),targetError=serverOperationError(server);if(targetError)return modalError(targetError);
 if(!has('network-ack'))return modalError('请核对影响范围及 SSH 管理通路。');
 const ports=get('fw-port').split('-').map(Number);if(ports.length>2||ports.some(n=>!Number.isInteger(n)||n<1||n>65535)||(ports.length===2&&ports[0]>ports[1]))return modalError('端口应在 1–65535，或使用有序端口范围。');
 if(!validAddress(get('fw-address')))return modalError('请输入有效的 IP 或 CIDR 地址范围。');
 if(!['in','out'].includes(get('fw-direction'))||!['TCP','UDP'].includes(get('fw-protocol'))||!['allow','deny'].includes(get('fw-action'))||!['host','container'].includes(get('fw-scope')))return modalError('规则属性无效。');
 const r={id:old?.id||m.record?.id||uid('fw'),server,direction:get('fw-direction'),protocol:get('fw-protocol'),port:get('fw-port'),address:get('fw-address'),action:get('fw-action'),scope:get('fw-scope'),projects:all('fw-project').filter(id=>pr(id)),origin:old?.origin||'栈桥登记',protected:false};
 if(r.action==='deny'&&ports[0]<=sr(server).port&&(ports[1]||ports[0])>=sr(server).port&&r.direction==='in')return modalError('该拒绝规则可能破坏 SSH 管理通路，原型暂不放行。');
 openModal('firewallconfirm',{record:r,before:clone(old||null),editor:{id:m.id,copyId:m.copyId,server},outcome:get('outcome')});
});
