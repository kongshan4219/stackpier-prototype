import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

test('实际入口在组件全部就绪后初始化；组件加载失败保留错误与重载入口', () => {
  const p = prototype();
  assert.equal(p.run('prototypeLoading.ready'), true);
  const failed = prototype(undefined, { missingScript: 'assets/features/plans.js' });
  assert.equal(failed.run('prototypeLoading.ready'), false);
  assert.equal(failed.run('prototypeLoading.errors.length'), 1);
  assert.match(failed.document.getElementById('boot-status').textContent, /组件加载失败/);
  assert.equal(failed.document.getElementById('reload').hidden, false);
  assert.doesNotMatch(failed.html('app'), /workspace-shell/);
  assert.equal(failed.saved(), undefined);
});

test('入口组件共同渲染全部导航页面、项目页与内容分类', () => {
  const p = prototype();
  const pages = ['overview', 'servers', 'projects', 'frp', 'templates', 'programs', 'backups', 'plans', 'monitor', 'firewall', 'dns', 'operations', 'settings'];
  assert.equal(p.run('navItems.map(item=>item[0]).join(",")'), pages.join(','));
  for (const page of pages) {
    p.click('navigate', { page });
    assert.equal(p.run('ui.page'), page);
    assert.match(p.html('app'), /<main id="main"[^>]*>[\s\S]*<h1\b/, page);
  }
  p.click('project', { id: 'p1' });
  for (const tab of ['overview', 'config', 'backups', 'monitor', 'deps', 'logs', 'history']) {
    p.click('tab', { id: tab });
    assert.equal(p.run('ui.tab'), tab);
    assert.match(p.html('app'), /<h1\b/);
  }
  for (const [page, action, id, state] of [['backups', 'backuptab', 'ranges', 'backupTab'], ['plans', 'plantab', 'policies', 'planTab'], ['monitor', 'monitortab', 'notifications', 'monitorTab']]) {
    p.click('navigate', { page });
    p.click(action, { id });
    assert.equal(p.run('ui.' + state), id);
    assert.match(p.html('app'), /<h1\b/);
  }
  p.click('navigate', { page: 'frp' });
  for (const id of ['connections', 'node', 'files', 'deploy', 'review']) {
    p.click('frp-tab', { id });
    assert.equal(p.run('FRP.tab'), id);
    assert.match(p.html('app'), /FRP 部署方案/);
  }
  p.click('project', { id: 'frp-n4-visitor' });
  assert.match(p.html('app'), /frpc visitor（STCP 访问端）/);
});

test('关键弹窗通过共同分发器渲染，FRP 弹窗覆盖仍生效', () => {
  const p = prototype();
  p.run('frpEnsure();');
  const cases = [
    ['serveredit', {}], ['serverdetail', { id: 's1' }],
    ['newproject', { step: 1, draft: {} }], ['projectop', { id: 'p1', op: 'stop' }],
    ['configdiff', { id: 'p1' }], ['templateedit', {}], ['programupload', {}],
    ['backupconfig', { id: 'p1' }], ['restore', { id: 'b4' }],
    ['planedit', {}], ['policyedit', {}], ['dnsedit', {}], ['firewalledit', {}],
    ['feedback', {}], ['scenes', {}],
    ['frp-nodeedit', { id: 'n4' }], ['frp-proxyedit', { node: 'n4', index: 0 }],
    ['frp-template', { id: 'frpc.toml.tpl' }], ['frp-settings', {}],
    ['frp-batch', { role: 'client' }], ['frp-op', { node: 'n4', role: 'visitor', op: 'deploy' }],
  ];
  for (const [kind, data] of cases) {
    p.document.getElementById('modal').innerHTML = '';
    p.run(`openModal(${JSON.stringify(kind)},${JSON.stringify(data)});`);
    assert.equal(p.document.getElementById('modal').open, true, kind);
    assert.match(p.html('modal'), /<h2 id="dialog-title">[^<]+<\/h2>/, kind);
    assert.match(p.html('modal'), /id="modal-error"/, kind);
    p.click('closemodal');
    assert.equal(p.document.getElementById('modal').open, false, kind);
  }
});

