'use strict';

function frpRecoveryNode(id){
 const node=frpNode(id);if(node)return node;
 const a=(S.frpConfigurationAttempts||[]).find(a=>a.nodeId===id||a.targets.some(t=>t.ownerNodeId===id)),server=a?.targets.find(t=>t.role==='server');
 return a?{id,revision:a.revision,ip:server?.serverTarget?.host||'原连接关联失效',serviceBindings:{},proxies:[],sourceSettings:clone(a.snapshot.settings||frpSettingsSnapshot())}:null;
}

// 原应用与所有未解决尝试共同组成恢复范围，不以最新绑定替代旧服务 / 旧路径。
function frpDetachTargets(n){
 const a=n.appliedConfiguration,targets=frpUnresolvedTargets(n.id);
 if(a&&!a.detached)for(const role of ['client','server',...(a.bindings?.visitor?['visitor']:[])]){
  const fixed=a.targets?.find(t=>t.role===role),p=pr(a.bindings?.[role]);
  const t=fixed||{projectId:a.bindings?.[role],role,serverTarget:p&&serverOperationSnapshot(p.server),files:clone(p?.frpApplied?.files||{}),programRef:clone(p?.frpApplied?.programRef||null)};
  if(!targets.some(x=>frpTargetKey(x)===frpTargetKey(t)))targets.push(t);
 }
 return targets;
}
function frpDetachPlan(n){
 const a=n.appliedConfiguration,errors=[...frpBindingErrors(n)],items=[],targets=frpDetachTargets(n);
 if(!targets.length)errors.push('没有完整的旧应用服务绑定可解除；保留证据，请先核对旧记录。');
 for(const t of targets){
  const {role}=t,p=frpServiceProject(t.projectId,role);
  if(!p||p.cleanup){errors.push('旧 '+frpPrefixes[role]+' 服务失效或清理待处理，不能假装解除完成。');continue;}
  if(t.identityReview||!t.serverTarget||!t.files?.tomlPath){errors.push('旧目标身份 / 路径证据不足，须核实原操作；不能使用当前绑定猜测。');continue;}
  const snapshot=p.frpApplied;if(!snapshot?.programRef||!snapshot.files?.tomlPath){errors.push('旧服务缺少程序 / 配置参照');continue;}
  const error=serverSnapshotError(t.serverTarget);if(error)errors.push(p.name+'：'+error);
  if(t.serverTarget.id!==p.server)errors.push('旧服务服务器归属改变，先核对原目标。');
  errors.push(...frpResolveProgram(t.programRef||snapshot.programRef,p.server).errors);
  for(const other of S.projects.filter(x=>x.id!==p.id&&x.server===p.server))if(projectOwnedResources(other).some(r=>cleanupTargetsOverlap({kind:'file',path:t.files.tomlPath},r)))errors.push('旧路径仍被其他项目 '+other.name+' 管理，不能清空他人配置。');
  for(const id of t.operationIds||[]){const o=S.operations.find(o=>o.id===id);if(o&&!o.protectionReleased&&['running','unknown'].includes(o.status))errors.push('原操作 '+id+' 可能继续写入；先核对原执行已结束。');}
  const oldNode={...clone(snapshot.node),proxies:[]},files=role==='server'?clone(p.frpReadSnapshot?.files||snapshot.files):{...clone(snapshot.files),toml:frpFiles(oldNode,role,a?.settings||snapshot.settings||n.sourceSettings||frpSettingsSnapshot()).toml};
  Object.assign(files,{tomlPath:t.files.tomlPath,unitPath:t.files.unitPath,binaryPath:t.files.binaryPath,unit:t.files.unit});
  items.push({projectId:p.id,role,action:role==='server'?'保留共享 FRPS，仅核对，不回滚认证或删除服务':'清空此连接旧映射配置并核对',readOnly:role==='server',serverTarget:clone(t.serverTarget),files,before:clone(t.files),appliedRevision:p.appliedRev,programRef:clone(t.programRef||snapshot.programRef),restart:role!=='server'&&p.runtime==='running'&&t.files.tomlPath===snapshot.files.tomlPath});
 }
 return {mode:'detach',evidenceSignature:frpEvidenceSignature(n.id),nodeId:n.id,revision:n.revision,bindings:clone(a?.bindings||n.serviceBindings||{}),previousApplied:clone(a||null),proxies:[],settings:clone(a?.settings||n.sourceSettings||frpSettingsSnapshot()),items,serviceIds:[...new Set(items.map(x=>x.projectId))],affectedConnections:frpAllConnections().filter(x=>x.id===n.id||targets.some(t=>t.role==='server'&&x.serviceBindings?.server===t.projectId)).map(x=>x.id),connectionSnapshots:[],errors:[...new Set(errors)]};
}
function frpRecoveryActions(o){
 if(o.kind!=='frp-config'||o.resolved)return '';
 const n=frpRecoveryNode(o.input?.nodeId);if(!n)return notice('旧连接关联待核对','原操作与占用证据仍保留，不能使用另一个连接猜测归属。','warning');
 const owners=[...new Set(frpAttempt(o)?.targets.filter(t=>frpTargetUnresolved(frpAttempt(o),t)).map(t=>t.ownerNodeId||n.id)||[n.id])];
 return owners.map(id=>frpPendingEvidenceBody(id)).join('');
}
