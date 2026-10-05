import test from 'node:test';
import assert from 'node:assert/strict';
import { prototype } from './prototype-harness.mjs';
const primary='cf-account-legacy', extra='cf-account-extra';
const json=(p,s)=>JSON.parse(p.run(`JSON.stringify(${s})`));
function connect(p,{account=extra,profile='normal',id,token='STACKPIER_DEMO_TOKEN_ONLY',name='新连接'}={}){
 p.click('cfconnect',id?{id}:{});p.submit('cfcheck',{'cf-name':name,'cf-target':account,'cf-profile':profile,'cf-token':token});p.flushTimers();
}
function save(p){p.submit('cfsave',{'cf-confirm':'on'});}
function edit(p,id='dns1',content='203.0.113.17'){
 p.click('dnsedit',{id});p.submit('dnsedit',{'dns-type':'A','dns-name':'api','dns-content':content,'dns-ttl':'300','dns-project':['p1','p5'],'network-ack':'on','outcome':'success'});
}
function operation(p,id='dns1',outcome='success'){
 return p.run(`(()=>{const r=clone(S.dns.find(r=>r.id===${JSON.stringify(id)}));r.content='203.0.113.18';return cloudflareNetworkOperation('upsert',r,${JSON.stringify(outcome)},cfTarget(r))?.id})()`);
}
function finish(p,id,outcome='success'){p.run(`finishOperation(S.operations.find(o=>o.id===${JSON.stringify(id)}),${JSON.stringify(outcome)})`);}

test('增量迁移保留原 DNS ID、用户编辑及其他模块，反复迁移无重复',()=>{
 const old=prototype();const original=json(old,'S');delete original.cloudflare;original.version=42;original.settings.cfName='用户旧账号';original.dns=original.dns.filter(r=>r.id!=='dns-demo-readonly');original.dns[0].content='203.0.113.88';original.operations.unshift({id:'old-dns-op',kind:'network',status:'unknown',label:'旧 DNS 修改',input:{netType:'dns',record:{id:'dns1'}},steps:[],resources:[],message:'旧历史'});
 const modules=['servers','projects','templates','programs','frp'];const preserved=Object.fromEntries(modules.map(k=>[k,JSON.stringify(original[k])]));
 const p=prototype(JSON.stringify(original));assert.equal(p.run('S.version'),42);assert.equal(p.run('S.dns.find(r=>r.id==="dns1").content'),'203.0.113.88');assert.equal(p.run('cfAccountName("cf-account-legacy")'),'用户旧账号');assert.equal(p.run('S.operations.find(o=>o.id==="old-dns-op").input.cfNeedsReview'),true);
 for(const k of modules)assert.equal(p.run(`JSON.stringify(S.${k})`),preserved[k],k);
 const before=p.run('JSON.stringify(S.cloudflare)');p.run('migrateCloudflare(S);migrateCloudflare(S)');assert.equal(p.run('JSON.stringify(S.cloudflare)'),before);assert.equal(p.run('S.dns.length'),5);
 const reloaded=prototype(p.saved());assert.equal(reloaded.run('S.dns.find(r=>r.id==="dns1").accountId'),primary);
});

test('清空列表、移除连接与删除示例后刷新不重新填充',()=>{
 const p=prototype();p.run('S.dns=[];S.cloudflare.connections.forEach(c=>c.removedAt=now());persist()');const r=prototype(p.saved());assert.equal(r.run('S.dns.length'),0);assert.equal(r.run('S.cloudflare.connections.filter(c=>!c.removedAt).length'),0);
});

test('任意凭据输入不进入持久化、历史、导出或内存候选，只有固定演示引用可保存',()=>{
 const p=prototype(),canary='fake-private-input-must-not-persist';connect(p,{token:canary});assert.ok(!p.saved().includes(canary));assert.ok(!p.run('JSON.stringify(S.operations)').includes(canary));assert.ok(!p.run('notesText()').includes(canary));assert.equal(p.document.getElementById('cf-token').value,'');assert.equal(p.run('ui.modal.candidate'),undefined);
 connect(p);save(p);assert.ok(!p.saved().includes('STACKPIER_DEMO_TOKEN_ONLY'));assert.ok(p.run('!!cfCurrent("cf-account-extra")'));
});

