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

test('配置页只读展示服务器 systemd 文件和已映射实际文件', () => {
  const p = prototype();
  p.run(`
    const project=pr('p1'),file=S.programs.find(item=>item.id==='file1');
    project.cfg.env='DRAFT_ONLY=1';
    project.deployedFiles=[{file:'catalog-config.yaml',targetPath:'/srv/stackpier-demo/catalog-api/app.conf',binary:clone(file)}];
    file.identity='new-upload-not-on-server';
  `);
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'config' });
  const html = p.html('app');
  assert.match(html, /\/etc\/systemd\/system\/catalog-api\.service/);
  assert.match(html, /\/srv\/stackpier-demo\/catalog-api\/app\.conf/);
  assert.match(html, /demo-config-content-a/);
  assert.doesNotMatch(html, /new-upload-not-on-server|DRAFT_ONLY=1|保存草稿|cfg-port/);
});

test('Compose 配置页读取已部署文件，不把待应用草稿当成服务器现状', () => {
  const p = prototype();
  p.click('project', { id: 'p2' });
  p.click('tab', { id: 'config' });
  const html = p.html('app');
  assert.match(html, /\/srv\/stackpier-demo\/media-web\/compose\.yaml/);
  assert.match(html, /8090:80/);
  assert.doesNotMatch(html, /8091:80/);
  assert.match(html, /待应用内容[\s\S]*有/);
});

test('未部署和已卸载项目不把配置记录显示成服务器文件', () => {
  const p = prototype();
  p.click('project', { id: 'p8' });
  p.click('tab', { id: 'config' });
  assert.match(p.html('app'), /运行文件已随项目卸载/);
  assert.doesNotMatch(p.html('app'), /legacy-web\/compose\.yaml|example\/web:demo-1\.0/);
  p.click('project', { id: 'p9' });
  p.click('tab', { id: 'config' });
  assert.match(p.html('app'), /项目尚未形成服务器运行文件/);
  assert.doesNotMatch(p.html('app'), /draft-service\.service/);
});

test('重新读取记录成功或失败，失败时保留最近文件快照', () => {
  const p = prototype();
  p.click('project', { id: 'p1' });
  p.click('tab', { id: 'config' });
  p.click('refreshprojectfiles', { id: 'p1' });
  assert.equal(p.run('pr("p1").configurationReadStatus'), 'success');
  const previous = p.run('pr("p1").configurationReadAt');
  p.run('sr("s2").state="unknown";');
  p.click('refreshprojectfiles', { id: 'p1' });
  assert.equal(p.run('pr("p1").configurationReadStatus'), 'unknown');
  assert.equal(p.run('pr("p1").configurationReadAt'), previous);
  assert.ok(p.run('pr("p1").configurationReadAttemptAt') >= previous);
  assert.match(p.html('app'), /当前无法读取目标服务器[\s\S]*最近一次可确认的文件快照/);
  assert.match(p.html('app'), /读取失败/);
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
