'use strict';
// 当前流程的虚构样例与一次性初始化；参考包仍独立用于模板和源码审阅。
function frpSampleSettings(nodes,naming='role'){
 return {schema:3,root:'/srv/services/frp',systemdDir:'/etc/systemd/system',user:'root',token:FRP_SOURCE.config.auth.token,templates:clone(FRP_SOURCE.templates),templateRev:1,naming,nodes,settingsRev:1,templateRevisions:Object.fromEntries(frpTemplateSlots.map(name=>[name,1]))};
}
function frpReferenceSample(){return frpSampleSettings(FRP_SOURCE.config.servers.map((n,i)=>({...clone(n),id:'n'+(i+1),revision:1,provider:'frp-source',arch:i===3?'aarch64':'x86_64'})),'legacy');}
function frpSampleState(){
 if(!['s1','s2','s3','s4'].every(sr))return {...frpSampleSettings([]),sampleVersion:1};
 const pairs=[['s1','s2','local',0],['s1','s4','backup',0],['s3','s2','arm',1],['s3','s4','arm-backup',0]];
 const nodes=pairs.map(([provider,server,prefix,offset],index)=>{
  const host=sr(server),id='n'+(index+1),proxies=clone(FRP_SOURCE.config.servers[index].proxies);
  for(const x of proxies){x.name=prefix+'-'+x.name.replace('example-','');if(x.type==='tcp')x.remote_port+=offset;}
  return {id,ip:host.host,ssh_user:host.user,arch:host.arch,provider,server,bind_addr:'0.0.0.0',bind_port:7000,proxies,revision:1,client_enabled:FRP_SOURCE.config.servers[index].client_enabled,clientInstallation:frpInstallationId(provider,'client'),roleProjects:{server:frpInstallationId(server,'server')},serverUnit:'frps-'+server+'.service'};
 });
 return {...frpSampleSettings(nodes),sampleVersion:1,samplePending:true};
}
function frpSeedSampleRoles(){
 const at=now();
 for(const [server,role] of [['s2','server'],['s4','server']]){
  const plan=frpInstallationPlan(server,role),p=pr(plan.id)||frpDraftProject(plan.node,role);
  if(!pr(plan.id))S.projects.push(p);
  Object.assign(p,{id:plan.id,name:frpPrefixes[role]+' · '+sname(server),frpInstallation:{role},life:'installed',runtime:role==='server'?'running':'na',desired:role==='server'?'running':'stopped',monitorPaused:role==='client',runtimeCheckStatus:'verified',observed:at,lastCheck:at,dataStatus:'in-place',note:'虚构服务器角色部署参照，仅用于浏览器模拟。'});
  delete p.frpRef;
  Object.assign(p.cfg,{port:role==='server'?plan.node.bind_port:0,version:'模拟程序条件（非附件二进制）',appConfig:plan.files.toml});
  p.frpDraftUnit=plan.files.unit;
  p.applied=clone(p.cfg);p.appliedRev=p.draftRev;
  p.frpApplied={host:server,role,node:clone(plan.node),files:clone(plan.files),root:plan.root,unit:role==='server'?plan.node.serverUnit:'',programReady:true};
 }
 frpSyncConfigs();
 for(const n of S.frp.nodes)for(const role of ['client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])]){
  if(n.id==='n2')continue;const p=pr(frpPid(n,role))||frpDraftProject(n,role);if(!pr(p.id))S.projects.push(p);p.note='虚构连接样例，服务状态不代表隧道或代理连通。';
  if(n.id==='n2')continue;
  p.life='installed';p.runtime=n.id==='n4'?'stopped':'running';p.desired=p.runtime;p.runtimeCheckStatus='verified';p.stopVerified=p.runtime==='stopped';p.observed=at;p.lastCheck=at;p.dataStatus='in-place';
  p.cfg.version='模拟程序条件（非附件二进制）';p.applied=clone(p.cfg);p.appliedRev=p.draftRev;p.frpApplied=frpSnapshot(n,role);
 }
 delete S.frp.samplePending;
}
