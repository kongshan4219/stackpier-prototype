import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function error(p) { return p.document.getElementById('modal-error').textContent; }

test('项目入口和弹窗统一使用部署项目，表单只保留三个字段', () => {
  const p = prototype();
  p.click('navigate', { page: 'projects' });
  assert.match(p.html('app'), /部署项目/);
  assert.doesNotMatch(p.html('app'), /新建项目/);
  p.click('newproject');
  const html = p.html('modal');
  assert.match(html, /<h2 id="dialog-title">部署项目<\/h2>/);
  assert.deepEqual([...html.matchAll(/name="(np-[^"]+)"/g)].map(match => match[1]), ['np-template', 'np-server', 'np-name']);
  assert.doesNotMatch(html, /np-port|np-env|np-desired|outcome|stepper|文件映射|配置文件预览/);
  assert.match(html, /type="submit">部署项目<\/button>/);
});

test('部署项目采用配置默认值并立即发起启动部署', () => {
  const p = prototype();
  p.click('newproject', { template: 't1' });
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'new-service' });
  const project = JSON.parse(p.run('JSON.stringify(S.projects.find(project=>project.name==="new-service"))'));
  assert.equal(project.server, 's4');
  assert.equal(project.template, 't1');
  assert.equal(project.desired, 'running');
  assert.equal(project.cfg.port, 8080);
  assert.equal(project.cfg.env, 'LOG_LEVEL=info\nTZ=Asia/Shanghai');
  assert.equal(project.applied, null);
  const operation = JSON.parse(p.run('JSON.stringify(S.operations.find(operation=>operation.project===S.projects.find(project=>project.name==="new-service").id))'));
  assert.equal(operation.kind, 'deploy');
  assert.equal(operation.status, 'running');
  assert.equal(operation.input.requestedState, 'running');
  p.click('navigate', { page: 'projects' });
  assert.doesNotMatch(p.html('app'), /new-service/);
  p.run(`finishOperation(S.operations.find(item=>item.id===${JSON.stringify(operation.id)}),'success');`);
  assert.match(p.html('app'), /new-service/);
  assert.equal(p.run('S.projects.find(project=>project.name==="new-service").creationPending'), undefined);
});

test('新项目在部署前置检查被拒绝时进入失败记录，无需清理', () => {
  const p = prototype(), before = p.run('S.projects.length');
  p.click('newproject', { template: 't1' });
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's3', 'np-name': 'rejected-service' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.equal(p.run('S.projects.length'), before);
  assert.equal(p.run('ui.page'), 'projects');
  assert.match(p.html('modal'), /归入失败记录/);
  assert.doesNotMatch(p.html('modal'), /查看项目/);
  p.click('closemodal');
  assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'none');
  p.click('projectstab', { id: 'list' });
  assert.doesNotMatch(p.html('app'), /rejected-service/);
  assert.equal(prototype(p.saved()).run('S.projects.some(project=>project.name==="rejected-service")'), false);
});

test('刷新后未确认的部署归入失败记录，项目列表不显示', () => {
  const p = prototype();
  p.click('newproject', { template: 't1' });
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'unresolved-service' });
  const reloaded = prototype(p.saved());
  assert.equal(reloaded.run('S.operations[0].status'), 'unknown');
  assert.equal(reloaded.run('S.projects.some(project=>project.name==="unresolved-service")'), false);
  assert.equal(reloaded.run('S.failedProjects[0].result'), 'unknown');
  reloaded.click('navigate', { page: 'projects' });
  assert.doesNotMatch(reloaded.html('app'), /unresolved-service/);
  reloaded.click('projectstab', { id: 'failures' });
  assert.match(reloaded.html('app'), /unresolved-service/);
});

test('新项目明确部署失败后不留在列表，原项目再次部署失败仍保留', () => {
  const p = prototype();
  p.click('newproject', { template: 't1' });
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'failed-service' });
  assert.equal(p.run('S.operations[0].status'), 'running');
  p.run("finishOperation(S.operations[0],'failed');");
  assert.equal(p.run('S.projects.some(project=>project.name==="failed-service")'), false);
  assert.equal(p.run('ui.page'), 'projects');
  assert.match(p.html('modal'), /归入失败记录/);
  assert.doesNotMatch(p.html('modal'), /查看项目/);
  p.click('closemodal');
  p.click('projectstab', { id: 'list' });
  assert.doesNotMatch(p.html('app'), /failed-service/);
  p.click('navigate', { page: 'operations' });
  assert.match(p.html('app'), /部署 failed-service/);
  p.click('navigate', { page: 'projects' });
  p.click('newproject', { template: 't1' });
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'failed-service' });
  assert.equal(p.run('S.projects.filter(project=>project.name==="failed-service").length'), 1);
  assert.equal(p.run('S.operations[0].status'), 'running');
  p.run("const existing=pr('p2');const removed=startOperation(existing,'uninstall',{},'success',{hold:true});finishOperation(removed,'success');const retry=startOperation(existing,'deploy',{},'failed',{hold:true});finishOperation(retry,'failed');");
  assert.equal(p.run('S.projects.some(project=>project.id==="p2")'), true);
  assert.equal(p.run('retry.status'), 'failed');
});

test('主动停止的项目重新部署后恢复运行，确认页没有运行目标选项', () => {
  const p = prototype();
  p.run("const subject=pr('p2');const stopped=startOperation(subject,'stop',{},'success',{hold:true});finishOperation(stopped,'success');const removed=startOperation(subject,'uninstall',{},'success',{hold:true});finishOperation(removed,'success');");
  assert.equal(p.run('subject.desired'), 'stopped');
  p.click('projectop', { id: 'p2', kind: 'deploy' });
  assert.doesNotMatch(p.html('modal'), /运行目标|部署后的目标|保持停止/);
  p.submit('projectop', { 'reuse-data': 'on', outcome: 'success' });
  assert.equal(p.run('S.operations[0].input.requestedState'), 'running');
  p.run("finishOperation(S.operations[0],'success');");
  assert.equal(p.run('subject.runtime'), 'running');
  assert.equal(p.run('subject.desired'), 'running');
});

test('同一服务器拒绝重复项目名，不同服务器允许同名', () => {
  const p = prototype(), before = p.run('S.projects.length');
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's2', 'np-name': 'catalog-api' });
  assert.match(error(p), /这台服务器已存在同名项目/);
  assert.equal(p.run('S.projects.length'), before);
  assert.equal(p.run('S.operations.filter(operation=>operation.label==="部署 catalog-api").length'), 0);
  p.click('closemodal');
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's1', 'np-name': 'catalog-api' });
  assert.equal(p.run('S.projects.filter(project=>project.name==="catalog-api").length'), 2);
});

test('已卸载记录仍占用同机项目名，非法项目名不会创建记录', () => {
  const p = prototype(), before = p.run('S.projects.length');
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't5', 'np-server': 's4', 'np-name': 'legacy-web' });
  assert.match(error(p), /这台服务器已存在同名项目/);
  p.submit('newproject', { 'np-template': 't5', 'np-server': 's1', 'np-name': '1 invalid' });
  assert.match(error(p), /项目名须以英文字母开头/);
  assert.equal(p.run('S.projects.length'), before);
});
