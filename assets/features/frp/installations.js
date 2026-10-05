'use strict';
// 服务器角色部署先于连接配置；frpc 程序就绪后仍等待连接配置，不伪造在线服务。
function frpInstallationId(server,role){return 'frp-installed-'+server+'-'+role;}
function frpServerDeployment(server,role){
 const matches=p=>p.life==='installed'&&(p.frpInstallation?.role||p.frpRef?.role)===role&&p.frpApplied?.role===role&&p.frpApplied.host===server;
 return S.projects.find(p=>p.frpInstallation&&matches(p))||S.projects.find(matches);
}
function frpInstallationPlan(serverId,role){
 const server=sr(serverId);if(!server||!['client','server'].includes(role))throw Error('请选择服务器和 frpc / frps 部署角色。');
 if(!validIPv4(server.host)&&!validIPv6(server.host))throw Error('服务器地址尚未登记，请先完善服务器信息。');
 if(!['x86_64','aarch64','arm64'].includes(server.arch))throw Error('服务器架构未确定或不支持，不能部署 FRP。');
 if(!/^[A-Za-z0-9_.-]+$/.test(server.user))throw Error('服务器 SSH 用户名尚未正确登记。');
 const id=frpInstallationId(serverId,role);
 // 监听参数沿用服务器配置，首次部署取参考配置；部署表单不覆盖配置值。
 const config=pr(id)?.frpApplied?.node||S.frp.nodes.find(n=>frpHost(n,'server')===serverId)||FRP_SOURCE.config.servers.find(n=>n.ip===server.host)||{bind_addr:'0.0.0.0',bind_port:7000};
 const node={id,ip:server.host,ssh_user:server.user,arch:server.arch,provider:serverId,server:serverId,bind_addr:config.bind_addr,bind_port:Number(config.bind_port),proxies:[],revision:1,serverUnit:'frps-'+serverId+'.service'};
 if(role==='server'&&(!validIPv4(node.bind_addr)&&!validIPv6(node.bind_addr)||!Number.isInteger(node.bind_port)||node.bind_port<1||node.bind_port>65535))throw Error('frps 配置中的监听地址或控制端口无效，请检查配置文件。');
 const files=role==='server'?frpFiles(node,'server'):{binaryPath:S.frp.root+'/bin/frpc',toml:'',unit:'',tomlPath:'',unitPath:''};
 return {programRef:clone(newerAssetPins(frpProgramRef(role))),id,server:serverId,role,node,files,root:S.frp.root,user:S.frp.user,systemdDir:S.frp.systemdDir,settingsRevision:S.frp.settingsRev,templates:role==='server'?Object.fromEntries(['frps.toml.tpl','frps.service.tpl'].map(name=>[name,S.frp.templates[name]])):{}};
}
function frpReadInstallationPlan(){return frpInstallationPlan(document.querySelector('#fb-server')?.value,document.querySelector('#fb-role')?.value);}
function frpRunInstallation(plan,conditions,operation='deploy'){
 frpEnsure();const p=pr(plan.id),label=(operation==='deploy'?'部署 ':'卸载 ')+frpRoles[plan.role]+' · '+sname(plan.server);
 const reject=message=>rejectOperation(p||{id:plan.id,name:label},'frp-install',message);
 let current;if(operation==='deploy'){try{current=frpInstallationPlan(plan.server,plan.role);}catch(error){return reject(error.message);}}
 if(operation==='deploy'&&JSON.stringify(current)!==JSON.stringify(plan))return reject('预览后的服务器或公共配置已变化，请重新打开部署确认。');
 if(operation==='deploy'){const errors=frpValidate();if(errors.length)return reject(errors.join('；'));}
 if(operation==='deploy'){const errors=frpResolveProgram(plan.programRef,plan.server).errors;if(errors.length)return reject(errors.join('；'));}
 if(!conditions.identity||!conditions.impact)return reject('请明确确认本次模拟部署的主机身份和共享程序影响。');
 if(operation==='uninstall'&&(!p||p.life!=='installed'||!conditions.remove))return reject('请确认卸载已部署的角色；不会清理其他角色或共享程序。');
 if(operation==='uninstall'&&(JSON.stringify(plan.files)!==JSON.stringify(p.frpApplied?.files)||plan.server!==p.frpApplied?.host))return reject('卸载确认后的完整部署参照已变化，请重新核对卸载目标。');
 const links=S.frp.nodes.filter(n=>frpHost(n,plan.role)===plan.server);
 if(operation==='uninstall'&&links.some(n=>pr(frpPid(n,'client'))?.life==='installed'||plan.role==='server'&&pr(frpPid(n,'visitor'))?.life==='installed'))return reject('仍有关联连接的运行载体，请先卸载连接客户端及 visitor，再卸载服务器角色。');
 if(operation==='deploy'&&plan.role==='server'&&p?.frpApplied&&links.length&&JSON.stringify(p.frpApplied.files)!==JSON.stringify(plan.files))return reject('服务端已有连接，监听、认证或运行路径的变更需先审阅关联连接；不能通过重新部署隐式迁移。');
 if(operation==='deploy'&&plan.role==='server'){
  const listener={host:plan.server,addr:plan.node.bind_addr,port:plan.node.bind_port};
  const controls=[...S.frp.nodes.map(n=>({project:frpPid(n,'server'),host:frpHost(n,'server'),addr:n.bind_addr,port:n.bind_port})),...S.projects.filter(p=>p.frpInstallation?.role==='server'&&p.life==='installed'&&p.frpApplied).map(p=>({project:p.id,host:p.frpApplied.host,addr:p.frpApplied.node.bind_addr,port:p.frpApplied.node.bind_port}))];
  const mappings=S.frp.nodes.flatMap(n=>n.proxies.map(x=>({host:frpHost(n,'server'),addr:x.type==='tcp'?n.bind_addr:x.visitor_bind_addr,port:x.type==='tcp'?x.remote_port:x.visitor_bind_port})));
  if([...controls.filter(x=>x.project!==plan.id),...mappings].some(x=>frpListenerOverlap(listener,x)))return reject('frps 控制监听与同机已有 FRP 配置的端口冲突，请核对监听地址和端口。');
 }
 const resources=['project:'+plan.id,'frp-install:'+plan.server+':'+plan.role,'frp-bin:'+plan.server+':'+(plan.role==='server'?'frps':'frpc')];
 const conflict=conflictFor(resources);if(conflict)return reject('与 '+conflict.label+' 冲突，请先核对原操作。');
 if(!p){const cfg={frp:true,port:plan.role==='server'?plan.node.bind_port:0,program:plan.role==='server'?'frps':'frpc',version:'模拟程序条件',dataDir:plan.root,serviceUser:plan.user,appConfig:plan.files.toml,env:''};S.projects.push({id:plan.id,name:(plan.role==='server'?'frps':'frpc')+' · '+sname(plan.server),server:plan.server,serverName:sname(plan.server),template:'frp-template-'+plan.role,type:'systemd',software:cfg.program,frpInstallation:{role:plan.role},life:'draft',runtime:'na',desired:'stopped',health:'unknown',cfg,applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:true,monitor:{hours:24,method:'systemd',channels:[],inherit:true},dataStatus:'reference-only',observed:null,lastCheck:null});}
 const o=record(label,'frp-install',plan.id,'running','服务器角色输入已固定；仅浏览器模拟。',{frpInstallation:true,ended:null,resources,input:{plan:clone(plan),operation,draftRev:pr(plan.id).draftRev,before:{life:p?.life||'draft',runtime:p?.runtime||'na'}},steps:(operation==='deploy'?['固定服务器与角色','交付角色程序',plan.role==='server'?'交付 frps 配置与 unit':'登记 frpc 程序就绪，等待连接配置','核对部署结果']:['固定角色与关联连接范围','卸载所选角色']).map((title,i)=>({title,status:i===0?'success':i===1?'running':'pending'})),outcome:conditions.outcome||'success'});
 pr(plan.id).frpLastOp=o.id;FRP.tab='connections';persist();render();closeModal();openModal('opdetail',{id:o.id});if(!conditions.hold)timers.set(o.id,setTimeout(()=>frpFinishInstallation(o,o.outcome),1600));return o;
}
function frpFinishInstallation(o,result){
 if(!o?.frpInstallation||!['running','unknown'].includes(o.status)||!['success','failed','partial','unknown'].includes(result))return;
 clearTimeout(timers.get(o.id));timers.delete(o.id);const p=pr(o.project),plan=o.input.plan,at=now();o.status=result;o.ended=result==='unknown'?null:at;o.protectionReleased=result!=='unknown';
 o.steps.forEach((step,index)=>{if(step.status==='success')return;step.status=result==='success'?'success':index===1?result==='partial'?'success':result:index===2&&result==='partial'?'failed':'pending';});
 if(p?.frpLastOp===o.id){
  if(result==='success'&&o.input.operation==='deploy'){
   p.cfg={...p.cfg,port:plan.role==='server'?plan.node.bind_port:0,appConfig:plan.files.toml,dataDir:plan.root,serviceUser:plan.user};p.applied=clone(p.cfg);p.frpApplied={host:plan.server,role:plan.role,node:clone(plan.node),files:clone(plan.files),root:plan.root,unit:plan.role==='server'?plan.node.serverUnit:'',programReady:true,programRef:clone(plan.programRef),program:clone(frpResolveProgram(plan.programRef,plan.server).file)};p.life='installed';p.runtime=plan.role==='server'?'running':'na';p.desired=plan.role==='server'?'running':'stopped';p.runtimeCheckStatus='verified';p.appliedRev=o.input.draftRev;p.components=[];p.observed=at;p.lastCheck=at;
  }else if(result==='success'){p.life='uninstalled';p.runtime='na';p.components=[];p.observed=at;}
  else if(result==='partial'){p.life=o.input.before.life==='installed'?'installed':'incomplete';p.components=[{name:'角色部署未完成',result:'程序已交付，后续分项未完成，保留原完整参照。'}];}
  else if(result==='unknown')p.components=[{name:'角色部署待核对',result:'原执行结果未知，不计为新的完整部署。'}];
 }
 o.message=result==='success'?(o.input.operation==='uninstall'?'已模拟卸载所选角色，保留共享程序。':plan.role==='client'?'frpc 程序已部署；创建连接并应用配置后再启动对应连接服务。':'frps 已完成模拟部署，可用于创建连接。'):result==='unknown'?'角色部署结果未知，请核对原操作；当前结果不作为新增连接的完整部署依据。':'角色部署未完成，保留已经确认的分项及原部署参照。';
 frpSyncConfigs();persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===o.id)renderModal();
}
