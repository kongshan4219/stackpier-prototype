'use strict';

function firewallProtected(r){const ports=String(r.port).split('-').map(Number);return r.protected||r.action==='allow'&&r.protocol!=='UDP'&&ports[0]<=sr(r.server)?.port&&(ports[1]||ports[0])>=sr(r.server)?.port;}
function firewallPortRules(){if(ui.server==='all')return [];return S.firewalls.filter(r=>(!r.direction||r.direction==='in')&&(!r.scope||r.scope==='host')&&(ui.server==='all'||r.server===ui.server)&&(ui.fwPolicy==='all'||!ui.fwPolicy||r.action===ui.fwPolicy)&&(r.protocol+' '+r.port+' '+r.address+' '+(r.description||'')+' '+sname(r.server)).toLowerCase().includes(ui.q.toLowerCase()));}
function firewallPage(){
 const all=firewallPortRules(),page=Math.max(1,Math.min(Number(ui.fwPage)||1,Math.ceil(all.length/10)||1)),rules=all.slice((page-1)*10,page*10),selected=ui.fwSelected||[],server=ui.server!=='all'&&sr(ui.server);
 return heading('主机防火墙','管理已有防火墙的主机入站端口规则。','','NETWORK / FIREWALL')+
 `<div class="toolbar"><select class="filter" data-filter="server" aria-label="防火墙服务器"><option value="all">请选择服务器</option>${S.servers.map(s=>`<option value="${s.id}" ${ui.server===s.id?'selected':''}>${h(s.name)}</option>`).join('')}</select><span class="grow"></span>${btn('刷新','fw-refresh',{},'','refresh')}</div>`+
 `<section class="card firewall-port-card"><div class="card-head"><h2>端口规则</h2><div class="row">${badge(server?'iptables':'等待选择',server?'success':'unknown')}${server?badge('已启用','success'):''}${server?'<span class="tag">版本 1.8.10 · 原型模拟</span>':''}</div></div><div class="card-body"><div class="toolbar"><div class="row">${btn('创建','firewalledit',{},'primary','plus')}${btn('删除'+(selected.length?'（'+selected.length+'）':''),'fw-batch-delete',{},'danger')}${btn('导入','fw-import')}${btn('导出','fw-export')}</div><span class="grow"></span><select class="filter" data-filter="fwPolicy" aria-label="策略筛选"><option value="all">全部策略</option><option value="allow" ${ui.fwPolicy==='allow'?'selected':''}>允许</option><option value="deny" ${ui.fwPolicy==='deny'?'selected':''}>拒绝</option></select><div class="searchbox">${I('search')}<input id="global-search" data-filter="q" value="${h(ui.q)}" placeholder="搜索端口、IP 或描述…" aria-label="搜索端口、IP 或描述"></div></div><p class="muted">使用状态来自监听观测，与允许 / 拒绝策略分别显示。容器发布端口、云安全组和上游 ACL 不在本页控制范围。</p></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="选择本页端口规则" data-action="fw-select-page" ${rules.some(r=>!firewallProtected(r))&&rules.filter(r=>!firewallProtected(r)).every(r=>selected.includes(r.id))?'checked':''} ${rules.some(r=>!firewallProtected(r))?'':'disabled'}></th><th>协议</th><th>端口</th><th>使用状态</th><th>策略</th><th>来源 IP</th><th>描述</th><th class="right">操作</th></tr></thead><tbody>${rules.map(r=>`<tr><td><input type="checkbox" aria-label="选择端口 ${h(r.port)}" data-action="fw-select" data-id="${r.id}" ${selected.includes(r.id)?'checked':''} ${firewallProtected(r)?'disabled':''}></td><td class="mono">${h(r.protocol.toLowerCase())}</td><td class="mono">${h(r.port)}</td><td>${r.listening===true?badge('已使用'+(r.process?'（'+r.process+'）':''),'success'):r.listening===false?badge('未使用','unknown'):badge('未观测','unknown')}</td><td>${badge(r.action==='allow'?'允许':'拒绝',r.action==='allow'?'success':'error')}</td><td><code>${h(r.address==='0.0.0.0/0'||r.address==='::/0'?'所有 IP':r.address)}</code></td><td>${h(r.description||'—')}</td><td class="right">${firewallProtected(r)?'<span class="muted">SSH 管理通路</span>':btn('编辑','firewalledit',{id:r.id},'small ghost')+btn('删除','firewalldelete',{id:r.id},'small ghost')}</td></tr>`).join('')}</tbody></table></div>${!rules.length?empty(server?'暂无匹配端口规则':'选择服务器后查看端口规则','原型只演示交互，不会连接或修改真实机器。'):''}<div class="card-foot"><span>共 ${all.length} 条</span><span class="grow"></span>${btn('上一页','fw-page',{page:page-1},'small')}<span>${page} / ${Math.ceil(all.length/10)||1}</span>${btn('下一页','fw-page',{page:page+1},'small')}</div></section><details class="mt"><summary>检查详情</summary><p>此处收纳后端原始结果、解析限制、规则顺序和读取错误；版本不作为只读采集或端口规则适配的白名单。</p></details>`;
}

