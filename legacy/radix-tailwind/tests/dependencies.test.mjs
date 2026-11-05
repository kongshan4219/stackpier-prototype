import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

test('项目详情、旧标签、弹窗和操作均不再提供依赖与复制', () => {
  const p = prototype();
  p.click('project', { id: 'p3' });
  assert.doesNotMatch(p.html('app'), /依赖与复制|初始化只读副本|MySQL 复制/);
  p.click('tab', { id: 'deps' });
  assert.equal(p.run('ui.tab'), 'overview');
  p.run('openModal("replica",{id:"p3"});');
  assert.equal(p.document.getElementById('modal').open, false);
  assert.equal(p.run('startOperation(pr("p3"),"replica",{},"success",{hold:true})'), null);
  assert.equal(p.run('Object.hasOwn(prototypeActions,"confirmdep")||Object.hasOwn(prototypeForms,"dependencies")'), false);
});

test('旧状态加载时清理依赖与复制字段和操作，并补齐检查方式', () => {
  const p = prototype();
  p.run(`
    const project=pr('p1');
    project.deps=['p3'];project.depChanges=[{project:'p3'}];project.replicaOf='p3';project.replication='healthy';
    project.monitor={hours:12,http:'https://example.com/health',tcp:'8080',channels:['email'],inherit:false};
    S.operations.unshift({id:'old-replica',kind:'replica',project:'p1',status:'success',input:{},steps:[]});
    persist();
  `);
  const loaded = prototype(p.saved());
  assert.equal(loaded.run('S.operations.some(operation=>operation.kind==="replica")'), false);
  assert.equal(loaded.run('["deps","depChanges","replicaOf","replication"].some(key=>Object.hasOwn(pr("p1"),key))'), false);
  assert.equal(loaded.run('pr("p1").monitor.method'), 'http');
  assert.equal(loaded.run('Object.hasOwn(pr("p1").monitor,"tcp")'), false);
});

test('配置页展示固定部署信息，核对后只读展示三类受管文件摘要', async () => {
  const p = prototype();
  p.run(`
    const project=pr('p1'),file=S.programs.find(item=>item.id==='file1');
    project.cfg.env='DRAFT_ONLY=1';
    project.deployedFiles=[{file:'catalog-config.yaml',targetPath:'/srv/stackpier-demo/catalog-api/app.conf',binary:clone(file)}];
    file.identity='new-upload-not-on-server';
  `);
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'config' });
  assert.match(p.html('app'), /已应用配置与文件[\s\S]*固定版本/);
  assert.match(p.html('app'), /尚未核对受管文件/);
  await p.run('checkProjectFiles(pr("p1"))');
  const html = p.html('app');
  assert.match(html, /\/etc\/systemd\/system\/catalog-api\.service/);
  assert.match(html, /\/srv\/stackpier-demo\/catalog-api\/app\.conf/);
  assert.match(html, /SHA-256/);
  assert.doesNotMatch(html, /new-upload-not-on-server|DRAFT_ONLY=1|保存草稿|cfg-port/);
});

test('Compose 配置页展示固定服务，草稿仅在独立弹窗展示', () => {
  const p = prototype();
  p.click('project', { id: 'p2' });
  p.click('tab', { id: 'config' });
  const html = p.html('app');
  assert.match(html, /\/srv\/stackpier-demo\/media-web/);
  assert.match(html, /8090:80/);
  assert.doesNotMatch(html, /8091:80|服务器当前读取结果|核对受管文件/);
  assert.doesNotMatch(p.run('projectRuntimeFile(pr("p2")).content'), /8091:80/);
  p.click('projectmore', {id:'p2'});
  assert.match(p.html('modal'), /项目草稿与更新/);
  p.click('projectdraft', {id:'p2'});
  assert.match(p.html('modal'),/项目草稿[\s\S]*8091:80/);
  assert.match(p.html('modal'), /待应用内容[\s\S]*有/);
});

test('摘要核对失败时保留历史观测，不改动读取快照与部署参照', async () => {
  const p = prototype();
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'config' });
  await p.run('checkProjectFiles(pr("p1"))');
  const previous = p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").checked');
  const snapshot=p.run('JSON.stringify(pr("p1").serverReadSnapshot)');
  const applied=p.run('JSON.stringify(pr("p1").appliedSnapshot)');
  p.run('sr("s2").state="unknown";');
  await p.run('checkProjectFiles(pr("p1"))');
  assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").state'), 'unknown');
  assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").previous.checked'), previous);
  assert.equal(p.run('JSON.stringify(pr("p1").serverReadSnapshot)'),snapshot);
  assert.equal(p.run('JSON.stringify(pr("p1").appliedSnapshot)'),applied);
  assert.match(p.html('app'), /本次核对未确认/);
  assert.match(p.html('app'), /历史观测 · 已过期/);
  assert.match(p.html('app'), /catalog-api\.service/);
});

test('巡检按项目类型提供命令或 HTTP，移除 TCP 并校验 HTTP 地址', () => {
  const p = prototype();
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'monitor' });
  assert.match(p.html('app'), /value="systemd"[\s\S]*systemd 命令/);
  assert.match(p.html('app'), /value="http"[\s\S]*指定 HTTP 地址/);
  assert.doesNotMatch(p.html('app'), /value="compose"|mon-tcp|TCP 检查端口/);
  p.submit('projectmonitor', { 'mon-hours': '6', 'mon-method': 'http', 'mon-http': 'https://status.example.com/health', 'mon-inherit': 'on' }, { id: 'p1' });
  assert.equal(p.run('pr("p1").monitor.method'), 'http');
  assert.equal(p.run('pr("p1").monitor.http'), 'https://status.example.com/health');
  assert.equal(p.run('Object.hasOwn(pr("p1").monitor,"tcp")'), false);
  const before = p.saved();
  p.submit('projectmonitor', { 'mon-hours': '6', 'mon-method': 'http', 'mon-http': 'ftp://status.example.com/health' }, { id: 'p1' });
  assert.equal(p.saved(), before);
  p.click('project', { id: 'p3' });
  p.click('tab', { id: 'monitor' });
  assert.match(p.html('app'), /value="compose"[\s\S]*Docker Compose 命令/);
  assert.doesNotMatch(p.html('app'), /value="systemd"/);
});

test('立即检查只记录所选命令或 HTTP 目标', () => {
  const p = prototype();
  p.run('pr("p1").monitor.method="systemd";runProjectCheck(pr("p1"));');
  assert.match(p.run('S.operations[0].steps[0].title'), /systemctl is-active catalog-api\.service/);
  p.run('pr("p2").monitor.method="http";runProjectCheck(pr("p2"));');
  assert.match(p.run('S.operations[0].steps[0].title'), /http:\/\/127\.0\.0\.1:8090\/health/);
});
