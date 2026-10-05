import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';
import {readyServices,deployService} from './service-fixtures.mjs';

test('FRPS、FRPC、visitor 使用项目统一部署，0 B 占位明确阻塞',()=>{
 const p=prototype(),count=p.run('S.projects.length');deployService(p,'server','qa-frps-block','s4',{'np-frp-bind':'127.0.0.1','np-frp-port':'7700'});
 assert.equal(p.run('ui.modal.kind'),'deploymentpreview');assert.match(p.html('modal'),/0 B/);p.click('deployment-preview-execute');assert.equal(p.run('S.projects.length'),count);assert.equal(p.run('S.operations[0].kind'),'apply');
 const q=readyServices();deployService(q,'server','qa-frps-new','s4',{'np-frp-bind':'127.0.0.1','np-frp-port':'7700'});assert.equal(q.run('deploymentLocation(ui.modal.draft).errors.length'),0);q.click('deployment-preview-execute');assert.equal(q.run('S.projects.some(p=>p.name==="qa-frps-new")'),false);q.run('finishOperation(S.operations[0],"success");');assert.equal(q.run('S.projects.filter(p=>p.name==="qa-frps-new").length'),1);
 const server=q.run('S.projects.find(p=>p.name==="qa-frps-new").id');deployService(q,'client','qa-frpc-new','s1',{'np-frp-server-service':server});q.click('deployment-preview-execute');q.run('finishOperation(S.operations[0],"success");');assert.equal(q.run('S.projects.find(p=>p.name==="qa-frpc-new").frpService.role'),'client');assert.match(q.run('S.projects.find(p=>p.name==="qa-frpc-new").frpApplied.files.unit'),/ExecStart=.*bin\/frpc -c .*projects\/qa-frpc-new\/frpc.toml/);
});

