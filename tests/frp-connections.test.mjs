import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';
import { referencePrototype } from './frp-fixtures.mjs';

function installed() {
  const p = referencePrototype(undefined, { hash: '#frp' });
  p.run('const installation=frpRun(["client","server","visitor"].map(role=>({node:"n4",role})),"deploy",{binary:true,identity:true,impact:true,hold:true});frpFinish(installation,"success");');
  return p;
}

test('新增连接无已部署角色时提示先部署并禁用选择和保存', () => {
  const p = emptyTopology();
  p.click('frp-nodeedit');
  assert.equal(p.document.querySelector('#fn-provider').disabled, true);
  assert.equal(p.document.querySelector('#fn-server').disabled, true);
  assert.equal(p.document.querySelector('button[type="submit"]').disabled, true);
  assert.match(p.html('modal'), /暂无可用服务器/);
  // 通用 frpc 演示项目虽标注已部署，也没有对应角色的完整部署参照。
  assert.equal(p.run('frpInstalledServers("client").length'), 0);
  assert.equal(p.run('frpInstalledServers("server").length'), 0);
});

test('新增连接按完整角色部署列出服务器，visitor 不当作客户端，已停止仍可选择', () => {
  const p = installed();
  p.run('const stopped=frpRun([{node:"n4",role:"client"}],"stop",{identity:true,impact:true,hold:true});frpFinish(stopped,{commandResult:"success",executionEnded:true,identityVerified:true,observedState:"stopped"});');
  p.click('frp-nodeedit');
  assert.equal(p.run('frpInstalledServers("client").map(s=>s.id).join(",")'), 'frp-source');
  assert.equal(p.run('frpInstalledServers("server").map(s=>s.id).join(",")'), 'frp-host-n4');
  assert.equal(p.document.querySelector('#fn-provider').disabled, false);
  assert.equal(p.document.querySelector('#fn-server').disabled, false);
  const before = p.run('JSON.stringify([S.frp,S.projects,S.servers,S.operations])');
  p.submit('frp-nodeedit', {'fn-provider':'frp-host-n4','fn-server':'frp-source','fn-bind':'0.0.0.0','fn-port':'7000'});
  assert.match(p.document.getElementById('modal-error').textContent, /请选择已部署 frpc/);
  assert.equal(p.run('JSON.stringify([S.frp,S.projects,S.servers,S.operations])'), before);
});

test('表单打开后角色被卸载，保存时再次校验并拒绝写入', () => {
  const p = installed();
  p.run('const removal=frpRun([{node:"n4",role:"client"}],"uninstall",{identity:true,impact:true,remove:true,hold:true});');
  p.click('frp-nodeedit');
  p.run('frpFinish(removal,"success");');
  const before = p.run('JSON.stringify([S.frp,S.projects,S.servers,S.operations])');
  const saved = p.saved();
  p.submit('frp-nodeedit', {'fn-provider':'frp-source','fn-server':'frp-host-n4','fn-bind':'0.0.0.0','fn-port':'7000'});
  assert.match(p.document.getElementById('modal-error').textContent, /部署状态可能已变化/);
  assert.equal(p.run('JSON.stringify([S.frp,S.projects,S.servers,S.operations])'), before);
  assert.equal(p.saved(), saved);
});

function emptyTopology() {
  const p = prototype(undefined, { hash: '#frp' });
  p.run('S.frp.nodes=[];S.projects=S.projects.filter(p=>!p.frpRef&&!p.frpInstallation);S.operations=[];frpGo("connections");');
  return p;
}

function deployRole(p, server, role, outcome = 'success') {
  p.click('frp-batch', { role, server });
  p.click('frp-batchconfirm');
  assert.equal(p.run('ui.modal.kind'), 'frp-install');
  p.submit('frp-install', { 'fi-binary':'on', 'fi-identity':'on', 'fi-impact':'on', 'fi-hold':'on', outcome });
  const id = p.run('S.operations[0].id');
  p.click('finishdemo', { id });
  assert.equal(p.run('S.operations[0].status'), outcome);
  return id;
}

