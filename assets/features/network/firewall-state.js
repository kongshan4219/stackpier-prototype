'use strict';

// 仅保存浏览器模拟观测，不从工具名称推断真实机器已完成统一接入。
function initializeUnifiedFirewall(){
 const sample=S.firewallSeed===true;delete S.firewallSeed;S.firewallHosts||={};
 for(const server of S.servers){
  if(S.firewallHosts[server.id])continue;
  const ready=sample&&['s1','s4'].includes(server.id),migration=sample&&server.id==='s2';
  S.firewallHosts[server.id]={state:ready?'ready':migration?'needs-setup':'unknown',manager:ready?'firewalld':migration?'UFW':'未知',backend:ready?'nftables':'待统一',os:server.os,arch:server.arch,serviceManager:ready||migration?'systemd':'待探测',captured:sample?now():'',revision:1,configuration:ready?'consistent':'unknown',defaultPolicy:ready||migration?'DROP':'unknown',reason:ready?'运行与永久配置已核对（模拟）':migration?'UFW 服务冲突，请单独处理；不自动迁移。':'尚未完成系统与防火墙盘点。',zones:sample?[{name:'public',interfaces:['eth0'],sources:[],target:ready||migration?'DROP':'unknown'}]:[],preserved:['Docker 容器链与 NAT','VPN 专属规则'],blockers:[]};
 }
}
function firewallHost(id){return S.firewallHosts?.[id];}
function firewallHostRules(id){return S.firewalls.filter(r=>r.server===id&&(!r.direction||r.direction==='in')&&(!r.scope||r.scope==='host'));}
function firewallRuleZone(rule){const zones=firewallHost(rule.server)?.zones||[];return rule.zone||(zones.length===1?zones[0].name:'');}
function firewallZoneOptions(id){return [['','请选择作用范围'],...(firewallHost(id)?.zones||[]).filter(zone=>zone.name!=='docker').map(zone=>[zone.name,zone.name+' · '+(zone.interfaces.join('、')||zone.sources.join('、')||'无绑定')])];}
function firewallChosenZone(id,value=''){const zones=firewallHost(id)?.zones||[],name=value||(zones.length===1?zones[0].name:'');return name!=='docker'&&zones.some(zone=>zone.name===name)?name:'';}
function firewallRuleZoneError(rule){return firewallChosenZone(rule.server,firewallRuleZone(rule))?'':'此规则的 Zone 尚未明确或已不在当前观测中，仅可查看；请先核对作用范围。';}
function firewallActiveOperation(id){return S.operations.find(o=>o.input?.netType==='firewall'&&['running','unknown'].includes(o.status)&&!o.protectionReleased&&(o.input.serverTarget?.id===id||o.input.record?.server===id));}
function firewallWriteError(id){
 const error=serverOperationError(id);if(error)return error;
 const host=firewallHost(id),operation=firewallActiveOperation(id);
 if(operation)return '存在未完成的防火墙操作，请先核对原操作。';
 if(host?.state!=='ready'||host.manager!=='firewalld'||host.backend!=='nftables'||host.configuration!=='consistent')return host?.reason||'请先检查并启动 firewalld。';
 return '';
}
function firewallInventoryIssues(host){
 const stages={startup:'启动入口',cron:'定时任务',services:'系统服务',general:'系统盘点'},reasons={'read-failed':'未能完整读取','access-denied':'系统拒绝访问','unsafe-path':'链接或路径未通过安全校验','unsafe-permissions':'权限未通过安全校验','invalid-owner':'属主未通过安全校验','invalid-type':'文件类型未通过安全校验',changed:'读取期间发生变化','limit-exceeded':'超过读取预算',timeout:'检查已取消或超时','invalid-format':'返回信息格式不完整'};
 const issues=[...new Map((host?.inventoryIssues||[]).map(issue=>[JSON.stringify(issue),issue])).values()],messages=[...new Set([...(host?.blockers||[]),...(host?.readErrors||[])])];
 return (issues.length?'<section aria-label="盘点问题"><h3>盘点问题</h3>'+issues.map(issue=>`<div><strong>${h(reasons[issue.code]||'盘点未完成，请核对检查说明')}</strong>${detail([['检查阶段',h(stages[issue.stage]||'系统盘点')],...(issue.object?[['检查对象','<code>'+h(issue.object)+'</code>']]:[]),...(issue.actual!==undefined?[['实际数量',h(issue.actual)]]:[]),...(issue.limit!==undefined?[['限制',h(issue.limit)]]:[]),['后续处理',issue.retryable?'可重新检查':'处理原因后重新检查']])}</div>`).join('')+'</section>':'')+(messages.length?(issues.length?'<h3>其他检查说明</h3>':'')+messages.map(reason=>notice('检查说明',reason,'warning')).join(''):'');
}
function firewallStateCard(id){
 if(!id||id==='all')return '';
 const host=firewallHost(id),operation=firewallActiveOperation(id),unknown=!host||host.state==='unknown',installed=host?.manager==='firewalld',running=installed&&host.state==='ready',conflict=host&&!['firewalld','未安装','未知'].includes(host.manager);
 return `<section class="card firewall-state-card" aria-label="防火墙管理状态"><div class="card-head"><h2>防火墙管理</h2>${badge(operation?'结果待核对':unknown?'检查未完成':running?'运行中':installed?'已停止':conflict?'服务冲突':'未安装',running?'success':'unknown')}</div><div class="card-body stack">${detail([['管理服务','firewalld'],['规则后端',h(installed?host.backend:'待检查')],['开机启动',host?.enabled===false?'未启用':installed?'已启用':'待检查']])}<p>管理主机入站端口。Docker、VPN、NAT 和转发规则由各自软件管理，不在此处接管。</p>${!operation&&unknown?notice('检查未完成',host?.reason||'请重新检查服务状态。','warning'):conflict?notice('服务冲突',h(host.manager)+' 正在管理主机防火墙。请单独处理冲突，不自动迁移或停用旧管理器。','warning'):''}<div class="row">${operation?btn('查看原操作','opdetail',{id:operation.id},'primary'):installed&&!unknown?btn(running?'停止防火墙':'启动防火墙','fw-service',{server:id,serviceaction:running?'stop':'start'})+btn(host.enabled===false?'启用开机启动':'关闭开机启动','fw-service',{server:id,serviceaction:host.enabled===false?'enable':'disable'}):''}${operation?'':btn('重新检查','fw-discover',{server:id})}<span class="tiny muted">${host?.captured?'最近观测 '+fmt(host.captured):'尚未取得观测'} · 浏览器模拟</span></div></div></section>`;
}
registerPrototypeHandlers(prototypeActions,['fw-service'],(event,target,d)=>{
 const host=firewallHost(d.server);if(!host||firewallActiveOperation(d.server))return;
 openModal('fw-service',{server:d.server,action:d.serviceaction,before:clone(host)});
});
registerPrototypeHandlers(prototypeModals,['fw-service'],m=>{
 const labels={start:'启动 firewalld',stop:'停止 firewalld',enable:'启用开机启动',disable:'关闭开机启动'};
 layout(labels[m.action],'只变更 firewalld 服务状态，不迁移其他软件规则。',detail([['目标服务器',h(sr(m.server)?.name||m.server)],['确认窗口','120 秒']])+notice('变更影响',m.action==='stop'?'停止将撤销 firewalld 运行保护；保留永久配置，不停止 Docker 或 VPN。':'按现有配置调整服务状态；真实执行前核对 SSH 通路。')+check('fw-service-confirm','确认服务变更及其流量影响',false),btn('取消','closemodal')+'<button class="btn primary" type="submit">确认执行（模拟）</button>',false,'fw-service');
});
registerPrototypeHandlers(prototypeForms,['fw-service'],(event,form,fd,get,has,all,m)=>{
 const host=firewallHost(m.server);if(!has('fw-service-confirm'))return modalError('请确认服务变更影响。');
 if(JSON.stringify(host)!==JSON.stringify(m.before)||firewallActiveOperation(m.server))return modalError('服务状态变化，请重新预览。');
 if(m.action==='start')host.state='ready';if(m.action==='stop')host.state='stopped';if(m.action==='enable')host.enabled=true;if(m.action==='disable')host.enabled=false;
 host.revision++;host.captured=now();persist();closeModal();render();toast('服务状态已更新（浏览器模拟，不代表真实 SSH 或恢复验收）。');
});