test('连接选择稳定服务 ID，保存 / 删除映射不创建项目或篡改应用参照',()=>{
 const p=readyServices(),count=p.run('S.projects.length');p.run('var before=JSON.stringify([frpNode("n3").appliedConfiguration,pr("frp-n3-client").frpApplied]);');
 p.click('frp-proxyedit',{node:'n3',index:0});p.submit('frp-proxyedit',{'fp-name':'qa-mapping','fp-type':'tcp','fp-localip':'127.0.0.1','fp-localport':'8080','fp-remote':'19991'});
 assert.equal(p.run('S.projects.length'),count);assert.equal(p.run('frpNode("n3").proxies[0].name'),'qa-mapping');assert.equal(p.run('JSON.stringify([frpNode("n3").appliedConfiguration,pr("frp-n3-client").frpApplied])===before'),true);
 p.click('frp-proxyremove',{node:'n3',index:0});p.click('frp-removesave',{node:'n3',index:0});assert.equal(p.run('S.projects.length'),count);
 p.click('frp-nodeedit',{id:'n3'});assert.match(p.html('modal'),/name="fn-provider"[\s\S]*frp-n3-client/);assert.match(p.html('modal'),/所属服务器|名称 \/ 所属服务器/);
});
for(const result of ['failed','partial','unknown'])test('FRP 配置应用 '+result+' 保留旧完整参照和逐目标结果',()=>{
 const p=readyServices();p.run('var before=JSON.stringify([frpNode("n3").appliedConfiguration,...S.projects.map(p=>p.frpApplied)]);frpNode("n3").proxies[0].remote_port=19999;frpNode("n3").revision++;');
 p.click('frp-configapply',{node:'n3'});p.submit('frpconfigapply',{'fc-confirm':'on','fc-hold':'on',outcome:result});assert.equal(p.run('S.operations[0].kind'),'frp-config');p.run(`finishOperation(S.operations[0],${JSON.stringify(result)});`);assert.equal(p.run('JSON.stringify([frpNode("n3").appliedConfiguration,...S.projects.map(p=>p.frpApplied)])===before'),true);assert.equal(p.run('S.operations[0].results.length'),3);assert.equal(p.run('frpNode("n3").configurationResult'),result);
});
test('共享 FRPS 去重与状态一致；成功配置应用不启动已停止服务',()=>{
 const p=readyServices();p.run('pr("frp-n4-client").runtime="stopped";pr("frp-n4-client").desired="stopped";var count=S.projects.length;');
 p.click('frp-configapply',{node:'n4'});assert.equal(p.run('ui.modal.plan.items.filter(x=>x.role==="server").length'),1);assert.equal(p.run('ui.modal.plan.affectedConnections.length'),2);
 p.submit('frpconfigapply',{'fc-confirm':'on','fc-hold':'on',outcome:'success'});p.run('finishOperation(S.operations[0],"success");');assert.equal(p.run('S.projects.length===count'),true);assert.equal(p.run('pr("frp-n4-client").runtime'),'stopped');assert.equal(p.run('frpNode("n4").appliedConfiguration.revision===frpNode("n4").revision'),true);assert.match(p.run('frpConnectionStatus(frpNode("n4"),"client")'),/已停止/);
});
test('STCP 缺 visitor 阻塞；删除最后映射只清空配置，服务仍保留',()=>{
 const p=readyServices();p.run('var count=S.projects.length;delete frpNode("n3").serviceBindings.visitor;');assert.match(p.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/visitor/);
 p.run('frpNode("n3").serviceBindings.visitor="frp-n3-visitor";frpNode("n3").proxies=frpNode("n3").proxies.filter(x=>x.type!=="stcp");frpNode("n3").revision++;');p.click('frp-configapply',{node:'n3'});assert.match(p.html('modal'),/清空 visitor 映射配置/);p.submit('frpconfigapply',{'fc-confirm':'on','fc-hold':'on',outcome:'success'});p.run('finishOperation(S.operations[0],"success");');assert.equal(p.run('S.projects.length===count'),true);assert.equal(p.run('!!pr("frp-n3-visitor")'),true);assert.doesNotMatch(p.run('pr("frp-n3-visitor").frpApplied.files.toml'),/\[\[visitors\]\]/);
});
test('viewer 回环、跨机、架构缺失和失效资产保持阻塞',()=>{
 const p=readyServices();p.run('frpNode("n3").proxies.find(x=>x.type==="stcp").visitor_bind_addr="0.0.0.0";');assert.match(p.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/回环/);
 p.run('frpNode("n3").proxies.find(x=>x.type==="stcp").visitor_bind_addr="127.0.0.1";pr("frp-n3-visitor").server="s4";');assert.match(p.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/FRPS 主机/);
 const q=readyServices();q.run('pr("frp-n3-client").frpApplied.programRef.pins=[];');assert.match(q.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/缺少匹配架构/);
 q.run('pr("frp-n3-client").frpApplied.programRef.pins=[{fileId:"deleted",revision:2}];');assert.match(q.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/引用文件/);
});
test('保存公共配置只提示更新，明确采用仅修改指定服务草稿',()=>{
 const p=readyServices();p.run('var applied=JSON.stringify(S.projects.map(p=>p.frpApplied)),drafts=JSON.stringify(S.projects.map(p=>p.cfg));');
 p.click('frp-template',{id:'frps.toml.tpl'});p.submit('frp-template',{'ft-source':p.run('S.frp.templates["frps.toml.tpl"]')+'\n# QA public'});
 assert.equal(p.run('JSON.stringify(S.projects.map(p=>p.frpApplied))===applied'),true);assert.equal(p.run('JSON.stringify(S.projects.map(p=>p.cfg))===drafts'),true);
 p.click('frp-update',{id:'frp-installed-s4-server'});p.click('frp-adopt');assert.equal(p.run('JSON.stringify(S.projects.map(p=>p.frpApplied))===applied'),true);
});
test('服务改名不破坏引用；删除连接经配置应用不卸载服务',()=>{
 const p=readyServices();p.run('pr("frp-n1-client").name="QA 服务改名";var count=S.projects.length;');assert.equal(p.run('frpBoundService(frpNode("n1"),"client").name'),'QA 服务改名');p.click('frp-connection-delete',{node:'n1'});p.click('frp-connection-delete-confirm',{node:'n1'});assert.equal(p.run('S.projects.length===count'),true);p.click('frp-configapply',{node:'n1'});p.submit('frpconfigapply',{'fc-confirm':'on','fc-hold':'on',outcome:'success'});p.run('finishOperation(S.operations[0],"success");');assert.equal(p.run('S.projects.length===count'),true);assert.equal(p.run('S.frp.nodes.some(n=>n.id==="n1")'),false);
});
test('新统一部署项目进入公共文件反向引用，文件改名保持稳定身份',()=>{
 const p=readyServices();deployService(p,'server','qa-ref-frps','s4',{'np-frp-bind':'127.0.0.1','np-frp-port':'7701'});p.click('deployment-preview-execute');p.run('finishOperation(S.operations[0],"success");assetById("qa-frp-bin-frps").name="QA 重命名";');assert.equal(p.run('assetReferences("qa-frp-bin-frps").projects.some(r=>r.project.name==="qa-ref-frps")'),true);assert.equal(p.run('templateProjects("frp-template-server").some(p=>p.name==="qa-ref-frps")'),true);
});
test('共享 FRPS 清理前保护其他连接服务，不能误删共享 unit 或程序',()=>{const p=readyServices();assert.match(p.run('projectCleanupError(pr("frp-installed-s2-server"),projectCleanupPlan(pr("frp-installed-s2-server")))'),/共享 FRPS/);assert.equal(p.run('projectCleanupPlan(pr("frp-n1-client")).remaining.some(t=>t.path==="/srv/services/frp/bin/frpc")'),false);});
test('共享 FRPS token 变更需明确采用相关连接，执行计划按服务去重',()=>{
 const p=readyServices();p.run('frpNode("n3").sourceSettings.token="DEMO_NEXT_SHARED_TOKEN";frpNode("n3").revision++;');assert.match(p.run('frpConfigurationPlan(frpNode("n3")).errors.join("；")'),/共享 FRPS 认证/);
 p.run('frpNode("n1").sourceSettings.token="DEMO_NEXT_SHARED_TOKEN";frpNode("n1").revision++;');assert.equal(p.run('frpConfigurationPlan(frpNode("n3")).items.filter(x=>x.role==="server").length'),1);assert.equal(p.run('frpConfigurationPlan(frpNode("n3")).items.filter(x=>x.role==="client").length'),2);assert.equal(p.run('frpConfigurationPlan(frpNode("n3")).connectionSnapshots.length'),2);
});
test('已应用映射不会被采用公共程序时回滚，单项目认证变更引导协调应用',()=>{const p=readyServices();p.run('frpNode("n3").proxies[0].name="QA_APPLIED_NEW_NAME";frpNode("n3").revision++;var plan=frpConfigurationPlan(frpNode("n3"));var op=startFrpConfiguration(plan,"success",true);finishOperation(op,"success");');assert.equal(p.run('frpProjectCandidate(pr("frp-n3-client")).node.proxies[0].name'),'QA_APPLIED_NEW_NAME');p.run('S.frp.token="QA_NEW_AUTH";frpSyncConfigs();frpAdoptProject(pr("frp-n3-client"),frpProjectCandidate(pr("frp-n3-client")));');assert.match(p.run('frpServiceLocation(pr("frp-n3-client")).errors.join("；")'),/配置 \/ FRP/);});
test('共享程序不同内容身份阻止单项目覆盖，生命周期不推断隧道健康',()=>{const p=readyServices();p.run('S.projects.push({...clone(pr("frp-n1-client")),id:"qa-shared-bin-service",name:"qa-shared-bin-service"});pr("frp-n1-client").cfg.frpSnapshot.programRef.pins=[{fileId:"frp-bin-frpc",revision:-1}];');assert.match(p.run('frpServiceLocation(pr("frp-n1-client")).errors.join("；")'),/共享程序/);assert.equal(p.run('monitorTarget(pr("frp-n3-client"))'),'systemctl is-active '+p.run('pr("frp-n3-client").frpApplied.unit'));p.run('var op=startOperation(pr("frp-n3-client"),"restart",{},"success",{hold:true});finishOperation(op,"success");');assert.equal(p.run('pr("frp-n3-client").runtime'),'running');assert.equal(p.run('pr("frp-n3-client").health'),'unknown');});
