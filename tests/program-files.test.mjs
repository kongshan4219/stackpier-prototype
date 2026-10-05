import assert from 'node:assert/strict';
import test from 'node:test';
import { File } from 'node:buffer';
import { createHash } from 'node:crypto';
import { prototype } from './prototype-harness.mjs';

// 只供解析测试的虚构 ELF 文件头与载荷，不是可运行程序。
function elfBytes({ machine = 62, bits = 2, order = 1, stamp = 1, type = 2 } = {}) {
  const bytes = new Uint8Array(96), view = new DataView(bytes.buffer), little = order === 1;
  bytes.set([0x7f, 0x45, 0x4c, 0x46, bits, order, 1]);
  view.setUint16(16, type, little);
  view.setUint16(18, machine, little);
  view.setUint32(20, 1, little);
  view.setUint16(bits === 1 ? 40 : 52, bits === 1 ? 52 : 64, little);
  bytes[95] = stamp;
  return bytes;
}

function elfFile(name = 'demo-program', options = {}) { return new File([elfBytes(options)], name); }
function genericFile(name = 'settings.yaml', content = 'example: true\n', type = 'text/yaml') { return new File([content], name, { type }); }
function error(p) { return p.document.getElementById('modal-error').textContent; }
function records(p) { return JSON.parse(p.run('JSON.stringify(S.programs)')); }
function open(p, id) { p.click('programupload', id ? { id } : {}); }
async function confirm(p, file, id) {
  open(p, id);
  await p.changeFiles([file]);
  assert.equal(p.document.getElementById('program-upload-save').disabled, false);
  p.submit('programupload', {});
  assert.equal(p.run('ui.modal.kind'), 'programname');
}
async function save(p, file, name = file.name, id) {
  await confirm(p, file, id);
  p.submit('programname', { 'bin-filename': name });
  assert.equal(p.run('ui.modal'), null, error(p));
  return records(p).find(binary => binary.filename === name);
}

test('上传弹窗只有文件选择，确认默认原名后才写入真实 SHA-256，刷新后仍保留摘要', async () => {
  const p = prototype(), before = p.saved(), file = elfFile('not-an-arch-name');
  open(p);
  assert.equal(p.document.getElementById('program-upload-save').disabled, true);
  assert.doesNotMatch(p.html('modal'), /id="bin-(name|arch|filename)"/);
  await p.changeFiles([file]);
  assert.equal(p.run('ui.modal.analysis.arch'), 'x86_64');
  assert.equal(p.saved(), before);
  p.submit('programupload', {});
  assert.equal(p.document.getElementById('bin-filename').value, file.name);
  assert.equal(p.saved(), before);
  p.submit('programname', { 'bin-filename': file.name });
  const record = records(p).find(binary => binary.filename === file.name);
  const expected = createHash('sha256').update(elfBytes()).digest('hex');
  assert.equal(record.sha256, expected);
  assert.equal(record.identity, 'sha256:' + expected);
  assert.equal(record.bytes, 96);
  assert.equal(record.kind, 'elf');
  assert.equal(records(prototype(p.saved())).find(binary => binary.id === record.id).sha256, expected);
  assert.equal(Object.keys(record).some(key => ['file', 'buffer', 'content'].includes(key)), false);
});

test('普通文件与空文件均按通用范围保存，并显示文件类型', async () => {
  const p = prototype();
  const text = await save(p, genericFile());
  const empty = await save(p, genericFile('empty.conf', '', 'text/plain'));
  assert.equal(text.kind, 'file');
  assert.equal(text.arch, 'any');
  assert.equal(text.mediaType, 'text/yaml');
  assert.equal(empty.bytes, 0);
  assert.equal(empty.sha256, createHash('sha256').update('').digest('hex'));
  p.click('navigate', { page: 'programs' });
  assert.match(p.html('app'), /<h1[^>]*>文件<\/h1>/);
  assert.match(p.html('app'), /通用/);
  assert.match(p.html('app'), /text\/yaml/);
  p.click('templateedit');
  p.click('template-map-add');
  assert.match(p.html('modal'), /settings\.yaml · 通用/);
});

