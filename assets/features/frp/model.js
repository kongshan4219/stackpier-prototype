'use strict';
// FRP 视图状态、角色记录与草稿同步；继续共用工作台的 S。
const FRP={tab:'connections',node:'n4',role:'client',file:'toml',scope:'one'};
const frpRoles={server:'frps 服务端',client:'frpc 客户端（服务提供端）',visitor:'frpc visitor（STCP 访问端）'};
const frpPrefixes={server:'frps',client:'frpc',visitor:'frpc-visitor'};
const frpPid=(n,r)=>'frp-'+n.id+'-'+r;
const frpNode=id=>S.frp.nodes.find(n=>n.id===id);
const frpLoopback=v=>v==='::1'||(validIPv4(v)&&v.split('.')[0]==='127');
function frpInit(){
 if(!S.frp){S.frp={schema:2,root:'/srv/services/frp',systemdDir:'/etc/systemd/system',user:'root',token:FRP_SOURCE.config.auth.token,templates:clone(FRP_SOURCE.templates),templateRev:1,naming:'legacy',nodes:FRP_SOURCE.config.servers.map((n,i)=>({...clone(n),id:'n'+(i+1),revision:1,provider:'frp-source',arch:i===3?'aarch64':'x86_64'}))};}
 // 仅移除旧草稿的选择标记；不重置用户节点、代理、已应用参照或历史操作。
 for(const n of S.frp.nodes)delete n.client_enabled;
 S.frp.schema=2;
}
function frpEnsure(){
 frpInit(); const F=S.frp;
 // 只清理原型未被用户改动的旧 FRP 程序假样例，不删除用户自行添加的记录。
 S.programs=S.programs.filter(b=>!(b.id==='bin3'&&b.identity==='demo-frpc-a'&&b.filename==='frpc-linux-x86_64'));
 if(!sr('frp-source'))S.servers.push({id:'frp-source',name:'FRP 内网执行机（身份待提供）',host:'未在参考包中提供',port:22,user:'待指定',auth:'待登记',os:'Debian（参考说明）',arch:'x86_64',kernel:'未观测',state:'unknown',group:'FRP 参考',cpu:0,mem:0,disk:0,checked:null,fp:'参考记录，不代表已接入或已信任',docker:false});
 for(const role of Object.keys(frpRoles))if(!tpl('frp-template-'+role))S.templates.push({id:'frp-template-'+role,name:frpRoles[role],type:'systemd',software:role==='server'?'frps':'frpc',program:role==='server'?'frps':'frpc',port:role==='server'?7000:'不固定监听',rev:1,version:'待提供真实程序',desc:'来自脱敏部署方案；独立配置、生成预览与逐角色应用',env:'',tpl:'见 FRP 部署 → 模板与审阅',fields:'使用 FRP 结构化表单',frpRole:role});
 const binaries=[['frps','x86_64','frps'],['frps','aarch64','frps-arm64'],['frpc','x86_64','frpc'],['frpc','aarch64','frpc-arm64']];
 for(const [name,arch,filename] of binaries)if(!S.programs.some(b=>b.id==='frp-bin-'+filename))S.programs.push({id:'frp-bin-'+filename,name,arch,filename,size:'0 B · 脱敏占位，不可执行',bytes:0,placeholder:true,time:null,identity:'仅文件名；无版本、架构或完整性验证'});
 for(const n of F.nodes){
  const hid='frp-host-'+n.id;if(!sr(hid))S.servers.push({id:hid,name:'FRP 云节点 '+n.ip+'（参考）',host:n.ip,port:22,user:n.ssh_user,auth:'待登记',os:'未核对',arch:n.arch,kernel:'未观测',state:'unknown',group:'FRP 参考',cpu:0,mem:0,disk:0,checked:null,fp:'未提供 host key；架构为试用值，不是真实观测',docker:false});
  for(const r of ['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])]){
   const id=frpPid(n,r);if(pr(id))continue;
   const cfg={port:r==='server'?n.bind_port:0,program:r==='server'?'frps':'frpc',version:'零字节占位，未部署',env:'',dataDir:F.root,serviceUser:F.user,appConfig:'',frp:true};
   S.projects.push({id,name:frpPrefixes[r]+'-'+n.ip,server:r==='client'?n.provider:hid,serverName:r==='client'?'FRP 内网执行机（待核对）':'FRP 云节点 '+n.ip,template:'frp-template-'+r,type:'systemd',software:r==='server'?'frps':'frpc',frpRef:{node:n.id,role:r},life:'draft',desired:'stopped',runtime:'na',health:'unknown',observed:null,lastCheck:null,cfg,applied:null,draftRev:1,appliedRev:0,components:[],plansPaused:false,dataStatus:'reference-only',deps:[],depChanges:[],monitor:{hours:24,http:'',tcp:r==='server'?String(n.bind_port):'',channels:[],inherit:true},backup:{stop:false,maxMinutes:10,databases:[],mysql:'',destination:'controller',account:'',path:F.root,enabled:false},note:'来自脱敏清单的参考项目；不是已接管、已部署或已健康的真实服务。'});
  }
 }
}
function frpHost(n,r){return r==='client'?n.provider:'frp-host-'+n.id;}
function frpPending(n,r){const p=pr(frpPid(n,r));return !p?.frpApplied||JSON.stringify(p.frpApplied.files)!==JSON.stringify(frpRenderSafe(n,r));}
function frpSyncConfigs(){if(!S.frp)return;for(const p of S.projects.filter(x=>x.frpRef)){const n=frpNode(p.frpRef.node);if(!n)continue;p.cfg.appConfig=frpRenderSafe(n,p.frpRef.role).toml;p.cfg.dataDir=S.frp.root;p.cfg.port=p.frpRef.role==='server'?n.bind_port:0;p.draftRev=n.revision;}}
function frpSaveNode(candidate,old){const backup=clone(S.frp.nodes);if(old)S.frp.nodes[S.frp.nodes.findIndex(n=>n.id===old.id)]=candidate;else S.frp.nodes.push(candidate);const errors=frpValidate();if(errors.length){S.frp.nodes=backup;throw Error(errors.join('；'));}if(old&&old.provider!==candidate.provider&&pr(frpPid(old,'client'))?.life==='installed'){S.frp.nodes=backup;throw Error('已部署客户端的主机不能通过编辑清单偷偷换机；本轮不实现迁移。');}frpEnsure();sr('frp-host-'+candidate.id).arch=candidate.arch;for(const r of Object.keys(frpRoles)){const p=pr(frpPid(candidate,r));if(p&&p.life==='draft'&&r==='client')p.server=candidate.provider;}frpSyncConfigs();persist();}
