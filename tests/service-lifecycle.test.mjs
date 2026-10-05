import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function preview(p,name='qa-new-service'){
 p.run('sr("s4").docker=true;');
 p.click('newproject',{server:'s4'});
 p.submit('newproject',{'np-template':'t5','np-server':'s4','np-name':name});
}
test('部署预览和执行期间没有项目，成功核对才创建一次',()=>{
 const p=prototype(),count=p.run('S.projects.length');preview(p);p.click('closemodal');assert.equal(p.run('S.projects.length'),count);
 preview(p);p.click('deployment-preview-execute');assert.equal(p.run('S.projects.length'),count);
 p.run('finishOperation(S.operations[0],"success");finishOperation(S.operations[0],"success");');
 assert.equal(p.run('S.projects.length'),count+1);
});
test('项目只包含部署服务，不包含二进制准备、从未部署或已卸载实体',()=>{
 const p=prototype();assert.equal(p.run('S.projects.some(p=>p.life==="draft"||p.life==="uninstalled"||p.frpInstallation?.role==="client")'),false);
});
test('FRP 在配置分组且只提供连接配置管理',()=>{
 const p=prototype();p.click('navigate',{page:'frp'});
 assert.match(p.html('app'),/CONFIGURATION \/ FRP/);
 assert.doesNotMatch(p.html('app'),/data-action="frp-batch"|data-action="frp-install"|data-action="frp-targets"|角色部署矩阵/);
});
test('新连接或映射不创建项目，旧状态迁移重复执行不复活项目',()=>{
 const p=prototype();p.run('const count=S.projects.length;frpEnsure();frpEnsure();');
 assert.equal(p.run('S.projects.length===count'),true);
 const next=prototype(p.saved());assert.equal(next.run('S.projects.some(p=>p.life==="draft"||p.life==="uninstalled")'),false);
});

