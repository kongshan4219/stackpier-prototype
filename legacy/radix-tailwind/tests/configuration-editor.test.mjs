import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';
import {readyServices} from './service-fixtures.mjs';

const source='services:\n  web:\n    image: example.test/web:fixture\n';
const error=p=>p.document.getElementById('modal-error').textContent;
function open(p,type){p.run(`openModal('templateedit',{initialType:${JSON.stringify(type)}})`);}
function upload(p,name,text){return p.run(`configurationUploadFiles(ui.modal,[{name:${JSON.stringify(name)},size:${Buffer.byteLength(text)},arrayBuffer:async()=>new TextEncoder().encode(${JSON.stringify(text)}).buffer}])`);}

test('三类编辑器展示各自字段，已有类型和 FRP 角色固定',()=>{
 const p=prototype();
 for(const [id,fields] of [['t1',['服务文件正文','文件与目录映射']],['t5',['Compose YAML 正文','显式变量（JSON）','文件与目录映射']],['frp-template-client',['FRP 程序固定版本','回环管理端口','允许映射端口起点']]]){
  p.click('templateedit',{id});const html=p.html('modal');
  for(const field of fields)assert.ok(html.includes(field));
  assert.doesNotMatch(html,/systemd 正文|架构选择规则|生成模板与|运行用户|连接到已部署 FRPS/);
  assert.equal(p.document.getElementById('tpl-type').disabled,true);
 }
 assert.equal(p.document.getElementById('fc-role').disabled,true);
 assert.equal(p.document.getElementById('fc-bind').value,'127.0.0.1');
 assert.equal(p.document.getElementById('fc-port').value,'9');
});
test('新配置按类型保留内存草稿，刷新只恢复已保存配置',()=>{
 const p=prototype();open(p,'compose');p.document.getElementById('tpl-name').value='draft-only';p.document.getElementById('tpl-source').value=source;
 p.run('configurationSwitchType(ui.modal,"systemd")');p.document.getElementById('tpl-source').value='[Service]\nExecStart=/srv/demo/program';p.run('configurationSwitchType(ui.modal,"compose")');
 assert.equal(p.document.getElementById('tpl-source').value,source);
 p.click('closemodal');open(p,'compose');assert.equal(p.document.getElementById('tpl-name').value,'draft-only');
 assert.ok(!p.saved().includes('draft-only'));
 const reloaded=prototype(p.saved());open(reloaded,'compose');assert.equal(reloaded.document.getElementById('tpl-source').value,'');
});
test('并发修订和类型篡改拒绝覆盖，错误保留输入',()=>{
 const p=prototype();p.click('templateedit',{id:'t5'});p.run('tpl("t5").rev++;');const saved=p.run('JSON.stringify(tpl("t5"))');
 p.submit('templateedit',{'tpl-name':'编辑中的配置','tpl-source':source});
 assert.match(error(p),/配置已更新/);assert.equal(p.run('JSON.stringify(tpl("t5"))'),saved);
 assert.equal(p.document.getElementById('tpl-source').value,source);
 p.submit('templateedit',{'tpl-name':'越界','tpl-type':'systemd'});assert.match(error(p),/类型已改变/);
});
test('明确重置演示同时清空配置编辑会话草稿',()=>{
 const p=prototype();open(p,'compose');p.document.getElementById('tpl-name').value='reset-this-draft';p.click('closemodal');
 p.run('resetSample()');open(p,'compose');assert.equal(p.document.getElementById('tpl-name').value,'');
});
test('systemd 正文与路径映射原样保存，旧修订与项目快照保留',()=>{
 const p=prototype();p.click('templateedit',{id:'t1'});
 const before=p.run('JSON.stringify(S.projects.map(p=>[p.cfg,p.appliedSnapshot,p.serverReadSnapshot]))'),history=p.run('JSON.stringify(tpl("t1").revisions)');
 const unit='  # 保留正文\n[Service]\nExecStart=/srv/fixture/program --literal=${VALUE}\n\n';
 p.click('configuration-mapping-add');
 p.submit('templateedit',{'tpl-name':'正文服务','tpl-source':unit,'tpl-map-kind-0':'directory','tpl-map-local-0':'/srv/source/','tpl-map-remote-0':'/srv/fixture/'});
 assert.equal(p.run('tpl("t1").tpl'),unit);assert.equal(p.run('tpl("t1").editorSchema'),2);
 assert.equal(p.run('JSON.stringify(S.projects.map(p=>[p.cfg,p.appliedSnapshot,p.serverReadSnapshot]))'),before);
 assert.equal(p.run('JSON.stringify(tpl("t1").revisions.slice(0,-1))'),history);
 assert.equal(p.run('tpl("t1").pathMappings[0].remotePath'),'/srv/fixture');
 p.click('newproject',{template:'t1',server:'s4'});p.submit('newproject',{'np-template':'t1','np-server':'s4','np-name':'qa-editor'});
 assert.equal(p.run('deploymentLocation(ui.modal.draft).errors.length'),0);
 assert.equal(p.run('ui.modal.draft.cfg.source'),unit);assert.equal(p.run('ui.modal.draft.cfg.systemdMode'),'unit');
 assert.equal(p.run('ui.modal.draft.cfg.fileMappings.length'),0);
 assert.equal(p.run('ui.modal.draft.cfg.pathMappings[0].deleteExtraneous'),true);
 assert.equal(p.run('S.projects.some(p=>p.name==="qa-editor")'),false);
});
test('systemd 旧固定配置打开不迁移，不伪造正文或本机路径',()=>{
 const p=prototype();p.run('Object.assign(tpl("t1"),{editorSchema:1,tpl:"",programRef:{pins:[{fileId:"bin1",revision:1}]},configRef:{pins:[{fileId:"file1",revision:1}]}})');
 const before=p.run('JSON.stringify(tpl("t1"))');p.click('templateedit',{id:'t1'});
 assert.equal(p.document.getElementById('tpl-source').value,'');assert.match(p.html('modal'),/旧配置|固定程序/);
 assert.equal(p.run('ui.modal.editor.mappings.length'),0);
 p.submit('templateedit',{'tpl-name':'不能空正文','tpl-source':'   '});assert.match(error(p),/正文/);
 assert.equal(p.run('JSON.stringify(tpl("t1"))'),before);
});
test('systemd 路径错误与正文空值拒绝保存，切换类型保留各自草稿',()=>{
 const p=prototype();open(p,'systemd');
 p.submit('templateedit',{'tpl-name':'invalid-unit','tpl-source':'  '});assert.match(error(p),/正文/);
 p.document.getElementById('tpl-source').value='[Service]\nExecStart=/srv/unit/program';p.click('configuration-mapping-add');
 p.submit('templateedit',{'tpl-name':'invalid-unit','tpl-map-kind-0':'file','tpl-map-local-0':'relative','tpl-map-remote-0':'/srv/unit/program'});assert.match(error(p),/绝对路径/);
 p.run('configurationSwitchType(ui.modal,"compose")');p.document.getElementById('tpl-source').value=source;p.run('configurationSwitchType(ui.modal,"systemd")');
 assert.equal(p.document.getElementById('tpl-source').value,'[Service]\nExecStart=/srv/unit/program');
 assert.equal(p.document.getElementById('tpl-map-local-0').value,'relative');
 assert.equal(p.run('S.templates.some(t=>t.name==="invalid-unit")'),false);
});
test('Compose 变量大小、名称与字符串类型限制和实际编辑器一致',()=>{
 const p=prototype();open(p,'compose');
 for(const variables of ['null','[]','{"A":1}','{"9BAD":"x"}','{',JSON.stringify({A:'x'.repeat(8193)}),JSON.stringify(Object.fromEntries(Array.from({length:65},(_,i)=>['K'+i,'x'])))]){
  p.submit('templateedit',{'tpl-name':'invalid-vars','tpl-source':source,'tpl-variables':variables});assert.match(error(p),/显式变量/);
  assert.equal(p.run('S.templates.some(t=>t.name==="invalid-vars")'),false);
 }
});
test('Compose 附件按文件名替换，移除不改变公共文件，保存与重载保留字节',async()=>{
 const p=prototype();open(p,'compose');const count=p.run('S.programs.length');
 await upload(p,'settings.txt','first');await upload(p,'settings.txt','第二版');
 assert.equal(p.run('ui.modal.editor.files.length'),1);assert.equal(p.run('ui.modal.editor.files[0].data'),Buffer.from('第二版').toString('base64'));
 await upload(p,'extra.txt','remove');p.click('configuration-file-remove',{path:'files/extra.txt'});
 p.submit('templateedit',{'tpl-name':'附件配置','tpl-source':source,'tpl-variables':'{}'});
 assert.equal(p.run('S.programs.length'),count);
 const saved=prototype(p.saved());saved.run('openModal("templateedit",{id:S.templates.find(t=>t.name==="附件配置").id})');
 assert.equal(saved.run('ui.modal.editor.files[0].size'),9);
});
test('附件拒绝非法文件、空文件、总量超限，失败保留原附件',async()=>{
 const p=prototype();open(p,'compose');await upload(p,'valid.txt','keep');
 for(const [name,size] of [['中文.txt',3],['empty.txt',0],['large.bin',1048577]]){
  await p.run(`configurationUploadFiles(ui.modal,[{name:${JSON.stringify(name)},size:${size}}])`);
  assert.match(error(p),/附加文件/);assert.equal(p.run('ui.modal.editor.files.length'),1);
 }
 assert.match(p.run('configurationFileError([{path:"files/a",size:1048576},{path:"files/b",size:1048576},{path:"files/c",size:1}])'),/总计/);
});
test('存储失败保留配置修订、项目与编辑草稿，恢复后可重试保存',async()=>{
 const p=prototype();p.click('templateedit',{id:'t5'});await upload(p,'settings.txt','keep');
 const before=p.run('JSON.stringify([S.templates,S.projects])'),saved=p.saved();
 p.run('globalThis.configurationStore=localStorage.setItem;localStorage.setItem=()=>{throw Error("quota")};');
 p.submit('templateedit',{'tpl-name':'保存失败草稿','tpl-source':source,'tpl-variables':'{}'});
 assert.match(error(p),/本次未保存/);assert.equal(p.run('JSON.stringify([S.templates,S.projects])'),before);assert.equal(p.saved(),saved);
 assert.equal(p.run('ui.modal.saving'),false);assert.equal(p.run('ui.modal.editor.files.length'),1);
 assert.equal(p.document.getElementById('tpl-name').value,'保存失败草稿');
 p.run('localStorage.setItem=configurationStore;');p.submit('templateedit',{'tpl-name':'保存成功配置','tpl-source':source,'tpl-variables':'{}'});
 assert.equal(p.run('ui.modal'),null);assert.equal(p.run('tpl("t5").name'),'保存成功配置');
});
test('文件读取期间的输入不丢失，关闭或换类型后丢弃迟到读取结果',async()=>{
 const p=prototype();open(p,'compose');
 const pending=p.run('configurationUploadFiles(ui.modal,[{name:"delayed.txt",size:3,arrayBuffer:()=>new Promise(resolve=>globalThis.finishFile=resolve)}])');
 p.document.getElementById('tpl-source').value='LATEST_INPUT';
 p.run('finishFile(new TextEncoder().encode("abc").buffer)');await pending;
 assert.equal(p.document.getElementById('tpl-source').value,'LATEST_INPUT');
 const late=p.run('configurationUploadFiles(ui.modal,[{name:"late.txt",size:3,arrayBuffer:()=>new Promise(resolve=>globalThis.finishFile=resolve)}])');
 p.run('configurationSwitchType(ui.modal,"systemd");finishFile(new TextEncoder().encode("abc").buffer)');await late;
 p.run('configurationSwitchType(ui.modal,"compose")');assert.equal(p.run('ui.modal.editor.files.length'),1);
});
test('FRP Token 不进入未保存草稿，端口冲突拒绝保存，留空保留凭据',()=>{
 const p=readyServices();p.click('templateedit',{id:'frp-template-server'});
 p.document.getElementById('fc-token').value='DEMO_UNSAVED_TOKEN_123';p.click('closemodal');p.click('templateedit',{id:'frp-template-server'});
 assert.equal(p.document.getElementById('fc-token').value,'');assert.ok(!p.saved().includes('DEMO_UNSAVED_TOKEN_123'));
 const before=p.run('tpl("frp-template-server").frpSource.token');
 p.submit('templateedit',{'tpl-name':'FRPS','fc-port':'27000','fc-admin':'27000'});assert.match(error(p),/冲突/);
 p.submit('templateedit',{'tpl-name':'FRPS','fc-port':'27000','fc-admin':'27100','fc-start':'27110','fc-end':'27299'});
 assert.equal(p.run('tpl("frp-template-server").frpSource.token'),before);
 assert.equal(p.run('tpl("frp-template-server").frpParameters.adminPort'),27100);
});
test('FRPC 与 visitor 保存后可独立预览未绑定服务，不需要选旧连接',()=>{
 for(const role of ['client','visitor']){
  const p=readyServices();p.click('templateedit',{id:'frp-template-'+role});
  p.submit('templateedit',{'tpl-name':'未绑定 '+role});
  assert.equal(p.run(`tpl("frp-template-${role}").editorSchema`),1);
  p.click('newproject',{template:'frp-template-'+role,server:'s4'});p.submit('newproject',{'np-template':'frp-template-'+role,'np-server':'s4','np-name':'qa-'+role});
  assert.equal(p.run('ui.modal.kind'),'deploymentpreview');assert.equal(p.run('ui.modal.draft.cfg.frpSnapshot.unbound'),true);
  assert.equal(p.run('deploymentLocation(ui.modal.draft).errors.length'),0);
  assert.match(p.run('ui.modal.draft.cfg.appConfig'),/serverPort = 9/);
  assert.doesNotMatch(p.run('ui.modal.draft.cfg.source'),/undefined|Requires=/);
 }
});


