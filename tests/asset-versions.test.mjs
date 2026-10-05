import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';

function replacement(p){
 p.run(`const file=assetById('file1');openModal('programname',{draft:{id:file.id,original:clone(file),analysis:{sourceName:'catalog-v2.yaml',kind:'file',arch:'any',bytes:20,size:'20 B',sha256:'c'.repeat(64),text:'log_level: debug\\n',provenance:'浏览器上传元数据 · 未验证可执行'}}});`);
 p.submit('programname',{'bin-filename':'catalog-v2.yaml'});
}

test('文件替换增加修订且旧版本可追溯，公共配置固定修订和项目快照不变',()=>{
 const p=prototype(),applied=p.run('JSON.stringify(pr("p1").appliedSnapshot)'),read=p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),other=p.run('JSON.stringify(pr("p7").cfg)');
 replacement(p);assert.equal(p.run('assetById("file1").revision'),2);assert.equal(p.run('assetRevision("file1",1).filename'),'catalog-config.yaml');assert.equal(p.run('assetRevision("file1",2).filename'),'catalog-v2.yaml');
 assert.equal(p.run('tpl("t1").fileMappings[1].pins[0].revision'),1);assert.equal(p.run('JSON.stringify(pr("p1").appliedSnapshot)'),applied);assert.equal(p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),read);
 assert.equal(p.run('assetReferences("file1",1).projects.length'),2);assert.equal(p.run('pr("p1").programUpdate'),true);
 p.click('asset-update',{id:'p1'});p.click('asset-update-adopt',{id:'p1'});assert.equal(p.run('pr("p1").cfg.fileMappings[1].pins[0].revision'),2);assert.equal(p.run('JSON.stringify(pr("p7").cfg)'),other);assert.equal(p.run('JSON.stringify(pr("p1").appliedSnapshot)'),applied);assert.equal(p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),read);
 p.click('projectop',{id:'p1',kind:'apply'});assert.equal(p.run('JSON.stringify(pr("p1").appliedSnapshot)'),applied);p.submit('projectop',{outcome:'success'});p.click('finishdemo',{id:p.run('S.operations[0].id')});assert.equal(p.run('pr("p1").appliedSnapshot.files.find(mapping=>mapping.binary.id==="file1").binary.revision'),2);assert.equal(p.run('pr("p7").appliedSnapshot.files.find(mapping=>mapping.binary.id==="file1").binary.revision'),1);
});
test('文件逻辑改名后，配置引用、反向引用和部署解析仍依靠 ID',()=>{
 const p=prototype();p.click('asset-rename',{id:'file1'});p.submit('assetrename',{'asset-name':'renamed-settings.yaml'});assert.equal(p.run('assetReferences("file1").configurations.length'),1);assert.equal(p.run('assetReferences("file1").projects.length'),2);assert.equal(p.run('deploymentLocation(pr("p1")).files[1].binary.id'),'file1');assert.equal(p.run('mappingName(tpl("t1").fileMappings[1])'),'renamed-settings.yaml');
 p.click('asset-rename',{id:'bin1'});p.submit('assetrename',{'asset-name':'renamed-program'});assert.equal(p.run('projectProgramFile(pr("p1")).id'),'bin1');
});
test('旧存储迁移保留用户正文、项目草稿、历史交付身份和空资产列表',()=>{
 const p=prototype();p.run(`delete S.assetSchema;delete S.publicAssetsSeeded;for(const file of S.programs){delete file.revisions;delete file.revision;delete file.groupId;}for(const template of S.templates){delete template.revisions;delete template.programRef;template.fileMappings=template.fileMappings?.map(mapping=>({file:mapping.file,targetPath:mapping.targetPath}));}tpl('t1').tpl='[Service]\\n# 用户自定义正文';pr('p1').cfg.source='[Service]\\n# 保留未应用草稿';pr('p1').draftRev=7;delete pr('p1').appliedSnapshot;delete pr('p1').serverReadSnapshot;pr('p1').applied.fileMappings=pr('p1').applied.fileMappings.map(mapping=>({file:mapping.file,targetPath:mapping.targetPath}));assetById('file1').identity='public-new-content';persist();`);
 const loaded=prototype(p.saved());assert.equal(loaded.run('tpl("t1").tpl'),'[Service]\n# 用户自定义正文');assert.equal(loaded.run('pr("p1").cfg.source'),'[Service]\n# 保留未应用草稿');assert.equal(loaded.run('pr("p1").draftRev'),7);assert.notEqual(loaded.run('pr("p1").appliedSnapshot.files.find(item=>item.binary.id==="file1").binary.identity'),'public-new-content');
 assert.deepEqual(JSON.parse(prototype(loaded.saved()).saved()),JSON.parse(loaded.saved()));
 const historical=loaded.run('pr("p1").appliedSnapshot.files.find(item=>item.binary.id==="file1").binary.revision');replacement(loaded);assert.equal(loaded.run('assetById("file1").revision'),2);assert.notEqual(historical,2);assert.notEqual(loaded.run('assetRevision("file1",2).identity'),'public-new-content');
 loaded.run('S.programs=[];S.templates=[];persist();');const empty=prototype(loaded.saved());empty.click('navigate',{page:'programs'});assert.equal(empty.run('S.programs.length'),0);empty.click('navigate',{page:'templates'});assert.equal(empty.run('S.templates.length'),0);assert.match(empty.html('app'),/部署配置/);
});
test('读取失败保留成功快照、时间与内容，公共修改和采用均不刷新服务器结果',()=>{
 const p=prototype(),snapshot=p.run('JSON.stringify(pr("p1").serverReadSnapshot)');p.click('asset-read-fail',{id:'p1'});assert.equal(p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),snapshot);assert.equal(p.run('pr("p1").configurationReadStatus'),'unknown');p.click('project',{id:'p1'});p.click('tab',{id:'config'});assert.match(p.html('app'),/读取失败 · 旧结果/);replacement(p);p.click('asset-update',{id:'p1'});p.click('asset-update-adopt',{id:'p1'});assert.equal(p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),snapshot);
});
test('详情嵌套跳转与原配置编辑器独立，抽屉关闭不覆盖草稿',()=>{
 const p=prototype();p.click('templateedit',{id:'t1'});p.run('ui.modal.editor.source="[Service]\\n# draft";renderModal();');p.click('mapping-view',{index:1});assert.equal(p.run('ui.modal.kind'),'templateedit');assert.match(p.html('asset-details'),/catalog-config.yaml/);p.click('asset-template',{id:'t1'});assert.match(p.html('asset-details'),/只读详情/);p.click('asset-back');assert.match(p.html('asset-details'),/公共文件详情/);p.click('asset-close');assert.equal(p.document.getElementById('tpl-source').value,'[Service]\n# draft');p.click('mapping-upload');assert.equal(p.run('ui.modal.kind'),'programupload');p.click('closemodal');assert.equal(p.run('ui.modal.kind'),'templateedit');assert.equal(p.document.getElementById('tpl-source').value,'[Service]\n# draft');p.click('closemodal');p.click('templateedit',{id:'t1'});assert.equal(p.document.getElementById('tpl-source').value,'[Service]\n# draft');
});
