import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';
import { evidenceServices } from './frp-evidence-fixtures.mjs';

const finish=(p,result,mode='apply')=>p.run(`var n=frpNode('qa-evidence-node'),plan=${mode==='detach'?'frpDetachPlan(n)':'frpConfigurationPlan(n)'},o=startFrpConfiguration(plan,${JSON.stringify(result)},true);if(!o)throw Error(plan.errors.join(';'));finishOperation(o,${JSON.stringify(result)});`);
test('首次部分应用确认写入后阻止改绑，原 FRPC 保留占用',async()=>{
 const p=await evidenceServices();finish(p,'partial');assert.equal(p.run('!!n.appliedConfiguration'),false);
 assert.throws(()=>p.run(`var next=clone(n);next.serviceBindings.client=qaBindings.clientb;next.revision++;frpSaveNode(next,n);`),/解除|未解决|待核/);
 assert.equal(p.run('frpReservationOwners("client",qaBindings.clienta,"other").some(n=>n.id===qaNode.id)'),true);
});
test('首次未知应用固定所有可能写入目标，刷新不丢失或冒充成功',async()=>{
 const p=await evidenceServices();finish(p,'unknown');const q=prototype(p.saved());
 assert.equal(q.run('!!frpNode("qa-evidence-node").appliedConfiguration'),false);
 assert.equal(q.run('frpUnresolvedTargets("qa-evidence-node").filter(t=>t.role!=="server").length'),2);
 assert.equal(q.run('frpConfigurationMatches(frpNode("qa-evidence-node"))'),false);
});
test('解除旧配置后再次部分应用仍保留约束及完整恢复入口',async()=>{
 const p=await evidenceServices();finish(p,'success');finish(p,'success','detach');finish(p,'partial');
 assert.equal(p.run('frpNeedsDetach(n)'),true);assert.equal(p.run('frpDetachPlan(n).errors.length'),0);
});
test('多次失败证据追加，重复完成回调幂等',async()=>{
 const p=await evidenceServices();finish(p,'partial');finish(p,'partial');p.run('var size=S.frpConfigurationAttempts.length;finishOperation(o,"success");');
 assert.equal(p.run('S.frpConfigurationAttempts.length'),2);assert.equal(p.run('size===S.frpConfigurationAttempts.length'),true);
 assert.equal(p.run('frpUnresolvedTargets(n.id).length>0'),true);
});
test('部分或未知清理不释放旧目标，全部成功才解决失败历史并允许改绑',async()=>{
 const p=await evidenceServices();finish(p,'partial');const id=p.run('o.id');finish(p,'partial','detach');finish(p,'unknown','detach');
 assert.equal(p.run('frpReservationOwners("client",qaBindings.clienta,"other").length'),1);
 p.run('finishOperation(o,"partial");');finish(p,'success','detach');
 assert.equal(p.run('frpUnresolvedTargets(n.id).length'),0);assert.equal(p.run('S.operations.find(o=>o.id==='+JSON.stringify(id)+').resolved'),true);
 p.run('var next=clone(n);next.serviceBindings.client=qaBindings.clientb;next.serviceBindings.visitor=qaBindings.visitorb;next.revision++;frpSaveNode(next,n);');finish(p,'success');
 assert.equal(p.run('frpConfigurationMatches(n)'),true);assert.equal(p.run('projectPendingOperations().some(o=>o.input?.nodeId===n.id)'),false);
});
test('visitor 残留独占，FRPS 仍共享，删除连接不能绕过',async()=>{
 const p=await evidenceServices();finish(p,'unknown');assert.equal(p.run('frpReservationOwners("visitor",qaBindings.visitora,"other").length'),1);
 p.run('var next=clone(n);next.id="qa-second";S.servers.push({...clone(sr("s2")),id:"qa-other-client",host:"192.0.2.233"});next.provider="qa-other-client";next.proxies=[];pr(qaBindings.clientb).server="qa-other-client";pr(qaBindings.clientb).frpApplied.host="qa-other-client";next.serviceBindings.client=qaBindings.clientb;next.serviceBindings.visitor=qaBindings.visitorb;delete next.pendingOperation;');
 assert.equal(p.run('frpBindingErrors(next).length'),0);p.run('frpSaveNode(next,null);');
 p.click('frp-connection-delete-confirm',{node:'qa-evidence-node'});assert.equal(p.run('!!n.deletedConfig'),false);
});
test('执行中已固定目标，切换绑定或卸载不能释放占用；重复提交不创建操作',async()=>{
 const p=await evidenceServices();p.run('var n=frpNode(qaNode.id),plan=frpConfigurationPlan(n),o=startFrpConfiguration(plan,"success",true);var count=S.operations.length;startFrpConfiguration(plan,"success",true);');
 assert.equal(p.run('S.operations.length===count'),true);assert.throws(()=>p.run('var next=clone(n);next.serviceBindings.client=qaBindings.clientb;frpSaveNode(next,n);'),/解除/);
 assert.match(p.run('projectCleanupError(pr(qaBindings.clienta),projectCleanupPlan(pr(qaBindings.clienta)))'),/固定配置目标/);
 const q=prototype(p.saved());assert.equal(q.run('S.operations.find(o=>o.input?.nodeId==="qa-evidence-node")?.status'),'unknown');
 assert.equal(q.run('frpUnresolvedTargets("qa-evidence-node").length'),3);
});
test('未知执行后来明确报错不能证明从未写入，历史核对追加且重复回调幂等',async()=>{
 const p=await evidenceServices();finish(p,'unknown');p.run('finishOperation(o,"unknown");var checks=frpAttempt(o).checks.length;finishOperation(o,"failed");');
 assert.equal(p.run('checks'),1);assert.equal(p.run('frpUnresolvedTargets(n.id).length'),3);assert.equal(p.run('frpAttempt(o).checks.length'),2);
});
test('旧版本已经改绑 B，迁移找回 A 原路径占用并允许清理；新成功不能盖掉旧目标',async()=>{
 const p=await evidenceServices();finish(p,'partial');p.run('var original=JSON.stringify(o.input);delete S.frpConfigurationAttempts;delete S.frpEvidenceSchema;n.serviceBindings.client=qaBindings.clientb;n.revision++;persist();');
 const q=prototype(p.saved());assert.equal(q.run('frpReservationOwners("client","qa-evidence-client-a","other").length'),1);
 assert.match(q.run('frpConfigurationPlan(frpNode("qa-evidence-node")).errors.join(";")'),/旧目标不同/);
 assert.equal(q.run('JSON.stringify(S.operations.find(o=>o.input?.nodeId==="qa-evidence-node").input)'),p.run('original'));
 q.run('var n=frpNode("qa-evidence-node"),plan=frpDetachPlan(n);var o=startFrpConfiguration(plan,"success",true);finishOperation(o,"success");');
 assert.equal(q.run('frpUnresolvedTargets(n.id).length'),0);assert.equal(q.run('n.serviceBindings.client'), 'qa-evidence-client-b');
});
test('不同旧路径逐一保留，清理历史路径不改当前 unit 或程序，也不删除共享 FRPS',async()=>{
 const p=await evidenceServices();finish(p,'unknown');p.run('o.protectionReleased=true;o.ended=now();var oldPath=plan.items[0].files.tomlPath;pr(qaBindings.clienta).frpApplied.files.tomlPath="/srv/services/frp/projects/qa-evidence-client-a/new.toml";pr(qaBindings.clienta).frpApplied.files.unit=pr(qaBindings.clienta).frpApplied.files.unit.replace(oldPath,pr(qaBindings.clienta).frpApplied.files.tomlPath);');finish(p,'success');
 assert.equal(p.run('frpUnresolvedTargets(n.id).some(t=>t.files.tomlPath===oldPath)'),true);assert.equal(p.run('frpConfigurationMatches(n)'),false);
 p.run('var serverBefore=JSON.stringify(pr(qaBindings.servera).frpApplied);');finish(p,'success','detach');assert.equal(p.run('frpUnresolvedTargets(n.id).length'),0);
 assert.equal(p.run('pr(qaBindings.clienta).frpApplied.files.tomlPath.endsWith("new.toml")'),true);assert.equal(p.run('JSON.stringify(pr(qaBindings.servera).frpApplied)===serverBefore'),true);
});
test('未知 / 不可访问原目标必须先核对结束事实，离线时不能清理成功',async()=>{
 const p=await evidenceServices();finish(p,'unknown');assert.match(p.run('frpDetachPlan(n).errors.join(";")'),/可能继续写入/);
 p.run('o.protectionReleased=true;o.ended=now();sr("s2").state="offline";');assert.match(p.run('frpDetachPlan(n).errors.join(";")'),/离线/);
 assert.equal(p.run('frpUnresolvedTargets(n.id).length'),3);
});
test('迁移缺少快照证据保守占用；仅 frpWritePending 也保留并幂等',async()=>{
 const p=await evidenceServices();p.run('var n=frpNode(qaNode.id);S.operations.unshift({id:"qa-legacy-missing",kind:"frp-config",input:{nodeId:n.id,revision:1,bindings:clone(n.serviceBindings)},status:"partial",time:now(),steps:[],resources:[]});pr(qaBindings.clientb).frpWritePending={operationId:"missing-operation",path:"/etc/qa-old-frpc.toml"};persist();');
 const q=prototype(p.saved());assert.equal(q.run('frpReservationOwners("client","qa-evidence-client-b","other").length'),1);
 assert.match(q.run('frpDetachPlan(frpNode("qa-evidence-node")).errors.join(";")'),/证据不足/);
 assert.deepEqual(JSON.parse(prototype(q.saved()).saved()),JSON.parse(q.saved()));
});
test('旧 resolved 布尔值不足以解锁；完整逐项目标证据才回填已解决',async()=>{
 const p=await evidenceServices();finish(p,'partial');p.run('o.resolved=true;o.resolution={operationId:"missing"};delete S.frpConfigurationAttempts;persist();');const q=prototype(p.saved());assert.equal(q.run('S.operations.find(o=>o.input?.nodeId==="qa-evidence-node").resolved'),undefined);
 finish(q,'success','detach');q.run('delete S.frpConfigurationAttempts;persist();');const r=prototype(q.saved());assert.equal(r.run('frpUnresolvedTargets("qa-evidence-node").length'),0);assert.equal(r.run('projectPendingOperations().some(o=>o.input?.nodeId==="qa-evidence-node")'),false);
});
test('已丢失连接仍保留固定目标恢复，不复活连接，也不清理他人资源',async()=>{
 const p=await evidenceServices();finish(p,'partial');p.run('S.frp.nodes=S.frp.nodes.filter(x=>x.id!==n.id);var recovery=frpRecoveryNode(n.id),plan=frpDetachPlan(recovery);var cleanup=startFrpConfiguration(plan,"success",true);finishOperation(cleanup,"success");');assert.equal(p.run('cleanup.status'),'success');assert.equal(p.run('frpUnresolvedTargets(n.id).length'),0);assert.equal(p.run('!!frpNode(n.id)'),false);
});
test('迁移重复执行不改无关用户数据、连接和固定操作正文',async()=>{
 const p=await evidenceServices();finish(p,'partial');p.run('var unchanged=JSON.stringify([S.dns,S.cloudflare,S.firewalls,S.programs,S.templates,S.servers,S.frp.nodes.filter(x=>x.id!==qaNode.id)]);var fixed=JSON.stringify(o.input);persist();');const q=prototype(p.saved());q.run('migrateFrpEvidence();migrateFrpEvidence();persist();');assert.equal(q.run('JSON.stringify([S.dns,S.cloudflare,S.firewalls,S.programs,S.templates,S.servers,S.frp.nodes.filter(x=>x.id!=="qa-evidence-node")])'),p.run('unchanged'));assert.equal(q.run('JSON.stringify(S.operations.find(o=>o.input?.nodeId==="qa-evidence-node").input)'),p.run('fixed'));assert.deepEqual(JSON.parse(prototype(q.saved()).saved()),JSON.parse(q.saved()));
});
test('共享 FRPS 认证的批量目标按真实连接归属占用，分别恢复不清空他人映射',async()=>{
 const p=await evidenceServices();p.run(`
 S.servers.push({...clone(sr('s2')),id:'qa-other-client',host:'192.0.2.233'});
 pr(qaBindings.clientb).server='qa-other-client';pr(qaBindings.clientb).frpApplied.host='qa-other-client';
 var other=clone(qaNode);other.id='qa-other-node';other.provider='qa-other-client';other.proxies=[];other.serviceBindings={client:qaBindings.clientb,server:qaBindings.servera,visitor:qaBindings.visitorb};S.frp.nodes.push(other);
 qaNode.sourceSettings.token=other.sourceSettings.token='DEMO_QA_NEW_AUTH';
 var n=qaNode,plan=frpConfigurationPlan(n),o=startFrpConfiguration(plan,'partial',true);if(!o)throw Error(plan.errors.join(';'));finishOperation(o,'partial');
 `);
 assert.equal(p.run('plan.items.filter(x=>x.role==="server").length'),1);
 assert.equal(p.run('frpUnresolvedTargets(n.id).some(t=>t.role==="visitor"&&t.writeEvidence==="written")'),true);
 assert.equal(p.run('frpReservationOwners("client",qaBindings.clientb,other.id).length'),0);
 assert.equal(p.run('frpUnresolvedTargets(other.id).some(t=>t.projectId===qaBindings.clientb)'),true);
 p.run('var otherSnapshot=JSON.stringify(pr(qaBindings.clientb).frpApplied),first=o;');finish(p,'success','detach');
 assert.equal(p.run('JSON.stringify(pr(qaBindings.clientb).frpApplied)===otherSnapshot'),true);assert.equal(p.run('!!first.resolved'),false);
 p.run('var cleanup=startFrpConfiguration(frpDetachPlan(other),"success",true);finishOperation(cleanup,"success");');
 assert.equal(p.run('first.resolved'),true);assert.equal(p.run('frpUnresolvedTargets().filter(t=>t.nodeId.startsWith("qa-")).length'),0);
});
test('旧路径属于其他项目时阻止清理；程序占位和架构检查始终保留',async()=>{
 const p=await evidenceServices();finish(p,'partial');p.run('var other=clone(pr("p1"));other.id="qa-path-owner";other.server="s2";other.applied.fileMappings=[pinMapping({file:"catalog-config.yaml",targetPath:plan.items[0].files.tomlPath})];delete other.resourceLedger;delete other.ownedResources;S.projects.push(other);initializeResourceLedgers();');
 assert.match(p.run('frpDetachPlan(n).errors.join(";")'),/其他项目/);
 p.run('S.projects=S.projects.filter(p=>p.id!=="qa-path-owner");var file=assetRevision(qaFiles[0].id,1);file.placeholder=true;file.bytes=0;');assert.match(p.run('frpDetachPlan(n).errors.join(";")'),/占位|无效/);
});
test('完整恢复后刷新台账不追加兼容副本来源，整个持久状态幂等',async()=>{
 const p=await evidenceServices();finish(p,'partial');finish(p,'success','detach');p.run('var next=clone(n);next.serviceBindings.client=qaBindings.clientb;frpSaveNode(next,n);');finish(p,'success');p.run('persist();');
 const q=prototype(p.saved());assert.deepEqual(JSON.parse(q.saved()),JSON.parse(p.saved()));assert.deepEqual(JSON.parse(prototype(q.saved()).saved()),JSON.parse(q.saved()));
});
test('其他连接的明确未写入失败不会被当前连接成功顺带解决',async()=>{
 const p=await evidenceServices();p.run('var input=frpConfigurationPlan(qaNode);input.nodeId="qa-unrelated-failed";input.items=[];input.bindings={};var other=record("QA 未写入失败","frp-config",null,"failed","虚构证据",{input,results:[],protectionReleased:true});frpRecordEvidence(other,"failed");');finish(p,'success');assert.equal(p.run('!!other.resolved'),false);
});
test('旧操作完全缺少目标时待核实，不能改绑删除或通过核对按钮强制成功',async()=>{
 const p=await evidenceServices();p.run('var n=qaNode;S.operations.unshift({id:"qa-no-target",kind:"frp-config",input:{nodeId:n.id},time:now(),status:"unknown",steps:[],resources:[]});persist();');const q=prototype(p.saved());
 assert.equal(q.run('!!frpNode("qa-evidence-node").evidenceReview'),true);
 assert.throws(()=>q.run('var n=frpNode("qa-evidence-node"),next=clone(n);next.serviceBindings.client="qa-evidence-client-b";frpSaveNode(next,n);'),/解除|核/);
 q.run('var o=S.operations.find(o=>o.id==="qa-no-target");finishOperation(o,"success");');assert.equal(q.run('o.status'),'unknown');assert.equal(q.run('!!frpNode("qa-evidence-node").appliedConfiguration'),false);
 assert.deepEqual(JSON.parse(prototype(q.saved()).saved()),JSON.parse(q.saved()));
});
test('迁移不以旧 resolved 或随后相同路径成功推断未知原执行已经停止',async()=>{
 const p=await evidenceServices();finish(p,'unknown');p.run('var original=o;original.protectionReleased=true;original.ended=now();');finish(p,'success','detach');p.run('original.protectionReleased=false;original.ended=null;delete S.frpConfigurationAttempts;persist();');const q=prototype(p.saved());assert.equal(q.run('frpUnresolvedTargets("qa-evidence-node").length'),3);assert.equal(q.run('!!S.operations.find(o=>o.id==='+JSON.stringify(p.run('original.id'))+').resolved'),false);
});
test('已解决的未知操作迟到回调不能复活旧映射或改变清理参照',async()=>{
 const p=await evidenceServices();finish(p,'unknown');p.run('var original=o;original.protectionReleased=true;original.ended=now();');finish(p,'success','detach');
 p.run('var fixed=JSON.stringify(S);finishOperation(original,"success");finishOperation(original,"partial");finishOperation(original,"unknown");');assert.equal(p.run('JSON.stringify(S)===fixed'),true);assert.equal(p.run('n.appliedConfiguration.detached'),true);
});
