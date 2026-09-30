import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

const source = '\n# 示例\nservices:\n  app:\n    image: example/app:demo\n';
function save(p) { p.submit('templateedit', { 'tpl-name': '文件映射示例', 'tpl-type': 'compose', 'tpl-source': source }); }
function mappedPrototype() {
  const p = prototype();
  p.run('openModal("templateedit");ui.modal.fileMappings=[{id:"map-a",fileId:"bin1",targetPath:"/srv/demo/app"}];renderModal();');
  return p;
}

test('文件映射随配置保存并持久化；创建和显式采用复制到项目，不自动部署', () => {
  const p = mappedPrototype();
  p.run('const beforeOps=S.operations.length;'); save(p);
  const id = p.run('S.templates.at(-1).id');
  assert.equal(p.run('S.templates.at(-1).fileMappings[0].fileId'), 'bin1');
  assert.equal(p.run('S.templates.at(-1).tpl'), source);
  p.run(`openModal('newproject',{step:3,draft:{template:${JSON.stringify(id)},server:'s4',name:'mapping-demo',desired:'running'}});`);
  p.submit('newproject', {}, { submitter: 'save' });
  assert.equal(p.run('S.projects.at(-1).cfg.fileMappings[0].targetPath'), '/srv/demo/app');
  assert.equal(p.run('S.projects.at(-1).applied'), null);
  assert.equal(p.run('S.operations.length===beforeOps'), true);
  const loaded = prototype(p.saved());
  assert.match(loaded.run('projectFileDirectories()'), /bin\/projects\//);
  assert.match(loaded.run('projectFileDirectories()'), /bin\/files\/bin1--/);
  loaded.run(`S.projects.at(-1).template=${JSON.stringify(id)};S.templates.at(-1).fileMappings[0].targetPath='/srv/demo/new-app';const projectId=S.projects.at(-1).id;`);
  assert.equal(loaded.run('S.projects.at(-1).cfg.fileMappings[0].targetPath'), '/srv/demo/app');
  loaded.click('adopttemplate', { id: loaded.run('projectId') });
  assert.equal(loaded.run('S.projects.at(-1).cfg.fileMappings[0].targetPath'), '/srv/demo/new-app');
});

test('直接上传保存时同步到程序文件；取消或任一行无效均不留下部分登记', () => {
  const p = prototype();
  p.run('const count=S.programs.length;openModal("templateedit");ui.modal.fileMappings=[{id:"upload-a",fileId:"uploaded-a",targetPath:"/srv/demo/app.yaml",upload:{id:"uploaded-a",name:"app.yaml",filename:"app.yaml",arch:"any",size:"1 KB",identity:"demo-upload"}}];renderModal();');
  p.click('closemodal'); assert.equal(p.run('S.programs.length===count'), true);
  p.run('openModal("templateedit");ui.modal.fileMappings=[{id:"upload-a",fileId:"uploaded-a",targetPath:"/srv/demo/app.yaml",upload:{id:"uploaded-a",name:"app.yaml",filename:"app.yaml",arch:"any",size:"1 KB",identity:"demo-upload"}},{id:"invalid",fileId:"missing",targetPath:"/srv/demo/missing"}];renderModal();');
  save(p); assert.equal(p.run('S.programs.length===count'), true);
  assert.equal(p.document.getElementById('modal-error').hidden, false);
  p.click('mappingremove', { id: 'invalid' }); save(p);
  assert.equal(p.run('S.programs.length'), p.run('count+1'));
  assert.equal(p.run('S.templates.at(-1).fileMappings[0].fileId'), 'uploaded-a');
  p.run('openModal("templateedit",{id:S.templates.at(-1).id});'); save(p);
  assert.equal(p.run('S.programs.length'), p.run('count+1'));
});

test('拒绝重复目标、相对路径与路径穿越，同时保留编辑输入', () => {
  for (const path of ['/srv/demo/app', 'relative/file', '/srv/demo/../file', '/srv//file', '/srv/demo/']) {
    const p = mappedPrototype();
    p.run(`ui.modal.fileMappings.push({id:'map-b',fileId:'bin2',targetPath:${JSON.stringify(path)}});renderModal();const count=S.templates.length;`);
    save(p);
    assert.equal(p.run('S.templates.length===count'), true);
    assert.equal(p.run('ui.modal.fileMappings.length'), 2);
    assert.equal(p.document.getElementById('modal-error').hidden, false);
  }
});

test('添加和移除映射保留配置正文与已填写目标；全部移除可以保存', () => {
  const p = mappedPrototype();
  p.document.getElementById('tpl-name').value = '保留输入';
  p.document.getElementById('tpl-source').value = source;
  p.document.getElementById('map-path-map-a').value = '/srv/demo/changed';
  p.click('mappingadd');
  assert.equal(p.document.getElementById('tpl-source').value, source);
  assert.equal(p.document.getElementById('map-path-map-a').value, '/srv/demo/changed');
  for (const id of JSON.parse(p.run('JSON.stringify(ui.modal.fileMappings.map(row=>row.id))'))) p.click('mappingremove', { id });
  save(p); assert.equal(p.run('S.templates.at(-1).fileMappings.length'), 0);
});

test('真实 change 分发器只读取选中文件元数据，保存后可再次从文件库选择', () => {
  const p = prototype(); p.run('openModal("templateedit");'); p.click('mappingadd');
  const id = p.run('ui.modal.fileMappings[0].id');
  p.change(`map-upload-${id}`, { files: [{ name: 'demo-config.yaml', size: 128, text() { throw new Error('不应读取文件内容'); } }] });
  assert.equal(p.run('ui.modal.fileMappings[0].upload.filename'), 'demo-config.yaml');
  assert.equal(p.document.getElementById(`map-file-${id}`).value, p.run('ui.modal.fileMappings[0].upload.id'));
  assert.doesNotMatch(p.html('modal'), /文件来源/);
  p.document.getElementById(`map-path-${id}`).value = '/srv/demo/config.yaml';
  save(p);
  assert.equal(p.run('S.programs.at(-1).filename'), 'demo-config.yaml');
  p.run('openModal("templateedit",{id:S.templates.at(-1).id});');
  assert.equal(p.document.getElementById(`map-file-${id}`).value, p.run('S.programs.at(-1).id'));
  assert.match(p.html('modal'), /demo-config.yaml/);
});

test('FRP 占位和会被迁出的旧样例不可用于普通文件映射', () => {
  const p = prototype();p.run('openModal("templateedit");');p.click('mappingadd');
  assert.doesNotMatch(p.html('modal'), /frpc-linux-x86_64/);
  p.run('frpEnsure();renderModal();');
  assert.doesNotMatch(p.html('modal'), /value="frp-bin-/);
});

test('取消文件选择保留原选择；替换上传后切回库文件不登记未选中的上传', () => {
  const p = mappedPrototype();
  const input = p.document.getElementById('map-upload-map-a');
  let opened = false; input.click = () => { opened = true; };
  p.click('mappingupload', { id: 'map-a' }); assert.equal(opened, true);
  p.change('map-upload-map-a', { files: [] });
  assert.equal(p.document.getElementById('map-file-map-a').value, 'bin1');
  p.run('const count=S.programs.length;');
  for (const name of ['first.yaml', 'second.yaml']) p.change('map-upload-map-a', { files: [{ name, size: 16 }] });
  assert.doesNotMatch(p.html('modal'), /first.yaml/);
  assert.equal(p.document.getElementById('map-path-map-a').value, '/srv/demo/app');
  p.document.getElementById('map-file-map-a').value = 'bin2';
  save(p);
  assert.equal(p.run('S.programs.length===count'), true);
  assert.equal(p.run('S.templates.at(-1).fileMappings[0].fileId'), 'bin2');
});