function firewallDiagnostics(id){
 const host=firewallHost(id);if(!host)return '<p>选择服务器后检查实际管理方式、依赖与规则来源。</p>';
 return detail([['管理方式',h(host.manager)],['底层规则接口',h(host.backend)],['服务管理器',h(host.serviceManager)],['采集时间',fmt(host.captured)]])+`<p>${h(host.reason)}</p><p>其他工具仅供诊断；不会作为并行写入入口。Docker / VPN 等软件规则保留其原有归属。</p><ul>${host.preserved.map(value=>`<li>${h(value)}</li>`).join('')}</ul>`;
}
function firewallDiscover(id){
 initializeUnifiedFirewall();const host=firewallHost(id);if(!host)return;
 if(firewallActiveOperation(id)){toast('存在未完成操作，请先核对原操作。','warning');return;}
 const error=serverOperationError(id);
 if(error){host.state='unknown';host.reason='本次读取失败：'+error+'；保留上次观测。';}
 else if(host.readFails){host.state='unknown';host.reason='本次只读检查未取得完整证据；保留上次规则与采集时间，不能用于写入。';}
 else{host.inventoryIssues=[];host.readErrors=[];host.captured=now();host.serviceManager=host.serviceManager==='待探测'?'systemd':host.serviceManager;host.state=host.blockers.length?'blocked':host.manager==='firewalld'&&host.backend==='nftables'&&host.configuration==='consistent'?'ready':'needs-setup';host.reason=host.state==='ready'?'运行与永久配置已核对（模拟）':host.state==='blocked'?'当前条件不能安全完成自动接入。':'其他主机防火墙服务需要单独处理；不自动迁移。';}
 persist();render();toast(host.state==='unknown'?'检查未完成（模拟）；旧观测仅供查看。':'已完成只读检查（模拟）；没有安装或切换软件。');
}
registerPrototypeHandlers(prototypeActions,['fw-discover'],(event,target,d)=>firewallDiscover(d.server||selectedServer()));
