import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prototype} from './prototype-harness.mjs';
import {referencePrototype,simulatePrograms} from './frp-fixtures.mjs';
const json=(p,code)=>JSON.parse(p.run('JSON.stringify('+code+')'));
const conditions={identity:true,impact:true,hold:true};
function attachment(){const p=prototype(undefined,{hash:'#frp'});p.click('frp-reference-load');p.click('frp-reference-confirmload');return p;}

test('附件四节点、八映射、两默认目标，与静态 config.json 逐字段一致；工作编辑保留',()=>{
 const p=prototype(undefined,{hash:'#frp'});p.run('frpNode("n1").proxies[0].name="user-edited";frpNode("n1").revision++;persist();');
 const before=p.run('JSON.stringify(S.frp)');p.click('frp-reference-load');assert.equal(p.run('S.frp.nodes[0].proxies[0].name'),'user-edited');p.click('frp-reference-confirmload');
 const source=JSON.parse(readFileSync(new URL('./fixtures/frp-reference/config.json',import.meta.url)));
 const expected=source.servers;const actual=json(p,'S.frp.nodes').map(({id,revision,provider,arch,...node})=>node);assert.deepEqual(actual,expected);
 assert.equal(p.run('frpSelectTargets("client").map(n=>n.ip).join(",")'),'198.51.100.20,192.0.2.40');
 assert.equal(p.run('frpSelectTargets("client","all").length'),4);assert.equal(p.run('frpSelectTargets("server").length'),4);
 assert.equal(p.run('frpSelectTargets("client","specified","ref-n1")[0].client_enabled'),false);
 assert.equal(p.run('frpValidate().length'),0);
 const reloaded=prototype(p.saved(),{hash:'#frp'});reloaded.click('frp-profile-toggle');assert.equal(reloaded.run('JSON.stringify(S.frpProfiles.workspace)'),before);assert.equal(reloaded.run('frpNode("n1").proxies[0].name'),'user-edited');
});

test('10 份 TOML 与 10 份 unit 对照附件生成文件；安装 unit 和依赖一致',()=>{
 const p=attachment();for(const n of json(p,'S.frp.nodes'))for(const role of ['client','server',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])]){
  const f=json(p,`frpFiles(frpNode(${JSON.stringify(n.id)}),${JSON.stringify(role)})`),prefix={client:'frpc',server:'frps',visitor:'frpc-visitor'}[role];
  assert.equal(f.toml,readFileSync(new URL(`./fixtures/frp-reference/generated/${prefix}/${n.ip}.toml`,import.meta.url),'utf8'));
  assert.equal(f.unit,readFileSync(new URL(`./fixtures/frp-reference/generated/${prefix}/${n.ip}.service`,import.meta.url),'utf8'));
  assert.equal(f.generatedUnit,`generated/${prefix}/${n.ip}.service`);
  assert.equal(f.unitPath,`/etc/systemd/system/${n.ip}${role==='visitor'?'-visitor':''}.service`);
  assert.ok(f.unit.includes('ExecStart='+f.binaryPath+' -c '+f.tomlPath));
  if(role==='visitor'){assert.equal(f.binaryPath,'/srv/services/frp/bin/frpc');assert.ok(f.unit.includes('After=network-online.target '+n.ip+'.service'));}
 }
});

test('严格校验布尔值、非空鉴权、整数端口和规范化重复节点',()=>{
 for(const [mutation,pattern] of [
  ['frpNode("ref-n1").client_enabled="false"','必须为布尔值'],['S.frp.token=true','token 不能为空'],
  ['frpNode("ref-n1").bind_port=true','1–65535'],['frpNode("ref-n1").proxies[0].remote_port=65536','1–65535'],
  ['frpNode("ref-n1").proxies[0].local_port=1.5','1–65535'],['frpNode("ref-n3").proxies[2].secret_key=1','密钥不能为空'],
  ['frpNode("ref-n3").proxies[2].visitor_bind_addr="0.0.0.0"','回环'],
  ['frpNode("ref-n2").ip=frpNode("ref-n1").ip','已存在连接'],
  ['frpNode("ref-n1").proxies[1].name="http"','代理名称不合法或重复'],
 ]){const p=attachment();p.run(mutation);assert.match(p.run('frpValidate().join("；")'),new RegExp(pattern));}
 const p=attachment();assert.equal(p.run('frpNormalizeIP("2001:0db8:0000:0:0:0:0:1")'),'2001:db8::1');
 p.run('frpNode("ref-n1").ip="2001:db8::1";frpNode("ref-n2").ip="2001:0db8:0:0:0:0:0:1";');assert.match(p.run('frpValidate().join("；")'),/已存在连接/);
});

