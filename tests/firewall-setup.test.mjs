import test from 'node:test';
import assert from 'node:assert/strict';
import { prototype } from './prototype-harness.mjs';

const scene=id=>{const a=prototype();a.click('loadscene',{id:'firewall-'+id});return a;};
test('唯一入口为 firewalld，待迁移服务器不开放端口写入',()=>{
 const a=scene('migrate');assert.equal(a.run("firewallHost(ui.server).state"),'needs-setup');assert.match(a.html('app'),/迁移到 firewalld/);assert.doesNotMatch(a.html('app'),/防火墙后端/);
 a.click('firewalledit');a.submit('firewalledit',{'fw-server':'s2','fw-protocol':'TCP','fw-port':'8088','fw-family':'ipv4','fw-address':'0.0.0.0/0','fw-action':'allow','network-ack':'on'});assert.equal(a.run('ui.modal.kind'),'firewalledit');assert.equal(a.run("S.operations.some(o=>o.status==='running')"),false);
});
test('刷新只读盘点，安装预览取消不产生操作或改动规则',()=>{
 const a=scene('install');a.run('var before=JSON.stringify(S.firewalls),count=S.operations.length');a.click('fw-refresh');assert.equal(a.run('S.operations.length'),a.run('count'));assert.equal(a.run("firewallHost('s4').manager"),'未安装');
 a.click('fw-setup',{server:'s4'});assert.match(a.html('modal'),/Python \/ D-Bus/);assert.equal(a.document.getElementById('fw-initial-policy').value,'');assert.match(a.html('modal'),/不会预选/);assert.match(a.html('modal'),/Docker/);assert.doesNotMatch(a.html('modal'),/name="outcome"/);a.click('closemodal');assert.equal(a.run('JSON.stringify(S.firewalls)'),a.run('before'));assert.equal(a.run('S.operations.length'),a.run('count'));
});
test('迁移固定服务器，成功保留全部规则并开放持久管理',()=>{
 const a=scene('migrate');a.run('var before=JSON.stringify(S.firewalls)');a.click('fw-setup',{server:'s2'});a.run("ui.server='s1'");a.submit('fw-setup',{'fw-setup-ack':'on'});assert.equal(a.run('S.operations[0].input.serverTarget.id'),'s2');assert.equal(a.run("firewallHost('s2').state"),'pending');assert.match(a.run("firewallWriteError('s2')"),/未完成/);
 a.click('finishdemo',{id:a.run('S.operations[0].id')});assert.equal(a.run("firewallHost('s2').state"),'ready');assert.equal(a.run("firewallHost('s2').backend"),'nftables');assert.equal(a.run('JSON.stringify(S.firewalls)'),a.run('before'));assert.equal(a.run('S.operations[0].protectionReleased'),true);
 a.click('closemodal');a.run("ui.server='s2';render()");assert.match(a.html('app'),/持久化规则/);assert.doesNotMatch(a.html('app'),/仅修改当前运行态/);
});
test('接入条件不足显示具体原因，不能创建操作',()=>{
 const a=scene('blocked');a.click('fw-setup',{server:'s3'});assert.match(a.html('modal'),/OpenRC/);assert.match(a.html('modal'),/无法等价转换/);assert.doesNotMatch(a.html('modal'),/type="submit"/);a.submit('fw-setup',{'fw-setup-ack':'on'});assert.equal(a.run("S.operations.some(o=>o.input?.action==='setup')"),false);
});
test('过期、服务器变化或规则漂移使固定预览失效',()=>{
 for(const change of ["ui.modal.plan.expires='2000-01-01T00:00:00Z'","sr('s2').host='192.0.2.99'","S.firewalls.find(r=>r.server==='s2').port='9999'"]){const a=scene('migrate');a.click('fw-setup',{server:'s2'});a.run(change);a.submit('fw-setup',{'fw-setup-ack':'on'});assert.equal(a.run("S.operations.some(o=>o.input?.action==='setup')"),false);assert.match(a.document.getElementById('modal-error').textContent,/过期|变化/);}
});
test('失败恢复原状态，原失败记录与外部软件规则保留',()=>{
 const a=scene('failed');assert.equal(a.run('S.operations[0].status'),'failed');assert.equal(a.run('S.operations[0].protectionReleased'),true);assert.equal(a.run("firewallHost('s2').manager"),'UFW');assert.match(a.html('modal'),/恢复原配置与服务状态/);assert.equal(a.run("S.firewalls.some(r=>r.scope==='container')"),true);
});
test('未知核对不会重放，缺少证据保留保护，明确恢复沿原操作',()=>{
 const a=scene('unknown'),id=a.run('S.operations[0].id'),count=a.run('S.operations.length');a.click('fw-setup-inspect',{id});assert.equal(a.run('S.operations[0].status'),'unknown');assert.equal(a.run('S.operations[0].protectionReleased'),false);assert.equal(a.run('S.operations.length'),count);
 a.click('fw-setup-recover',{id});a.submit('fw-setup-recover',{'fw-recover-ack':'on'});assert.equal(a.run('S.operations[0].id'),id);assert.equal(a.run('S.operations[0].status'),'rolled-back');assert.equal(a.run("firewallHost('s2').manager"),'UFW');assert.equal(a.run('S.operations[0].protectionReleased'),true);
});
test('原操作取得新证据可确认成功，刷新继续保留未知操作',()=>{
 const a=scene('recheck'),id=a.run('S.operations[0].id');a.click('fw-setup-inspect',{id});assert.equal(a.run('S.operations[0].status'),'success');assert.equal(a.run("firewallHost('s2').state"),'ready');
 const b=scene('pending');b.run('persist()');const c=prototype(b.saved());assert.equal(c.run('S.operations[0].status'),'unknown');assert.ok(c.run("firewallWriteError('s2')"));c.run("ui.page='firewall';ui.server='s2';render()");assert.match(c.html('app'),/查看原操作/);
});
test('外部漂移后的恢复不能盲目覆盖',()=>{
 const a=scene('unknown'),id=a.run('S.operations[0].id');a.run("S.firewalls.find(r=>r.server==='s2').description='外部更新'");a.click('fw-setup-recover',{id});a.submit('fw-setup-recover',{'fw-recover-ack':'on'});assert.equal(a.run('S.operations[0].status'),'unknown');assert.equal(a.run("S.firewalls.find(r=>r.server==='s2').description"),'外部更新');assert.equal(a.run('S.operations[0].protectionReleased'),false);
});
test('读取失败保留旧采集时间与规则，不能写入或迁移',()=>{
 const a=scene('read-error');a.run("var oldTime=firewallHost('s2').captured,oldRules=JSON.stringify(S.firewalls)");a.click('fw-refresh');assert.equal(a.run("firewallHost('s2').captured"),a.run('oldTime'));assert.equal(a.run('JSON.stringify(S.firewalls)'),a.run('oldRules'));assert.ok(a.run("firewallWriteError('s2')"));
});
test('新机器初始策略不预选，选择后固定到预览与成功状态',()=>{
 const a=scene('install');a.click('fw-setup',{server:'s4'});a.submit('fw-setup',{});assert.match(a.document.getElementById('modal-error').textContent,/明确选择/);assert.equal(a.run("S.operations.some(o=>o.input?.action==='setup')"),false);
 a.submit('fw-setup',{'fw-initial-policy':'REJECT'});assert.equal(a.run('ui.modal.plan.currentPolicy'),'ACCEPT');assert.equal(a.run('ui.modal.plan.targetPolicy'),'REJECT');assert.match(a.html('modal'),/目标入站默认策略/);assert.equal(a.document.querySelectorAll('[name=fw-setup-ack]')[0].checked,false);
 a.submit('fw-setup',{'fw-setup-ack':'on'});a.click('finishdemo',{id:a.run('S.operations[0].id')});assert.equal(a.run("firewallHost('s4').defaultPolicy"),'REJECT');assert.equal(a.run('S.operations[0].input.plan.targetPolicy'),'REJECT');
});
test('既有策略保持不变，预览后策略变化阻止切换',()=>{
 const a=scene('migrate');a.click('fw-setup',{server:'s2'});assert.equal(a.run('ui.modal.plan.currentPolicy'),'DROP');assert.equal(a.run('ui.modal.plan.targetPolicy'),'DROP');a.run("firewallHost('s2').defaultPolicy='ACCEPT'");a.submit('fw-setup',{'fw-setup-ack':'on'});assert.match(a.document.getElementById('modal-error').textContent,/变化/);assert.equal(a.run("S.operations.some(o=>o.input?.action==='setup')"),false);
});
test('多个 Zone 不默认选 public，端口写入绑定已选择的作用范围',()=>{
 const a=scene('ready');a.run("firewallHost('s2').zones.push({name:'internal',interfaces:['eth1'],sources:['198.51.100.0/24'],target:'DROP'})");a.click('firewalledit');assert.equal(a.document.getElementById('fw-zone').value,'');
 const fields={'fw-server':'s2','fw-protocol':'TCP','fw-port':'8443','fw-family':'ipv4','fw-address':'198.51.100.0/24','fw-action':'allow','network-ack':'on'};
 a.submit('firewalledit',fields);assert.match(a.document.getElementById('modal-error').textContent,/Zone/);a.submit('firewalledit',{...fields,'fw-zone':'internal'});assert.equal(a.run('ui.modal.record.zone'),'internal');assert.match(a.html('modal'),/internal/);assert.doesNotMatch(a.html('modal'),/fw-runtime|name="outcome"/);
});
test('导入按选定 Zone 判断重复，另一个 Zone 的同样规则可独立维护',()=>{
 const a=scene('multi-zone');a.run("var existing=firewallHostRules('s2')[0],transfer=JSON.stringify({format:'stackpier-port-rules',version:1,rules:[firewallTransferRule(existing)]})");assert.throws(()=>a.run("firewallParseImport(transfer,'s2','public')"));assert.equal(a.run("firewallParseImport(transfer,'s2','internal')[0].zone"),'internal');
});