test('选择一个账号，重复 Account ID 引导更新，名称不会改变稳定身份',()=>{
 const p=prototype();connect(p);save(p);const count=p.run('S.cloudflare.connections.length'),c=json(p,'cfCurrent("cf-account-extra")');connect(p);assert.match(p.html('modal'),/此账号已有当前连接/);save(p);assert.equal(p.run('S.cloudflare.connections.length'),count);
 p.click('cfrename',{id:c.id});p.submit('cfrename',{'cf-name':'与旧账号重名也可用'});assert.equal(p.run('cfCurrent("cf-account-extra").id'),c.id);assert.equal(p.run('cfCurrent("cf-account-extra").accountId'),extra);
});

test('只读与分 Zone 权限、失效、DNS 读取不足分别阻止写入',()=>{
 const p=prototype();assert.equal(p.run('cfAccess("cf-zone-readonly").ok'),true);assert.equal(p.run('cfAccess("cf-zone-readonly",true).ok'),false);assert.equal(operation(p,'dns-demo-readonly'),undefined);
 p.run('const c=cfCurrent("cf-account-legacy");c.check=cfProbe("mixed",S.cloudflare.zones.filter(z=>z.accountId===c.accountId))');assert.equal(p.run('cfAccess(S.dns[0].zoneId,true).ok'),true);assert.equal(p.run('cfAccess(S.dns[2].zoneId,true).ok'),false);
 for(const profile of ['invalid','denied','dnsdenied','network','nozones']){p.run(`c.check=cfProbe(${JSON.stringify(profile)},S.cloudflare.zones.filter(z=>z.accountId===c.accountId))`);assert.equal(operation(p),undefined,profile);}
});

test('编辑不能隐式移动账号或 Zone，提交前重新校验修订',()=>{
 const p=prototype();edit(p);const id=p.run('cfCurrent("cf-account-legacy").id');p.run('cfCurrent("cf-account-legacy").credentialRevision++');p.submit('dnscommit',{'dns-confirm':'on','shared-ack':'on'});assert.match(p.document.getElementById('modal-error').textContent,/修订|失效/);assert.equal(p.run('S.dns[0].content'),'198.51.100.20');
 p.run('cfCurrent("cf-account-legacy").credentialRevision--');assert.equal(p.run('cloudflareNetworkOperation("upsert",{...S.dns[0],accountId:"cf-account-readonly",zoneId:"cf-zone-readonly"},"success",cfTarget(S.dns[0]))'),null);assert.equal(p.run('cfConnection('+JSON.stringify(id)+').accountId'),primary);
});

test('更新失败保留旧连接，成功增加凭据修订且范围缩小保留不可访问记录',()=>{
 const p=prototype(),c=json(p,'cfCurrent("cf-account-legacy")');const before=p.run('JSON.stringify([S.dns,S.projects])');connect(p,{account:primary,id:c.id,profile:'network'});save(p);assert.equal(p.run('cfConnection('+JSON.stringify(c.id)+').credentialRevision'),1);assert.equal(p.run('JSON.stringify([S.dns,S.projects])'),before);
 connect(p,{account:primary,id:c.id,profile:'limited'});save(p);assert.equal(p.run('cfConnection('+JSON.stringify(c.id)+').credentialRevision'),2);assert.equal(p.run('JSON.stringify([S.dns,S.projects])'),before);assert.equal(p.run('cfAccess(S.dns.find(r=>r.id==="dns3").zoneId).ok'),false);
 const after=p.run('JSON.stringify(S.cloudflare)');connect(p,{account:extra,id:c.id});save(p);assert.equal(p.run('JSON.stringify(S.cloudflare)'),after);
});

test('操作异步返回只写提交时账号，成功与传播区分，重复终态不重放',()=>{
 const p=prototype(),id=operation(p);p.run('ui.cfAccount="cf-account-readonly";ui.zone="cf-zone-readonly"');const readonly=p.run('JSON.stringify(S.dns.find(r=>r.id==="dns-demo-readonly"))');finish(p,id);assert.equal(p.run('S.dns.find(r=>r.id==="dns1").content'),'203.0.113.18');assert.equal(p.run('JSON.stringify(S.dns.find(r=>r.id==="dns-demo-readonly"))'),readonly);assert.equal(p.run('S.dns.find(r=>r.id==="dns1").propagation'),'unverified');const before=p.run('JSON.stringify(S.dns)');finish(p,id);assert.equal(p.run('JSON.stringify(S.dns)'),before);
});