test('相同文件名的不同适用范围可并存，同范围同名不同内容拒绝覆盖', async () => {
  const p = prototype();
  await save(p, elfFile());
  await save(p, elfFile('demo-program', { machine: 183 }));
  await save(p, genericFile('demo-program', 'generic content'));
  assert.deepEqual(records(p).filter(binary => binary.name === 'demo-program').map(binary => binary.arch), ['x86_64', 'aarch64', 'any']);
  const before = p.saved();
  await confirm(p, elfFile('demo-program', { stamp: 2 }));
  p.submit('programname', { 'bin-filename': 'demo-program' });
  assert.match(error(p), /替换文件/);
  assert.equal(p.saved(), before);
  p.submit('programname', { 'bin-filename': 'another-program' });
  assert.equal(records(p).filter(binary => binary.name === 'another-program').length, 1);
});

test('不同名称的相同内容在选取阶段拒绝，重复提交不会新增记录', async () => {
  const p = prototype(), first = await save(p, elfFile());
  const before = p.saved();
  p.submit('programname', { 'bin-filename': 'alias-after-submit' });
  assert.equal(p.saved(), before);
  open(p);
  await p.changeFiles([elfFile('renamed-copy')]);
  assert.match(error(p), /demo-program.*不能更名重复上传/);
  assert.equal(p.document.getElementById('program-upload-save').disabled, true);
  assert.equal(records(p).filter(binary => binary.sha256 === first.sha256).length, 1);
});

test('确认保存重新检查内容去重和名称冲突', async () => {
  for (const collision of ['hash', 'name']) {
    const p = prototype();
    await confirm(p, elfFile());
    p.run(`S.programs.push({id:'other',name:${JSON.stringify(collision === 'name' ? 'demo-program' : 'alias')},filename:${JSON.stringify(collision === 'name' ? 'demo-program' : 'alias')},arch:'x86_64',sha256:${collision === 'hash' ? 'ui.modal.draft.analysis.sha256' : "'different-content'"}});persist();`);
    const before = p.saved();
    p.submit('programname', { 'bin-filename': 'demo-program' });
    assert.match(error(p), collision === 'hash' ? /不能更名重复上传/ : /替换文件/);
    assert.equal(p.saved(), before);
  }
});

test('替换保留文件归属与 ID，默认取所选原名，只提醒对应架构项目更新', async () => {
  const p = prototype(), file = elfFile('renamed-release', { stamp: 2 });
  const beforeApplied = p.run('JSON.stringify(S.projects.map(project=>project.applied))');
  const replacement = await save(p, file, file.name, 'bin1');
  assert.equal(replacement.id, 'bin1');
  assert.equal(replacement.name, 'catalog-service');
  assert.equal(replacement.arch, 'x86_64');
  assert.equal(p.run('S.projects.filter(project=>project.cfg.program==="catalog-service"&&sr(project.server).arch==="x86_64").every(project=>project.programUpdate)'), true);
  assert.equal(p.run('JSON.stringify(S.projects.map(project=>project.applied))'), beforeApplied);
  assert.equal(records(p).find(binary => binary.id === 'bin2').identity, 'demo-content-b');
  open(p, 'bin1');
  await p.changeFiles([file]);
  assert.match(error(p), /无需替换/);
});

test('替换拒绝适用范围不符、跨记录重复内容及目标记录变化', async () => {
  const p = prototype();
  const other = await save(p, elfFile('other-binary'));
  open(p, 'bin1');
  await p.changeFiles([elfFile('wrong-architecture', { machine: 183 })]);
  assert.match(error(p), /适用范围为 x86_64.*aarch64/);
  await p.changeFiles([elfFile('same-content')]);
  assert.match(error(p), /不能更名重复上传/);
  await p.changeFiles([elfFile('fresh-content', { stamp: 3 })]);
  p.submit('programupload', {});
  p.run('S.programs.find(binary=>binary.id==="bin1").identity="changed-while-confirming";persist();');
  const before = p.saved();
  p.submit('programname', { 'bin-filename': 'fresh-content' });
  assert.match(error(p), /记录已变化/);
  assert.equal(p.saved(), before);
  assert.equal(records(p).find(binary => binary.id === other.id).sha256, other.sha256);
});

