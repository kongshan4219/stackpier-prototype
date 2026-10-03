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
  return {id,ip:host.host,ssh_user:host.user,arch:host.arch,provider,server,bind_addr:'0.0.0.0',bind_port:7000,proxies,revision:1,clientInstallation:frpInstallationId(provider,'client'),roleProjects:{server:frpInstallationId(server,'server')},serverUnit:'frps-'+server+'.service'};
 });
 return {...frpSampleSettings(nodes),sampleVersion:1,samplePending:true};
}
function frpSeedSampleRoles(){
 const at=now();
 for(const [server,role] of [['s1','client'],['s3','client'],['s2','server'],['s4','server']]){
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
  const p=pr(frpPid(n,role));p.note='虚构连接样例，服务状态不代表隧道或代理连通。';
  if(n.id==='n2')continue;
  p.life='installed';p.runtime=n.id==='n4'?'stopped':'running';p.desired=p.runtime;p.runtimeCheckStatus='verified';p.stopVerified=p.runtime==='stopped';p.observed=at;p.lastCheck=at;p.dataStatus='in-place';
  p.cfg.version='模拟程序条件（非附件二进制）';p.applied=clone(p.cfg);p.appliedRev=p.draftRev;p.frpApplied=frpSnapshot(n,role);
 }
 delete S.frp.samplePending;
}
function frpRefreshReferenceSample(){
 // 仅刷新完全未修改的旧默认清单；有草稿、部署、操作或关联数据的用户状态保持原样。
 if(S.frp.sampleVersion!==undefined)return;
 const same=frpSampleEqual,reference=frpReferenceSample();
 if(!same(S.frp,reference))return;
 const defaults=initial().servers;
 if(!defaults.every(base=>{const server=sr(base.id);return server&&['host','port','user','arch'].every(key=>server[key]===base[key]);}))return;
 const hosts=[frpReferenceProvider(),...reference.nodes.map(frpReferenceServer)],hostIds=new Set(hosts.map(server=>server.id));
 if(hosts.some(base=>sr(base.id)&&!same(sr(base.id),base)))return;
 const projects=reference.nodes.flatMap(n=>['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])].map(role=>frpDraftProject(n,role))),projectIds=new Set(projects.map(p=>p.id));
 const existing=S.projects.filter(p=>p.frpRef||p.frpInstallation);
 if(existing.length&&existing.length!==projects.length||!existing.length&&hosts.some(base=>sr(base.id)))return;
 if(existing.some(p=>!projectIds.has(p.id)||!frpReferenceProjectMatches(p,projects.find(base=>base.id===p.id))))return;
 if(S.operations.some(o=>o.frp||o.frpInstallation||projectIds.has(o.project)||hostIds.has(o.server)||o.resources?.some(resource=>resource.startsWith('project:')&&projectIds.has(resource.slice(8))||resource.startsWith('server:')&&hostIds.has(resource.slice(7)))))return;
 if([...S.projects,...S.dns,...S.firewalls,...S.notifications,...(S.failedProjects||[])].some(row=>!projectIds.has(row.id)&&(hostIds.has(row.server)||projectIds.has(row.project)||row.projects?.some(id=>projectIds.has(id)))))return;
 S.servers=S.servers.filter(server=>!hostIds.has(server.id));S.projects=S.projects.filter(p=>!projectIds.has(p.id));S.frp=frpSampleState();
}
function frpReferenceProjectMatches(project,base){
 const p=clone(project),n=frpNode(base.frpRef.node),role=base.frpRef.role;
 // 早期样例保留了派生的旧名称与文件缓存；仅接受默认生成内容，不忽略用户正文。
 if(![base.serverName,role==='client'?'FRP 内网执行机（待核对）':'FRP 云节点 '+n.ip].includes(p.serverName))return false;
 p.serverName=base.serverName;
 if(Object.hasOwn(p.cfg,'textDeployment')){
  const f=frpFiles(n,role),expected={type:'systemd',serverId:base.server,fileName:frpUnit(n,role),workingDir:S.frp.root,content:f.unit,files:[{path:f.tomlPath,content:f.toml}],program:base.cfg.program,binaryPath:f.binaryPath};
  if(!frpSampleEqual(p.cfg.textDeployment,expected))return false;
  delete p.cfg.textDeployment;
 }
 return frpSampleEqual(p,base);
}
function frpSampleEqual(a,b){
 if(a===b)return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&frpSampleEqual(a[key],b[key]));
}
