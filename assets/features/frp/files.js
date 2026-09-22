'use strict';
// 逐角色生成 TOML / unit、固定参照并校验草稿。
const frpQuote=v=>JSON.stringify(String(v)).replace(/\u007f/g,'\\u007f');
function frpSubstitute(text,values){return text.replace(/\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)|\$/g,(token,braced,plain)=>{if(token==='$$')return '$';const key=braced||plain;if(!key||!Object.hasOwn(values,key))throw Error('模板占位符未知或不完整：'+token);return String(values[key]);});}
function frpValidateTemplate(name,text){
 if(!frpTemplateSlots.includes(name))throw Error('仅维护三种角色的六类 TOML / service 模板。');
 if(!text.trim())throw Error('模板正文不能为空。');
 const role=frpTemplateRole(name),toml=name.endsWith('.toml.tpl');
 const allowed=toml?(role==='server'?['bind_addr','bind_port','auth_method','auth_token']:['server_ip','bind_port','auth_method','auth_token',role==='client'?'proxies':'visitors']):['server_ip'];
 frpSubstitute(text,Object.fromEntries(allowed.map(key=>[key,''])));
 const authKeys=[...text.matchAll(/^\s*(?:auth|"auth"|'auth')\s*\.\s*(token|method|"token"|"method"|'token'|'method')\s*=/gm)].map(match=>match[1].replace(/["']/g,''));
 if(toml&&(authKeys.filter(key=>key==='token').length!==1||authKeys.filter(key=>key==='method').length!==1||/^\s*\[\s*(?:auth\s*[\].]|"auth"|'auth')/m.test(text)))throw Error('全局认证只能由固定 auth.method / auth.token 占位生成，不允许重复或另设认证表。');
 if(toml){
  const placeholder=key=>'\\$(?:\\{'+key+'\\}|'+key+')',required={auth_method:['auth\\.method',true],auth_token:['auth\\.token',true],...(role==='server'?{bind_addr:['bindAddr',true],bind_port:['bindPort',false]}:{server_ip:['serverAddr',true],bind_port:['serverPort',false]})};
  for(const [key,[field,quoted]] of Object.entries(required)){const value=(quoted?'"':'')+placeholder(key)+(quoted?'"':'');if(!new RegExp('^\\s*'+field+'\\s*=\\s*'+value+'\\s*(?:#.*)?$','m').test(text))throw Error(name+'：'+field+' 必须使用 '+key+' 占位，不允许注释占位或硬编码替代。');}
  if(role!=='server'){const key=role==='client'?'proxies':'visitors';if(!new RegExp('^\\s*'+placeholder(key)+'\\s*(?:#.*)?$','m').test(text))throw Error(name+'：需要独立的 '+key+' 映射块占位。');}
 }
 return allowed;
}
function frpUnit(n,r){const ip=n.ip;return S.frp.naming==='role'?frpPrefixes[r]+'-'+ip+'.service':ip+(r==='visitor'?'-visitor':'')+'.service';}
function frpFiles(n,r){
 const F=S.frp,prefix=frpPrefixes[r],esc=v=>frpQuote(v).slice(1,-1);
 const proxy=n.proxies.map(x=>['[[proxies]]','name = '+frpQuote(x.name),'type = '+frpQuote(x.type),'localIP = '+frpQuote(x.local_ip),'localPort = '+x.local_port,x.type==='tcp'?'remotePort = '+x.remote_port:'secretKey = '+frpQuote(x.secret_key)].join('\n')).join('\n\n');
 const visitor=n.proxies.filter(x=>x.type==='stcp').map(x=>['[[visitors]]','name = '+frpQuote(x.name+'-visitor'),'type = "stcp"','serverName = '+frpQuote(x.name),'secretKey = '+frpQuote(x.secret_key),'bindAddr = '+frpQuote(x.visitor_bind_addr),'bindPort = '+x.visitor_bind_port].join('\n')).join('\n\n');
 const vars={server_ip:n.ip,bind_addr:n.bind_addr,bind_port:n.bind_port,auth_method:'token',auth_token:esc(F.token),proxies:proxy,visitors:visitor};
 function substitute(text){return frpSubstitute(text,vars);}
 for(const suffix of ['.toml.tpl','.service.tpl'])frpValidateTemplate(prefix+suffix,F.templates[prefix+suffix]);
 let unit=substitute(F.templates[prefix+'.service.tpl']).replaceAll('/srv/services/frp',F.root).replace(/^User=.*$/m,'User='+F.user);
 if(r==='visitor')unit=unit.replace('After=network-online.target '+n.ip+'.service','After=network-online.target '+frpUnit(n,'server'));
 return {toml:substitute(F.templates[prefix+'.toml.tpl']),unit,tomlPath:F.root+'/generated/'+prefix+'/'+n.ip+'.toml',unitPath:F.systemdDir+'/'+frpUnit(n,r),binaryPath:F.root+'/bin/'+(r==='server'?'frps':'frpc')};
}
function frpRenderSafe(n,r){try{return frpFiles(n,r)}catch(e){return {toml:'无法生成：'+e.message,unit:'无法生成：'+e.message,tomlPath:'—',unitPath:'—',binaryPath:'—'}}}
function frpSnapshot(n,r){const names=['.toml.tpl','.service.tpl'].map(suffix=>frpPrefixes[r]+suffix);return {files:frpFiles(n,r),node:clone(n),role:r,revision:n.revision,settingsRevision:S.frp.settingsRev,templateRev:S.frp.templateRev,templateRevisions:Object.fromEntries(names.map(name=>[name,S.frp.templateRevisions[name]])),templateSources:Object.fromEntries(names.map(name=>[name,S.frp.templates[name]])),root:S.frp.root,naming:S.frp.naming,host:frpHost(n,r),unit:frpUnit(n,r)};}
function frpPreviewBinding(items,op){return JSON.stringify(items.map(x=>{const n=frpNode(x.node),p=pr(frpPid(n,x.role));return op==='deploy'?{node:n.id,role:x.role,snapshot:frpSnapshot(n,x.role)}:{project:p.id,applied:p.frpApplied};}));}
function frpValidate(nodes=S.frp.nodes){
 const errors=[],F=S.frp,ips=new Set(),listeners=[];
 const port=(p,where)=>{if(!Number.isInteger(p)||p<1||p>65535)errors.push(where+'：端口必须是 1–65535 的整数');};
 const ip=(v,where)=>{if(!validIPv4(v)&&!validIPv6(v))errors.push(where+'：地址必须是 IP');};
 if(!/^\/[A-Za-z0-9_./-]+$/.test(F.root)||F.root.includes('..'))errors.push('运行根目录必须为不含上跳的绝对路径');
 if(!/^\/[A-Za-z0-9_./-]+$/.test(F.systemdDir)||F.systemdDir.includes('..'))errors.push('unit 目录必须为不含上跳的绝对路径');
 if(!/^[A-Za-z_][A-Za-z0-9_-]*\$?$/.test(F.user))errors.push('应用运行用户名格式不正确');
 if(!F.token)errors.push('认证 token 不能为空（仅填写演示值）');
 for(const n of nodes){ip(n.ip,n.id);ip(n.bind_addr,n.ip+' bind_addr');port(n.bind_port,n.ip+' 控制端口');if(ips.has(n.ip))errors.push('重复的服务端 IP：'+n.ip);ips.add(n.ip);if(!/^[A-Za-z0-9_.-]+$/.test(n.ssh_user))errors.push(n.ip+'：SSH 用户名格式不正确');
  const names=new Set(),host='frp-host-'+n.id;listeners.push({host,addr:n.bind_addr,port:n.bind_port,label:n.ip+' frps 控制监听'});
  for(const x of n.proxies){if(!/^[A-Za-z0-9_.-]+$/.test(x.name)||names.has(x.name))errors.push(n.ip+'：代理名称不合法或重复 '+x.name);names.add(x.name);ip(x.local_ip,x.name+' localIP');port(x.local_port,x.name+' localPort');
   if(x.type==='tcp'){port(x.remote_port,x.name+' remotePort');listeners.push({host,addr:n.bind_addr,port:x.remote_port,label:n.ip+' TCP '+x.name});}
   else if(x.type==='stcp'){if(!x.secret_key)errors.push(x.name+'：STCP 密钥不能为空');if(!frpLoopback(x.visitor_bind_addr))errors.push(x.name+'：visitor 必须监听回环地址');port(x.visitor_bind_port,x.name+' visitor 端口');listeners.push({host,addr:x.visitor_bind_addr,port:x.visitor_bind_port,label:n.ip+' visitor '+x.name});}
   else errors.push(x.name+'：本参考方案仅支持 TCP / STCP');
  }
  for(const r of ['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])])try{const f=frpFiles(n,r);if(/\$\{/.test(f.toml+f.unit))errors.push(n.ip+'：仍有未替换变量');if(!f.unit.includes('ExecStart='+f.binaryPath+' -c '+f.tomlPath))errors.push(n.ip+' '+r+'：ExecStart 与程序/配置路径不一致');}catch(e){errors.push(n.ip+'：'+e.message)}
 }
 for(let i=0;i<listeners.length;i++)for(let j=i+1;j<listeners.length;j++){const a=listeners[i],b=listeners[j];const sameFamily=a.addr.includes(':')===b.addr.includes(':');const overlap=a.addr===b.addr||(sameFamily&&[a.addr,b.addr].some(x=>x==='0.0.0.0'||x==='::'))||a.addr==='::'||b.addr==='::';if(a.host===b.host&&a.port===b.port&&overlap)errors.push(a.label+' 与 '+b.label+' 监听冲突');}
 const units=new Map();for(const n of nodes)for(const r of ['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])]){const k=frpHost(n,r)+'/'+frpUnit(n,r);if(units.has(k))errors.push('同机 unit 重名：'+frpUnit(n,r)+'；请选择按角色命名或不同主机');else units.set(k,true);}
 return [...new Set(errors)];
}