function firewallEditor(m){
 const old=S.firewalls.find(r=>r.id===m.id),source=m.copyId&&S.firewalls.find(r=>r.id===m.copyId);
 const r=m.record||old||(source?{...clone(source),id:undefined,server:'',protected:false}:{server:selectedServer(m.server),direction:'in',protocol:'TCP',port:'',address:'',action:'allow',scope:'host',projects:[],origin:'栈桥登记'});
 if(m.id&&!old){layout('规则关联失效','原规则已不存在。',notice('无法编辑','请关闭后返回列表核对。','error'));return;}
 m.before=m.before||clone(old||null);
 if(!old)m.server=r.server;
 layout(old?'编辑端口规则':source?'复制到其他服务器':'创建端口规则','仅管理主机入站端口规则；编辑固定原服务器。',`<div class="stack">${firewallProtected(r)?notice('这条规则保护当前管理通路','原型不允许破坏性修改。','warning'):''}<div class="field-row">${select('fw-server','服务器',[['','请选择目标服务器'],...S.servers.map(s=>[s.id,s.name])],r.server,'',old?'disabled':'required')}${select('fw-family','地址族',[['ipv4','IPv4'],['ipv6','IPv6']],r.address?.includes(':')?'ipv6':'ipv4')}</div>${r.server&&serverOperationError(r.server)?notice('阻止执行',serverOperationError(r.server),'error'):''}<div class="field-row">${select('fw-protocol','协议',['TCP','UDP','TCP/UDP'],r.protocol)}${field('fw-port','目标端口或端口范围',r.port,'例如 8080 或 8000-8010。','text','required')}</div>${select('fw-source','来源',[['all','所有 IP'],['custom','指定 IP']],!r.address||['0.0.0.0/0','::/0'].includes(r.address)?'all':'custom')}${field('fw-address','来源 IP / CIDR',r.address||'0.0.0.0/0','所有 IP 或指定 IP / CIDR。','text','required'+(!r.address||['0.0.0.0/0','::/0'].includes(r.address)?' readonly':''))}<div class="field-row">${select('fw-action','处理动作',[['allow','允许'],['deny','拒绝']],r.action)}${field('fw-description','描述',r.description||'','最多 256 个字符。')}</div>${check('network-ack','已核对影响范围，确认不破坏当前 SSH 管理通路',false)}${outcomeField(m.outcome||'success',[['success','规则写入并核对成功'],['failed','权限不足，明确失败'],['unknown','响应丢失，结果待核对']])}</div>`,btn('放弃编辑','interaction-discard')+'<button class="btn primary" type="submit">查看提交确认</button>',false,'firewalledit');
}
registerPrototypeHandlers(prototypeModals,['firewalledit','firewalldelete','firewallconfirm'],m=>{
 if(m.kind==='firewalledit')return firewallEditor(m);
 if(m.kind==='firewalldelete')return networkDelete(m,'firewall');
 layout('确认防火墙变更','操作目标和内容已固定；切换筛选不会改变本次提交。',firewallSummary(m.record,m.before)+check('fw-confirm','确认上述固定服务器和端口规则变更',false)+check('fw-runtime','确认仅修改当前运行态，重启或外部重载可能恢复原配置',false),btn('返回修改','firewall-back-edit')+btn('放弃编辑','interaction-discard')+'<button class="btn primary" type="submit">确认并提交（演示）</button>',false,'firewallcommit');
});
registerPrototypeHandlers(prototypeActions,['firewallcopy','firewall-back-edit'],(event,target,d,a)=>{
 if(a==='firewallcopy')return openModal('firewalledit',{copyId:d.id,server:''});
 const m=ui.modal;if(m?.kind==='firewallconfirm')openModal('firewalledit',{...m.editor,record:clone(m.record),before:m.before,outcome:m.outcome});
});
registerPrototypeHandlers(prototypeForms,['firewalledit','firewallcommit'],(event,form,fd,get,has,all,m,p,kind)=>{
 if(kind==='firewallcommit'){if(m.kind!=='firewallconfirm'||(!has('fw-confirm')||!has('fw-runtime')))return modalError('请确认固定目标及变更内容。');const old=S.firewalls.find(r=>r.id===m.record.id);if(JSON.stringify(old||null)!==JSON.stringify(m.before))return modalError('原规则在预览后变化，请返回重新核对。');const err=serverOperationError(m.record.server);if(err)return modalError(err);m.saved=true;clearInteractionDraft('firewalledit',m.editor.id);return networkOperation('firewall','upsert',m.record,m.outcome);}
 if(m.kind!=='firewalledit')return;
 const old=S.firewalls.find(r=>r.id===m.id);if(old&&firewallProtected(old))return modalError('受保护的 SSH 管理通路不允许在此原型直接修改。');
 if(old&&fd.has('fw-server')&&get('fw-server')!==old.server)return modalError('编辑规则不能更换服务器；请使用复制，再独立确认删除原规则。');
 const server=old?.server||get('fw-server'),targetError=serverOperationError(server);if(targetError)return modalError(targetError);
 if(!has('network-ack'))return modalError('请核对影响范围及 SSH 管理通路。');
 const ports=get('fw-port').split('-').map(Number);if(ports.length>2||ports.some(n=>!Number.isInteger(n)||n<1||n>65535)||(ports.length===2&&ports[0]>ports[1]))return modalError('端口应在 1–65535，或使用有序端口范围。');
 if(get('fw-family')!==(get('fw-address').includes(':')?'ipv6':'ipv4')||!validAddress(get('fw-address')))return modalError('请输入有效的 IP 或 CIDR 地址范围。');
 if(!['TCP','UDP','TCP/UDP'].includes(get('fw-protocol'))||!['allow','deny'].includes(get('fw-action')))return modalError('规则属性无效。');
 const r={id:old?.id||m.record?.id||uid('fw'),server,direction:'in',protocol:get('fw-protocol'),port:get('fw-port'),address:get('fw-address'),action:get('fw-action'),scope:'host',description:get('fw-description'),projects:clone(old?.projects||[]),origin:old?.origin||'栈桥登记',protected:false};
 if(r.action==='deny'&&r.protocol!=='UDP'&&ports[0]<=sr(server).port&&(ports[1]||ports[0])>=sr(server).port&&r.direction==='in')return modalError('该拒绝规则可能破坏 SSH 管理通路，原型暂不放行。');
 openModal('firewallconfirm',{record:r,before:clone(old||null),editor:{id:m.id,copyId:m.copyId,server},outcome:get('outcome')});
});

registerPrototypeHandlers(prototypeActions,['fw-select','fw-select-page','fw-page','fw-refresh'],(event,target,d,a)=>{
 if(a==='fw-refresh'){ui.fwSelected=[];toast('已刷新端口规则（原型模拟）');render();return;}
 if(a==='fw-page'){ui.fwPage=Math.max(1,Number(d.page)||1);render();return;}
 const selected=new Set(ui.fwSelected||[]),ids=a==='fw-select'?[d.id]:firewallPortRules().slice(((Number(ui.fwPage)||1)-1)*10,(Number(ui.fwPage)||1)*10).filter(r=>!firewallProtected(r)).map(r=>r.id),remove=ids.every(id=>selected.has(id));
 ids.forEach(id=>remove?selected.delete(id):selected.add(id));ui.fwSelected=[...selected];render();
});

document.addEventListener('change',event=>{if(!['fw-source','fw-family'].includes(event.target.id))return;const input=document.getElementById('fw-address'),kind=document.getElementById('fw-source'),family=document.getElementById('fw-family');if(!input||!kind||!family)return;input.readOnly=kind.value==='all';input.value=kind.value==='all'?(family.value==='ipv6'?'::/0':'0.0.0.0/0'):'';});
