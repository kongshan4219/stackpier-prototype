'use strict';

function frpServiceProject(id,role){const p=pr(id);return p&&p.frpService?.role===role&&p.life==='installed'?p:null;}
function frpServices(role){return S.projects.filter(p=>p.frpService?.role===role&&p.life==='installed'&&!p.cleanup);}
function frpBoundService(n,role){return frpServiceProject(n?.serviceBindings?.[role]||n?.roleProjects?.[role],role);}
function frpServiceOptions(role){return [['','请选择服务实例'],...frpServices(role).map(p=>[p.id,p.name+' · '+sname(p.server)+' · '+runtimeName[p.runtime]])];}
function syncNewFrpFields(m=ui.modal){
 const target=document.getElementById('np-frp-fields'),t=tpl(document.getElementById('np-template')?.value);if(!target||!t)return;
 const v=m.frpValues||m.projectConfig?.frpInputs||{};
 target.innerHTML=!t.frpRole?'':t.frpRole==='server'?`<div class="field-row">${field('np-frp-bind','FRPS 监听地址',v.bind||'0.0.0.0','配置值不是实际端口探测。')}${field('np-frp-port','FRPS 控制端口',v.port||7000,'','number','min="1" max="65535" required')}</div>`:t.frpRole==='client'?select('np-frp-server-service','连接到已部署 FRPS',frpServiceOptions('server'),v.serverService||'','部署服务不自动创建连接记录。','required'):select('np-frp-connection','STCP visitor 配置来源',[['','请选择包含 STCP 的连接'],...S.frp.nodes.filter(n=>n.proxies.some(x=>x.type==='stcp')).map(n=>[n.id,sname(n.provider)+' → '+n.ip])],v.connection||'','visitor 必须部署在该连接 FRPS 所在服务器，使用 frpc。','required');
}
document.addEventListener('change',e=>{if(e.target.id==='np-template')syncNewFrpFields();});
function configureFrpServiceDraft(draft,fd,m){
 const t=tpl(draft.template),role=t.frpRole,settings=clone(t.frpSource||frpSettingsSnapshot());
 const inputs={bind:String(fd.get('np-frp-bind')||''),port:Number(fd.get('np-frp-port')),serverService:String(fd.get('np-frp-server-service')||''),connection:String(fd.get('np-frp-connection')||'')};
 let node;
 if(role==='server'){
  if(!validIPv4(inputs.bind)&&!validIPv6(inputs.bind)||!Number.isInteger(inputs.port)||inputs.port<1||inputs.port>65535)throw Error('监听 IP 与控制端口无效。');
  node={id:'service-'+draft.name,ip:sr(draft.server).host,provider:draft.server,server:draft.server,ssh_user:sr(draft.server).user,bind_addr:inputs.bind,bind_port:inputs.port,proxies:[],client_enabled:true,revision:1};
 }else if(role==='client'){
  const service=frpServiceProject(inputs.serverService,'server');if(!service||service.cleanup)throw Error('尚无可用 FRPS 服务，请先从项目部署。');
  node={...clone(service.frpApplied.node),id:'service-'+draft.name,provider:draft.server,server:service.server,proxies:[],serviceBindings:{server:service.id},client_enabled:true};
 }else{
  const n=frpNode(inputs.connection);if(!n?.proxies.some(x=>x.type==='stcp'))throw Error('请先保存 STCP 映射，再部署 visitor 服务。');
  const server=frpBoundService(n,'server');if(!server||draft.server!==server.server)throw Error('visitor 必须位于对应 FRPS 主机。');
  node=clone(n);
 }
 const files=frpFiles(node,role,settings),directory=settings.root+'/projects/'+draft.name;
 files.tomlPath=directory+'/'+frpPrefixes[role]+'.toml';files.unitPath=settings.systemdDir+'/'+draft.name+'.service';files.generatedToml='generated/'+frpPrefixes[role]+'/'+draft.name+'.toml';files.generatedUnit='generated/'+frpPrefixes[role]+'/'+draft.name+'.service';
 files.unit=files.unit.replace(/^ExecStart=.*$/m,'ExecStart='+files.binaryPath+' -c '+files.tomlPath);
 if(role==='visitor')files.unit=files.unit.replace(/^After=.*$/m,'After=network.target '+frpBoundService(node,'server')?.frpApplied.unit).replace(/^Requires=.*$/m,'Requires='+frpBoundService(node,'server')?.frpApplied.unit);
 const programRef=clone(t.programRef),snapshot={role,host:draft.server,node,files,unit:draft.name+'.service',root:settings.root,settings,settingsRevision:settings.settingsRev,templateRevisions:clone(settings.templateRevisions),configurationRevision:t.rev,programRef,templateId:t.id,program:clone(frpResolveProgram(programRef,draft.server).file)};
 draft.frpService={role};draft.cfg={...draft.cfg,source:files.unit,appConfig:files.toml,program:frpProgramName(role),programRef,frpSnapshot:snapshot,frpInputs:inputs,dataDir:directory,port:role==='server'?node.bind_port:0,version:'固定程序修订 · '+(snapshot.program?.revision||'无效'),fileMappings:[]};
 m.frpValues=clone(inputs);return draft;
}
function frpServiceLocation(p){
 const snapshot=p.cfg.frpSnapshot,server=sr(p.server),errors=[],warnings=[],files=[];
 if(!snapshot)return {mainPath:'未知',files,errors:['FRP 服务配置快照缺失'],warnings};
 const linked=S.frp.nodes.filter(n=>Object.values(n.serviceBindings||{}).includes(p.id));
 if(p.frpApplied&&linked.length){const old=p.frpApplied,token=f=>f.toml.match(/^\s*auth\.token\s*=.*$/m)?.[0]?.trim();if(token(old.files)!==token(snapshot.files)||JSON.stringify(old.node.proxies)!==JSON.stringify(snapshot.node.proxies))errors.push('认证或映射变更影响关联连接；请在配置 / FRP 明确采用并协调应用，不从单个项目改写配对配置。');}
 errors.push(...frpResolveProgram(snapshot.programRef,p.server).errors);const block=serverOperationError(p.server);if(block)errors.push(block);
 const f=snapshot.files;
 for(const path of [f.unitPath,f.tomlPath,f.binaryPath]){const error=targetFilePathError(path);if(error)errors.push(error);}
 if(!f.unit.includes('ExecStart='+f.binaryPath+' -c '+f.tomlPath))errors.push('启动命令与程序 / TOML 路径不一致。');
 if(snapshot.role==='visitor'){if(!snapshot.node.proxies.some(x=>x.type==='stcp'))errors.push('TCP-only 连接不部署 visitor。');if(p.server!==snapshot.node.server)errors.push('visitor 必须位于 FRPS 主机。');if(snapshot.node.proxies.some(x=>x.type==='stcp'&&!frpLoopback(x.visitor_bind_addr)))errors.push('visitor 只允许回环地址。');}
 for(const other of S.projects.filter(x=>x.id!==p.id&&x.server===p.server&&x.frpApplied)){
  if([other.frpApplied.files.unitPath,other.frpApplied.files.tomlPath].some(path=>[f.unitPath,f.tomlPath].includes(path)))errors.push('目标文件已被 '+other.name+' 使用。');
  if(other.frpApplied.files.binaryPath===f.binaryPath){const old=frpResolveProgram(other.frpApplied.programRef,other.server),next=frpResolveProgram(snapshot.programRef,p.server);if(old.errors.length||!old.file||old.file.identity!==next.file?.identity)errors.push('共享程序目标仍由 '+other.name+' 使用不同或未知修订；不能从本项目替换共享程序，先核对共享影响或使用独立程序落点。');else warnings.push('共享程序：'+other.name+'；固定相同内容身份，不替换其版本或重启该服务。');}
  if(snapshot.role==='server'&&other.frpService?.role==='server'&&frpListenerOverlap({host:p.server,addr:snapshot.node.bind_addr,port:snapshot.node.bind_port},{host:other.server,addr:other.frpApplied.node.bind_addr,port:other.frpApplied.node.bind_port}))errors.push('FRPS 控制端口与 '+other.name+' 冲突。');
 }
 const occupied=S.projects.find(x=>x.id!==p.id&&x.server===p.server&&p.cfg.port&&Number(x.applied?.port)===Number(p.cfg.port));if(occupied)errors.push('端口已由 '+occupied.name+' 使用。');
 const program=frpResolveProgram(snapshot.programRef,p.server).file;files.push({file:frpProgramName(snapshot.role),targetPath:f.binaryPath,binary:program,generated:false});files.push({file:'配置生成 TOML（非上传资产）',targetPath:f.tomlPath,binary:{filename:f.generatedToml,revision:snapshot.configurationRevision,arch:'any',identity:'生成内容 · 固定 C'+snapshot.configurationRevision},generated:true});
 return {mainPath:f.unitPath,files,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
// 项目与连接同用这一份稳定服务引用；不按显示名称匹配。
const servicePid=frpPid;
// frpPid 为旧 const，调用方改为服务绑定优先，旧 ID 仅用于迁移。
function frpServiceBindings(n){return Object.keys(frpRoles).map(role=>({role,project:frpBoundService(n,role),id:n.serviceBindings?.[role]}));}
const serviceProjectTab=projectTab;projectTab=function(p){if(!p.frpService||ui.tab!=='config')return serviceProjectTab(p);const read=p.frpReadSnapshot;return `<div class="toolbar">${btn('查看公共部署配置','asset-template',{id:p.template,project:p.id})}${btn('查看公共更新差异','frp-update',{id:p.id})}${btn('应用项目配置草稿','projectop',{id:p.id,kind:'apply'},'primary')}${btn('模拟读取成功','frp-read',{id:p.id})}${btn('模拟读取失败','frp-read',{id:p.id,fail:'true'})}</div>${S.frp.nodes.filter(n=>Object.values(n.serviceBindings||{}).includes(p.id)).map(n=>btn('连接与映射 · '+n.ip,'frp-locate',{node:n.id,project:p.id})).join('')}<div class="grid2 mt">${card('服务器上次成功读取 · 只读',read?`<p>${h(read.at||'历史时间未知')} · ${p.frpReadError?'旧结果，模拟读取失败':'浏览器模拟'}</p><pre class="code asset-text">${h(frpMask(read.files.toml))}</pre>`:empty('没有成功读取','不会用草稿代替服务器内容。'))}${card('已应用参照',`<pre class="code asset-text">${h(frpMask(p.frpApplied?.files.toml||''))}</pre>`)}</div><details class="mt"><summary>项目配置草稿与全部落点</summary>${landingPreviewBody(p)}</details>`;};
