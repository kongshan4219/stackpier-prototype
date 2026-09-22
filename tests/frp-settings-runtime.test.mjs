import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function installed(roles = ['server']) {
  const p = prototype(undefined, { hash: '#frp' });
  p.run(`const items=${JSON.stringify(roles.map(role => ({ node: 'n4', role })))};const frpInitial=frpRun(items,'deploy',{binary:true,identity:true,impact:true,goal:'running',hold:true});frpFinish(frpInitial,'success');`);
  return p;
}

test('六类模板原文可编辑，未保存预览不改变草稿、应用或操作记录', () => {
  const p = installed();
  assert.equal(p.run('frpTemplateSlots.length'), 6);
  for (const name of JSON.parse(p.run('JSON.stringify(frpTemplateSlots)'))) {
    const original = p.run(`S.frp.templates[${JSON.stringify(name)}]`);
    const source = '\n# 编辑演示\n' + original + '\n  ';
    p.click('frp-template', { id: name });
    p.run('var frpBeforePreview=JSON.stringify([S.frp,S.operations,S.projects]);');
    p.document.querySelector('#ft-source').value = source;
    p.click('frp-template-preview');
    assert.equal(p.run('JSON.stringify([S.frp,S.operations,S.projects])===frpBeforePreview'), true);
    assert.match(p.html('modal'), /受影响连接/);
    p.submit('frp-template', { 'ft-source': source });
    assert.equal(p.run(`S.frp.templates[${JSON.stringify(name)}]`), source);
  }
  assert.equal(p.run('pr("frp-n4-server").frpApplied.files.toml===frpInitial.input.items[0].files.toml'), true);
  assert.equal(p.run('S.operations.filter(o=>o.frp).length'), 1);
});

test('模板认证占位不可删、硬编码或重复，未知及错角色占位拒绝', () => {
  const p = prototype(undefined, { hash: '#frp' });
  const original = p.run('S.frp.templates["frpc.toml.tpl"]');
  const invalid = [
    original.replace('auth.token = "${auth_token}"\n', ''),
    original.replace('${auth_token}', 'DEMO_NODE_TOKEN'),
    original + '\nauth.token = "DEMO_SECOND_TOKEN"\n',
    original + '\n[auth]\ntoken = "DEMO_SECOND_TOKEN"\n',
    original + '\nauth . "token" = "DEMO_SECOND_TOKEN"\n',
    original + '\n["auth"]\ntoken = "DEMO_SECOND_TOKEN"\n',
    original + '\n${arbitrary_command}\n',
    original + '\n${visitors}\n',
    original.replace('serverAddr = "${server_ip}"', '# ${server_ip}\nserverAddr = "192.0.2.123"'),
  ];
  for (const source of invalid) {
    p.click('frp-template', { id: 'frpc.toml.tpl' });
    p.submit('frp-template', { 'ft-source': source });
    assert.equal(p.document.getElementById('modal-error').hidden, false);
    assert.equal(p.run('S.frp.templates["frpc.toml.tpl"]'), original);
  }
});

test('固定占位支持参考包两种写法及字面美元，不读取环境或执行表达式', () => {
  const p = prototype(undefined, { hash: '#frp' });
  p.run('S.frp.templates["frpc.toml.tpl"]=S.frp.templates["frpc.toml.tpl"].replace(/\\$\\{([a-z_]+)\\}/g,"$$$1")+"\\n# $$literal\\n";');
  assert.equal(p.run('frpValidate().length'), 0);
  assert.match(p.run('frpFiles(frpNode("n4"),"client").toml'), /# \$literal/);
  assert.throws(() => p.run('frpSubstitute("${process.env.SECRET}",{})'));
});

test('全局token保存只改草稿，STCP密钥、在途输入及旧应用参照保持', () => {
  const p = installed(['server', 'client', 'visitor']);
  p.run('const beforeApplied=JSON.stringify(S.projects.map(p=>p.frpApplied)),beforeSecrets=JSON.stringify(S.frp.nodes.map(n=>n.proxies.map(x=>x.secret_key)));const pendingOp=frpRun([{node:"n3",role:"server"}],"deploy",{binary:true,identity:true,impact:true,goal:"running",hold:true}),frozen=JSON.stringify(pendingOp.input);');
  p.click('frp-settings');
  assert.match(p.html('modal'), /全局统一 auth.token/);
  p.submit('frp-settings', { 'fs-root': '/srv/services/frp', 'fs-systemd': '/etc/systemd/system', 'fs-user': 'root', 'fs-naming': 'legacy', 'fs-token': 'DEMO_NEW_GLOBAL_TOKEN' });
  assert.equal(p.run('S.frp.settingsRev'), 2);
  assert.equal(p.run('JSON.stringify(pendingOp.input)===frozen&&JSON.stringify(S.projects.map(p=>p.frpApplied))===beforeApplied'), true);
  assert.equal(p.run('JSON.stringify(S.frp.nodes.map(n=>n.proxies.map(x=>x.secret_key)))===beforeSecrets'), true);
  assert.equal(p.run('frpAffectedRoles().every(x=>frpFiles(x.node,x.role).toml.includes("DEMO_NEW_GLOBAL_TOKEN"))'), true);
  p.run('frpFinish(pendingOp,"success");');
  assert.equal(p.run('pr("frp-n3-server").frpApplied.files.toml.includes("DEMO_NEW_GLOBAL_TOKEN")'), false);
  assert.equal(p.run('frpPending(frpNode("n3"),"server")'), true);
});

test('同连接认证更新须明确覆盖旧认证角色，其他连接不自动部署', () => {
  const p = installed(['server', 'client', 'visitor']);
  p.run('S.frp.token="DEMO_GLOBAL_CHANGED";S.frp.settingsRev++;frpSyncConfigs();const otherBefore=JSON.stringify(pr("frp-n3-server"));frpRun([{node:"n4",role:"server"}],"deploy",{binary:true,identity:true,impact:true,authChange:true,goal:"running",hold:true});');
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /配对角色仍使用旧认证/);
  p.click('frp-group', { node: 'n4' });
  assert.equal(p.run('ui.modal.items.length'), 3);
  p.submit('frp-op', { 'fo-binary': 'on', 'fo-identity': 'on', 'fo-impact': 'on', 'fo-authchange': 'on', 'fo-goal': 'running', 'outcome': 'success', 'fo-hold': 'on' });
  p.run('const changed=S.operations[0];frpFinish(changed,"success");');
  assert.equal(p.run('changed.status'), 'success');
  assert.equal(p.run('JSON.stringify(pr("frp-n3-server"))===otherBefore'), true);
  assert.equal(p.run('items.every(x=>pr(frpPid(frpNode(x.node),x.role)).frpApplied.files.toml.includes("DEMO_GLOBAL_CHANGED"))'), true);
});