test('通用文件替换只提醒实际使用该记录的项目，架构专用版本优先', async () => {
  const p = prototype(), shared = await save(p, genericFile());
  p.run(`pr("p1").cfg.fileMappings=[pinMapping({file:"settings.yaml",targetPath:"/srv/app/settings.yaml"})];pr("p6").cfg.fileMappings=[pinMapping({file:"settings.yaml",targetPath:"/srv/app/settings.yaml"})];`);
  await save(p, elfFile('settings.yaml'));
  p.run('pr("p1").programUpdate=false;pr("p6").programUpdate=false;');
  await save(p, genericFile('settings-v2.yaml', 'example: changed\n'), 'settings-v2.yaml', shared.id);
  assert.equal(p.run('pr("p1").programUpdate'), true);
  assert.equal(p.run('pr("p6").programUpdate'), true);
  assert.equal(p.run('pr("p1").cfg.fileMappings[0].pins[0].revision'),1);
});

test('命名返回保留分析结果，取消和关闭均不保存', async () => {
  const p = prototype(), before = p.saved();
  await confirm(p, elfFile());
  p.document.getElementById('bin-filename').value = 'edited-name';
  p.click('program-upload-back');
  assert.equal(p.run('ui.modal.kind'), 'programupload');
  assert.equal(p.document.getElementById('program-upload-save').disabled, false);
  p.submit('programupload', {});
  assert.equal(p.document.getElementById('bin-filename').value, 'edited-name');
  p.click('closemodal');
  assert.equal(p.saved(), before);
  assert.equal(p.run('ui.modal'), null);
});

test('更换文件或关闭弹窗后，迟到的文件读取结果不能覆盖当前状态', async () => {
  for (const action of ['reselect', 'close']) {
    const p = prototype();
    let release;
    const slow = { name: 'old-file', size: 96, slice: () => ({ arrayBuffer: () => new Promise(resolve => { release = resolve; }) }), arrayBuffer: async () => elfBytes().buffer };
    open(p);
    const pending = p.changeFiles([slow]);
    assert.equal(p.document.getElementById('program-upload-save').disabled, true);
    if (action === 'reselect') await p.changeFiles([elfFile('new-file', { machine: 183 })]);
    else { p.click('closemodal'); open(p); }
    release(elfBytes().slice(0, 64).buffer);
    await pending;
    assert.equal(p.run('ui.modal.analysis?.sourceName'), action === 'reselect' ? 'new-file' : undefined);
    assert.equal(records(p).some(binary => binary.filename === 'old-file'), false);
  }
});

test('存储失败不改变文件或项目，可在确认弹窗重试', async () => {
  const p = prototype();
  await confirm(p, elfFile('release-file'), 'bin1');
  const before = p.run('JSON.stringify(S)'), saved = p.saved();
  p.run('const originalWrite=localStorage.setItem;localStorage.setItem=()=>{throw new Error("quota")};');
  p.submit('programname', { 'bin-filename': 'release-file' });
  assert.match(error(p), /保存失败/);
  assert.equal(p.run('JSON.stringify(S)'), before);
  assert.equal(p.saved(), saved);
  assert.equal(p.run('ui.modal.kind'), 'programname');
  p.run('localStorage.setItem=originalWrite;');
  p.submit('programname', { 'bin-filename': 'release-file' });
  assert.equal(p.run('ui.modal'), null);
});

test('按文件头字节序和位数识别架构，ARM32 不误标 armv7l', async () => {
  const p = prototype();
  for (const [machine, bits, order, arch] of [[3,1,1,'i386'],[62,2,1,'x86_64'],[183,2,1,'aarch64'],[183,2,2,'aarch64_be'],[40,1,1,'arm'],[40,1,2,'armeb'],[21,2,1,'ppc64le'],[21,2,2,'ppc64'],[243,2,1,'riscv64'],[258,2,1,'loongarch64']]) {
    open(p);
    await p.changeFiles([elfFile('misleading-x86-file-name', { machine, bits, order })]);
    assert.equal(p.run('ui.modal.analysis.arch'), arch);
  }
});

