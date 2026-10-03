import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

const source = 'services:\n  app:\n    image: example/app:demo\n';

function createTemplate(p, name = '带文件映射的配置', files = ['catalog-service'], paths = ['/srv/example/bin/catalog']) {
  p.click('templateedit');
  p.submit('templateedit', {
    'tpl-name': name,
    'tpl-type': 'compose',
    'tpl-source': source,
    'tpl-map-file': files,
    'tpl-map-path': paths,
  });
  return JSON.parse(p.run(`JSON.stringify(S.templates.find(template=>template.name===${JSON.stringify(name)}))`));
}

function error(p) { return p.document.getElementById('modal-error').textContent; }

test('新增部署配置底部显示文件映射，同名多架构合并为一个文件选项', () => {
  const p = prototype();
  p.click('templateedit');
  const html = p.html('modal');
  assert.match(html, /id="template-file-mapping-title">文件映射/);
  assert.match(html, /name="tpl-map-file"/);
  assert.match(html, /name="tpl-map-path"/);
  assert.match(html, /catalog-service · aarch64 \/ x86_64/);
  assert.equal((html.match(/value="catalog-service"/g) || []).length, 1);
  assert.match(html, /添加文件映射/);
});

test('一个配置可保存多项映射并在编辑弹窗恢复，空白行不进入记录', () => {
  const p = prototype();
  const template = createTemplate(p, '多文件配置', ['catalog-service', 'catalog-service', ''], ['/srv/app/bin/api', '/srv/app/bin/worker', '']);
  assert.deepEqual(template.fileMappings, [
    { file: 'catalog-service', targetPath: '/srv/app/bin/api' },
    { file: 'catalog-service', targetPath: '/srv/app/bin/worker' },
  ]);
  p.click('navigate', { page: 'templates' });
  p.click('templateedit', { id: template.id });
  assert.equal(p.document.getElementById('tpl-map-file-0').value, 'catalog-service');
  assert.equal(p.document.getElementById('tpl-map-path-0').value, '/srv/app/bin/api');
  assert.equal(p.document.getElementById('tpl-map-path-1').value, '/srv/app/bin/worker');
  assert.match(p.html('app'), /文件映射<\/small>2 项/);
});

test('文件映射允许为空，半行、未知文件、重复目标和超过上限均拒绝保存', () => {
  const p = prototype();
  const empty = createTemplate(p, '无映射配置', [], []);
  assert.deepEqual(empty.fileMappings, []);
  const cases = [
    [['catalog-service'], [''], /同时选择文件并填写目标路径/],
    [[''], ['/srv/app/bin/api'], /同时选择文件并填写目标路径/],
    [['missing-program'], ['/srv/app/bin/api'], /不存在或不可部署/],
    [['catalog-service', 'catalog-service'], ['/srv/app/bin/api', '/srv/app/bin/api'], /目标路径.*重复/],
    [Array(21).fill('catalog-service'), Array.from({ length: 21 }, (_, index) => `/srv/app/bin/${index}`), /最多 20 项/],
  ];
  for (const [files, paths, message] of cases) {
    p.click('templateedit');
    const before = p.run('S.templates.length');
    p.submit('templateedit', { 'tpl-name': '无效映射', 'tpl-type': 'compose', 'tpl-source': source, 'tpl-map-file': files, 'tpl-map-path': paths });
    assert.match(error(p), message);
    assert.equal(p.run('S.templates.length'), before);
    p.click('closemodal');
  }
});

test('目标路径必须是规范绝对文件路径', () => {
  const p = prototype();
  const invalid = ['relative/file', '/', '/srv/app/', '/srv//app/file', '/srv/../app/file', '/srv/./app/file', '/srv/app\nfile', '/' + 'a'.repeat(4096)];
  for (const path of invalid) {
    p.click('templateedit');
    p.submit('templateedit', { 'tpl-name': '无效路径', 'tpl-type': 'systemd', 'tpl-source': '[Service]\nExecStart=/srv/app', 'tpl-map-file': ['catalog-service'], 'tpl-map-path': [path] });
    assert.ok(error(p), path);
    assert.equal(p.run('S.templates.some(template=>template.name==="无效路径")'), false);
    p.click('closemodal');
  }
});

test('不可部署的占位文件不进入映射选项，已失效的旧映射不能再次保存', () => {
  const p = prototype();
  p.run('frpEnsure();');
  assert.equal(p.run('deploymentFiles().some(file=>file.name==="frps")'), false);
  const template = createTemplate(p);
  p.run(`S.programs=S.programs.filter(binary=>binary.name!=="catalog-service");openModal("templateedit",{id:${JSON.stringify(template.id)}});`);
  assert.match(p.html('modal'), /已不存在 · catalog-service/);
  p.submit('templateedit', { 'tpl-name': template.name, 'tpl-type': template.type, 'tpl-source': template.tpl, 'tpl-map-file': ['catalog-service'], 'tpl-map-path': ['/srv/example/bin/catalog'] });
  assert.match(error(p), /不存在或不可部署/);
});