test('按实际监听主机与地址冲突；跨服务器同端口及本地目标复用允许',()=>{
 const p=attachment();assert.equal(p.run('frpValidate().length'),0);
 p.run('frpNode("ref-n1").bind_addr="127.0.0.1";frpNode("ref-n1").bind_port=18080;');assert.match(p.run('frpValidate().join("；")'),/控制监听.*TCP.*冲突/);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"::",port:7000},{host:"a",addr:"0.0.0.0",port:7000})'),true);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"127.0.0.1",port:7000},{host:"b",addr:"127.0.0.1",port:7000})'),false);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"127.0.0.1",port:7000},{host:"a",addr:"127.0.0.2",port:7000})'),false);
 p.run('frpNode("ref-n1").bind_port=7000;frpNode("ref-n1").proxies[1].local_port=80;');assert.equal(p.run('frpValidate().length'),0);
});

test('STCP provider / visitor 始终引用同一名称和密钥，TCP-only 不生成 visitor',()=>{
 const p=attachment();p.run('frpNode("ref-n3").proxies[2].secret_key="DEMO_CHANGED_PAIR";');
 assert.match(p.run('frpFiles(frpNode("ref-n3"),"client").toml'),/secretKey = "DEMO_CHANGED_PAIR"/);
 assert.match(p.run('frpFiles(frpNode("ref-n3"),"visitor").toml'),/serverName = "example-database"[\s\S]*secretKey = "DEMO_CHANGED_PAIR"/);
 assert.doesNotMatch(p.run('frpFiles(frpNode("ref-n3"),"visitor").toml'),/remotePort/);
 assert.throws(()=>p.run('frpLinkedAction("frp-generate",{node:"ref-n1",role:"visitor"})'));
});

test('0 B、缺架构与失效固定引用阻塞，binary=true 也不能绕过',()=>{
 const p=attachment();p.run('frpRun([{node:"ref-n1",role:"client"}],"deploy",{binary:true,identity:true,impact:true,hold:true});');assert.equal(p.run('S.operations[0].status'),'rejected');assert.match(p.run('S.operations[0].message'),/0 B/);
 const ready=referencePrototype(undefined,{hash:'#frp'});ready.run('pr("frp-n4-server").frpDraft.programRef.pins=[];');assert.match(ready.run('frpDeployErrors([{node:"n4",role:"server"}]).join("；")'),/缺少匹配架构 aarch64/);
 ready.run('pr("frp-n4-server").frpDraft.programRef.pins=[{fileId:"deleted",revision:2}];');assert.ok(ready.run('frpDeployErrors([{node:"n4",role:"server"}]).length')>0);
});

test('文件、FRP 配置、角色项目双向稳定引用，visitor 使用 frpc，文件改名不影响',()=>{
 const p=simulatePrograms(prototype(undefined,{hash:'#frp'}));p.run('const operation=frpRun([{node:"n3",role:"visitor"}],"deploy",'+JSON.stringify(conditions)+');frpFinish(operation,"success");');
 const refs=json(p,'assetReferences("frp-bin-frpc")');assert.equal(refs.configurations.length,2);assert.ok(refs.projects.length>0);
 const arm=json(p,'assetReferences("frp-bin-frpc-arm64")');assert.ok(arm.projects.length>0);
 p.run('assetById("frp-bin-frpc").name="renamed-program";');assert.equal(p.run('frpResolveProgram(pr("frp-n1-client").frpDraft.programRef,"s1").pin.fileId'),'frp-bin-frpc');
 p.click('asset-template',{id:'frp-template-visitor'});assert.match(p.html('asset-details'),/生成 TOML 与 unit/);assert.match(p.html('asset-details'),/frpc/);
});