for(const result of ['failed','partial','unknown'])test(result+' 部署仅保留操作与恢复证据',()=>{
 const p=prototype(),count=p.run('S.projects.length');preview(p,'qa-'+result);p.click('deployment-preview-execute');p.run(`finishOperation(S.operations[0],${JSON.stringify(result)});`);
 assert.equal(p.run('S.projects.length'),count);assert.equal(p.run('S.failedProjects[0].result'),result);assert.equal(p.run('S.failedProjects[0].deployment.project.server'),'s4');assert.ok(p.run('S.failedProjects[0].deployment.targets.length')>0);
 const q=prototype(p.saved());assert.equal(q.run('S.failedProjects[0].result'),result);
});
test('成功部署的停止、异常和离线状态不移除实体',()=>{
 const p=prototype(),count=p.run('S.projects.length');p.run(`const stopped=startOperation(pr('p2'),'stop',{},'success',{hold:true});finishOperation(stopped,'success');`);assert.equal(p.run('pr("p2").runtime'),'stopped');assert.equal(p.run('S.projects.length'),count);p.run('pr("p2").runtime="partial";sr("s1").state="offline";persist();');assert.equal(prototype(p.saved()).run('!!pr("p2")'),true);
});
test('完全清理必须确认数据，成功移除实体与专属资源，保留公共和共享网络',()=>{
 const p=prototype();p.run('var shared=JSON.stringify([S.programs,S.templates,S.dns.map(r=>r.id),S.firewalls.map(r=>r.id)]);');
 p.click('projectop',{id:'p1',kind:'uninstall'});assert.match(p.html('modal'),/专属数据将被删除|独立部署目录/);p.submit('projectop',{'uninstall-name':'catalog-api',outcome:'success'});assert.equal(p.run('S.operations[0].kind'),'apply');
 p.submit('projectop',{'uninstall-name':'catalog-api','cleanup-data-confirm':'on',outcome:'success'});assert.equal(p.run('S.operations[0].kind'),'uninstall');p.run('finishOperation(S.operations[0],"success");');assert.equal(p.run('!!pr("p1")'),false);assert.equal(p.run('S.dns.find(r=>r.id==="dns4").projects.includes("p5")'),true);assert.equal(p.run('JSON.stringify([S.programs,S.templates,S.dns.map(r=>r.id),S.firewalls.map(r=>r.id)])===shared'),true);assert.equal(p.run('S.operations[0].completeCleanup'),true);
});
for(const result of ['failed','partial','unknown'])test('清理 '+result+' 保留残留与恢复入口，不提前移除',()=>{
 const p=prototype();p.click('projectop',{id:'p1',kind:'uninstall'});p.submit('projectop',{'uninstall-name':'catalog-api','cleanup-data-confirm':'on',outcome:result});p.run(`finishOperation(S.operations[0],${JSON.stringify(result)});`);assert.equal(p.run('!!pr("p1")'),true);assert.equal(p.run('pr("p1").cleanup.status'),result);const q=prototype(p.saved());assert.equal(q.run('!!pr("p1")'),true);
 if(result!=='unknown'){q.click('projectop',{id:'p1',kind:'uninstall'});q.submit('projectop',{'uninstall-name':'catalog-api','cleanup-data-confirm':'on',outcome:'success'});q.run('finishOperation(S.operations[0],"success");');assert.equal(q.run('!!pr("p1")'),false);}
});
test('共享路径与归属不明资源阻止清理',()=>{
 const p=prototype();p.run('pr("p7").ownedResources=[{kind:"directory",path:"/srv/stackpier-demo/catalog-api",label:"其他服务目录",ownership:"project"}];');assert.match(p.run('projectCleanupError(pr("p7"),projectCleanupPlan(pr("p7")))'),/外部目录|被项目/);
 p.run('pr("p7").ownedResources=[{kind:"volume",path:"ambiguous-volume",ownership:"unknown"}];');assert.match(p.run('projectCleanupError(pr("p7"),projectCleanupPlan(pr("p7")))'),/归属不明/);
});
test('增量迁移保留全部非项目数据及独有配置，重复迁移不会复活旧对象',()=>{
 const p=prototype();p.run(`const old=initial();old.settings.cfName='QA 用户账号';old.projects.find(p=>p.id==='p9').cfg.source='USER_UNIQUE_BODY';S=old;var other=JSON.stringify([S.servers,S.templates,S.programs,S.dns,S.firewalls,S.settings]);frpInit();migrateServiceProjects();migrateServiceProjects();persist();`);
 assert.equal(p.run('JSON.stringify([S.servers,S.templates,S.programs,S.dns,S.firewalls,S.settings])===other'),true);assert.equal(p.run('S.serviceMigration.evidence.some(e=>e.snapshot.cfg.source==="USER_UNIQUE_BODY")'),true);assert.equal(p.run('S.serviceMigration.evidence.some(e=>e.projectId==="p8"&&e.needsReview)'),true);assert.equal(p.run('S.projects.some(p=>["p8","p9"].includes(p.id))'),false);
});

test('旧卸载不完整迁移为待处理清理，归属核对后才能恢复且不复活项目',()=>{
 const p=prototype();assert.equal(p.run('S.failedProjects.some(f=>f.migrationProject==="p8")'),true);p.run('var f=S.failedProjects.find(f=>f.migrationProject==="p8");');assert.match(p.run('failedCleanupBlock(f)'),/归属待核对/);p.click('history-cleanup-review',{id:p.run('f.id')});p.submit('historycleanupreview',{'history-identity':'on','history-owned':'on'});assert.equal(p.run('ui.modal.kind'),'failedcleanup');assert.equal(p.run('!!pr("p8")'),false);assert.equal(p.run('failedCleanupBlock(f)'), '');p.submit('failedcleanup',{'cleanup-confirm':'on',outcome:'success'});p.run('finishOperation(S.operations[0],"success");migrateServiceProjects();');assert.equal(p.run('f.cleanup.status'),'success');assert.equal(p.run('!!pr("p8")'),false);assert.equal(p.run('S.failedProjects.filter(f=>f.migrationProject==="p8").length'),1);
});
test('声明专属卷纳入清理，共享卷和外部挂载保留',()=>{const p=prototype();p.run('pr("p7").ownedResources=[{kind:"volume",path:"qa-exclusive-volume",ownership:"project"},{kind:"volume",path:"qa-shared-volume",ownership:"shared",shared:true},{kind:"directory",path:"/external/qa-mount",ownership:"external"}];');assert.equal(p.run('projectCleanupPlan(pr("p7")).remaining.some(t=>t.path==="qa-exclusive-volume")'),true);assert.equal(p.run('projectCleanupPlan(pr("p7")).preserved.length'),2);assert.equal(p.run('projectCleanupError(pr("p7"),projectCleanupPlan(pr("p7")))'),'');});