test('部署项目复制映射，公共配置修改须明确采用后才进入项目草稿', () => {
  const p = prototype(), template = createTemplate(p);
  p.click('newproject', { template: template.id });
  p.submit('newproject', { 'np-template': template.id, 'np-name': 'mapped-project', 'np-server': 's1' });
  assert.deepEqual(JSON.parse(p.run('JSON.stringify(pr("mapped-project")||S.projects.find(project=>project.name==="mapped-project").cfg.fileMappings)')), template.fileMappings);
  const projectId = p.run('S.projects.find(project=>project.name==="mapped-project").id');
  p.click('templateedit', { id: template.id });
  p.submit('templateedit', { 'tpl-name': template.name, 'tpl-type': template.type, 'tpl-source': template.tpl, 'tpl-map-file': ['catalog-service'], 'tpl-map-path': ['/opt/mapped/catalog'] });
  assert.equal(p.run(`pr(${JSON.stringify(projectId)}).templateUpdate`), true);
  assert.equal(p.run(`pr(${JSON.stringify(projectId)}).cfg.fileMappings[0].targetPath`), '/srv/example/bin/catalog');
  p.click('adopttemplate', { id: projectId });
  assert.equal(p.run(`pr(${JSON.stringify(projectId)}).cfg.fileMappings[0].targetPath`), '/opt/mapped/catalog');
  assert.equal(p.run(`pr(${JSON.stringify(projectId)}).applied`), null);
});

test('部署按目标架构解析映射并固定文件身份，文件随后替换仍显示可更新', () => {
  const p = prototype();
  p.run(`const project=pr("p2");project.cfg.fileMappings=[{file:"catalog-service",targetPath:"/srv/media/bin/catalog"}];const operation=startOperation(project,"apply",{},"success",{hold:true});globalThis.mappedOperation=operation;`);
  assert.equal(p.run('mappedOperation.input.mappedFiles[0].binary.arch'), 'x86_64');
  assert.equal(p.run('mappedOperation.input.mappedFiles[0].targetPath'), '/srv/media/bin/catalog');
  const acceptedIdentity = p.run('mappedOperation.input.mappedFiles[0].binary.identity');
  p.run('S.programs.find(binary=>binary.id==="bin1").identity="new-content-after-accept";finishOperation(mappedOperation,"success");');
  assert.equal(acceptedIdentity, 'demo-content-a');
  assert.equal(p.run('pr("p2").programUpdate'), true);
  assert.equal(p.run('pr("p2").applied.fileMappings[0].targetPath'), '/srv/media/bin/catalog');
});

test('通用文件适用于所有架构，同名架构文件在对应服务器上优先', () => {
  const p = prototype();
  p.run(`S.programs.push({id:"shared",name:"settings.yaml",filename:"settings.yaml",arch:"any",kind:"file",bytes:0,size:"0 B",identity:"sha256:shared"},{id:"settings-x86",name:"settings.yaml",filename:"settings-x86.yaml",arch:"x86_64",kind:"elf",bytes:96,size:"96 B",identity:"sha256:x86"});`);
  assert.match(p.run('deploymentFileLabel(deploymentFiles().find(file=>file.name==="settings.yaml"))'), /通用 \/ x86_64/);
  assert.equal(p.run('deploymentFileFor("settings.yaml",sr("s2")).id'), 'settings-x86');
  assert.equal(p.run('deploymentFileFor("settings.yaml",sr("s3")).id'), 'shared');
  assert.equal(p.run('deploymentFiles().some(file=>file.name==="settings.yaml")'), true);
  p.run('const project=pr("p2");project.server="s3";sr("s3").state="online";project.cfg.fileMappings=[{file:"settings.yaml",targetPath:"/srv/app/settings.yaml"}];globalThis.sharedOperation=startOperation(project,"apply",{},"success",{hold:true});');
  assert.equal(p.run('sharedOperation.input.mappedFiles[0].binary.id'), 'shared');
});

test('通用文件不能冒充 systemd 主程序', () => {
  const p = prototype();
  p.run('S.programs=S.programs.filter(file=>file.id!=="bin1");S.programs.push({id:"generic-program",name:"catalog-service",filename:"catalog-service",arch:"any",kind:"file",bytes:20,size:"20 B",identity:"sha256:generic"});globalThis.result=startOperation(pr("p1"),"apply",{},"success",{hold:true});');
  assert.equal(p.run('result'), null);
  assert.match(p.run('S.operations[0].message'), /对应 x86_64 的 ELF 文件/);
});

test('目标架构缺少文件或项目草稿路径失效时拒绝部署', () => {
  for (const kind of ['missing', 'path']) {
    const p = prototype();
    p.run(`const project=pr("p2");${kind === 'missing' ? 'project.server="s3";sr("s3").state="online";project.cfg.fileMappings=[{file:"frpc",targetPath:"/srv/app/frpc"}];' : 'project.cfg.fileMappings=[{file:"catalog-service",targetPath:"relative/catalog"}];'}globalThis.result=startOperation(project,"apply",{},"success",{hold:true});`);
    assert.equal(p.run('result'), null);
    assert.equal(p.run('S.operations[0].status'), 'rejected');
    assert.match(p.run('S.operations[0].message'), kind === 'missing' ? /缺少适用于 aarch64 的文件/ : /目标路径无效/);
  }
});