test('旧节点不同token迁移为待确认草稿，不改变已应用及历史快照', () => {
  const p = installed(['server', 'client', 'visitor']);
  p.run('frpNode("n4").token="DEMO_LEGACY_NODE_TOKEN";const before=JSON.stringify(pr("frp-n4-server").frpApplied);persist();');
  const reloaded = prototype(p.saved(), { hash: '#frp' });
  assert.equal(reloaded.run('Object.hasOwn(frpNode("n4"),"token")'), false);
  assert.equal(reloaded.run('frpNode("n4").authMigration.roles.length'), 3);
  assert.equal(reloaded.run('JSON.stringify(pr("frp-n4-server").frpApplied)'), p.run('before'));
  assert.match(reloaded.html('app'), /旧节点认证待确认/);
  reloaded.run('frpRun([{node:"n4",role:"server"}],"deploy",{binary:true,identity:true,impact:true,goal:"running",hold:true});');
  assert.match(reloaded.run('S.operations[0].message'), /明确确认认证变化/);
});

test('预览后修订变化拒绝受理，不悄悄采用新token', () => {
  const p = prototype(undefined, { hash: '#frp' });
  p.click('frp-op', { node: 'n4', role: 'server', op: 'deploy' });
  p.run('S.frp.token="DEMO_CHANGED_AFTER_PREVIEW";S.frp.settingsRev++;');
  p.submit('frp-op', { 'fo-binary': 'on', 'fo-identity': 'on', 'fo-impact': 'on', 'fo-goal': 'running', 'outcome': 'success', 'fo-hold': 'on' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /预览后配置/);
});

for (const [commandResult, observedState, expected] of [['error', 'stopped', 'success'], ['success', 'running', 'failed'], ['success', 'unknown', 'unknown']]) {
  test(`FRP停止独立核对：命令${commandResult}、观测${observedState}判${expected}`, () => {
    const p = installed();
    p.run(`const action=frpRun([{node:'n4',role:'server'}],'stop',{identity:true,impact:true,hold:true});frpFinish(action,{commandResult:${JSON.stringify(commandResult)},executionEnded:true,identityVerified:true,observedState:${JSON.stringify(observedState)}});`);
    assert.equal(p.run('action.status'), expected);
    assert.equal(p.run('action.frpRuntimeResults[0].evidence.commandResult'), commandResult);
    assert.equal(p.run('pr("frp-n4-server").runtime'), observedState === 'unknown' ? 'running' : observedState);
    assert.equal(p.run('pr("frp-n4-server").desired'), expected === 'success' ? 'stopped' : 'running');
    assert.equal(p.run('pr("frp-n4-server").health'), 'unknown');
    if (expected === 'unknown') {
      assert.equal(p.run('action.protectionReleased'), false);
      assert.match(p.run('frpRoleStatus(frpNode("n4"),"server")'), /当前待核对/);
    }
  });
}

test('FRP未知核对不重放；重启仅running不足，补新进程证据后完成', () => {
  const p = installed();
  p.run('const action=frpRun([{node:"n4",role:"server"}],"restart",{identity:true,impact:true,hold:true});frpFinish(action,{commandResult:"error",executionEnded:true,identityVerified:true,observedState:"running",restartVerified:false});const count=S.operations.length;');
  assert.equal(p.run('action.status'), 'unknown');
  p.click('frp-reconcile', { id: p.run('action.id') });
  p.submit('frp-reconcile', { 'fr-0-command': 'success', 'fr-0-ended': 'on', 'fr-0-identity': 'on', 'fr-0-observed': 'running', 'fr-0-restart': 'on' });
  assert.equal(p.run('action.status'), 'success');
  assert.equal(p.run('action.frpRuntimeResults[0].evidence.commandResult'), 'error');
  assert.equal(p.run('action.frpRuntimeChecks.length'), 2);
  assert.equal(p.run('S.operations.length===count'), true);
});

test('FRP旧观测不得强判成功，历史迟到核对不覆盖新操作', () => {
  const p = installed();
  p.run('const old=frpRun([{node:"n4",role:"server"}],"stop",{identity:true,impact:true,hold:true});frpFinish(old,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"stopped",observedAt:"2000-01-01T00:00:00Z"});');
  assert.equal(p.run('old.status'), 'unknown');
  p.run('frpFinish(old,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"running"});const newer=frpRun([{node:"n4",role:"server"}],"stop",{identity:true,impact:true,hold:true});frpFinish(newer,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"stopped"});const current=JSON.stringify(pr("frp-n4-server"));frpFinish(old,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"running"});');
  assert.equal(p.run('JSON.stringify(pr("frp-n4-server"))===current'), true);
});