function connect(p, client, server) {
  p.click('frp-nodeedit');
  p.submit('frp-nodeedit', { 'fn-provider':client, 'fn-server':server, 'fn-bind':'127.0.0.1', 'fn-port':'1' });
  assert.equal(p.document.getElementById('modal-error').textContent, '');
  return p.run('S.frp.nodes.at(-1).id');
}

test('零连接时先部署角色再建立连接，沿用 frps 已部署配置，应用后才启动 frpc', () => {
  const p = emptyTopology();
  deployRole(p, 's1', 'client');
  assert.equal(p.run('S.frp.nodes.length'), 0);
  assert.equal(p.run('frpServerDeployment("s1","client").runtime'), 'na');
  assert.equal(p.run('frpServerDeployment("s1","client").frpApplied.files.unit'), '');
  p.run('FRP_SOURCE.config.servers.find(n=>n.ip===sr("s2").host).bind_port=7100;');
  deployRole(p, 's2', 'server');
  const serverSnapshot = p.run('JSON.stringify(frpServerDeployment("s2","server").frpApplied)');
  const id = connect(p, 's1', 's2');
  assert.equal(p.run(`frpNode(${JSON.stringify(id)}).bind_port`), 7100);
  assert.equal(p.run(`frpNode(${JSON.stringify(id)}).bind_addr`), '0.0.0.0');
  assert.equal(p.run('S.operations.length'), 2, '保存连接不能执行或重复部署');
  assert.match(p.run('frpConnectionCard(S.frp.nodes[0])'), /frpc 已部署/);
  assert.match(p.run('frpConnectionCard(S.frp.nodes[0])'), /连接配置待应用/);
  p.click('frp-op', { node:id, role:'client', op:'deploy' });
  assert.equal(p.document.querySelector('#fo-binary'), null, '应用配置复用已部署程序');
  p.submit('frp-op', { 'fo-identity':'on', 'fo-impact':'on', 'fo-hold':'on', outcome:'success' });
  p.click('finishdemo', { id:p.run('S.operations[0].id') });
  assert.equal(p.run('pr(frpPid(S.frp.nodes[0],"client")).runtime'), 'running');
  assert.equal(p.run('JSON.stringify(frpServerDeployment("s2","server").frpApplied)'), serverSnapshot);
  assert.match(p.run('frpConnectionCard(S.frp.nodes[0])'), /连通性待核对/);
  assert.doesNotMatch(p.run('frpConnectionCard(S.frp.nodes[0])'), /连接配置待应用|部署 FRP/);
  const reloaded = prototype(p.saved(), { hash:'#frp' });
  assert.equal(reloaded.run('S.frp.nodes.length'), 1);
  assert.equal(reloaded.run('frpInstalledServers("server").length'), 1);
  assert.equal(reloaded.run('pr(frpPid(S.frp.nodes[0],"client")).runtime'), 'running');
});

