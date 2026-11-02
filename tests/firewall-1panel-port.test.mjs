import test from 'node:test';
import assert from 'node:assert/strict';
import {normalize,parseImport,seed} from '../src/antd/firewall-port/model.js';
import {isValidIPOrCIDR,normalizePortRange} from '../src/antd/firewall-port/validation.ts';
test('上游校验：双栈 CIDR 与端口边界',()=>{
 for(const ip of ['192.0.2.1','192.0.2.0/24','2001:db8::/64','::ffff:192.0.2.1'])assert.equal(isValidIPOrCIDR(ip),true);
 for(const ip of ['999.2.3.4','2001:::1','192.0.2.1/33','::1/129'])assert.equal(isValidIPOrCIDR(ip),false);
 assert.equal(normalizePortRange('80:90'),'80-90');for(const p of ['0','65536','90-80','80;reboot'])assert.throws(()=>normalizePortRange(p));
});
test('来源、目标端口和协议的组合展开；编辑不接受复合规则',()=>{
 const input={protocol:'tcp/udp',sourceAddress:'192.0.2.1 2001:db8::1',destinationPort:'80,443',action:'accept'};
 assert.equal(normalize('system',input).length,8);
 assert.throws(()=>normalize('system',input,'firewalld',true));
 assert.throws(()=>normalize('system',{...input,destinationPort:Array.from({length:126},(_,i)=>String(i+1)).join(',')}));
});
test('转发空目标映射对应族回环；拒绝族不匹配和非法接口',()=>{
 const input={family:'ipv6',protocol:'tcp',port:'8080',targetPort:'80',targetIP:''};
 assert.equal(normalize('forwarding',input)[0].targetIP,'::1');
 assert.throws(()=>normalize('forwarding',{...input,targetIP:'192.0.2.1'}));
 assert.throws(()=>normalize('forwarding',{...input,interface:'eth0;id'}));
});
test('导入在提交前拒绝错误 JSON、端口与批次上限',()=>{
 assert.throws(()=>parseImport('system','{}','firewalld'));
 assert.throws(()=>parseImport('system','[{"protocol":"tcp","destinationPort":"0","action":"accept"}]','firewalld'));
 const r=seed().forwarding[0];assert.throws(()=>parseImport('forwarding',JSON.stringify(Array(501).fill(r))));
 assert.equal(parseImport('system','[{"protocol":"tcp","destinationPort":"8081","action":"accept"}]','firewalld').length,1);
});
test('虚构服务器状态独立；Docker 来源策略要求有效地址',()=>{
 const a=seed(),b=seed('ufw');a.rules.splice(0);assert.equal(b.rules.length,4);
 assert.throws(()=>normalize('docker',{port:'8080',protocol:'tcp',mode:'allow_sources',sources:''}));
 assert.equal(normalize('docker',{port:'8080',protocol:'tcp',mode:'deny_all',sources:''}).length,1);
});