test('未知格式、架构和损坏 ELF 均作为通用文件，只有超限文件拒绝分析', async () => {
  const broken = elfBytes(); broken[52] = 0;
  const files = [new File(['plain text'], 'plain.txt'), new File([elfBytes().slice(0, 20)], 'truncated'), new File([broken], 'broken'), elfFile('unknown', { machine: 65535 }), elfFile('relocatable', { type: 1 }), elfFile('bad-class', { machine: 62, bits: 1 })];
  const p = prototype(), before = p.saved();
  for (const file of files) {
    open(p);
    await p.changeFiles([file]);
    assert.equal(p.run('ui.modal.analysis.arch'), 'any');
    assert.equal(p.run('ui.modal.analysis.kind'), 'file');
    assert.equal(p.document.getElementById('program-upload-save').disabled, false);
    assert.equal(p.saved(), before);
    p.click('closemodal');
  }
  open(p);
  await p.changeFiles([{ name: 'large', size: 256*1024*1024+1, slice() { throw new Error('不得读取'); }, arrayBuffer() { throw new Error('不得读取'); } }]);
  assert.match(error(p), /不超过 256 MB/);
  assert.equal(p.document.getElementById('program-upload-save').disabled, true);
  assert.equal(p.saved(), before);
});

test('读取失败、摘要不可用、校验失败与分析超时不会生成伪造摘要', async () => {
  for (const failure of ['read', 'crypto', 'digest', 'timeout']) {
    const p = prototype(), before = p.saved();
    open(p);
    if (failure === 'crypto') p.run('crypto={};');
    if (failure === 'digest') p.run('crypto={subtle:{digest:async()=>{throw new Error("digest failed")}}};');
    const file = failure === 'read' ? { name: 'unreadable', size: 96, slice: () => ({ arrayBuffer: async () => { throw new Error('read'); } }), arrayBuffer: async () => elfBytes().buffer } : failure === 'timeout' ? { name: 'slow', size: 96, slice: () => ({ arrayBuffer: () => new Promise(() => {}) }), arrayBuffer: async () => elfBytes().buffer } : elfFile();
    const pending = p.changeFiles([file]);
    if (failure === 'timeout') p.flushTimers();
    await pending;
    assert.equal(p.run('ui.modal.analysis'), null);
    assert.equal(p.saved(), before);
    assert.ok(error(p));
  }
});

test('文件头与完整读取的类型或架构不一致时拒绝保存', async () => {
  const p = prototype();
  open(p);
  await p.changeFiles([{ name: 'changing-file', size: 96, slice: () => ({ arrayBuffer: async () => elfBytes().slice(0, 64).buffer }), arrayBuffer: async () => elfBytes({ machine: 183 }).buffer }]);
  assert.match(error(p), /文件类型或架构发生变化/);
  assert.equal(p.document.getElementById('program-upload-save').disabled, true);
});

test('文件名验证拒绝路径、控制字符与超长名称，拖入多个文件不沿用旧结果', async () => {
  const p = prototype(), before = p.saved();
  await confirm(p, elfFile());
  for (const name of ['', '.', '..', '../demo', 'folder\\demo', 'bad\nname', 'a'.repeat(256), '程'.repeat(86)]) {
    p.submit('programname', { 'bin-filename': name });
    assert.equal(p.saved(), before);
    assert.equal(p.run('ui.modal.kind'), 'programname');
    assert.ok(error(p));
  }
  p.click('program-upload-back');
  await p.dropFiles([elfFile(), elfFile('second')]);
  assert.match(error(p), /一次选择一个/);
  assert.equal(p.run('ui.modal.analysis'), null);
  await p.dropFiles([elfFile('single-dropped')]);
  assert.equal(p.run('ui.modal.analysis.sourceName'), 'single-dropped');
});