test('未知结果阻止移除和覆盖，读取核对不会新增修改操作',()=>{
 const p=prototype(),id=operation(p,'dns1','unknown'),c=p.run('cfCurrent("cf-account-legacy").id');finish(p,id,'unknown');assert.match(p.run(`cfRemoveConnection(${JSON.stringify(c)})`),/结果未知/);assert.equal(operation(p),undefined);const count=p.run('S.operations.length');p.click('verifyop',{id});p.submit('verifyop',{'verify-result':'success','verify-evidence':'on'});assert.equal(p.run('S.operations.length'),count);assert.equal(p.run('S.operations.find(o=>o.id==='+JSON.stringify(id)+').status'),'success');assert.equal(p.run('S.dns.find(r=>r.id==="dns1").content'),'203.0.113.18');
});

test('读取核对失败保持未知，确认结束不伪造 DNS 成功',()=>{
 const p=prototype(),id=operation(p,'dns1','unknown');finish(p,id,'unknown');p.run('cfCurrent("cf-account-legacy").check.valid=false');p.click('verifyop',{id});p.submit('verifyop',{'verify-result':'success','verify-evidence':'on'});assert.equal(p.run('S.operations.find(o=>o.id==='+JSON.stringify(id)+').status'),'unknown');p.submit('verifyop',{'verify-result':'ended-unknown','verify-evidence':'on'});assert.equal(p.run('S.operations.find(o=>o.id==='+JSON.stringify(id)+').protectionReleased'),true);assert.equal(p.run('S.dns[0].content'),'198.51.100.20');
});

test('移除只断开管理连接，保留 DNS、项目和历史，卸载清理也检查 Zone 权限',()=>{
 const p=prototype();const before=p.run('JSON.stringify([S.dns,S.projects,S.operations])');assert.equal(p.run('cfRemoveConnection(cfCurrent("cf-account-legacy").id)'), '');assert.equal(p.run('JSON.stringify([S.dns,S.projects,S.operations])'),before);assert.equal(p.run('cfAccess(S.dns[0].zoneId).ok'),false);
 assert.match(p.run('prepareDnsCleanup({dnsIds:["dns1"]})'),/没有写权限/);
});

test('刷新中断保留固定身份且转为未知，明确失败不改写原记录',()=>{
 const p=prototype(),id=operation(p);const target=p.run('JSON.stringify(S.operations.find(o=>o.id==='+JSON.stringify(id)+').input.cfTarget)');const r=prototype(p.saved());assert.equal(r.run('S.operations.find(o=>o.id==='+JSON.stringify(id)+').status'),'unknown');assert.equal(r.run('JSON.stringify(S.operations.find(o=>o.id==='+JSON.stringify(id)+').input.cfTarget)'),target);finish(r,id,'failed');assert.equal(r.run('S.dns[0].content'),'198.51.100.20');
});

test('检查期间取消或重复点击不保存候选连接',()=>{
 const p=prototype(),before=p.run('JSON.stringify(S.cloudflare)');p.click('cfconnect');p.submit('cfcheck',{'cf-name':'不保存','cf-target':extra,'cf-profile':'normal','cf-token':'STACKPIER_DEMO_TOKEN_ONLY'});p.submit('cfcheck',{'cf-name':'不保存','cf-target':extra,'cf-profile':'normal','cf-token':'STACKPIER_DEMO_TOKEN_ONLY'});p.click('closemodal');p.flushTimers();assert.equal(p.run('JSON.stringify(S.cloudflare)'),before);assert.equal(p.run('ui.modal'),null);
});

test('旧未知操作释放保护后迟到核对不覆盖后续确认的记录',()=>{
 const p=prototype(),old=operation(p,'dns1','unknown');finish(p,old,'unknown');p.run('S.operations.find(o=>o.id==='+JSON.stringify(old)+').protectionReleased=true');const newer=operation(p);finish(p,newer);const before=p.run('JSON.stringify(S.dns)');p.run('finishCloudflareOperation(S.operations.find(o=>o.id==='+JSON.stringify(old)+'),"success",{reconcile:true})');assert.equal(p.run('JSON.stringify(S.dns)'),before);assert.equal(p.run('S.operations.find(o=>o.id==='+JSON.stringify(old)+').status'),'unknown');
});

test('旧卸载操作没有 DNS 固定身份时禁止清理，归属与保护保持可追溯',()=>{
 const p=prototype();assert.match(p.run('dnsCleanupError({dnsIds:["dns1"]})'),/待核对/);const input={dnsIds:['dns1']};p.run('const cleanupInput='+JSON.stringify(input)+';prepareDnsCleanup(cleanupInput)');assert.equal(p.run('dnsCleanupError(cleanupInput)'),'');p.run('S.dns[0].accountId="cf-account-readonly"');assert.match(p.run('dnsCleanupError(cleanupInput)'),/归属/);
});
