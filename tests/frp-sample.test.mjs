import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';
import { referencePrototype } from './frp-fixtures.mjs';

function oldDefault(mutation = '') {
  const p = referencePrototype(undefined, { hash: '#frp' });
  p.run(`${mutation}delete S.frp.sampleVersion;persist();`);
  return p.saved();
}

const earlyFileCache = `for(const p of S.projects.filter(p=>p.frpRef)){
  const n=frpNode(p.frpRef.node),role=p.frpRef.role,f=frpFiles(n,role);
  p.serverName=role==='client'?'FRP 内网执行机（待核对）':'FRP 云节点 '+n.ip;
  p.cfg.textDeployment={type:'systemd',serverId:p.server,fileName:frpUnit(n,role),workingDir:S.frp.root,content:f.unit,files:[{path:f.tomlPath,content:f.toml}],program:p.cfg.program,binaryPath:f.binaryPath};
}`;

test('当前 FRP 样例展示已登记服务器关系和四条连接配置，复用完整角色部署', () => {
  const p = prototype(undefined, { hash: '#frp' });
  const state = JSON.parse(p.saved());
  assert.equal(state.frp.nodes.length, 4);
  assert.equal(p.run('frpInstalledServers("client").map(s=>s.id).join(",")'), 's1,s3');
  assert.equal(p.run('frpInstalledServers("server").map(s=>s.id).join(",")'), 's2,s4');
  assert.equal(p.run('S.frp.nodes.flatMap(n=>n.proxies).filter(x=>x.type==="tcp").length'), 6);
  assert.equal(p.run('S.frp.nodes.flatMap(n=>n.proxies).filter(x=>x.type==="stcp").length'), 2);
  assert.equal(p.run('frpValidate().length'), 0);
  assert.equal(p.run('S.servers.length'), 4);
  assert.equal(p.run('frpPid(frpNode("n1"),"server")===frpPid(frpNode("n3"),"server")'), true);
  assert.equal(p.run('frpPid(frpNode("n2"),"server")===frpPid(frpNode("n4"),"server")'), true);
  assert.match(p.run('frpConnectionCard(frpNode("n1"))'), /本地实验节点[\s\S]*云端应用节点[\s\S]*运行中/);
  assert.match(p.run('frpConnectionCard(frpNode("n2"))'), /frpc 已部署[\s\S]*连接配置待应用/);
  assert.match(p.run('frpConnectionCard(frpNode("n3"))'), /ARM 实验节点[\s\S]*frpc visitor[\s\S]*运行中/);
  assert.match(p.run('frpConnectionCard(frpNode("n4"))'), /已停止[\s\S]*frpc visitor[\s\S]*已停止/);
  assert.doesNotMatch(p.html('app'), /身份待提供|未在参考包中提供|未部署|部署fpr/);
  assert.equal(p.run('S.frp.nodes.every(n=>frpConnectionCard(n).includes("连通性待核对"))'), true);
  for (const project of state.projects.filter(project => project.frpApplied)) {
    const applied = project.frpApplied;
    assert.equal(project.life, 'installed');
    assert.equal(applied.host, project.server);
    assert.equal(project.appliedRev, project.draftRev);
    assert.equal(project.health, 'unknown');
    if (project.frpInstallation?.role === 'client') {
      assert.equal(applied.files.unit, '');
      assert.equal(project.runtime, 'na');
    } else {
      assert.ok(applied.files.unit.includes(`ExecStart=${applied.files.binaryPath} -c ${applied.files.tomlPath}`));
    }
  }
  assert.deepEqual(JSON.parse(prototype(p.saved(), { hash: '#frp' }).saved()), state, '刷新不重放样例部署或改变完整参照');
});

test('样例连接仍通过应用配置流程启动，停止的完整参照支持原 unit 启动', () => {
  const p = prototype(undefined, { hash: '#frp' });
  p.click('frp-op', { node: 'n2', role: 'client', op: 'deploy' });
  assert.equal(p.document.querySelector('#fo-binary'), null);
  p.submit('frp-op', { 'fo-identity': 'on', 'fo-impact': 'on', 'fo-hold': 'on', outcome: 'success' });
  p.click('finishdemo', { id: p.run('S.operations[0].id') });
  assert.equal(p.run('pr(frpPid(frpNode("n2"),"client")).runtime'), 'running');
  assert.equal(p.run('frpPending(frpNode("n2"),"client")'), false);
  p.run('const start=frpRun([{node:"n4",role:"client"}],"start",{identity:true,impact:true,hold:true});frpFinish(start,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"running"});');
  assert.equal(p.run('pr(frpPid(frpNode("n4"),"client")).runtime'), 'running');
  assert.equal(p.run('pr(frpPid(frpNode("n4"),"visitor")).runtime'), 'stopped');
});

