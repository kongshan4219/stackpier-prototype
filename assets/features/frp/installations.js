'use strict';
// 服务器角色部署先于连接配置；frpc 程序就绪后仍等待连接配置，不伪造在线服务。
function frpInstallationId(server,role){return 'frp-installed-'+server+'-'+role;}
function frpServerDeployment(server,role){
 const matches=p=>p.life==='installed'&&(p.frpInstallation?.role||p.frpRef?.role)===role&&p.frpApplied?.role===role&&p.frpApplied.host===server;
 return S.projects.find(p=>p.frpInstallation&&matches(p))||S.projects.find(matches);
}
function frpInstallationPlan(serverId,role,useDraft=true){
 const server=sr(serverId);if(!server||!['client','server'].includes(role))throw Error('请选择服务器和 frpc / frps 部署角色。');
 if(!validIPv4(server.host)&&!validIPv6(server.host))throw Error('服务器地址尚未登记，请先完善服务器信息。');
 if(!['x86_64','aarch64','arm64'].includes(server.arch))throw Error('服务器架构未确定或不支持，不能部署 FRP。');
 if(!/^[A-Za-z0-9_.-]+$/.test(server.user))throw Error('服务器 SSH 用户名尚未正确登记。');
 const id=frpInstallationId(serverId,role),project=pr(id);
 if(useDraft&&project?.frpInstallation&&project.frpDraft){const d=project.frpDraft;return {id,server:serverId,role,node:clone(d.node),files:clone(d.files),programRef:clone(d.programRef),root:d.root,user:d.settings.user,systemdDir:d.settings.systemdDir,settingsRevision:d.settingsRevision,templates:role==='server'?Object.fromEntries(['frps.toml.tpl','frps.service.tpl'].map(name=>[name,d.settings.templates[name]])):{},sourceDraft:{projectId:id,revision:project.draftRev}};}
 // 监听参数沿用服务器配置，首次部署取参考配置；部署表单不覆盖配置值。
 const config=pr(id)?.frpApplied?.node||S.frp.nodes.find(n=>frpHost(n,'server')===serverId)||FRP_SOURCE.config.servers.find(n=>n.ip===server.host)||{bind_addr:'0.0.0.0',bind_port:7000};
 const node={id,ip:server.host,ssh_user:server.user,arch:server.arch,provider:serverId,server:serverId,bind_addr:config.bind_addr,bind_port:Number(config.bind_port),proxies:[],revision:1,serverUnit:'frps-'+serverId+'.service'};
 if(role==='server'&&(!validIPv4(node.bind_addr)&&!validIPv6(node.bind_addr)||!Number.isInteger(node.bind_port)||node.bind_port<1||node.bind_port>65535))throw Error('frps 配置中的监听地址或控制端口无效，请检查配置文件。');
 const files=role==='server'?frpFiles(node,'server'):{binaryPath:S.frp.root+'/bin/frpc',toml:'',unit:'',tomlPath:'',unitPath:''};
 return {programRef:clone(newerAssetPins(frpProgramRef(role))),id,server:serverId,role,node,files,root:S.frp.root,user:S.frp.user,systemdDir:S.frp.systemdDir,settingsRevision:S.frp.settingsRev,templates:role==='server'?Object.fromEntries(['frps.toml.tpl','frps.service.tpl'].map(name=>[name,S.frp.templates[name]])):{}};
}
