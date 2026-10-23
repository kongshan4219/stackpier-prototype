import test from 'node:test';
import assert from 'node:assert/strict';
import { prototype } from './prototype-harness.mjs';

const transfer={format:'stackpier-port-rules',version:1,rules:[{protocol:'tcp+udp',port:'9100-9110',family:'ipv4',source:'198.51.100.0/24',action:'allow',description:'虚构端口'}]};
test('端口页面只列选定服务器的主机入站规则，SSH 管理规则受保护',()=>{
 const a=prototype();a.click('navigate',{page:'firewall'});assert.equal(a.run('firewallPortRules().length'),0);a.run("ui.server='s1';render()");assert.ok(a.run("firewallPortRules().every(r=>r.server==='s1'&&(!r.direction||r.direction==='in')&&(!r.scope||r.scope==='host'))"));assert.match(a.html('app'),/使用状态/);assert.match(a.html('app'),/SSH 管理通路/);assert.equal(a.run("firewallProtected({server:'s1',port:'20-30',protocol:'TCP',action:'allow'})"),true);
 a.run("S.firewalls=Array.from({length:12},(_,i)=>({id:'page-'+i,server:'s4',protocol:'TCP',port:String(9000+i),address:'0.0.0.0/0',action:'allow',direction:'in',scope:'host',projects:[],protected:i===0}));ui.server='s4';ui.fwPage=1;ui.fwSelected=[]");a.click('fw-select-page');assert.equal(a.run('ui.fwSelected.length'),9);assert.equal(a.run("ui.fwSelected.includes('page-10')"),false);a.run('ui.fwPage=2');a.click('fw-select-page');assert.equal(a.run('ui.fwSelected.length'),11);
});
test('导入整体确认与固定服务器，模拟成功后一次生效',()=>{
 const a=prototype();a.run("ui.server='s4'");a.click('fw-import');a.submit('fw-import',{'fw-import-json':JSON.stringify(transfer)});assert.equal(a.run('ui.modal.kind'),'fw-batch-confirm');a.submit('fw-batch-confirm',{'fw-batch-ack':'on',outcome:'success'});assert.match(a.document.getElementById('modal-error').textContent,/确认/);assert.equal(a.run('S.operations.some(o=>o.status==="running")'),false);
 a.run("ui.server='s1'");a.submit('fw-batch-confirm',{'fw-batch-ack':'on','fw-runtime':'on',outcome:'success'});assert.equal(a.run('S.operations[0].input.serverTarget.id'),'s4');a.run('finishOperation(S.operations[0],"success")');assert.equal(a.run('S.firewalls.some(r=>r.server==="s4"&&r.port==="9100-9110")'),true);
});
test('批量删除漂移不部分生效，目标变化不导入到其他服务器',()=>{
 const a=prototype();a.run(`var records=firewallParseImport(${JSON.stringify(JSON.stringify(transfer))},'s4');S.firewalls.push(...records);var input={netType:'firewall',action:'port-batch',mode:'delete',records:clone(records),before:clone(records),targetId:'s4',serverTarget:serverOperationSnapshot('s4')};S.firewalls.find(r=>r.id===records[0].id).description='外部改变';`);assert.throws(()=>a.run('applyNetwork(input)'));assert.equal(a.run('S.firewalls.some(r=>r.id===records[0].id)'),true);
 a.run("input.mode='add';sr('s4').host='192.0.2.250'");assert.throws(()=>a.run('applyNetwork(input)'));
});
test('导入拒绝未知字段、版本、重复项和 SSH 拒绝规则',()=>{
 const a=prototype();for(const bad of [{...transfer,version:2},{...transfer,command:'flush'},{...transfer,rules:[...transfer.rules,...transfer.rules]},{...transfer,rules:[{...transfer.rules[0],protocol:'tcp',port:'22',action:'deny'}]}])assert.throws(()=>a.run(`firewallParseImport(${JSON.stringify(JSON.stringify(bad))},'s1')`));
});