test('Compose 映射按三列逐行编辑，目录后缀归一并固定到新预览',()=>{
 const p=prototype();open(p,'compose');
 p.click('configuration-mapping-add');p.submit('templateedit',{'tpl-name':'路径配置','tpl-source':source,'tpl-map-kind-0':'directory','tpl-map-local-0':'/srv/input/','tpl-map-remote-0':'/srv/output/'});
 assert.equal(p.run('S.templates.find(t=>t.name==="路径配置").pathMappings[0].remotePath'),'/srv/output');
 p.run('globalThis.mappingTemplate=S.templates.find(t=>t.name==="路径配置");globalThis.mappingDraft=configurationProjectDraft(mappingTemplate,{name:"mapping-fixture",cfg:{}})');
 assert.equal(p.run('mappingDraft.cfg.pathMappings[0].deleteExtraneous'),true);
 assert.equal(p.run('mappingTemplate.pathMappings[0].deleteExtraneous'),undefined);
 assert.match(p.run('configurationMappingSummary(mappingDraft.cfg.pathMappings,true)'),/完全同步，删除多余条目/);
 assert.match(p.run('configurationMappingSummary(mappingTemplate.pathMappings,true)'),/覆盖同名，保留多余条目/);
 p.run('openModal("templateedit",{id:S.templates.find(t=>t.name==="路径配置").id})');
 assert.equal(p.document.getElementById('tpl-map-kind-0').value,'directory');
 assert.equal(p.document.getElementById('tpl-map-local-0').value,'/srv/input');
 assert.match(p.html('modal'),/会删除远程映射目录内多余文件和子目录/);
 p.click('configuration-mapping-add');assert.equal(p.run('ui.modal.editor.mappings.length'),2);
 p.click('configuration-mapping-remove',{index:0});assert.equal(p.run('ui.modal.editor.mappings.length'),1);
 assert.match(p.run('configurationMappingError([{kind:"file",localPath:"relative",remotePath:"/srv/output"}])'),/绝对路径/);
 assert.match(p.run('configurationMappingError([{kind:"file",localPath:"/srv/file",remotePath:"/srv/output/"}])'),/绝对路径/);
 assert.match(p.run('configurationMappingError([{kind:"directory",localPath:"/srv/input",remotePath:"/srv/output"},{kind:"file",localPath:"/srv/file",remotePath:"/srv/output/file"}])'),/相互包含/);
});
