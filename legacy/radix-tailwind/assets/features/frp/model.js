'use strict';
// FRP 视图状态、角色记录与草稿同步；继续共用工作台的 S。
const FRP={tab:'connections',node:'n4',role:'client',file:'toml',scope:'one'};
const frpRoles={server:'frps 服务端',client:'frpc 客户端（服务提供端）',visitor:'frpc visitor（STCP 访问端）'};
const frpPrefixes={server:'frps',client:'frpc',visitor:'frpc-visitor'};
const frpTemplateSlots=Object.values(frpPrefixes).flatMap(prefix=>[prefix+'.toml.tpl',prefix+'.service.tpl']);
const frpTemplateRole=name=>Object.keys(frpPrefixes).find(role=>name.startsWith(frpPrefixes[role]+'.'));
const frpPid=(n,r)=>n?.serviceBindings?.[r]||n?.roleProjects?.[r]||'frp-'+n?.id+'-'+r;
const frpNode=id=>S.frp.nodes.find(n=>n.id===id)||Object.values(S.frpProfiles||{}).flatMap(F=>F.nodes).find(n=>n.id===id);
const frpLoopback=v=>v==='::1'||(validIPv4(v)&&v.split('.')[0]==='127');
function frpInit(){
 if(!S.frp)S.frp=frpSampleState();
 const F=S.frp;F.settingsRev||=1;F.templateRev||=1;F.templateRevisions||=Object.fromEntries(frpTemplateSlots.map(name=>[name,F.templateRev]));
 // 旧节点认证仅转成显式待确认草稿；已应用和在途快照继续保留旧事实。
 for(const n of F.nodes){
  if(n.client_enabled===undefined)n.client_enabled=true; // 旧记录没有默认目标字段，保留可操作语义。
  const legacy=[n.token,n.authToken,n.tokenOverride,n.auth?.token].filter(value=>typeof value==='string'&&value);
  if(legacy.some(value=>value!==F.token)){n.authMigration={roles:['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])],message:'旧节点认证与全局 token 不同；新草稿统一使用全局值，应用前须明确确认。'};n.revision++;}
  delete n.token;delete n.authToken;delete n.tokenOverride;delete n.tokenSource;delete n.tokenMode;delete n.inheritToken;
  if(n.auth){delete n.auth.token;if(!Object.keys(n.auth).length)delete n.auth;}
 }
 F.schema=3;
 // 保留已有参考清单；新版示例必须由用户明确载入。
}
function frpReferenceProvider(){return {id:'frp-source',name:'FRP 内网执行机（身份待提供）',host:'未在参考包中提供',port:22,user:'待指定',auth:'待登记',os:'Debian（参考说明）',arch:'x86_64',kernel:'未观测',state:'unknown',group:'FRP 参考',cpu:0,mem:0,disk:0,checked:null,fp:'参考记录，不代表已接入或已信任',docker:false};}
function frpReferenceServer(n){return {id:n.server||'frp-host-'+n.id,name:'FRP 云节点 '+n.ip+'（参考）',host:n.ip,port:22,user:n.ssh_user,auth:'待登记',os:'未核对',arch:n.arch,kernel:'未观测',state:'unknown',group:'FRP 参考',cpu:0,mem:0,disk:0,checked:null,fp:'未提供 host key；架构为试用值，不是真实观测',docker:false};}
function frpDraftProject(n,r){
 const F=S.frp,cfg={port:r==='server'?n.bind_port:0,program:r==='server'?'frps':'frpc',version:'零字节占位，未部署',env:'',dataDir:F.root,serviceUser:F.user,appConfig:'',frp:true};
 return {id:frpPid(n,r),name:n.roleProjects?.server?frpPrefixes[r]+' · '+sname(frpHost(n,r))+' → '+n.ip:frpPrefixes[r]+'-'+n.ip,server:frpHost(n,r),serverName:sname(frpHost(n,r)),template:'frp-template-'+r,type:'systemd',software:r==='server'?'frps':'frpc',frpRef:{node:n.id,role:r},life:'draft',desired:'stopped',runtime:'na',health:'unknown',observed:null,lastCheck:null,cfg,applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,stopVerified:false,dataStatus:'reference-only',monitor:{hours:24,method:'systemd',http:'',channels:[],inherit:true},note:'来自脱敏清单的参考项目；不是已接管、已部署或已健康的真实服务。'};
}
function frpEnsure(){
 frpInit(); const F=S.frp;
 const seedPublicAssets=!S.publicAssetsSeeded&&S.programs.length>0&&S.templates.length>0;S.publicAssetsSeeded=true;
 // 历史自定义 FRP 文件与项目保留；专用角色引用明确的公共资产 ID。
 if(F.nodes.some(n=>n.provider==='frp-source')&&!sr('frp-source'))S.servers.push(frpReferenceProvider());
 for(const role of seedPublicAssets?Object.keys(frpRoles):[])if(!tpl('frp-template-'+role))S.templates.push({id:'frp-template-'+role,name:frpRoles[role],type:'systemd',software:role==='server'?'frps':'frpc',program:role==='server'?'frps':'frpc',port:role==='server'?7000:'不固定监听',rev:1,version:'待提供真实程序',desc:'来自脱敏部署方案；独立配置、生成预览与逐角色应用',env:'',tpl:'见 配置 / FRP → 公共模板详情',fields:'使用 FRP 结构化表单',frpRole:role});
 const historical=S.programs.find(b=>b.id==='bin3'&&b.identity==='demo-frpc-a');if(historical&&!historical.groupId)historical.groupId='legacy-frp-bin3';
 const binaries=[['frps','x86_64','frps'],['frps','aarch64','frps-arm64'],['frpc','x86_64','frpc'],['frpc','aarch64','frpc-arm64']];
 for(const [name,arch,filename] of seedPublicAssets?binaries:[])if(!S.programs.some(b=>b.id==='frp-bin-'+filename))S.programs.push({id:'frp-bin-'+filename,groupId:'asset-frp-bin-'+name,name,arch,filename,size:'0 B · 脱敏占位，不可执行',bytes:0,placeholder:true,time:null,identity:'仅文件名；无版本、架构或完整性验证'});
 for(const n of F.nodes){
  const hid=n.server||'frp-host-'+n.id;if(!sr(hid))S.servers.push(frpReferenceServer(n));
  // 连接只引用服务；保存或查看清单绝不创建项目。
 }
 if(F.samplePending)frpSeedSampleRoles();
 frpSyncConfigs();
}
function frpHost(n,r){return r==='client'?n.provider:(n.server||'frp-host-'+n.id);}
// 只采用对应角色完整部署的原主机参照，不以草稿或程序名称推断已部署。
function frpInstalledServers(role){
 const hosts=new Set(S.projects.filter(p=>p.life==='installed'&&(p.frpInstallation?.role||p.frpRef?.role)===role&&p.frpApplied?.role===role&&p.frpApplied.host).map(p=>p.frpApplied.host));
 return S.servers.filter(server=>hosts.has(server.id));
}
function frpValidateConnectionServers(candidate){
 for(const role of ['client','server']){const p=frpBoundService(candidate,role);if(!p||p.cleanup)throw Error('尚无可用 '+frpRoles[role]+' 服务；请先在项目部署。');}
 const visitor=candidate.serviceBindings?.visitor&&frpBoundService(candidate,'visitor');if(visitor&&visitor.server!==frpBoundService(candidate,'server').server)throw Error('visitor 服务必须位于对应 FRPS 主机。');
}

function frpAuthChange(n,r){const p=pr(frpPid(n,r));if(n.authMigration?.roles.includes(r))return true;if(!p?.frpApplied)return false;const line=text=>text.match(/^\s*auth\.token\s*=.*$/m)?.[0]?.trim();return line(p.frpApplied.files.toml)!==line((p.frpDraft?.files||frpRenderSafe(n,r)).toml);}
function frpPending(n,r){const p=n&&pr(frpPid(n,r));return !!n?.authMigration?.roles.includes(r)||!p?.frpApplied||JSON.stringify(p.frpApplied.files)!==JSON.stringify(p.frpDraft?.files)||p.frpApplied.programRef&&JSON.stringify(p.frpApplied.programRef)!==JSON.stringify(p.frpDraft?.programRef);}
function frpAffectedRoles(role){return S.frp.nodes.flatMap(n=>Object.keys(frpRoles).filter(r=>(!role||r===role)&&(r!=='visitor'||n.proxies.some(x=>x.type==='stcp')||pr(frpPid(n,r)))).map(r=>({node:n,role:r,project:pr(frpPid(n,r))})));}
function frpAuthImpact(items){return frpAffectedRoles().filter(x=>items.some(item=>item.node===x.node.id)&&(x.project?.life==='installed'||items.some(item=>item.node===x.node.id&&item.role===x.role))&&frpAuthChange(x.node,x.role));}
function frpSyncConfigs(){if(S.frp)frpSyncDrafts();}
function frpSaveNode(candidate,old){
 const visitorErrors=frpBindingErrors(candidate).filter(e=>e.startsWith('frpc-visitor'));if(visitorErrors.length)throw Error(visitorErrors.join('；'));
 if(old&&frpNeedsDetach(old)&&(!frpSameBindings(old.serviceBindings,candidate.serviceBindings)||old.appliedConfiguration&&!old.appliedConfiguration.detached&&!frpSameBindings(old.appliedConfiguration.bindings,candidate.serviceBindings)))throw Error('已应用或未解决目标改绑前须先明确解除旧配置并核对，旧服务不会卸载。');
 if(!old||!frpSameBindings(old.serviceBindings,candidate.serviceBindings))frpValidateConnectionServers(candidate);
 const bindings=frpBindingErrors(candidate);if(bindings.length)throw Error(bindings.join('；'));
 candidate.configurationManaged=true;const previous=clone(S.frp.nodes);if(old)S.frp.nodes[S.frp.nodes.findIndex(n=>n.id===old.id)]=candidate;else S.frp.nodes.push(candidate);
 const errors=frpValidate();if(errors.length){S.frp.nodes=previous;throw Error(errors.join('；'));}
 // 保存连接只更新配置，不采用公共资产、不改项目草稿或已应用状态。
 persist();
}
