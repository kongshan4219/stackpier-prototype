import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function deploy(p, result = 'failed', name = 'failure-demo') {
  p.run(`tpl('t1').fileMappings=tpl('t1').fileMappings.map(mapping=>({...mapping,targetPath:mapping.targetPath.replace('/catalog-api/', '/'+${JSON.stringify(name)}+'/')}));`);
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': name });
  p.click('deployment-preview-execute');
  assert.equal(p.run('S.operations[0].status'), 'running');
  p.run(`finishOperation(S.operations[0],${JSON.stringify(result)});`);
  return p.run('S.failedProjects[0].id');
}

function clean(p, id, outcome = 'success') {
  p.click('failedcleanup', { id });
  p.submit('failedcleanup', { 'cleanup-confirm': 'on', outcome });
}

for (const result of ['failed', 'partial', 'unknown']) {
  test(`${result} 新项目只保留在失败记录，并保存部署时的文件范围`, () => {
    const p = prototype();
    p.run('tpl("t1").fileMappings=[{file:"catalog-config.yaml",targetPath:"/srv/example/settings.yaml"}];');
    const id = deploy(p, result);
    assert.equal(p.run('S.projects.some(project=>project.name==="failure-demo")'), false);
    p.click('closemodal');
    assert.equal(p.run('ui.projectsTab'), 'failures');
    assert.match(p.html('app'), /failure-demo|清理残留/);
    p.click('projectstab', { id: 'list' });
    assert.doesNotMatch(p.html('app'), /failure-demo/);
    p.run('tpl("t1").fileMappings=[{file:"catalog-config.yaml",targetPath:"/srv/changed/config.yaml"}];');
    p.click('failedproject', { id });
    assert.match(p.html('modal'), /failure-demo\.service|\/failure-demo\/data/);
    assert.match(p.html('modal'), /\/srv\/example\/settings.yaml/);
    assert.doesNotMatch(p.html('modal'), /\/srv\/changed/);
    const reloaded = prototype(p.saved());
    assert.equal(reloaded.run('S.failedProjects.length'), 1);
    assert.equal(reloaded.run('S.failedProjects[0].result'), result);
    assert.equal(reloaded.run('S.projects.some(project=>project.name==="failure-demo")'), false);
    assert.deepEqual(JSON.parse(prototype(reloaded.saved()).saved()), JSON.parse(reloaded.saved()));
  });
}

test('清理经确认后执行，成功保留记录且重复提交不再产生操作', () => {
  const p = prototype(), id = deploy(p, 'partial');
  p.run('const unaffected=JSON.stringify([S.projects,S.programs,S.templates,S.dns,S.firewalls]);');
  p.click('failedcleanup', { id });
  p.submit('failedcleanup', { outcome: 'success' });
  assert.match(p.document.getElementById('modal-error').textContent, /请确认/);
  assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'pending');
  clean(p, id);
  assert.equal(p.run('S.operations[0].kind'), 'failed-cleanup');
  p.click('finishdemo', { id: p.run('S.operations[0].id') });
  assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'success');
  assert.equal(p.run('S.failedProjects[0].cleanup.items.every(item=>item.status==="success")'), true);
  assert.equal(p.run('JSON.stringify([S.projects,S.programs,S.templates,S.dns,S.firewalls])===unaffected'), true);
  p.click('failedprojects');
  assert.match(p.html('app'), /failure-demo/);
  assert.match(p.html('app'), /已清理/);
  assert.doesNotMatch(p.html('app'), /data-action="failedcleanup"/);
  const count = p.run('S.operations.length');
  clean(p, id);
  assert.equal(p.run('S.operations.length'), count);
  assert.equal(prototype(p.saved()).run('S.failedProjects[0].cleanup.status'), 'success');
});

for (const outcome of ['failed', 'partial']) {
  test(`清理${outcome}保留未完成分项，重试不重复清理成功分项`, () => {
    const p = prototype(), id = deploy(p);
    clean(p, id, outcome);
    p.run(`finishOperation(S.operations[0],${JSON.stringify(outcome)});`);
    const remaining = p.run('S.failedProjects[0].deployment.targets.length-S.failedProjects[0].cleanup.items.filter(item=>item.status==="success").length');
    assert.equal(p.run('S.failedProjects[0].cleanup.status'), outcome);
    assert.ok(remaining > 0);
    clean(p, id);
    assert.equal(p.run('S.operations[0].input.targets.length'), remaining);
    p.click('finishdemo', { id: p.run('S.operations[0].id') });
    assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'success');
    assert.equal(p.run('S.failedProjects[0].cleanup.items.length'), p.run('S.failedProjects[0].deployment.targets.length'));
  });
}