test('保存公共模板/设置及文件替换仅提示更新；采用只改指定草稿，应用另确认',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.run('const op=frpRun([{node:"n4",role:"server"}],"deploy",'+JSON.stringify(conditions)+');frpFinish(op,"success");const before=JSON.stringify([pr("frp-n4-server").frpApplied,pr("frp-n4-server").frpReadSnapshot]),drafts=JSON.stringify(S.projects.map(p=>p.frpDraft));');
 p.click('frp-template',{id:'frps.toml.tpl'});p.submit('frp-template',{'ft-source':p.run('S.frp.templates["frps.toml.tpl"]')+'\n# public edit'});
 assert.equal(p.run('JSON.stringify(S.projects.map(p=>p.frpDraft))===drafts'),true);assert.equal(p.run('pr("frp-n4-server").frpAvailableUpdate'),true);
 p.run('var others=JSON.stringify(S.projects.filter(p=>p.id!=="frp-n4-server"));');p.click('frp-update',{id:'frp-n4-server'});p.click('frp-adopt');
 assert.equal(p.run('JSON.stringify([pr("frp-n4-server").frpApplied,pr("frp-n4-server").frpReadSnapshot])===before'),true);assert.equal(p.run('JSON.stringify(S.projects.filter(p=>p.id!=="frp-n4-server"))===others'),true);
 p.run('const later=frpRun([{node:"n4",role:"server"}],"deploy",'+JSON.stringify(conditions)+');frpFinish(later,"success");');assert.match(p.run('pr("frp-n4-server").frpApplied.files.toml'),/# public edit/);
});

test('共享 FRPS 按服务器角色去重，批量中间失败后仍保留后续成功结果',()=>{
 const p=simulatePrograms(prototype(undefined,{hash:'#frp'}));assert.equal(p.run('frpUniqueItems(S.frp.nodes.map(n=>({node:n.id,role:"server"}))).length'),2);
 p.run('const items=S.frp.nodes.map(n=>({node:n.id,role:"client"})),batch=frpRun(items,"deploy",'+JSON.stringify({...conditions,outcome:'partial'})+');frpFinish(batch,"partial");');
 assert.equal(p.run('batch.input.items.length'),4);assert.equal(p.run('batch.frpResults.length'),4);assert.equal(p.run('batch.frpResults.at(-1).status'),'success');assert.ok(p.run('batch.frpResults.some(x=>x.status==="partial")'));
});

test('最后一条 STCP 删除后先展示 visitor 清理，明确确认才移除',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.run('const initialOp=frpRun(["client","server","visitor"].map(role=>({node:"n4",role})),"deploy",'+JSON.stringify(conditions)+');frpFinish(initialOp,"success");');
 p.click('frp-proxyremove',{node:'n4',index:0});p.click('frp-removesave',{node:'n4',index:0});assert.equal(p.run('pr("frp-n4-visitor").life'),'installed');
 p.click('frp-update',{id:'frp-n4-client'});p.click('frp-adopt');p.click('frp-op',{node:'n4',role:'client',op:'deploy'});assert.match(p.run('frpLandingBody(frpNode("n4"),"client")'),/本次确认将移除 visitor/);assert.ok(p.run('frpCleanupPreview(frpNode("n4"))'));
 p.run('frpRun([{node:"n4",role:"client"}],"deploy",'+JSON.stringify(conditions)+');');assert.equal(p.run('S.operations[0].status'),'rejected');
 p.run('const cleanup=frpRun([{node:"n4",role:"client"}],"deploy",'+JSON.stringify({...conditions,cleanup:true})+');frpFinish(cleanup,"success");');assert.equal(p.run('pr("frp-n4-visitor").life'),'uninstalled');assert.equal(p.run('pr("frp-n4-visitor").frpCleanup.unitRemoved'),true);
});

test('生成不安装，安装不启动，停止不删除，卸载保留生成文件',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.click('frp-generate',{node:'n1',role:'client'});assert.equal(p.run('pr("frp-n1-client").life'),'draft');assert.ok(p.run('!!S.frpGenerated["frp-n1-client"]'));
 p.run('const install=frpRun([{node:"n1",role:"client"}],"install",'+JSON.stringify(conditions)+');frpFinish(install,"success");');assert.equal(p.run('pr("frp-n1-client").runtime'),'stopped');
 p.run('const remove=frpRun([{node:"n1",role:"client"}],"uninstall",'+JSON.stringify({...conditions,remove:true})+');frpFinish(remove,"success");');assert.equal(p.run('pr("frp-n1-client").life'),'uninstalled');assert.ok(p.run('!!S.frpGenerated["frp-n1-client"]'));
});

