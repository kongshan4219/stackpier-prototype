import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

const verified = (overrides = {}) => ({ commandResult: 'success', executionEnded: true, identityVerified: true, observedState: 'stopped', restartVerified: false, ...overrides });

function operation(kind = 'stop') {
  const p = prototype();
  p.run(`const subject=pr('p1'),before=JSON.stringify({runtime:subject.runtime,observed:subject.observed,desired:subject.desired});const operation=startOperation(subject,${JSON.stringify(kind)},{},'success',{hold:true});`);
  return p;
}

function finish(p, evidence) {
  p.run(`finishOperation(operation,${JSON.stringify(evidence)});`);
}

test('启停受理仅固定本次请求，命令返回成功但实际不符仍记录失败', () => {
  const p = operation();
  assert.equal(p.run('operation.input.requestedState'), 'stopped');
  assert.equal(p.run('JSON.stringify({runtime:subject.runtime,observed:subject.observed,desired:subject.desired})===before'), true);
  finish(p, verified({ observedState: 'running' }));
  assert.equal(p.run('operation.status'), 'failed');
  assert.equal(p.run('operation.commandResult'), 'success');
  assert.equal(p.run('subject.runtime'), 'running');
  assert.equal(p.run('subject.desired'), 'running');
  assert.equal(p.run('subject.stopVerified'), false);
  assert.equal(p.run('operation.runtimeChecks.length'), 1);
  assert.match(p.html('modal'), /命令返回：成功/);
  assert.match(p.html('modal'), /实际状态没有达到请求/);
});

test('命令报错仍核对，执行已结束且实际达到停止请求可以成功', () => {
  const p = operation();
  finish(p, verified({ commandResult: 'error' }));
  assert.equal(p.run('operation.status'), 'success');
  assert.equal(p.run('operation.commandResult'), 'error');
  assert.equal(p.run('operation.steps[0].status'), 'failed');
  assert.equal(p.run('subject.runtime'), 'stopped');
  assert.equal(p.run('subject.desired'), 'stopped');
  assert.equal(p.run('isExpectedStop(subject)'), true);
  assert.equal(p.run('activeOps(subject).length'), 0);
  assert.match(p.html('modal'), /已核对 4 \/ 4 个分项/);
  assert.match(p.html('modal'), /width:100%/);
});

test('实际核对失败保留历史运行与时间，界面明确当前未知且继续保护', () => {
  const p = operation();
  finish(p, verified({ observedState: 'unknown', observedAt: null }));
  assert.equal(p.run('operation.status'), 'unknown');
  assert.equal(p.run('JSON.stringify({runtime:subject.runtime,observed:subject.observed,desired:subject.desired})===before'), true);
  assert.equal(p.run('subject.runtimeCheckStatus'), 'unknown');
  assert.equal(p.run('activeOps(subject).length'), 1);
  p.click('project', { id: 'p1' });
  assert.match(p.html('app'), /当前待核对/);
  assert.match(p.html('app'), /上次观测：运行中/);
  p.run('runProjectCheck(subject);');
  assert.equal(p.run('JSON.parse(before).observed===subject.observed'), true);
  assert.equal(p.run('subject.desired'), 'running');
});

test('状态达到但缺少执行结束证据仍未知，再核对只补同一操作证据', () => {
  const p = operation();
  finish(p, verified({ executionEnded: false }));
  assert.equal(p.run('operation.status'), 'unknown');
  assert.equal(p.run('subject.runtime'), 'stopped');
  assert.equal(p.run('subject.desired'), 'running');
  assert.equal(p.run('subject.stopVerified'), false);
  assert.equal(p.run('activeOps(subject).length'), 1);
  p.run('const countBefore=S.operations.length;');
  finish(p, verified());
  assert.equal(p.run('operation.status'), 'success');
  assert.equal(p.run('operation.runtimeChecks.length'), 2);
  assert.equal(p.run('operation.runtimeChecks[0].assessment.status'), 'unknown');
  assert.equal(p.run('S.operations.length===countBefore'), true);
  assert.equal(p.run('subject.stopVerified'), true);
});

test('明确失败后可通过表单再次只读核对，保留先前失败与原命令结果', () => {
  const p = operation();
  finish(p, verified({ commandResult: 'error', observedState: 'running' }));
  assert.equal(p.run('operation.status'), 'failed');
  p.run('const operationCount=S.operations.length;openModal("verifyop",{id:operation.id});');
  p.submit('verifyop', { 'runtime-command': 'success', 'runtime-observed': 'stopped', 'runtime-ended': 'on', 'runtime-identity': 'on' });
  assert.equal(p.run('operation.status'), 'success');
  assert.equal(p.run('operation.runtimeChecks[0].assessment.status'), 'failed');
  assert.equal(p.run('operation.runtimeChecks[1].assessment.status'), 'success');
  assert.equal(p.run('operation.commandResult'), 'error');
  assert.equal(p.run('operation.runtimeChecks[1].evidence.commandResult'), 'error');
  assert.equal(p.run('S.operations.length'), p.run('operationCount'));
  const loaded = prototype(p.saved());
  assert.equal(loaded.run('S.operations.find(o=>o.kind==="stop").runtimeChecks.length'), 2);
});

