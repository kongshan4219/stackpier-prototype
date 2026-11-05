import {isValidIPOrCIDR,isValidAddressForFamily,isValidPortRange,normalizePortRange,splitTagValues,inferAddressFamily} from './validation.ts';
import {c} from './copy.js';
export const options=items=>items.map(([value,label])=>({value,label}));
export const values=text=>splitTagValues([text||'']);
export function seed(provider='firewalld'){
 return {provider,forwardBackend:'iptables',dockerBackend:'iptables',active:true,bound:true,ipv6:true,ping:false,revision:1,lifecycle:{system:{active:true,bound:true},docker:{active:true,bound:true},forwarding:{active:true,bound:true}},
 rules:[{id:'ssh',protocol:'tcp',sourceAddress:'',destinationPort:'22',action:'accept',description:'SSH',family:'ipv4',protected:true,priority:0},{id:'web',protocol:'tcp',sourceAddress:'192.0.2.0/24',destinationPort:'8080',action:'accept',description:'示例 Web 服务',family:'ipv4',priority:0},{id:'v6',protocol:'tcp',sourceAddress:'2001:db8::/64',destinationPort:'8443',action:'drop',description:'IPv6 示例',family:'ipv6',priority:10},{id:'native',protocol:'all',sourceAddress:'',destinationPort:'',action:'reject',description:'复杂原始规则',family:'ipv4',opaque:true,raw:'rule family="ipv4" service name="demo-service" reject'}],
 forwarding:[{id:'forward',family:'ipv4',protocol:'tcp',port:'18080',targetIP:'192.0.2.20',targetPort:'8080',interface:'eth0'}],
 docker:[{id:'docker-web',container:'demo-web',host:'0.0.0.0',port:'8080',targetPort:'80',family:'ipv4',protocol:'tcp',mode:'allow_sources',sources:'192.0.2.0/24',effective:true},{id:'orphan',container:'孤立策略 · 容器已移除',host:'0.0.0.0',port:'9090',targetPort:'90',family:'ipv4',protocol:'tcp',mode:'deny_all',sources:'',effective:false}],
 whitelist:[{id:'ssh-white',type:'ssh',protocol:'tcp',port:'22',sources:''}],backups:[],tasks:[]};
}
export function normalize(kind,input,provider='firewalld',editing=false){
 const v={...input};
 if(kind==='system'){
  const addresses=values(v.sourceAddress),ports=values(v.destinationPort);
  if(!['tcp','udp','tcp/udp','all','icmp','icmpv6'].includes(v.protocol)||!['accept','drop','reject'].includes(v.action))throw Error(c.errors.json);
  if(!addresses.length&&!ports.length)throw Error(c.errors.required);
  if(addresses.some(a=>!isValidIPOrCIDR(a)))throw Error(c.errors.address);
  if(ports.some(p=>!isValidPortRange(p)))throw Error(c.errors.port);
  if(v.protocol==='all'&&ports.length&&provider!=='ufw')throw Error(c.errors.port);
  if(editing&&(addresses.length>1||ports.length>1))throw Error(c.errors.single);
  const protocols=v.protocol==='tcp/udp'?['tcp','udp']:[v.protocol];
  if(Math.max(1,addresses.length)*Math.max(1,ports.length)*protocols.length>500)throw Error(c.errors.limit);
  if(v.priority!==undefined&&v.priority!==null&&(!Number.isInteger(Number(v.priority))||(provider==='firewalld'?(v.priority< -32768||v.priority>32767):v.priority<1)))throw Error(c.errors.priority);
  return (addresses.length?addresses:['']).flatMap(address=> (ports.length?ports:['']).flatMap(port=>protocols.map(protocol=>({...v,protocol,sourceAddress:address,destinationPort:port?normalizePortRange(port):'',family:address?inferAddressFamily(address):v.family||'ipv4'}))));
 }
 if(kind==='forwarding'){
  if(!['ipv4','ipv6'].includes(v.family)||!['tcp','udp','tcp/udp'].includes(v.protocol))throw Error(c.errors.json);
  if(!isValidPortRange(v.port)||!isValidPortRange(v.targetPort))throw Error(c.errors.port);
  if(v.targetIP&&!isValidAddressForFamily(v.family,v.targetIP,false))throw Error(c.errors.address);
  if(v.interface&&!/^[\w.:+-]{1,15}$/.test(v.interface))throw Error(c.errors.json);
  v.port=normalizePortRange(v.port);v.targetPort=normalizePortRange(v.targetPort);v.targetIP=v.targetIP||(v.family==='ipv6'?'::1':'127.0.0.1');
 }
 if(kind==='docker'||kind==='whitelist'){
  if(!isValidPortRange(v.port)||!['tcp','udp'].includes(v.protocol))throw Error(c.errors.port);
  if(values(v.sources).some(a=>!isValidIPOrCIDR(a)))throw Error(c.errors.address);
  if(kind==='docker'&&(!['deny_sources','allow_sources','deny_all','accept_sources','accept_all'].includes(v.mode)||(['deny_sources','allow_sources','accept_sources'].includes(v.mode)&&!values(v.sources).length)))throw Error(c.errors.required);
 }
 return [v];
}
export function parseImport(kind,text,provider){
 if(new TextEncoder().encode(text).length>(kind==='system'?64*1024*1024:256*1024))throw Error(c.errors.size);
 let rows;try{rows=JSON.parse(text)}catch{throw Error(c.errors.json)}
 if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error(c.errors.json);
 if(kind!=='system'&&rows.length>500)throw Error(c.errors.limit);
 return rows.flatMap(row=>normalize(kind,{...row,family:row.family||row.scope?.family||'ipv4'},provider));
}
export function exported(kind,rows,provider){
 return rows.map(({id,protected:locked,opaque,...r})=>kind==='system'?{...r,scope:{provider,family:r.family,zone:provider==='firewalld'?'public':undefined,table:['iptables','nftables'].includes(provider)?'filter':undefined,chain:['iptables','nftables'].includes(provider)?'1PANEL_BASIC':provider==='ufw'?'incoming':undefined,direction:'input'},nativeKind:opaque?'opaque':'rule',parseStatus:opaque?'opaque':'supported'}:r);
}