test('演示访问流程保留错误提示、首次设置与登录，密码不进入浏览器保存状态', () => {
  const p = prototype();
  p.click('logout');
  p.submit('auth', { 'access-password': 'DEMO_WRONG_PASSWORD' });
  assert.equal(p.run('ui.auth'), 'login');
  assert.equal(p.document.getElementById('auth-error').hidden, false);
  p.click('authsetup');
  p.submit('auth', { 'access-password': 'short', 'access-confirm': 'short' });
  assert.equal(p.run('ui.initialized'), false);
  const password = 'DEMO_COMPONENT_ACCESS_2026';
  p.submit('auth', { 'access-password': password, 'access-confirm': password });
  assert.equal(p.run('ui.auth'), 'setup-success');
  p.click('authlogin');
  p.submit('auth', { 'access-password': password });
  assert.equal(p.run('ui.auth'), null);
  assert.match(p.html('app'), /<main id="main"/);
  assert.equal(p.saved().includes(password), false);
});

test('共享配置正文原样保存；显式采用和项目保存都不应用或启动', () => {
  const p = prototype();
  const source = '\n  # 保留注释与首尾空白\nservices:\n  example:\n    image: "example:${TAG}"\n    command: ["echo", "  demo  "]\n\n  ';
  p.run('const subject=pr("p3"),templateId=subject.template,appliedBefore=JSON.stringify(subject.applied),draftBefore=JSON.stringify(subject.cfg),opsBefore=S.operations.length,runtimeBefore=subject.runtime;openModal("templateedit",{id:templateId});');
  p.submit('templateedit', { 'tpl-name': '测试完整 Compose', 'tpl-type': 'compose', 'tpl-source': source });
  assert.equal(p.run('tpl(templateId).tpl'), source);
  assert.equal(p.run('subject.templateUpdate'), true);
  assert.equal(p.run('JSON.stringify(subject.cfg)===draftBefore&&JSON.stringify(subject.applied)===appliedBefore'), true);
  p.click('adopttemplate', { id: 'p3' });
  assert.equal(p.run('configText(subject)'), source);
  const edited = source + '\n# 仅保存本项目\n ';
  p.submit('fileprojectconfig', { 'cfg-source': edited }, { id: 'p3' });
  assert.equal(p.run('configText(subject)'), edited);
  assert.equal(p.run('JSON.stringify(subject.applied)===appliedBefore&&subject.runtime===runtimeBefore&&S.operations.length===opsBefore'), true);
  const reloaded = prototype(p.saved());
  assert.equal(reloaded.run('configText(pr("p3"))'), edited);
});

test('共享配置空正文不能覆盖已有内容，systemd 完整正文也原样保存', () => {
  const p = prototype();
  p.run('const templateId=pr("p1").template,before=JSON.stringify(tpl(templateId));openModal("templateedit",{id:templateId});');
  p.submit('templateedit', { 'tpl-name': '空正文', 'tpl-type': 'systemd', 'tpl-source': ' \n\t' });
  assert.equal(p.run('JSON.stringify(tpl(templateId))===before'), true);
  assert.equal(p.document.getElementById('modal-error').hidden, false);
  const source = '\n# 示例服务文件\n[Service]\nExecStart=/srv/example/app --name="  demo  "\nEnvironment="LABEL=${LABEL}"\n\n';
  p.submit('templateedit', { 'tpl-name': '完整服务文件', 'tpl-type': 'systemd', 'tpl-source': source });
  assert.equal(p.run('tpl(templateId).tpl'), source);
});

test('FRP 三角色仍生成配对 TOML 与 unit，地址、程序和转义保持一致', () => {
  const p = prototype(undefined, { hash: '#frp' });
  assert.equal(p.run('ui.page'), 'frp');
  assert.equal(p.run('frpValidate().length'), 0);
  const token = 'EXAMPLE_quote"_slash\\_line\nnext';
  p.run(`S.frp.token=${JSON.stringify(token)};`);
  const files = JSON.parse(p.run('JSON.stringify(Object.fromEntries(Object.keys(frpRoles).map(role=>[role,frpFiles(frpNode("n4"),role)])))'));
  for (const role of ['server', 'client', 'visitor']) {
    assert.ok(files[role].toml.includes('auth.token = ' + JSON.stringify(token)));
    assert.ok(files[role].unit.includes('ExecStart=' + files[role].binaryPath + ' -c ' + files[role].tomlPath));
  }
  assert.match(files.server.toml, /bindPort = 7000/);
  assert.match(files.client.toml, /\[\[proxies\]\][\s\S]*type = "stcp"/);
  assert.match(files.visitor.toml, /\[\[visitors\]\][\s\S]*serverName = "example-database"/);
  assert.match(files.visitor.toml, /bindAddr = "127.0.0.1"/);
  assert.equal(files.visitor.binaryPath, files.client.binaryPath);
  assert.notEqual(files.visitor.unitPath, files.client.unitPath);
});