test('未知部署先核对结束与服务器；未知清理先核对，刷新不丢记录或解锁', () => {
  const p = prototype(), id = deploy(p, 'unknown'), deploymentId = p.run('S.failedProjects[0].operation');
  clean(p, id);
  assert.match(p.document.getElementById('modal-error').textContent, /原部署尚未确认结束/);
  p.click('verifyop', { id: deploymentId });
  p.submit('verifyop', { 'verify-result': 'ended-unknown', 'verify-evidence': 'on' });
  clean(p, id);
  assert.match(p.document.getElementById('modal-error').textContent, /检查原服务器/);
  p.click('servercheck', { id: 's4' });
  p.submit('servercheck', { 'check-result': 'online' });
  clean(p, id, 'unknown');
  const reloaded = prototype(p.saved()), cleanupId = reloaded.run('S.failedProjects[0].cleanup.operation');
  assert.equal(reloaded.run('S.failedProjects[0].cleanup.status'), 'unknown');
  clean(reloaded, id);
  assert.match(reloaded.document.getElementById('modal-error').textContent, /尚未确认结束/);
  reloaded.click('verifyop', { id: cleanupId });
  reloaded.submit('verifyop', { 'verify-result': 'success', 'verify-evidence': 'on' });
  assert.equal(reloaded.run('S.failedProjects[0].cleanup.status'), 'success');
  assert.equal(reloaded.run('S.projects.some(project=>project.name==="failure-demo")'), false);
  assert.equal(reloaded.run('S.failedProjects[0].result'), 'unknown');
});

test('只剩数据目录时再次部分清理仍保留未完成项', () => {
  const p = prototype(), id = deploy(p);
  for (let attempt = 0; attempt < 2; attempt++) {
    clean(p, id, 'partial');
    p.run("finishOperation(S.operations[0],'partial');");
    assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'partial');
    assert.equal(p.run('S.failedProjects[0].cleanup.items.filter(item=>item.status!=="success").length'), 1);
  }
  assert.equal(p.run('S.operations[0].input.targets.length'), 1);
  assert.equal(p.run('S.operations[0].steps.some(step=>step.title.includes("停止并移除"))'), false);
});

test('未知部署核对成功只补充原操作证据，不自动建立项目', () => {
  const p = prototype();
  deploy(p, 'unknown');
  const original = p.run('S.failedProjects[0].operation');
  p.click('verifyop', { id: original });
  p.submit('verifyop', { 'verify-result': 'success', 'verify-evidence': 'on' });
  assert.equal(p.run('S.operations[0].status'), 'success');
  assert.equal(p.run('S.failedProjects.length'), 1);
  assert.equal(p.run('S.projects.some(project=>project.name==="failure-demo")'), false);
  assert.equal(prototype(p.saved()).run('S.failedProjects.length'), 1);
});

test('同名重试或其他项目采用相同文件后，旧失败记录不能清理其资源', () => {
  for (const shared of [false, true]) {
    const p = prototype();
    if (shared) p.run('tpl("t1").fileMappings=[{file:"catalog-config.yaml",targetPath:"/srv/shared/app.yaml"}];');
    const id = deploy(p);
    p.click('newproject');
    p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': shared ? 'another-service' : 'failure-demo' });
    p.click('deployment-preview-execute');
    p.run("finishOperation(S.operations[0],'success');");
    clean(p, id);
    assert.match(p.document.getElementById('modal-error').textContent, /已被项目.*使用/);
    assert.equal(p.run('S.failedProjects[0].cleanup.status'), 'pending');
    assert.equal(p.run('S.operations.some(operation=>operation.kind==="failed-cleanup")'), false);
  }
});

test('清理中的相同资源禁止重新部署；残留未清理禁止删除服务器连接', () => {
  const p = prototype(), id = deploy(p);
  p.run('S.projects=S.projects.filter(project=>project.server!=="s4");persist();');
  p.click('serverdelete', { id: 's4' });
  assert.match(p.html('modal'), /仍有失败项目残留/);
  p.click('confirmserverdelete', { id: 's4' });
  assert.equal(p.run('!!sr("s4")'), true);
  clean(p, id);
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'failure-demo' });
  p.click('deployment-preview-execute');
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /使用相同项目资源/);
  assert.equal(p.run('S.projects.some(project=>project.name==="failure-demo")'), false);
});

test('旧失败部署可以归档，缺失服务器身份的记录不猜测清理目标', () => {
  const p = prototype();
  deploy(p);
  p.run('S.failedProjects=[];delete S.operations[0].input.deployment;persist();');
  const reloaded = prototype(p.saved());
  assert.equal(reloaded.run('S.failedProjects.length'), 1);
  clean(reloaded, reloaded.run('S.failedProjects[0].id'));
  assert.match(reloaded.document.getElementById('modal-error').textContent, /缺少原服务器身份/);
});

test('重复部署请求被拒绝时不丢弃正在执行的原部署', () => {
  const p = prototype();
  p.click('newproject');
  p.submit('newproject', { 'np-template': 't1', 'np-server': 's4', 'np-name': 'pending-service' });
  p.click('deployment-preview-execute');
  p.run('const original=S.operations[0],subject=pr(original.project);startOperation(subject,"deploy",{},"success",{hold:true});');
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.equal(p.run('!!pr(original.project)'), true);
  p.run('finishOperation(original,"success");');
  assert.equal(p.run('pr(original.project).life'), 'installed');
  assert.equal(p.run('pr(original.project).creationPending'), undefined);
});
