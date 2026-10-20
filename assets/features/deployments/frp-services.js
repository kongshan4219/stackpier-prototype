'use strict';

function configurationFrpDefaults(t,role='server'){
 return clone(t?.frpParameters||{controlAddr:role==='server'?t?.frpInputs?.bind||'127.0.0.1':'127.0.0.1',controlPort:role==='server'?t?.frpInputs?.port||27000:9,adminPort:role==='server'?27100:27101,allowedPortStart:27110,allowedPortEnd:27299,hasCredential:!!t?.frpSource?.token});
}
function configurationFrpFields(v,existing,token){
 const f=v.frp,server=v.role==='server';
 return select('fc-role','FRP 服务角色',[['server','FRPS 服务端'],['client','FRPC 提供端'],['visitor','visitor 访问端']],v.role,'',existing?'disabled':'')+
  '<p class="muted">使用已核实的官方 FRP 0.71.0 程序；连接与 TCP / STCP 映射在「FRP」管理。</p>'+
  field('fc-token','认证 Token',token,'','password',`minlength="16" maxlength="256" ${f.hasCredential?'':'required'} placeholder="${f.hasCredential?'留空保留；输入新值替换':'填写关联角色共用的 Token'}"`)+
  '<p class="muted">Token 不回填；替换只用于新修订，已有项目保留原凭据。原型仅接受 EXAMPLE_ 或 DEMO_ 开头的虚构值。</p>'+
  field('fc-bind',server?'FRPS 私网控制监听地址':'FRPC 初始未连接地址',f.controlAddr,'','text','required '+(server?'':'readonly'))+
  `<div class="configuration-form-grid">${field('fc-port','FRP 控制端口',f.controlPort,'','number',`required min="${server?1024:9}" max="65535" ${server?'':'readonly'}`)}${field('fc-admin','回环管理端口',f.adminPort,'','number','required min="1024" max="65535"')}${field('fc-start','允许映射端口起点',f.allowedPortStart,'','number','required min="1024" max="65535"')}${field('fc-end','允许映射端口终点',f.allowedPortEnd,'','number','required min="1024" max="65535"')}</div>`+
  notice('FRPS TCP 代理和管理端口仅监听回环；FRPC / visitor 初始未连接，部署后在 FRP 页面绑定。');
}
function configurationFrpError(v,token){
 const f=v.frp,ip=f.controlAddr,privateIP=validIPv4(ip)&&(/^(127|10)\./.test(ip)||/^192\.168\./.test(ip)||/^172\.(1[6-9]|2\d|3[01])\./.test(ip))||validIPv6(ip)&&(ip==='::1'||/^f[cd]/i.test(ip));
 if(!privateIP||!Number.isInteger(f.adminPort)||f.adminPort<1024||f.adminPort>65535)return '控制地址须为明确私网或回环 IP，管理与 TCP 代理仅监听 127.0.0.1';
 if(!Number.isInteger(f.controlPort)||f.controlPort<(v.role==='server'?1024:1)||f.controlPort>65535||f.controlPort===f.adminPort)return '控制端口无效或与管理端口冲突';
 if(v.role!=='server'&&(ip!=='127.0.0.1'||f.controlPort!==9))return 'FRPC 初始为未绑定的 127.0.0.1:9，远端由 FRP 连接统一管理';
 if(!Number.isInteger(f.allowedPortStart)||!Number.isInteger(f.allowedPortEnd)||f.allowedPortStart<1024||f.allowedPortEnd>65535||f.allowedPortEnd<f.allowedPortStart||f.allowedPortEnd-f.allowedPortStart>255)return '需固定最多 256 个 TCP 代理端口范围';
 if([f.controlPort,f.adminPort].some(port=>port>=f.allowedPortStart&&port<=f.allowedPortEnd))return '代理端口范围不能包含控制或管理保留端口';
 if(!token&&!f.hasCredential)return '新建 FRP 配置必须填写认证 Token';
 if(token&&(token.length<16||token.length>256||!/^(EXAMPLE_|DEMO_)[A-Za-z0-9_.-]+$/.test(token)))return '原型只接受 16–256 字符、EXAMPLE_ 或 DEMO_ 开头的虚构 Token。';
 return '';
}
function configurationFrpTemplate(t,v,token){
 const source=clone(t?.frpSource||frpSettingsSnapshot());if(token)source.token=token;
 const f={...v.frp,hasCredential:true};
 return {type:'systemd',frpRole:v.role,software:frpProgramName(v.role),program:frpProgramName(v.role),programRef:configurationPin(v.programVersion),frpParameters:f,
  frpInputs:{bind:f.controlAddr,port:f.controlPort,serverService:'',connection:''},frpSource:source,deploymentConfig:true,tpl:source.templates[frpPrefixes[v.role]+'.service.tpl'],fileMappings:[],desc:'FRP 角色参数与固定程序配置'};
}
