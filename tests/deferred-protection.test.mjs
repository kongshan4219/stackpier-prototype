import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

test('当前页面、项目标签、更多操作和试用场景均无备份恢复入口', () => {
  const p = prototype();
  for (const page of ['overview', 'projects', 'monitor', 'operations', 'settings']) {
    p.click('navigate', { page });
    assert.doesNotMatch(p.html('app'), /备份|保护策略|计划与策略/);
  }
  p.click('project', { id: 'p1' });
  assert.doesNotMatch(p.html('app'), /备份|恢复来源/);
  for (const kind of ['projectmore', 'scenes']) {
    p.run(`openModal(${JSON.stringify(kind)},{id:'p1'});`);
    assert.doesNotMatch(p.html('modal'), /备份|保护策略|review-p2|review-p3/);
    p.click('closemodal');
  }
  assert.equal(p.run('S.projects.some(project=>Object.hasOwn(project,"backup"))'), false);
});

test('旧入口和旧模拟操作不可复活，不重置当前演示状态', () => {
  const p = prototype();
  p.run('pr("p1").name="保留此项目";const before=JSON.stringify(S);');
  for (const page of ['backups', 'plans']) {
    p.click('navigate', { page });
    assert.equal(p.run('ui.page'), 'overview');
    assert.match(p.html('app'), /工作空间/);
  }
  for (const kind of ['reviewsettings', 'backupconfig', 'choosebackup', 'chooserestore', 'backupdetail', 'restore', 'planedit', 'policyedit', 'cleanup']) {
    p.run(`openModal(${JSON.stringify(kind)},{id:'p1'});`);
    assert.equal(p.document.getElementById('modal').open, false, kind);
  }
  for (const kind of ['backup', 'restore', 'cleanup']) {
    assert.equal(p.run(`startOperation(pr('p1'),${JSON.stringify(kind)},{},'success',{hold:true})`), null);
    p.run(`openModal('projectop',{id:'p1',op:${JSON.stringify(kind)}});`);
    assert.equal(p.document.getElementById('modal').open, false, kind);
  }
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'backups' });
  assert.equal(p.run('ui.tab'), 'overview');
  p.run('loadScene("normal-backup");');
  assert.equal(p.run('JSON.stringify(S)===before'), true);
});

test('旧持久状态仅迁出暂停功能，项目草稿、FRP、通知和其他操作保留', () => {
  const p = prototype();
  p.run(`
    frpEnsure();
    pr('p1').name='保留名称';pr('p1').cfg.appConfig='保留草稿';
    pr('p1').backup={path:'/example/retired'};pr('p1').temporary=true;
    delete pr('p8').monitorPaused;pr('p8').plansPaused=true;
    S.backups=[{id:'legacy-backup'}];S.policies=[{id:'legacy-policy'}];
    S.plans=[{id:'legacy-plan',kind:'backup',name:'历史保护计划'}];
    S.review.p2=true;S.review.p3=true;S.review.notes=[{text:'保留反馈'}];
    record('旧备份','backup','p1','running','旧演示',{resources:['project:p1']});
    record('旧恢复','restore','p1','unknown','旧演示',{resources:['project:p1']});
    record('计划跳过 · 历史保护计划','schedule',null,'skipped','未触发');
    record('巡检跳过','schedule','p1','skipped','巡检已暂停');
    record('待核对停止','stop','p2','running','保留原操作',{input:{before:{runtime:'running'}},resources:['project:p2']});
    persist();
  `);
  const before = JSON.parse(p.saved());
  const reloaded = prototype(p.saved());
  const after = JSON.parse(reloaded.saved());
  assert.equal(after.projects.find(project => project.id === 'p1').name, '保留名称');
  assert.equal(after.projects.find(project => project.id === 'p1').cfg.appConfig, '保留草稿');
  assert.equal(after.projects.find(project => project.id === 'p8').monitorPaused, true);
  assert.deepEqual(after.servers, before.servers);
  assert.deepEqual(after.templates, before.templates);
  assert.deepEqual(after.frp, before.frp);
  assert.deepEqual(after.notifications, before.notifications);
  assert.deepEqual(after.review.notes, before.review.notes);
  for (const key of ['backups', 'policies', 'plans']) assert.equal(Object.hasOwn(after, key), false);
  assert.equal(after.projects.some(project => ['backup', 'temporary', 'plansPaused'].some(key => Object.hasOwn(project, key))), false);
  assert.equal(after.review.p2, undefined);
  assert.equal(after.review.p3, undefined);
  assert.equal(after.operations.some(operation => ['backup', 'restore', 'cleanup'].includes(operation.kind)), false);
  assert.equal(after.operations.some(operation => operation.label.includes('历史保护计划')), false);
  assert.equal(after.operations.some(operation => operation.label === '巡检跳过'), true);
  assert.equal(after.operations.find(operation => operation.kind === 'stop').status, 'unknown');
  assert.equal(reloaded.run('activeOps(pr("p1")).length'), 0);
  assert.equal(reloaded.run('activeOps(pr("p2")).length'), 1);
  assert.deepEqual(JSON.parse(prototype(reloaded.saved()).saved()), after);
});

test('卸载暂停定时巡检，重新部署后保持暂停并可明确恢复', () => {
  const p = prototype();
  p.run(`const subject=pr('p2');const uninstall=startOperation(subject,'uninstall',{},'success',{hold:true});finishOperation(uninstall,'success');`);
  assert.equal(p.run('subject.monitorPaused'), true);
  p.click('resumemonitor', { id: 'p2' });
  assert.equal(p.run('subject.monitorPaused'), true);
  p.run(`const deploy=startOperation(subject,'deploy',{desired:'running'},'success',{hold:true});finishOperation(deploy,'success');`);
  assert.equal(p.run('subject.life'), 'installed');
  assert.equal(p.run('subject.monitorPaused'), true);
  p.click('project', { id: 'p2' });
  p.click('tab', { id: 'monitor' });
  assert.match(p.html('app'), /恢复定时巡检/);
  p.click('resumemonitor', { id: 'p2' });
  assert.equal(p.run('subject.monitorPaused'), false);
  p.click('projectcheck', { id: 'p2' });
  assert.equal(p.run('S.operations[0].kind'), 'check');
});

test('全部剩余场景可装载，MySQL 复制初始化入口保留', () => {
  const ids = JSON.parse(prototype().run('JSON.stringify(scenes.map(scene=>scene.id))'));
  for (const id of ids) {
    const p = prototype();
    p.run(`loadScene(${JSON.stringify(id)});`);
    assert.equal(p.run('ui.scenario'), id);
    assert.equal(p.run('prototypeLoading.ready'), true);
    assert.equal(p.run('S.operations.some(operation=>["backup","restore","cleanup"].includes(operation.kind))'), false);
    if (id === 'replica-init') {
      assert.equal(p.run('ui.modal.kind'), 'replica');
      assert.match(p.html('modal'), /初始化 MySQL 只读副本/);
    }
  }
});
