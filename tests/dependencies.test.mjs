import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function scenario() {
  const p = prototype();
  p.run("const subject=pr('p3'),dependent=pr('p1');dependent.depChanges=[];const original=clone(subject.applied);");
  return p;
}
const changes = p => p.run('dependent.depChanges.length');

for (const outcome of ['failed', 'partial', 'unknown']) {
  test(`配置 ${outcome} 不通知依赖`, () => {
    const p = scenario();
    p.run(`subject.cfg.env+='\\nEXAMPLE=changed';const operation=startOperation(subject,'apply',{},'${outcome}',{hold:true});finishOperation(operation,'${outcome}');`);
    assert.equal(changes(p), 0);
    assert.equal(p.run('JSON.stringify(subject.applied)===JSON.stringify(original)'), true);
  });
}

test('完整成功且配置正文改变才通知；D3 完成不会采用执行期间保存的 D4', () => {
  const p = scenario();
  p.run("subject.cfg.env+='\\nEXAMPLE=D3';subject.draftRev=3;const operation=startOperation(subject,'apply',{},'success',{hold:true});subject.cfg.env+='\\nEXAMPLE=D4';subject.draftRev=4;finishOperation(operation,'success');");
  assert.equal(changes(p), 1);
  assert.equal(p.run("subject.applied.env.endsWith('EXAMPLE=D3')&&subject.cfg.env.endsWith('EXAMPLE=D4')"), true);
  assert.equal(p.run('dependent.depChanges[0].operation===operation.id'), true);
});

test('同内容应用、公共配置采用及草稿修订不通知', () => {
  const p = scenario();
  p.run("subject.cfg.templateRev++;subject.draftRev++;const operation=startOperation(subject,'apply',{},'success',{hold:true});finishOperation(operation,'success');subject.cfg.env+='\\nUNAPPLIED=only-draft';subject.draftRev++;persist();");
  assert.equal(changes(p), 0);
});

test('成功使用受理参照比较，不把 D4 的差异算作 D3 已应用变化', () => {
  const p = scenario();
  p.run("const operation=startOperation(subject,'apply',{},'success',{hold:true});subject.cfg.env+='\\nONLY_D4=changed';subject.draftRev++;finishOperation(operation,'success');");
  assert.equal(changes(p), 0);
});

test('程序身份确实改变才通知；未知历史身份和展示版本号变化不伪造事件', () => {
  for (const [previous, next, expected] of [['demo-content-a', 'demo-content-a', 0], ['demo-content-a', 'demo-new', 1], [undefined, 'demo-new', 0]]) {
    const p = prototype();
    p.run("const subject=pr('p1'),dependent=pr('p2');pr('p7').life='uninstalled';dependent.deps=[subject.id];dependent.depChanges=[];");
    if (previous !== undefined) p.run(`subject.applied.contentIdentity=${JSON.stringify(previous)};`);
    p.run(`S.programs.find(b=>b.id==='bin1').identity=${JSON.stringify(next)};subject.cfg.version='new-display-label';const operation=startOperation(subject,'update',{},'success',{hold:true});finishOperation(operation,'success');`);
    assert.equal(p.run('operation?.status'), 'success');
    assert.equal(changes(p), expected);
  }
});

for (const kind of ['start', 'stop', 'restart', 'backup']) {
  test(`${kind} 不通知依赖`, () => {
    const p = scenario();
    p.run(`const operation=startOperation(subject,'${kind}',{},'success',{hold:true});finishOperation(operation,'success');`);
    assert.equal(changes(p), 0);
  });
}

for (const outcome of ['success', 'partial', 'unknown', 'start-failed']) {
  test(`恢复 ${outcome} 只有完整成功且正文变化才通知`, () => {
    const p = scenario();
    p.run(`const backup=S.backups.find(b=>b.id==='b4');backup.config.env+='\\nRESTORED=change';const operation=startOperation(subject,'restore',{backupId:backup.id},'${outcome}',{hold:true});finishOperation(operation,'${outcome}');`);
    assert.equal(changes(p), outcome === 'success' ? 1 : 0);
  });
}

test('同内容恢复不通知', () => {
  const p = scenario();
  p.run("const operation=startOperation(subject,'restore',{backupId:'b4'},'success',{hold:true});finishOperation(operation,'success');");
  assert.equal(changes(p), 0);
});

test('原操作由 unknown 核对成功只通知一次，刷新和重复回读不重复追加', () => {
  const p = scenario();
  p.run("subject.cfg.env+='\\nCHANGE=1';const operation=startOperation(subject,'apply',{},'unknown',{hold:true});finishOperation(operation,'unknown');");
  assert.equal(changes(p), 0);
  p.run("finishOperation(operation,'success');finishOperation(operation,'success');notifyDependencies(subject,operation);persist();");
  assert.equal(changes(p), 1);
  const reloaded = prototype(p.saved());
  reloaded.run("const subject=pr('p3'),dependent=pr('p1'),operation=S.operations[0];notifyDependencies(subject,operation);finishOperation(operation,'success');");
  assert.equal(changes(reloaded), 1);
});