test('frps 部署移除监听表单，预览读取配置，配置变化拒绝旧确认且重新部署保留已有值', () => {
  const p = emptyTopology();
  p.run('FRP_SOURCE.config.servers.find(n=>n.ip===sr("s2").host).bind_port=7100;');
  p.click('frp-batch', { role:'server', server:'s2' });
  assert.equal(p.document.querySelector('#fi-bind'), null);
  assert.equal(p.document.querySelector('#fi-port'), null);
  p.click('frp-batchpreview');
  assert.match(p.html('modal'), /bindPort = 7100/);
  p.run('FRP_SOURCE.config.servers.find(n=>n.ip===sr("s2").host).bind_port=7200;');
  p.click('frp-install-previewconfirm');
  p.submit('frp-install', { 'fi-binary':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.equal(p.run('frpInstalledServers("server").length'), 0);
  deployRole(p, 's2', 'server');
  assert.equal(p.run('frpServerDeployment("s2","server").frpApplied.node.bind_port'), 7200);
  p.run('FRP_SOURCE.config.servers.find(n=>n.ip===sr("s2").host).bind_port=7000;');
  deployRole(p, 's2', 'server');
  assert.equal(p.run('frpServerDeployment("s2","server").frpApplied.node.bind_port'), 7200);
  assert.match(p.run('frpServerDeployment("s2","server").frpApplied.files.toml'), /bindPort = 7200/);
});

test('多个 frpc 共用一个 frps，独立连接文件不碰撞，重复关系和映射冲突原子拒绝', () => {
  const p = emptyTopology();
  deployRole(p, 's1', 'client');
  deployRole(p, 's3', 'client');
  deployRole(p, 's2', 'server');
  const first = connect(p, 's1', 's2');
  const second = connect(p, 's3', 's2');
  assert.equal(p.run('frpPid(S.frp.nodes[0],"server")===frpPid(S.frp.nodes[1],"server")'), true);
  assert.equal(p.run('frpUnit(S.frp.nodes[0],"client")===frpUnit(S.frp.nodes[1],"client")'), false);
  assert.equal(p.run('frpFiles(S.frp.nodes[0],"client").tomlPath===frpFiles(S.frp.nodes[1],"client").tomlPath'), false);
  assert.equal(p.run('frpValidate().length'), 0);
  const before = p.run('JSON.stringify([S.frp,S.projects,S.operations])');
  p.click('frp-nodeedit');
  p.submit('frp-nodeedit', { 'fn-provider':'s1', 'fn-server':'s2' });
  assert.match(p.document.getElementById('modal-error').textContent, /已存在连接/);
  assert.equal(p.run('JSON.stringify([S.frp,S.projects,S.operations])'), before);
  p.click('frp-proxyedit', { node:first });
  p.submit('frp-proxyedit', { 'fp-type':'tcp','fp-name':'web-demo','fp-localip':'127.0.0.1','fp-localport':'80','fp-remote':'18080' });
  const mapped = p.run('JSON.stringify([S.frp,S.projects,S.operations])');
  p.click('frp-proxyedit', { node:second });
  p.submit('frp-proxyedit', { 'fp-type':'tcp','fp-name':'other-web','fp-localip':'127.0.0.1','fp-localport':'80','fp-remote':'18080' });
  assert.match(p.document.getElementById('modal-error').textContent, /监听冲突/);
  assert.equal(p.run('JSON.stringify([S.frp,S.projects,S.operations])'), mapped);
  p.submit('frp-proxyedit', { 'fp-type':'tcp','fp-name':'web-demo','fp-localip':'127.0.0.1','fp-localport':'80','fp-remote':'18081' });
  assert.match(p.document.getElementById('modal-error').textContent, /代理名称重复/);
  assert.equal(p.run('JSON.stringify([S.frp,S.projects,S.operations])'), mapped);
});

test('独立角色失败、部分完成和未知不成为可选服务器，核对成功后才开放选择', () => {
  for (const outcome of ['failed','partial','unknown']) {
    const p = emptyTopology();
    const id = deployRole(p, 's1', 'client', outcome);
    assert.equal(p.run('frpInstalledServers("client").length'), 0, outcome);
    const reloaded = prototype(p.saved(), { hash:'#frp' });
    reloaded.click('frp-nodeedit');
    assert.equal(reloaded.document.querySelector('#fn-provider').disabled, true);
    if (outcome === 'unknown') {
      reloaded.click('frp-batch', { role:'client', server:'s1' });
      reloaded.click('frp-batchconfirm');
      reloaded.submit('frp-install', { 'fi-binary':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on' });
      assert.equal(reloaded.run('S.operations[0].status'), 'rejected');
      reloaded.click('verifyop', { id });
      reloaded.submit('verifyop', { 'verify-result':'success','verify-evidence':'on' });
      assert.equal(reloaded.run('frpInstalledServers("client").length'), 1);
      assert.equal(reloaded.run('S.operations.filter(o=>o.status!=="rejected").length'), 1, '核对不重放部署');
    }
  }
});

test('部署预览固定输入；公共配置变化拒绝旧确认，受理后变化保留为新草稿', () => {
  const p = emptyTopology();
  p.click('frp-batch', { role:'server', server:'s2' });
  p.click('frp-batchpreview');
  const preview = p.run('JSON.stringify(ui.modal.plan)');
  p.run('S.frp.token="DEMO_NEW_AUTH";S.frp.settingsRev++;frpSyncConfigs();');
  p.click('frp-install-previewconfirm');
  assert.equal(p.run('JSON.stringify(ui.modal.plan)'), preview);
  p.submit('frp-install', { 'fi-binary':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.equal(p.run('S.projects.filter(p=>p.frpInstallation).length'), 0);
  p.click('frp-batch', { role:'server', server:'s2' });
  p.click('frp-batchconfirm');
  p.submit('frp-install', { 'fi-binary':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on',outcome:'success' });
  const id = p.run('S.operations[0].id');
  p.run('S.frp.token="DEMO_LATER_AUTH";S.frp.settingsRev++;frpSyncConfigs();');
  p.click('finishdemo', { id });
  assert.match(p.run('frpServerDeployment("s2","server").frpApplied.files.toml'), /DEMO_NEW_AUTH/);
  assert.match(p.run('frpServerDeployment("s2","server").cfg.appConfig'), /DEMO_LATER_AUTH/);
});

test('角色卸载先核对关联连接，已安装连接阻止卸载，草稿可保留但不能再应用', () => {
  const p = emptyTopology();
  deployRole(p, 's1', 'client');
  deployRole(p, 's2', 'server');
  const id = connect(p, 's1', 's2');
  p.run(`const action=frpRun([{node:${JSON.stringify(id)},role:"client"}],"deploy",{identity:true,impact:true,hold:true});frpFinish(action,"success");`);
  p.click('frp-install-remove', { id:'frp-installed-s2-server' });
  p.submit('frp-install-remove', { 'fi-remove':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on',outcome:'success' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /关联连接/);
  p.run(`const removal=frpRun([{node:${JSON.stringify(id)},role:"client"}],"uninstall",{remove:true,identity:true,impact:true,hold:true});frpFinish(removal,"success");`);
  p.click('frp-install-remove', { id:'frp-installed-s2-server' });
  p.submit('frp-install-remove', { 'fi-remove':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on',outcome:'success' });
  p.click('finishdemo', { id:p.run('S.operations[0].id') });
  assert.equal(p.run('frpInstalledServers("server").length'), 0);
  assert.equal(p.run('S.frp.nodes.length'), 1);
  p.click('frp-op', { node:id, role:'client', op:'deploy' });
  p.submit('frp-op', { 'fo-identity':'on','fo-impact':'on','fo-hold':'on',outcome:'success' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /已部署 frps/);
});

test('共用 frps 的认证变更不能只更新一条连接，未确认的服务端变更不能隐式重部署', () => {
  const p = emptyTopology();
  deployRole(p, 's1', 'client');
  deployRole(p, 's3', 'client');
  deployRole(p, 's2', 'server');
  const first = connect(p, 's1', 's2');
  const second = connect(p, 's3', 's2');
  p.run(`for(const id of [${JSON.stringify(first)},${JSON.stringify(second)}]){const o=frpRun([{node:id,role:"client"}],"deploy",{identity:true,impact:true,hold:true});frpFinish(o,"success");}S.frp.token="DEMO_UPDATED_AUTH";S.frp.settingsRev++;frpSyncConfigs();`);
  const applied = p.run('JSON.stringify(S.projects.filter(p=>p.frpApplied).map(p=>p.frpApplied))');
  p.run(`frpRun([{node:${JSON.stringify(first)},role:"server"},{node:${JSON.stringify(first)},role:"client"}],"deploy",{authChange:true,identity:true,impact:true,hold:true});`);
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /共用 frps/);
  p.click('frp-batch', { role:'server',server:'s2' });
  p.click('frp-batchconfirm');
  p.submit('frp-install', { 'fi-binary':'on','fi-identity':'on','fi-impact':'on','fi-hold':'on' });
  assert.equal(p.run('S.operations[0].status'), 'rejected');
  assert.match(p.run('S.operations[0].message'), /关联连接/);
  assert.equal(p.run('JSON.stringify(S.projects.filter(p=>p.frpApplied).map(p=>p.frpApplied))'), applied);
});