test('早于受理或上次核对的状态不能让原操作成功，终态迟到回调不冒充再次核对', () => {
  const stale = operation();
  finish(stale, verified({ observedAt: '2000-01-01T00:00:00.000Z' }));
  assert.equal(stale.run('operation.status'), 'unknown');
  assert.equal(stale.run('JSON.parse(before).observed===subject.observed'), true);
  const p = operation();
  p.run('operation.time=new Date(Date.now()-60000).toISOString();');
  finish(p, verified({ observedState: 'running', observedAt: new Date(Date.now() - 30000).toISOString() }));
  assert.equal(p.run('operation.status'), 'failed');
  finish(p, verified());
  assert.equal(p.run('operation.status'), 'failed');
  assert.equal(p.run('operation.runtimeChecks.length'), 1);
  p.run(`finishRuntimeOperation(operation,${JSON.stringify(verified({ observedAt: new Date(Date.now() - 20000).toISOString() }))},{recheck:true});`);
  assert.equal(p.run('operation.status'), 'unknown');
  assert.equal(p.run('operation.runtimeChecks.length'), 2);
  assert.equal(p.run('operation.runtimeChecks[1].assessment.canUpdateObservation'), false);
  assert.equal(p.run('subject.runtime'), 'running');
  assert.equal(p.run('operation.protectionReleased'), true);
});

test('目标身份未核实不能更新实际观测，重启还需要本次动作证据', () => {
  const p = operation();
  finish(p, verified({ identityVerified: false }));
  assert.equal(p.run('operation.status'), 'unknown');
  assert.equal(p.run('subject.runtime'), 'running');
  assert.equal(p.run('JSON.parse(before).observed===subject.observed'), true);
  const restarted = operation('restart');
  finish(restarted, verified({ observedState: 'running', restartVerified: false }));
  assert.equal(restarted.run('operation.status'), 'unknown');
  finish(restarted, verified({ observedState: 'running', restartVerified: true }));
  assert.equal(restarted.run('operation.status'), 'success');
});

test('仅部分成员符合请求记录部分完成，拒绝的冲突请求不改变原操作或项目', () => {
  const p = operation();
  p.run('const fixed=JSON.stringify(operation.input),state=JSON.stringify(subject);const rejected=startOperation(subject,"start",{},"success",{hold:true});');
  assert.equal(p.run('rejected'), null);
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.equal(p.run('JSON.stringify(subject)===state&&JSON.stringify(operation.input)===fixed'), true);
  finish(p, verified({ observedState: 'partial' }));
  assert.equal(p.run('operation.status'), 'partial');
  assert.equal(p.run('subject.runtime'), 'partial');
  assert.equal(p.run('subject.stopVerified'), false);
});

test('主动停止只有核实后抑制告警，巡检不会把意外退出变为预期停止', () => {
  const p = operation();
  finish(p, verified());
  p.run('S.notifications=[];runProjectCheck(subject,{runtime:"stopped"});');
  assert.equal(p.run('S.notifications.length'), 0);
  p.run('runProjectCheck(subject,{runtime:"running"});runProjectCheck(subject,{runtime:"stopped"});');
  assert.equal(p.run('subject.stopVerified'), false);
  assert.equal(p.run('isExpectedStop(subject)'), false);
  assert.match(p.run('S.notifications[0].text'), /意外停止/);
  const crash = prototype();
  crash.run('const subject=pr("p1");runProjectCheck(subject,{runtime:"stopped"});');
  assert.equal(crash.run('subject.desired'), 'running');
  assert.match(crash.run('S.notifications[0].text'), /意外停止/);
});

test('启动受理清除旧停止豁免，失败但已结束的稳定实际结果更新基线而不静默', () => {
  const p = prototype();
  p.run('const subject=pr("p7"),operation=startOperation(subject,"start",{},"success",{hold:true});');
  assert.equal(p.run('operation.input.requestedState'), 'running');
  assert.equal(p.run('subject.stopVerified'), false);
  assert.equal(p.run('isExpectedStop(subject)'), false);
  finish(p, verified());
  assert.equal(p.run('operation.status'), 'failed');
  assert.equal(p.run('subject.desired'), 'stopped');
  assert.equal(p.run('subject.stopVerified'), false);
  p.run('runProjectCheck(subject,{runtime:"stopped"});');
  assert.match(p.run('S.notifications[0].text'), /意外停止/);
  const restarted = operation('restart');
  finish(restarted, verified());
  assert.equal(restarted.run('operation.status'), 'failed');
  assert.equal(restarted.run('subject.desired'), 'stopped');
  assert.equal(restarted.run('subject.stopVerified'), false);
});

test('迁出旧 P1 受理意图但保留原型资料与意见，不把旧失败当停止成功', () => {
  const p = prototype();
  p.run(`S.review.p1='accepted';S.review.notes=[{text:'保留意见'}];pr('p1').desired='stopped';pr('p1').cfg.appConfig='保留正文';delete pr('p1').stopVerified;record('旧停止失败','stop','p1','failed','旧记录',{input:{before:{runtime:'running',desired:'running'}}});persist();`);
  const loaded = prototype(p.saved());
  assert.equal(loaded.run('S.review.p1'), undefined);
  assert.equal(loaded.run('S.review.notes[0].text'), '保留意见');
  assert.equal(loaded.run('pr("p1").cfg.appConfig'), '保留正文');
  assert.equal(loaded.run('pr("p1").desired'), 'running');
  assert.equal(loaded.run('pr("p1").stopVerified'), false);
  assert.equal(loaded.run('S.operations[0].input.requestedState'), 'stopped');
  loaded.run('openModal("scenes");');
  assert.doesNotMatch(loaded.html('modal'), /调整待审行为|reviewsettings/);
  loaded.run('openModal("reviewsettings");');
  assert.equal(loaded.document.getElementById('modal').open, false);
});
