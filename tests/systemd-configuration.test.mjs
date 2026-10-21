import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';

const source='\n\n[Service]\nExecStart=/srv/qa-unit/program --value=${VALUE} --label={{name}}\n';
function setup(name='qa-unit',template='t1'){
 const p=prototype();p.click('templateedit',{id:template});p.click('configuration-mapping-add');
 p.submit('templateedit',{'tpl-name':'QA unit','tpl-source':source,'tpl-map-kind-0':'directory','tpl-map-local-0':'/srv/qa-input','tpl-map-remote-0':'/srv/qa-unit'});
 p.click('newproject',{template,server:'s4'});p.submit('newproject',{'np-template':template,'np-server':'s4','np-name':name});
 assert.equal(p.run('ui.modal.kind'),'deploymentpreview');return p;
}
function deploy(p){p.click('deployment-preview-execute');p.run('finishOperation(S.operations[0],"success");globalThis.unitProject=pr(S.operations[0].project);');}

test('正文部署保留变量字面值、固定映射与运行状态，不捏造业务健康或程序资产',async()=>{
 const p=setup();assert.equal(p.run('configText(ui.modal.draft)'),source);deploy(p);
 assert.equal(p.run('unitProject.appliedSnapshot.cfg.source'),source);
 assert.equal(p.run('unitProject.appliedSnapshot.cfg.pathMappings[0].deleteExtraneous'),true);
 assert.equal(p.run('unitProject.appliedSnapshot.program'),null);
 assert.equal(p.run('unitProject.runtime'),'running');assert.equal(p.run('unitProject.health'),'unknown');
 p.run('ui.project=unitProject.id;ui.page="project";ui.tab="config";render()');
 assert.match(p.html('app'),/固定文件与目录映射|运行状态/);assert.doesNotMatch(p.html('app'),/\/health|config\.json/);
 await p.run('checkProjectFiles(unitProject)');assert.equal(p.run('unitProject.fileCheck.files.length'),1);
 assert.equal(p.run('unitProject.fileCheck.files[0].kind'),'unit');assert.equal(p.run('unitProject.fileCheck.files[0].state'),'same');
});
test('映射不能覆盖 unit、私有目录或已有项目，预览错误阻止执行',()=>{
 const p=setup(),count=p.run('S.operations.length');
 for(const path of ['/etc/systemd/system/qa-unit.service','/etc/systemd/system','/srv/stackpier-demo/qa-unit']){
  p.run(`ui.modal.draft.cfg.pathMappings[0].remotePath=${JSON.stringify(path)}`);
  assert.ok(p.run('deploymentLocation(ui.modal.draft).errors.length')>0);p.click('deployment-preview-execute');assert.equal(p.run('S.operations.length'),count);
 }
 const q=setup();deploy(q);
 q.click('newproject',{template:'t1',server:'s4'});q.submit('newproject',{'np-template':'t1','np-server':'s4','np-name':'qa-collision'});
 assert.match(q.run('deploymentLocation(ui.modal.draft).errors.join(" ")'),/映射目标已由/);
});
test('映射在失败清理快照中保留，运行中的同映射部署互斥',()=>{
 const p=setup();p.click('deployment-preview-execute');
 assert.equal(p.run('S.operations[0].input.deployment.preserved[0].path'),'/srv/qa-unit');
 assert.equal(p.run('S.operations[0].input.deployment.targets.some(x=>x.path==="/srv/qa-unit")'),false);
 p.click('newproject',{template:'t1',server:'s4'});p.submit('newproject',{'np-template':'t1','np-server':'s4','np-name':'qa-second'});p.click('deployment-preview-execute');
 assert.equal(p.run('S.operations[0].status'),'rejected');
 p.run('finishOperation(S.operations.find(x=>x.status==="running"),"partial")');
 assert.equal(p.run('S.failedProjects.find(x=>x.result==="partial").deployment.preserved[0].path'),'/srv/qa-unit');
 assert.equal(p.run('S.projects.some(p=>p.name==="qa-unit")'),false);
});
test('正文模式不沿用固定程序更新或采用流程，拒绝后保留部署快照',()=>{
 const p=setup();deploy(p);const before=p.run('JSON.stringify([unitProject.cfg,unitProject.appliedSnapshot])');
 p.run('startOperation(unitProject,"apply",{},"success",{hold:true})');assert.equal(p.run('S.operations[0].status'),'rejected');
 p.run('startOperation(unitProject,"update",{},"success",{hold:true})');assert.equal(p.run('S.operations[0].status'),'rejected');
 p.click('asset-update-adopt',{id:p.run('unitProject.id')});
 assert.equal(p.run('JSON.stringify([unitProject.cfg,unitProject.appliedSnapshot])'),before);
});
test('早期 frpc 软件标签的普通 systemd 配置保存后仍作为正文模式',()=>{
 const p=setup('qa-generic-frpc','t4');assert.equal(p.run('tpl("t4").revisions.map(r=>r.rev).join(",")'),'1,2');assert.equal(p.run('ui.modal.draft.cfg.systemdMode'),'unit');deploy(p);
 assert.equal(p.run('projectIsFrp(unitProject)'),false);
 const loaded=prototype(p.saved());assert.equal(loaded.run('projectIsFrp(S.projects.find(p=>p.name==="qa-generic-frpc"))'),false);
});

test('新映射避开 Compose 外部映射与其他项目私有根，固定并发范围也保护映射',()=>{
 const p=setup();
 p.run('const other=pr("p3");other.server="s4";other.applied.pathMappings=[{kind:"directory",localPath:"/srv/compose-source",remotePath:"/srv/qa-unit"}];');
 assert.match(p.run('deploymentLocation(ui.modal.draft).errors.join(" ")'),/映射目标已由/);
 p.run('ui.modal.draft.cfg.pathMappings[0].remotePath="/srv/stackpier-demo/"+pr("p3").name+"/custom.conf"');
 assert.match(p.run('deploymentLocation(ui.modal.draft).errors.join(" ")'),/映射目标已由/);
 p.run('ui.modal.draft.cfg.pathMappings[0].remotePath="/srv/qa-unit"');
 assert.equal(p.run('deploymentScopesOverlap(deploymentSnapshot(ui.modal.draft),deploymentSnapshot(pr("p3"),pr("p3").applied))'),true);
});
test('正文前导换行经过渲染、添加映射和保存重开仍完整保留',()=>{
 const p=prototype();p.click('templateedit',{id:'t1'});p.document.getElementById('tpl-source').value=source;
 p.click('configuration-mapping-add');assert.equal(p.document.getElementById('tpl-source').value,source);
 p.click('configuration-mapping-remove',{index:0});assert.equal(p.document.getElementById('tpl-source').value,source);
 p.submit('templateedit',{'tpl-name':'QA whitespace'});assert.equal(p.run('tpl("t1").tpl'),source);
 p.click('templateedit',{id:'t1'});assert.equal(p.document.getElementById('tpl-source').value,source);
});
