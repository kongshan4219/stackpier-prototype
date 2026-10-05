'use strict';

function frpAllConnections(){return [...new Map([...Object.values(S.frpProfiles||{}).flatMap(f=>f.nodes||[]),...(S.frp?.nodes||[])].map(n=>[n.id,n])).values()];}
function frpSameBindings(a,b){return JSON.stringify(Object.keys(frpRoles).map(role=>a?.[role]||''))===JSON.stringify(Object.keys(frpRoles).map(role=>b?.[role]||''));}
function frpReservationOwners(role,id,exclude='',nodes=frpAllConnections()){
 return nodes.filter(n=>n.id!==exclude&&(n.serviceBindings?.[role]===id||n.appliedConfiguration?.bindings?.[role]===id));
}
function frpBindingErrors(n,nodes=frpAllConnections()){
 const errors=[];
 if(n.bindingReview)errors.push(n.ip+'：旧应用绑定待核对，不能猜测旧服务配置已解除。');
 for(const role of ['client','visitor'])for(const id of new Set([n.serviceBindings?.[role],n.appliedConfiguration?.bindings?.[role]].filter(Boolean))){
  const owners=frpReservationOwners(role,id,n.id,nodes);if(owners.length)errors.push(frpPrefixes[role]+' 服务 '+pname(id)+' 已存在连接 '+owners.map(o=>o.ip+' / '+o.id).join('、')+' 占用；'+(role==='visitor'?'visitor 独占绑定':'FRPC 不能被多连接改写')+'，旧应用绑定解除前仍保留占用。');
 }
 return errors;
}
function frpNeedsDetach(n){return !!n.appliedConfiguration&&(!n.appliedConfiguration.detached||Object.keys(n.appliedConfiguration.bindings||{}).length>0);}
function frpConfigurationMatches(n){return !n.bindingReview&&(!n.configurationResult||n.configurationResult==='success')&&!Object.values(n.serviceBindings||{}).some(id=>pr(id)?.frpWritePending)&&!frpBindingErrors(n).length&&!n.appliedConfiguration?.detached&&n.appliedConfiguration?.revision===n.revision&&frpSameBindings(n.appliedConfiguration.bindings,n.serviceBindings)&&JSON.stringify(n.appliedConfiguration.proxies)===JSON.stringify(n.proxies);}
function migrateFrpBindings(){
 for(const n of frpAllConnections()){
  const a=n.appliedConfiguration;if(!a||a.detached)continue;if(!Array.isArray(a.proxies)){n.bindingReview='旧应用映射证据缺失';continue;}if(a.bindings)continue;
  const operation=S.operations.find(o=>o.kind==='frp-config'&&o.status==='success'&&o.input?.nodeId===n.id&&o.input.revision===a.revision);
  if(operation?.input.bindings){a.bindings=clone(operation.input.bindings);a.bindingSource=operation.id;continue;}
  const bindings={},ids=a.serviceIds||[];
  for(const role of Object.keys(frpRoles)){const services=ids.filter(id=>pr(id)?.frpService?.role===role);if(services.length===1)bindings[role]=services[0];}
  if(bindings.client&&bindings.server&&(!a.proxies.some(p=>p.type==='stcp')||bindings.visitor)){a.bindings=bindings;a.bindingSource='旧稳定服务 ID 的唯一角色参照';}
  else n.bindingReview='旧记录缺少唯一服务绑定证据';
 }
 S.frpBindingSchema=1;
}
function frpDetachPlan(n){
 const a=n.appliedConfiguration,errors=[...frpBindingErrors(n)],items=[];
 if(!a||a.detached||!a.bindings?.client||!a.bindings?.server)errors.push('没有完整的旧应用服务绑定可解除；保留证据，请先核对旧记录。');
 for(const role of ['client','server',...(a?.bindings?.visitor?['visitor']:[])]){
  const p=frpServiceProject(a?.bindings?.[role],role);if(!p||p.cleanup){errors.push('旧 '+frpPrefixes[role]+' 服务失效或清理待处理，不能假装解除完成。');continue;}
  const snapshot=p.frpApplied;if(!snapshot?.programRef||!snapshot.files?.tomlPath){errors.push('旧服务缺少程序 / 配置参照');continue;}
  const error=serverOperationError(p.server);if(error)errors.push(p.name+'：'+error);
  errors.push(...frpResolveProgram(snapshot.programRef,p.server).errors);
  const oldNode={...clone(snapshot.node),proxies:[]},files=role==='server'?clone(snapshot.files):{...clone(snapshot.files),toml:frpFiles(oldNode,role,a.settings||snapshot.settings||n.sourceSettings||frpSettingsSnapshot()).toml};
  items.push({projectId:p.id,role,action:role==='server'?'保留共享 FRPS，核对旧连接映射已解除':'清空此连接旧映射配置并核对',readOnly:role==='server',serverTarget:serverOperationSnapshot(p.server),files,before:clone(snapshot.files),appliedRevision:p.appliedRev,programRef:clone(snapshot.programRef),restart:role!=='server'&&p.runtime==='running'});
 }
 return {mode:'detach',nodeId:n.id,revision:n.revision,bindings:clone(a?.bindings||{}),previousApplied:clone(a||null),proxies:[],settings:clone(a?.settings||n.sourceSettings||frpSettingsSnapshot()),items,serviceIds:items.map(x=>x.projectId),affectedConnections:frpAllConnections().filter(x=>x.id===n.id||x.serviceBindings?.server===a?.bindings?.server).map(x=>x.id),connectionSnapshots:[],errors:[...new Set(errors)]};
}
registerPrototypeHandlers(prototypeModals,['frp-binding-detach'],m=>{const n=frpNode(m.node);if(!n)return closeModal();m.plan||=frpDetachPlan(n);layout('解除旧连接配置 · '+n.ip,'旧服务保留；全部清空并核对成功后才允许改绑。新服务应用是下一次独立确认。',frpConfigurationPlanBody(m.plan)+outcomeField()+check('fc-confirm','确认清空旧映射及必要重载 / 重启，不卸载旧服务')+check('fc-hold','保持模拟执行中'),btn('取消','closemodal')+`<button class="btn primary" type="submit" ${m.plan.errors.length?'disabled':''}>确认解除旧配置</button>`,true,'frpconfigapply');});
