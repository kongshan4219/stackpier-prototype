import test from 'node:test';
import assert from 'node:assert/strict';
import { prototype } from './prototype-harness.mjs';

const scene=id=>{const a=prototype();a.click('loadscene',{id:'firewall-'+id});return a;};
const spec={protocol:'tcp',port:'8443',family:'ipv4',source:'198.51.100.0/24',action:'allow',description:'Zone 固定测试'};
const transfer=JSON.stringify({format:'stackpier-port-rules',version:1,rules:[spec]});
function preview(kind){
 const a=scene('multi-zone');
 if(kind==='import'){a.click('fw-import');a.submit('fw-import',{'fw-import-zone':'internal','fw-import-json':transfer});}
 else if(kind==='batch-delete'){a.click('fw-select',{id:'fw3'});a.click('fw-batch-delete');}
 else if(kind==='delete')a.click('firewalldelete',{id:'fw3'});
 else{a.click('firewalledit',kind==='edit'?{id:'fw3'}:{});a.submit('firewalledit',{'fw-server':'s2','fw-zone':kind==='edit'?'public':'internal','fw-protocol':'TCP','fw-port':'8443','fw-family':'ipv4','fw-address':'198.51.100.0/24','fw-action':'allow','network-ack':'on'});}
 return a;
}
function submit(a,kind){
 if(['import','batch-delete'].includes(kind))a.submit('fw-batch-confirm',{'fw-batch-ack':'on'});
 else if(kind==='delete')a.submit('networkdelete',{'delete-ack':'on'});
 else a.submit('firewallcommit',{'fw-confirm':'on'});
}
test('新机器每种选择都固定到真实 Zone target，结果与策略摘要一致',()=>{
 for(const policy of ['ACCEPT','DROP','REJECT']){
  const a=scene('install');a.click('fw-setup',{server:'s4'});a.submit('fw-setup',{'fw-initial-policy':policy});assert.equal(a.run('ui.modal.plan.zones[0].target'),policy);assert.match(a.html('modal'),new RegExp('目标策略 '+policy));
  a.submit('fw-setup',{'fw-setup-ack':'on'});a.click('finishdemo',{id:a.run('S.operations[0].id')});assert.equal(a.run("firewallHost('s4').zones[0].target"),policy);assert.equal(a.run("firewallHost('s4').defaultPolicy"),policy);
 }
});
test('已有 firewalld 迁移保留各 Zone target，包括 default 的独立语义',()=>{
 const a=scene('multi-zone');a.run("Object.assign(firewallHost('s2'),{state:'needs-setup',backend:'iptables'});firewallHost('s2').zones[0].target='default';firewallHost('s2').zones[1].target='ACCEPT'");a.click('fw-setup',{server:'s2'});assert.equal(a.run('ui.modal.plan.currentPolicy'),'按各 Zone 保留');assert.deepEqual(JSON.parse(a.run('JSON.stringify(ui.modal.plan.zones.map(zone=>zone.target))')),['default','ACCEPT']);assert.match(a.html('modal'),/原策略 default → 目标策略 default/);
 a.submit('fw-setup',{'fw-setup-ack':'on'});a.click('finishdemo',{id:a.run('S.operations[0].id')});assert.deepEqual(JSON.parse(a.run("JSON.stringify(firewallHost('s2').zones.map(zone=>zone.target))")),['default','ACCEPT']);
});
test('导入及批量删除确认和操作历史展示固定 Zone',()=>{
 for(const kind of ['import','batch-delete']){
  const a=preview(kind),zone=kind==='import'?'internal':'public';assert.match(a.html('modal'),new RegExp(zone));submit(a,kind);assert.match(a.html('modal'),new RegExp(zone));
  a.run("firewallHost('s2').zones=[]");a.click('opdetail',{id:a.run('S.operations[0].id')});assert.match(a.html('modal'),new RegExp(zone));
 }
});
test('单条和批量端口预览后 Zone 或管理配置变化拒绝受理',()=>{
 for(const kind of ['add','edit','delete','import','batch-delete']){
  const a=preview(kind);a.run("firewallHost('s2').zones[0].interfaces=['eth99']");submit(a,kind);assert.equal(a.run("S.operations.some(o=>o.status==='running')"),false,kind);assert.match(a.document.getElementById('modal-error').textContent,/管理配置或 Zone/,kind);
 }
});
test('单条和批量执行中管理器漂移保留未知，核对成功也不能越过快照',()=>{
 for(const kind of ['add','edit','delete','import','batch-delete']){
  const a=preview(kind);a.run('var rulesBefore=JSON.stringify(S.firewalls)');submit(a,kind);const id=a.run('S.operations[0].id');a.run("Object.assign(firewallHost('s2'),{state:'needs-setup',manager:'UFW'})");a.click('finishdemo',{id});assert.equal(a.run('S.operations[0].status'),'unknown',kind);assert.equal(a.run('JSON.stringify(S.firewalls)'),a.run('rulesBefore'),kind);
  a.click('verifyop',{id});a.submit('verifyop',{'verify-result':'success','verify-evidence':'on'});assert.equal(a.run('S.operations[0].status'),'unknown',kind);assert.equal(a.run('JSON.stringify(S.firewalls)'),a.run('rulesBefore'),kind);
 }
});
test('受理后目标 Zone 消失时不能产生指向无效 Zone 的规则',()=>{
 const a=preview('import');submit(a,'import');a.run("firewallHost('s2').zones=firewallHost('s2').zones.filter(zone=>zone.name!=='internal')");a.click('finishdemo',{id:a.run('S.operations[0].id')});assert.equal(a.run('S.operations[0].status'),'unknown');assert.equal(a.run("S.firewalls.some(rule=>rule.port==='8443')"),false);
});
test('跨 Zone 导出被阻止，单 Zone 文件可以导入另一明确目标',()=>{
 const a=scene('multi-zone');a.run("var original=firewallHostRules('s2')[0];S.firewalls.push({...clone(original),id:'second-zone',zone:'internal'})");assert.throws(()=>a.run("firewallExportSelection(firewallHostRules('s2'))"),/仅支持一个明确 Zone/);
 a.run("var exported=firewallExportSelection(firewallHostRules('s2').filter(rule=>rule.zone==='internal'))");assert.equal(a.run('exported.zone'),'internal');assert.equal(a.run("firewallParseImport(JSON.stringify(exported.file),'s4','public').length"),1);
});
test('旧存储没有统一观测时不自动成为 ready，规则和历史保持',()=>{
 const a=prototype();a.run('var oldRules=JSON.stringify(S.firewalls),oldOperations=JSON.stringify(S.operations);delete S.firewallHosts;persist()');const b=prototype(a.saved());assert.equal(b.run("firewallHost('s1').state"),'unknown');assert.equal(b.run("firewallHost('s4').state"),'unknown');assert.ok(b.run("firewallWriteError('s1')"));assert.equal(b.run('JSON.stringify(S.firewalls)'),a.run('oldRules'));assert.equal(b.run('JSON.stringify(S.operations)'),a.run('oldOperations'));assert.equal(prototype().run("firewallHost('s1').state"),'ready');
});
test('现有管理器列表标记 UFW 和只读，不显示已持久化接入',()=>{
 const a=scene('migrate');assert.match(a.html('app'),/>UFW</);assert.match(a.html('app'),/原规则 · 只读/);assert.doesNotMatch(a.html('app'),/持久化规则/);
});
test('未知或已消失 Zone 规则只读，直接编辑删除与旧批量选择不泄露异常',()=>{
 for(const zone of ['', 'removed-zone']){
  const a=scene('multi-zone');a.run(`S.firewalls.find(rule=>rule.id==='fw3').zone=${JSON.stringify(zone)};render()`);assert.match(a.html('app'),/Zone 待核对 · 只读/);assert.equal(a.document.querySelector('[data-action="fw-select"][data-id="fw3"]').disabled,true);
  a.click('fw-select-page');assert.equal(a.run("(ui.fwSelected||[]).includes('fw3')"),false);a.click('fw-select',{id:'fw3'});assert.equal(a.run("(ui.fwSelected||[]).includes('fw3')"),false);
  for(const action of ['firewalledit','firewalldelete']){assert.doesNotThrow(()=>a.click(action,{id:'fw3'}));assert.match(a.html('modal'),/Zone 尚未明确或已不在当前观测中/);assert.doesNotMatch(a.html('modal'),/type="submit"/);a.click('closemodal');}
  a.run("ui.fwSelected=['fw3']");assert.doesNotThrow(()=>a.click('fw-batch-delete'));assert.equal(a.run("ui.modal?.kind==='fw-batch-confirm'"),false);assert.equal(a.run("S.operations.some(operation=>operation.status==='running')"),false);
 }
});
test('显式但已不存在的单 Zone 不能导出',()=>{
 const a=scene('multi-zone');a.run("S.firewalls.find(rule=>rule.id==='fw3').zone='removed-zone';ui.fwSelected=['fw3']");assert.throws(()=>a.run("firewallExportSelection([S.firewalls.find(rule=>rule.id==='fw3')])"),/未知作用范围/);assert.doesNotThrow(()=>a.click('fw-export'));
});
test('任一入站规则无法映射已核实 Zone 时阻止迁移与成功完成',()=>{
 for(const zone of ['', 'removed-zone']){
  const a=scene('multi-zone');a.run(`Object.assign(firewallHost('s2'),{state:'needs-setup',backend:'iptables'});S.firewalls.find(rule=>rule.id==='fw3').zone=${JSON.stringify(zone)}`);a.click('fw-setup',{server:'s2'});assert.match(a.html('modal'),/未能唯一确定 Zone 归属/);assert.doesNotMatch(a.html('modal'),/type="submit"/);a.submit('fw-setup',{'fw-setup-ack':'on'});assert.equal(a.run("S.operations.some(operation=>operation.input?.action==='setup')"),false);assert.equal(a.run("firewallHost('s2').state"),'needs-setup');
 }
});