test('FRP 批量操作初始不预选客户端，明确选择全部 visitor 仅包含 STCP 节点', () => {
  const p = prototype();
  p.click('frp-batch', { role: 'client' });
  assert.equal(p.run('frpBatchItems().length'), 0);
  assert.doesNotMatch(p.html('modal'), /默认客户端|client_enabled/);
  p.click('frp-batchconfirm');
  assert.equal(p.run('ui.modal.kind'), 'frp-batch');
  assert.match(p.document.getElementById('modal-error').textContent, /没有适用的选中节点/);
  p.document.querySelector('#fb-role').value = 'visitor';
  p.document.querySelector('#fb-scope').value = 'all';
  assert.equal(p.run('frpBatchItems().map(item=>item.node+":"+item.role).join(",")'), 'n3:visitor,n4:visitor');
  p.click('frp-batchconfirm');
  assert.equal(p.run('ui.modal.items.length'), 2);
  assert.equal(p.run('S.operations.filter(operation=>operation.frp).length'), 0);
});

test('FRP 零字节占位拒绝部署；普通项目操作也不能绕过专用流程', () => {
  const p = prototype();
  p.run('frpEnsure();const subject=pr("frp-n4-server");const result=frpRun([{node:"n4",role:"server"}],"deploy",{binary:false,identity:true,impact:true,goal:"running",hold:true}),rejected=S.operations[0];');
  assert.equal(p.run('result'), null);
  assert.equal(p.run('rejected.status'), 'rejected');
  assert.match(p.run('rejected.message'), /零字节/);
  assert.equal(p.run('subject.life'), 'draft');
  assert.equal(p.run('subject.applied'), null);
  p.run('startOperation(subject,"deploy",{},"success",{hold:true});const bypass=S.operations[0];');
  assert.equal(p.run('bypass.status'), 'rejected');
  assert.match(p.run('bypass.message'), /FRP 专用确认/);
  assert.equal(p.run('S.programs.filter(binary=>binary.placeholder).every(binary=>binary.bytes===0)'), true);
});

for (const outcome of ['partial', 'unknown']) {
  test(`FRP ${outcome} 保留先前完成角色、受理快照与独立网络记录`, () => {
    const p = prototype();
    p.run('frpEnsure();const networkBefore=JSON.stringify([S.dns,S.firewalls]),items=[{node:"n4",role:"server"},{node:"n4",role:"visitor"}];const operation=frpRun(items,"deploy",{binary:true,identity:true,impact:true,goal:"running",outcome:"success",hold:true});const fixedToml=operation.input.items[0].files.toml;S.frp.token="EXAMPLE_CHANGED_DURING_OPERATION";frpSyncConfigs();');
    p.run(`finishOperation(operation,${JSON.stringify(outcome)});`);
    assert.equal(p.run('operation.status'), outcome);
    assert.equal(p.run('pr("frp-n4-server").frpApplied.files.toml===fixedToml'), true);
    assert.equal(p.run('pr("frp-n4-server").runtime'), 'running');
    assert.equal(p.run('pr("frp-n4-visitor").frpApplied'), undefined);
    assert.equal(p.run('frpPending(frpNode("n4"),"server")'), true);
    assert.equal(p.run('JSON.stringify([S.dns,S.firewalls])===networkBefore'), true);
    if (outcome === 'unknown') {
      assert.equal(p.run('activeOps(pr("frp-n4-visitor")).length'), 1);
      const reloaded = prototype(p.saved());
      reloaded.run('const operation=S.operations.find(operation=>operation.frp),before=S.operations.length;finishOperation(operation,"failed");');
      assert.equal(reloaded.run('operation.status'), 'partial');
      assert.equal(reloaded.run('pr("frp-n4-server").life'), 'installed');
      assert.equal(reloaded.run('operation.frpCompleted.join(",")'), 'frp-n4-server');
      assert.equal(reloaded.run('operation.steps.slice(1,4).every(step=>step.status==="success")&&S.operations.length===before'), true);
    } else {
      assert.equal(p.run('pr("frp-n4-visitor").life'), 'incomplete');
      assert.ok(p.run('pr("frp-n4-visitor").components.length') > 0);
    }
  });
}
