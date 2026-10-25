'use strict';

// 模拟条件只从原型审阅入口注入，不让业务表单选择成功或失败。
function loadFirewallScene(id){
 const server=id==='firewall-install'?'s4':id==='firewall-blocked'?'s3':'s2';
 const host=firewallHost(server);sr(server).state='online';ui.firewallOutcome='success';ui.firewallRecheck='unknown';
 // 场景入口已明确重置演示数据；成功迁移样例仅包含范围明确的主机入站规则。
 S.firewalls=S.firewalls.filter(rule=>rule.server!==server||rule.scope!=='host'||rule.direction!=='out');
 host.state='needs-setup';host.manager='UFW';host.backend='待统一';host.configuration='unknown';host.defaultPolicy='DROP';host.serviceManager='systemd';host.reason='已识别 UFW 主机入站规则及启动来源；可预览迁移。';host.blockers=[];host.inventoryIssues=[];host.readErrors=[];host.readFails=false;
 delete host.setupChecks;
 if(id==='firewall-setup-error'){host.manager='原生 nftables';host.defaultPolicy='ACCEPT';host.zones[0].interfaces=['docker0','ens33'];host.blockers=['依赖下载来源未核实','桥接接口与完整规则归属未证明'];host.reason='可查看失败预览及具体诊断；尚不能接入。';host.setupChecks={packages:'failed',scope:'failed',conversion:'not-evaluated',target:'not-evaluated',ipv4:'ACCEPT',ipv6:'',issues:[{id:'packages',code:'apt-uri-protocol',stage:'packages',object:'python3-firewall',field:'scheme',protocol:'file'},{id:'scope',code:'scope-unproven',stage:'scope',object:'docker0'},{id:'conversion',code:'conversion-dependent',stage:'conversion',dependsOn:['scope']},{id:'target',code:'target-unproven',stage:'target',dependsOn:['conversion']}]};}
 if(['firewall-ready','firewall-multi-zone'].includes(id)){host.state='ready';host.manager='firewalld';host.backend='nftables';host.configuration='consistent';host.reason='已完成统一接入，运行和永久配置一致（模拟）。';}
 if(id==='firewall-multi-zone'){firewallHostRules(server).forEach(rule=>{rule.zone='public';});host.zones.push({name:'internal',interfaces:['eth1'],sources:['198.51.100.0/24'],target:'DROP'});}
 if(id==='firewall-install'){host.manager='未安装';host.defaultPolicy='ACCEPT';host.zones.forEach(zone=>{zone.target='ACCEPT';});host.reason='只读盘点未发现主机防火墙管理器；可以查看安装计划。';}
 if(id==='firewall-blocked'){host.os='Alpine Linux（示例）';host.serviceManager='OpenRC';host.state='blocked';host.blockers=['未检测到可用的独立恢复服务，尚不能安全自动切换。','存在无法等价转换的自定义主机规则；需先核对其用途。'];host.reason='自动探测完成，当前条件不能安全完成自动接入。';}
 if(id==='firewall-read-error'){host.state='unknown';host.readFails=true;host.reason='本次只读检查未取得完整证据；保留旧规则和原采集时间，不用于写入。';host.inventoryIssues=[{code:'access-denied',stage:'cron',object:'/var/spool/cron/crontabs',retryable:true},{code:'limit-exceeded',stage:'services',object:'systemd 服务清单',actual:4097,limit:4096,retryable:false},{code:'changed',stage:'startup',object:'/etc/network/if-pre-up.d/bridge',retryable:true}];}
 navigate('firewall');ui.server=server;ui.fwSelected=[];ui.fwPage=1;render();
 if(['firewall-failed','firewall-unknown','firewall-recheck','firewall-pending'].includes(id)){
  const outcome=id==='firewall-failed'?'failed':id==='firewall-pending'?'success':'unknown';
  const o=startFirewallSetup(firewallSetupPlan(server),outcome,{hold:true});
  if(o&&id!=='firewall-pending')finishFirewallSetup(o,outcome);
  ui.firewallRecheck=id==='firewall-recheck'?'success':'unknown';
 }
 persist();toast('已装载统一防火墙模拟场景；不会连接真实服务器。');
}
