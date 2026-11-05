import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {prototype} from './prototype-harness.mjs';

test('固定页不展示草稿或公共最新正文，核对不会执行或应用配置',async()=>{
 const p=prototype();
 p.run('pr("p1").cfg.source="DRAFT_ONLY";tpl("t1").tpl="PUBLIC_ONLY";tpl("t1").rev=8;');
 const saved=p.run('JSON.stringify([pr("p1").cfg,pr("p1").appliedSnapshot,S.operations,pr("p1").runtime])');
 p.click('project',{id:'p1'});p.click('tab',{id:'config'});
 await p.run('checkProjectFiles(pr("p1"))');
 const html=p.run('projectConfig(pr("p1"))');
 assert.match(html,/已应用配置与文件[\s\S]*固定版本/);
 assert.doesNotMatch(html,/DRAFT_ONLY|PUBLIC_ONLY|C8|项目草稿|服务器当前读取结果|<pre/);
 assert.equal(p.run('pr("p1").fileCheck.files.length'),3);
 assert.equal(p.run('JSON.stringify([pr("p1").cfg,pr("p1").appliedSnapshot,S.operations,pr("p1").runtime])'),saved);
 assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="program").state'),'unknown','缺失历史程序摘要不能伪造一致');
 const unit=p.run('pr("p1").fileCheck.files.find(f=>f.kind==="unit").sha256');
 assert.equal(unit,createHash('sha256').update(p.run('pr("p1").appliedSnapshot.cfg.source')).digest('hex'));
});

test('远端变更、缺失、无法确认各自呈现，连续失败保留最后一次历史观测',async()=>{
 const p=prototype();
 await p.run('checkProjectFiles(pr("p1"),"changed")');
 assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").state'),'changed');
 assert.match(p.run('projectConfig(pr("p1"))'),/远端被改/);
 await p.run('checkProjectFiles(pr("p1"),"missing")');
 assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").state'),'missing');
 await p.run('checkProjectFiles(pr("p1"))');
 const before=p.run('JSON.stringify(pr("p1").fileCheck.files.find(f=>f.kind==="config"))');
 await p.run('checkProjectFiles(pr("p1"),"unknown")');
 await p.run('checkProjectFiles(pr("p1"),"unknown")');
 assert.equal(p.run('JSON.stringify(pr("p1").fileCheck.files.find(f=>f.kind==="config").previous)'),before);
 assert.match(p.run('projectConfig(pr("p1"))'),/无法读取 \/ 无法确认[\s\S]*历史观测 · 已过期/);
 const loaded=prototype(p.saved());
 assert.equal(loaded.run('JSON.stringify(pr("p1").fileCheck)'),p.run('JSON.stringify(pr("p1").fileCheck)'));
});

test('新部署参照使旧核对过期，迟到核对不能覆盖已改变的目标',async()=>{
 const p=prototype();await p.run('checkProjectFiles(pr("p1"))');
 p.run('pr("p1").appliedSnapshot.files[1].binary.sha256="d".repeat(64);');
 assert.match(p.run('projectConfig(pr("p1"))'),/此观测对应旧部署参照，已过期/);
 await p.run('checkProjectFiles(pr("p1"))');
 assert.doesNotMatch(p.run('projectConfig(pr("p1"))'),/此观测对应旧部署参照，已过期/);
 assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").state'),'changed');
 const check=p.run('JSON.stringify(pr("p1").fileCheck)');
 const reading=p.run('checkProjectFiles(pr("p1"))');
 p.run('pr("p1").server="s4";');await reading;
 assert.equal(p.run('JSON.stringify(pr("p1").fileCheck)'),check);
});

test('重复核对只受理一次，项目切换不会把观测写入其他项目',async()=>{
 const p=prototype(),other=p.run('JSON.stringify(pr("p7"))');
 const first=p.run('checkProjectFiles(pr("p1"))');
 const second=p.run('checkProjectFiles(pr("p1"),"missing")');
 p.click('project',{id:'p7'});p.click('tab',{id:'config'});
 await Promise.all([first,second]);
 assert.equal(p.run('pr("p1").fileCheck.files.find(f=>f.kind==="config").state'),'same');
 assert.equal(p.run('JSON.stringify(pr("p7"))'),other);
 assert.match(p.run('projectConfig(pr("p7"))'),/尚未核对受管文件/);
});

test('Compose 和 FRP 使用固定信息页；旧原型的更新入口可单独打开与取消',()=>{
 const p=prototype();
 for(const id of ['p2','frp-n1-client']){
  p.click('project',{id});p.click('tab',{id:'config'});
  const html=p.run(`projectConfig(pr(${JSON.stringify(id)}))`);
  assert.match(html,/已应用配置与文件/);assert.doesNotMatch(html,/核对受管文件|<pre|采用更新/);
  const before=p.run(`JSON.stringify(pr(${JSON.stringify(id)}))`);
  p.click('projectmore',{id});assert.match(p.html('modal'),/项目草稿与更新/);
  p.click('projectdraft',{id});assert.match(p.html('modal'),/项目草稿与更新/);
  p.click('closemodal');assert.equal(p.run(`JSON.stringify(pr(${JSON.stringify(id)}))`),before);
 }
 assert.match(p.run('projectConfig(pr("p2"))'),/Compose 固定服务[\s\S]*8090:80/);
});
