import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';
import {readyServices} from './service-fixtures.mjs';

test('三个类型筛选各自配置，不允许跨类型提交',()=>{
 for(const type of ['compose','systemd','frp']){
  const p=prototype();p.click('newproject');p.click('deployment-type',{type});
  const options=p.html('modal').match(/<select id="np-template"[^>]*>(.*?)<\/select>/s)[1];
  for(const t of p.run('S.templates'))assert.equal(options.includes('value="'+t.id+'"'),(t.frpRole?'frp':t.type)===type);
  assert.equal((p.html('modal').match(/name="np-/g)||[]).length,3);
 }
 const p=prototype();p.click('newproject');p.click('deployment-type',{type:'compose'});p.submit('newproject',{'np-template':'t1','np-server':'s4','np-name':'qa-type'});assert.match(p.document.getElementById('modal-error').textContent,/类型不匹配/);
});
test('无配置时阻止预览，创建后返回部署并恢复输入',()=>{
 const p=prototype();p.run('S.templates=S.templates.filter(t=>t.type!=="compose");');p.click('newproject');p.click('deployment-type',{type:'compose'});
 assert.match(p.html('modal'),/尚无此类型/);assert.equal(p.document.querySelector('button[type="submit"]').disabled,true);
 p.document.getElementById('np-name').value='qa-nginx';p.document.getElementById('np-server').value='s4';p.click('deployment-config-manage');
 assert.equal(p.run('ui.page'),'templates');p.submit('templateedit',{'tpl-name':'QA Nginx','tpl-type':'compose','tpl-source':'services:\n  web:\n    image: example.test/nginx:demo','tpl-variables':'{"PORT":"8080"}'});
 assert.equal(p.run('ui.page'),'projects');assert.equal(p.document.getElementById('np-name').value,'qa-nginx');assert.equal(p.document.getElementById('np-server').value,'s4');assert.equal(p.run('tpl(ui.modal.template).variables'),'{"PORT":"8080"}');
 const restored=prototype(p.saved(),{hash:p.run('location.hash')});assert.equal(restored.document.getElementById('np-template').value,p.run('ui.modal.template'));
});
test('预览只读，配置变更要求重新预览，不接受旧项目副本',()=>{
 const p=prototype();p.click('newproject',{template:'t1',server:'s4'});p.run('ui.modal.projectConfig={source:"UNSAVED_BODY",projectLocal:true};');p.submit('newproject',{'np-template':'t1','np-server':'s4','np-name':'qa-fixed'});
 assert.equal(p.run('ui.modal.draft.cfg.source===tpl("t1").tpl'),true);assert.doesNotMatch(p.html('modal'),/data-action="deployment-adapt"/);
 const count=p.run('S.operations.length');p.run('tpl("t1").rev++;');p.click('deployment-preview-execute');assert.equal(p.run('S.operations.length'),count);assert.match(p.document.getElementById('modal-error').textContent,/配置已更新/);
});
test('清空已选配置后进入管理会新建配置',()=>{
 const p=prototype();p.click('newproject',{template:'t5',server:'s4'});p.document.getElementById('np-template').value='';p.click('deployment-config-manage');
 assert.equal(p.run('ui.modal.id'),undefined);assert.equal(p.run('ui.modal.initialType'),'compose');assert.equal(p.document.getElementById('tpl-name').value,'');
});
test('FRP 角色参数在配置管理保存，部署只引用固定值',()=>{
 const p=readyServices();p.click('templateedit',{id:'frp-template-server'});assert.ok(p.document.getElementById('fc-port'));
 p.submit('frpdeploymentconfig',{'fc-name':'QA FRPS 配置','fc-bind':'127.0.0.1','fc-port':'7790','fc-token':'DEMO_CONFIG_TOKEN'});
 assert.equal(p.run('tpl("frp-template-server").frpInputs.port'),7790);
 p.click('newproject',{template:'frp-template-server',server:'s4'});assert.doesNotMatch(p.html('modal'),/np-frp|fc-token|textarea/);
 p.submit('newproject',{'np-template':'frp-template-server','np-server':'s4','np-name':'qa-frps','np-frp-port':'9999'});assert.equal(p.run('ui.modal.draft.cfg.frpInputs.port'),7790);
});
test('取消配置编辑保留草稿但不修改保存配置或创建项目',()=>{
 const p=prototype();p.click('newproject',{template:'t5',server:'s4'});p.document.getElementById('np-name').value='qa-cancel';p.click('deployment-config-manage');
 const before=p.run('JSON.stringify([S.templates,S.projects,S.operations])');p.document.getElementById('tpl-source').value='UNSAVED_QA_BODY';p.click('deployment-config-return');
 assert.equal(p.run('JSON.stringify([S.templates,S.projects,S.operations])'),before);assert.equal(p.document.getElementById('np-name').value,'qa-cancel');p.click('deployment-config-manage');assert.equal(p.document.getElementById('tpl-source').value,'UNSAVED_QA_BODY');
});
test('配置编辑时刷新仍可返回原部署目标',()=>{
 const p=prototype();p.click('newproject',{template:'t5',server:'s4'});p.document.getElementById('np-name').value='qa-refresh';p.click('deployment-config-manage');
 const restored=prototype(p.saved(),{hash:p.run('location.hash')});assert.match(restored.html('modal'),/保存并返回部署/);restored.click('deployment-config-return');assert.equal(restored.document.getElementById('np-name').value,'qa-refresh');assert.equal(restored.document.getElementById('np-server').value,'s4');
});
test('独立 FRP 配置的更新来源保持自己的固定配置',()=>{
 const p=readyServices();p.run('openModal("templateedit",{initialType:"frp"});');p.submit('frpdeploymentconfig',{'fc-name':'QA independent FRPS','fc-bind':'127.0.0.1','fc-port':'7900','fc-token':'DEMO_INDEPENDENT_TOKEN'});
 const id=p.run('S.templates.find(t=>t.name==="QA independent FRPS").id');p.click('newproject',{template:id,server:'s4'});p.submit('newproject',{'np-template':id,'np-server':'s4','np-name':'qa-independent'});p.click('deployment-preview-execute');p.run('finishOperation(S.operations[0],"success");');
 assert.equal(p.run('frpProjectCandidate(S.projects.find(p=>p.name==="qa-independent")).settings.token'),'DEMO_INDEPENDENT_TOKEN');
 p.run('S.frp.token="DEMO_GLOBAL_OTHER";frpSyncPublicTemplates();');assert.equal(p.run(`tpl(${JSON.stringify(id)}).frpSource.token`),'DEMO_INDEPENDENT_TOKEN');
});
