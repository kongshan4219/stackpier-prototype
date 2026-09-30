import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function open(p, id = 't5') { p.click('deploytemplate', { id }); }
function submit(p, name = 'Web · Compose 应用', server = 's4') {
  p.submit('deploytemplate', { 'deploy-name': name, 'deploy-server': server });
}

test('配置卡片移除关联数量；部署弹窗默认配置名且取消不创建项目', () => {
  const p = prototype();
  p.click('navigate', { page: 'templates' });
  assert.doesNotMatch(p.html('app'), /关联项目|用于新项目/);
  p.run('const before=JSON.stringify([S.projects,S.operations]);');
  open(p);
  assert.equal(p.document.getElementById('deploy-name').value, p.run('tpl("t5").name'));
  assert.equal(p.document.getElementById('deploy-server').value, '');
  assert.doesNotMatch(p.html('modal'), /stepper|下一步|运行目标|部署配置<\/label>/);
  p.click('closemodal');
  assert.equal(p.run('JSON.stringify([S.projects,S.operations])===before'), true);
});

test('确认直接部署：保留中文名称、复制正文及映射，操作固定本次输入', () => {
  const p = prototype();
  p.run('sr("s4").docker=true;Object.assign(tpl("t5"),{contentMode:"file",tpl:"services:\\n  app:\\n    image: example/demo\\n",fileMappings:[{id:"mapping",fileId:"bin1",filename:"demo",targetPath:"/srv/demo/app"}]});');
  open(p); submit(p);
  assert.equal(p.run('S.projects.at(-1).name'), 'Web · Compose 应用');
  assert.equal(p.run('S.projects.at(-1).server'), 's4');
  assert.equal(p.run('S.projects.at(-1).cfg.source===tpl("t5").tpl'), true);
  assert.equal(p.run('S.operations[0].kind'), 'deploy');
  assert.equal(p.run('S.operations[0].status'), 'running');
  assert.equal(p.run('S.operations[0].project===S.projects.at(-1).id'), true);
  assert.equal(p.run('S.operations[0].input.requestedState'), 'running');
  p.run('tpl("t5").fileMappings[0].targetPath="/srv/changed";');
  assert.equal(p.run('S.projects.at(-1).cfg.fileMappings[0].targetPath'), '/srv/demo/app');
  assert.equal(p.run('S.operations[0].input.cfg.fileMappings[0].targetPath'), '/srv/demo/app');
  assert.equal(prototype(p.saved()).run('S.projects.at(-1).name'), 'Web · Compose 应用');
});

test('空名称、失效配置与服务器、同机重名及 MySQL 同配置拒绝创建', () => {
  for (const failure of ['name', 'server', 'template', 'duplicate', 'mysql']) {
    const p = prototype(); open(p, failure === 'mysql' ? 't2' : 't5');
    p.run('const before=JSON.stringify([S.projects,S.operations]);');
    if (failure === 'template') p.run('S.templates=S.templates.filter(t=>t.id!=="t5");');
    if (failure === 'name') submit(p, '   ');
    else if (failure === 'server') submit(p, 'example', 'missing');
    else if (failure === 'duplicate') submit(p, p.run('S.projects[0].name'), p.run('S.projects[0].server'));
    else if (failure === 'mysql') submit(p, '另一个 MySQL', p.run('S.projects.find(p=>p.template==="t2").server'));
    else submit(p);
    assert.equal(p.document.getElementById('modal-error').hidden, false, failure);
    assert.equal(p.run('JSON.stringify([S.projects,S.operations])===before'), true, failure);
  }
});

test('无服务器禁用部署；FRP 保持专用流程且不创建通用项目', () => {
  const p = prototype();
  p.run('S.servers=[];'); open(p);
  assert.match(p.html('modal'), /暂无服务器/);
  assert.match(p.html('modal'), /type="submit" disabled/);
  const frp = prototype(); frp.run('frpEnsure();const count=S.projects.length;');
  open(frp, frp.run('S.templates.find(t=>t.software==="frpc").id'));
  assert.equal(frp.run('ui.page'), 'frp');
  assert.equal(frp.run('ui.modal'), null);
  assert.equal(frp.run('S.projects.length===count'), true);
});

test('服务器缺少环境时保留项目草稿并显示原有部署拒绝结果', () => {
  const p = prototype(); open(p); submit(p);
  assert.equal(p.run('S.projects.at(-1).life'), 'draft');
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /Docker/);
});