test('刷新未修改的旧默认样例，保留非 FRP 草稿、意见与既有数据', () => {
  const saved = oldDefault(earlyFileCache+'pr("p1").name="保留项目";pr("p1").cfg.appConfig="保留草稿";sr("s3").name="数据副本节点";S.review.notes=[{text:"保留意见"}];S.projects.filter(p=>p.frpRef).forEach(p=>delete p.stopVerified);');
  const before = JSON.parse(saved);
  const p = prototype(saved, { hash: '#frp' });
  const after = JSON.parse(p.saved());
  assert.equal(after.frp.sampleVersion, 1);
  assert.equal(p.run('frpInstalledServers("client").length'), 2);
  assert.equal(p.run('frpInstalledServers("server").length'), 2);
  assert.deepEqual(after.projects.filter(project => !project.frpRef && !project.frpInstallation), before.projects.filter(project => !project.frpRef));
  for (const key of ['operations', 'dns', 'firewalls', 'notifications', 'settings', 'review']) assert.deepEqual(after[key], before[key], key);
  assert.deepEqual(after.servers, before.servers.filter(server => !server.id.startsWith('frp-')));
  assert.deepEqual(JSON.parse(prototype(p.saved(), { hash: '#frp' }).saved()), after);
});

test('编辑、关联或部署过的旧 FRP 数据不会被默认样例替换', () => {
  for (const mutation of [
    'frpNode("n4").proxies[0].local_port=3307;frpNode("n4").revision++;',
    'S.frp.token="EXAMPLE_CUSTOM_TOKEN";S.frp.settingsRev++;',
    'S.frp.templates["frpc.toml.tpl"]+="\\n# 用户模板";S.frp.templateRev++;',
    'pr("frp-n4-client").name="自定义客户端项目";',
    earlyFileCache+'pr("frp-n4-client").cfg.textDeployment.content+="\\n# 用户修改正文";',
    'sr("frp-source").name="已登记客户端";',
    'S.dns[0].projects.push("frp-n4-client");',
    'S.projects=S.projects.filter(p=>p.id!=="frp-n4-client");',
    'record("检查参考服务器","check",null,"unknown","保留原执行",{resources:["server:frp-host-n4"]});',
    'const operation=frpRun([{node:"n4",role:"server"}],"deploy",{binary:true,identity:true,impact:true,hold:true});frpFinish(operation,"success");',
    'const operation=frpRun([{node:"n4",role:"server"}],"deploy",{binary:true,identity:true,impact:true,hold:true});',
  ]) {
    const saved = oldDefault(mutation), before = JSON.parse(saved);
    const after = JSON.parse(prototype(saved).saved());
    assert.deepEqual(after.frp, before.frp, mutation);
    assert.deepEqual(after.projects, before.projects, mutation);
    assert.deepEqual(after.servers, before.servers, mutation);
    assert.equal(after.frp.sampleVersion, undefined, mutation);
  }
});

test('空场景与刷新保持零连接，明确重置后恢复当前虚构样例并保留意见', () => {
  const p = prototype();
  p.run('S.review.notes=[{text:"保留意见"}];loadScene("empty");');
  p.click('frp-home');
  assert.equal(p.run('S.frp.nodes.length'), 0);
  assert.equal(p.run('S.servers.length'), 0);
  assert.equal(p.run('frpInstalledServers("client").length'), 0);
  assert.match(p.html('app'), /尚无连接/);
  const reloaded = prototype(p.saved(), { hash: '#frp' });
  assert.equal(reloaded.run('S.frp.nodes.length'), 0);
  assert.equal(reloaded.run('S.servers.length'), 0);
  reloaded.click('resetdemo');
  assert.equal(reloaded.run('S.frp.nodes.length'), 4);
  assert.equal(reloaded.run('frpInstalledServers("server").length'), 2);
  assert.equal(reloaded.run('S.review.notes[0].text'), '保留意见');
  const withoutFrp = JSON.parse(p.saved());delete withoutFrp.frp;
  assert.equal(prototype(JSON.stringify(withoutFrp), { hash: '#frp' }).run('S.frp.nodes.length'), 0);
});
