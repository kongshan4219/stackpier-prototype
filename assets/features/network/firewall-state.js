'use strict';

// 仅保存浏览器模拟观测，不从工具名称推断真实机器已完成统一接入。
function initializeUnifiedFirewall(){
 const sample=S.firewallSeed===true;delete S.firewallSeed;S.firewallHosts||={};
 for(const server of S.servers){
  if(S.firewallHosts[server.id])continue;
  const ready=sample&&['s1','s4'].includes(server.id),migration=sample&&server.id==='s2';
  S.firewallHosts[server.id]={state:ready?'ready':migration?'needs-setup':'unknown',manager:ready?'firewalld':migration?'UFW':'未知',backend:ready?'nftables':'待统一',os:server.os,arch:server.arch,serviceManager:ready||migration?'systemd':'待探测',captured:sample?now():'',revision:1,configuration:ready?'consistent':'unknown',defaultPolicy:ready||migration?'DROP':'unknown',reason:ready?'运行与永久配置已核对（模拟）':migration?'现有 UFW 主机入站规则需要迁移。':'尚未完成系统与防火墙盘点。',zones:sample?[{name:'public',interfaces:['eth0'],sources:[],target:ready||migration?'DROP':'unknown'}]:[],preserved:['Docker 容器链与 NAT','VPN 专属规则'],blockers:[]};
 }
}
function firewallHost(id){return S.firewallHosts?.[id];}
function firewallHostRules(id){return S.firewalls.filter(r=>r.server===id&&(!r.direction||r.direction==='in')&&(!r.scope||r.scope==='host'));}
function firewallRuleZone(rule){const zones=firewallHost(rule.server)?.zones||[];return rule.zone||(zones.length===1?zones[0].name:'');}
function firewallZoneOptions(id){return [['','请选择作用范围'],...(firewallHost(id)?.zones||[]).map(zone=>[zone.name,zone.name+' · '+(zone.interfaces.join('、')||zone.sources.join('、')||'无绑定')])];}
function firewallChosenZone(id,value=''){const zones=firewallHost(id)?.zones||[],name=value||(zones.length===1?zones[0].name:'');return zones.some(zone=>zone.name===name)?name:'';}
function firewallRuleZoneError(rule){return firewallChosenZone(rule.server,firewallRuleZone(rule))?'':'此规则的 Zone 尚未明确或已不在当前观测中，仅可查看；请先核对作用范围。';}
function firewallActiveOperation(id){return S.operations.find(o=>o.input?.netType==='firewall'&&['running','unknown'].includes(o.status)&&!o.protectionReleased&&(o.input.serverTarget?.id===id||o.input.record?.server===id));}
function firewallWriteError(id){
 const error=serverOperationError(id);if(error)return error;
 const host=firewallHost(id),operation=firewallActiveOperation(id);
 if(operation)return '存在未完成的防火墙操作，请先核对原操作。';
 if(host?.state!=='ready'||host.manager!=='firewalld'||host.backend!=='nftables'||host.configuration!=='consistent')return host?.reason||'请先检查并完成 firewalld 统一接入。';
 return '';
}
function firewallStateCard(id){
 if(!id||id==='all')return '';
 const host=firewallHost(id),operation=firewallActiveOperation(id),state=operation?.status==='running'?'pending':operation?'unknown':host?.state||'unknown';
 const labels={ready:'可管理','needs-setup':'待安装／迁移',blocked:'仅可查看',pending:'正在接入',unknown:'结果待核对'};
 return `<section class="card firewall-state-card"><div class="card-head"><h2>防火墙管理</h2>${badge(labels[state],state==='ready'?'success':state==='blocked'?'error':'unknown')}</div><div class="card-body stack">${detail([['统一管理方式','firewalld · nftables'],['当前管理方式',h(host?.manager||'待探测')],['系统 / 架构',h((host?.os||'待探测')+' / '+(host?.arch||'待探测'))],['服务管理器',h(host?.serviceManager||'待探测')],['配置持久化',state==='ready'?'运行与永久配置一致':'尚未完成核对']])}<p>${h(operation?'当前主机有未完成操作；保留原操作身份与恢复保护。':host?.reason||'自动探测发行版、64 位架构、服务管理器和规则来源。')}</p>${(host?.blockers||[]).map(reason=>notice('接入受阻',reason,'warning')).join('')}<div class="row">${operation?btn('查看原操作','opdetail',{id:operation.id},'primary'):state==='needs-setup'?btn(host.manager==='未安装'?'安装并接入':'迁移到 firewalld','fw-setup',{server:id},'primary'):state!=='ready'?btn('重新检查','fw-discover',{server:id}):''}<span class="tiny muted">${host?.captured?'最近观测 '+fmt(host.captured):'尚未取得观测'} · 浏览器模拟</span></div></div></section>`;
}
function firewallDiagnostics(id){
 const host=firewallHost(id);if(!host)return '<p>选择服务器后检查实际管理方式、依赖与规则来源。</p>';
 return detail([['管理方式',h(host.manager)],['底层规则接口',h(host.backend)],['服务管理器',h(host.serviceManager)],['采集时间',fmt(host.captured)]])+`<p>${h(host.reason)}</p><p>其他工具仅供诊断；不会作为并行写入入口。Docker / VPN 等软件规则保留其原有归属。</p><ul>${host.preserved.map(value=>`<li>${h(value)}</li>`).join('')}</ul>`;
}
function firewallDiscover(id){
 initializeUnifiedFirewall();const host=firewallHost(id);if(!host)return;
 if(firewallActiveOperation(id)){toast('存在未完成操作，请先核对原操作。','warning');return;}
 const error=serverOperationError(id);
 if(error){host.state='unknown';host.reason='本次读取失败：'+error+'；保留上次观测。';}
 else if(host.readFails){host.state='unknown';host.reason='本次 SSH 读取超时；保留上次规则与采集时间，不能用于写入。';}
 else{host.captured=now();host.serviceManager=host.serviceManager==='待探测'?'systemd':host.serviceManager;host.state=host.blockers.length?'blocked':host.manager==='firewalld'&&host.backend==='nftables'&&host.configuration==='consistent'?'ready':'needs-setup';host.reason=host.state==='ready'?'运行与永久配置已核对（模拟）':host.state==='blocked'?'当前条件不能安全完成自动接入。':'已识别现有规则与加载来源，可以查看固定接入计划。';}
 persist();render();toast('已完成只读检查（模拟）；没有安装或切换软件。');
}
registerPrototypeHandlers(prototypeActions,['fw-discover'],(event,target,d)=>firewallDiscover(d.server||selectedServer()));