test('失败读取保留内容和成功时间；历史编辑与主动清空刷新不被示例填满',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.run('const op=frpRun([{node:"n4",role:"server"}],"deploy",'+JSON.stringify(conditions)+');frpFinish(op,"success");var oldRead=JSON.stringify(pr("frp-n4-server").frpReadSnapshot);');p.click('frp-read',{id:'frp-n4-server',fail:'true'});assert.equal(p.run('JSON.stringify(pr("frp-n4-server").frpReadSnapshot)'),p.run('oldRead'));
 p.run('pr("frp-n4-server").cfg.appConfig="user-saved-custom";persist();');const migrated=prototype(p.saved(),{hash:'#frp'});assert.equal(migrated.run('pr("frp-n4-server").cfg.appConfig'),'user-saved-custom');
 p.run('S.frp.nodes=[];S.programs=[];S.templates=[];persist();');const empty=prototype(p.saved(),{hash:'#frp'});assert.equal(empty.run('S.frp.nodes.length+S.programs.length+S.templates.length'),0);
});

test('实际已应用程序引用只计匹配架构；替换保持公共固定修订、草稿与应用参照',()=>{
 const p=simulatePrograms(prototype(undefined,{hash:'#frp'}));p.run('const op=frpRun([{node:"n1",role:"client"},{node:"n3",role:"client"}],"deploy",'+JSON.stringify(conditions)+');frpFinish(op,"success");');
 assert.ok(p.run('assetReferences("frp-bin-frpc").projects.every(x=>sr(x.project.server).arch==="x86_64")'));assert.ok(p.run('assetReferences("frp-bin-frpc-arm64").projects.every(x=>sr(x.project.server).arch==="aarch64")'));
 p.run('var old=JSON.stringify([pr("frp-n1-client").frpDraft,pr("frp-n1-client").frpApplied]),pins=JSON.stringify(frpProgramRef("client"));const f=assetById("frp-bin-frpc");f.revision++;f.identity="TEST_NEXT_CONTENT";f.revisions.push({...clone(f),revisions:undefined});markAssetUpdates();');
 assert.equal(p.run('JSON.stringify([pr("frp-n1-client").frpDraft,pr("frp-n1-client").frpApplied])'),p.run('old'));assert.equal(p.run('JSON.stringify(frpProgramRef("client"))'),p.run('pins'));assert.equal(p.run('pr("frp-n1-client").frpAvailableUpdate'),true);
});

test('STCP 版本或全局认证变更不能应用成未确认的两端分叉',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.run('const first=frpRun(["server","client","visitor"].map(role=>({node:"n4",role})),"deploy",'+JSON.stringify(conditions)+');frpFinish(first,"success");frpNode("n4").proxies[0].secret_key="DEMO_NEXT_SECRET";frpNode("n4").revision++;frpAdoptProject(pr("frp-n4-client"),frpPublicCandidate(frpNode("n4"),"client"));');
 assert.match(p.run('frpPairErrors([{node:"n4",role:"client"}]).join("；")'),/STCP serverName \/ secretKey/);
 p.run('frpAdoptProject(pr("frp-n4-visitor"),frpPublicCandidate(frpNode("n4"),"visitor"));');assert.equal(p.run('frpPairErrors([{node:"n4",role:"client"},{node:"n4",role:"visitor"}]).length'),0);
 p.run('S.frp.token="DEMO_NEXT_AUTH";S.frp.settingsRev++;frpAdoptProject(pr("frp-n4-server"),frpPublicCandidate(frpNode("n4"),"server"));');assert.match(p.run('frpPairErrors([{node:"n4",role:"server"}]).join("；")'),/配对角色仍使用旧认证/);
});

test('节点残留生成记录可独立清理；服务、安装 unit 与应用参照保持',()=>{
 const p=referencePrototype(undefined,{hash:'#frp'});p.click('frp-generate',{node:'n1',role:'client'});p.run('S.frp.nodes=S.frp.nodes.filter(n=>n.id!=="n1");var before=JSON.stringify(S.projects);');
 p.click('frp-generated-files');assert.match(p.html('modal'),/来源节点已删除 · 残留记录/);
 p.click('frp-generated-remove',{id:'frp-n1-client'});p.click('frp-generated-confirm');assert.equal(p.run('S.frpGenerated["frp-n1-client"]'),undefined);assert.equal(p.run('JSON.stringify(S.projects)'),p.run('before'));
});
