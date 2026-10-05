'use strict';
// 模拟操作受理与分项结果核对；保留未知结果和迟到核对保护。
function frpCompileItems(items,op='deploy'){return frpUniqueItems(items).map(x=>{const n=frpNode(x.node),p=pr(frpPid(n,x.role)),snapshot=['deploy','install'].includes(op)?frpDraftSnapshot(n,x.role):clone(p.frpApplied);if(!snapshot)throw Error('没有已应用运行载体参照，不能猜测启停或卸载目标');if(['deploy','install'].includes(op))snapshot.program=clone(frpResolveProgram(snapshot.programRef,snapshot.host).file);return {serverTarget:serverOperationSnapshot(snapshot.host),node:n.id,role:x.role,project:p.id,snapshot,cfg:clone(p.cfg),draftRev:p.draftRev,before:{life:p.life,runtime:p.runtime,desired:p.desired},files:clone(snapshot.files)};});}
function frpNeedsBinary(items){return items.some(x=>{const n=frpNode(x.node);return !n.roleProjects?.server||x.role==='visitor'||x.role==='client'&&pr(n.clientInstallation)?.life!=='installed'||x.role==='server'&&pr(frpPid(n,'server'))?.life!=='installed';});}
function frpRun(items,op,conditions){
 frpEnsure();items=frpUniqueItems(items);if(!items.length){modalError('没有选中的适用角色。');return;}
 const p=pr(frpPid(frpNode(items[0].node),items[0].role)),errors=frpValidate();
 if(['deploy','install'].includes(op)){const invalid=frpDeployErrors(items);if(invalid.length)return rejectOperation(p,'frp-'+op,invalid.join('；'));const cleanup=items.map(x=>frpCleanupPreview(frpNode(x.node))).filter(Boolean);if(cleanup.length&&!conditions.cleanup)return rejectOperation(p,'frp-'+op,'删除最后一条 STCP 后须明确确认移除 visitor 配置和 unit。');}
 for(const item of items){const node=frpNode(item.node),err=serverOperationError(frpHost(node,item.role));if(err)return rejectOperation(p,'frp-'+op,err);}
 if(op==='start'){for(const x of items){const q=pr(frpPid(frpNode(x.node),x.role));if(q.frpApplied?.programRef){const invalid=frpResolveProgram(q.frpApplied.programRef,q.frpApplied.host).errors;if(invalid.length)return rejectOperation(q,'frp-start',invalid.join('；'));}}}
 if(['deploy','install'].includes(op)||op==='start')for(const item of items){const n=frpNode(item.node);if(n.roleProjects?.server)try{frpValidateConnectionServers(n);}catch(error){return rejectOperation(p,'frp-'+op,error.message);}}
 if(['deploy','install'].includes(op))for(const item of items){const n=frpNode(item.node);if(!n.roleProjects?.server)continue;
  if(item.role!=='server'){if(frpAuthChange(n,'server')&&!items.some(x=>x.node===n.id&&x.role==='server'))return rejectOperation(p,'frp-deploy','frps 仍使用旧认证，请先核对并应用配对服务端配置。');const program=item.role==='client'?pr(n.clientInstallation):null;if(program&&program.frpApplied?.files.binaryPath!==pr(frpPid(n,item.role))?.frpDraft?.files.binaryPath)return rejectOperation(p,'frp-deploy','已部署 frpc 程序与连接草稿的运行路径不同，请先核对服务器角色部署。');}
  if(item.role==='server'&&frpAuthChange(n,'server')){const affected=S.frp.nodes.filter(other=>frpPid(other,'server')===frpPid(n,'server')).flatMap(other=>['client','visitor'].filter(role=>pr(frpPid(other,role))?.life==='installed'&&frpAuthChange(other,role)).map(role=>({node:other.id,role})));if(affected.some(x=>!items.some(item=>item.node===x.node&&item.role===x.role)))return rejectOperation(p,'frp-deploy','共用 frps 的其他已部署连接仍使用旧认证，请先审阅所有关联连接的认证变更。');}
 }
 if(conditions.previewBinding&&conditions.previewBinding!==frpPreviewBinding(items,op))return rejectOperation(p,'frp-'+op,'预览后配置或已应用参照已变化，请重新打开预览并确认；不使用新内容替换原确认。');
 if(['deploy','install'].includes(op)){const pairing=frpPairErrors(items);if(pairing.length)return rejectOperation(p,'frp-'+op,pairing.join('；'));}
 if(['deploy','install'].includes(op)&&errors.length)return rejectOperation(p,'frp-deploy',errors.join('；'));
 if(!conditions.identity||!conditions.impact)return rejectOperation(p,'frp-'+op,'主机身份、授权或影响范围未确认。不自动接受 host key，不自动提权。');
 if(op==='uninstall'&&!conditions.remove)return rejectOperation(p,'frp-'+op,'请确认仅卸载所选角色，保留其他角色、共享程序及网络资源。');
 if(['deploy','install'].includes(op)&&frpAuthImpact(items).length){
  if(!conditions.authChange)return rejectOperation(p,'frp-deploy','全局认证与所选角色的旧参照不同，请明确确认认证变化后再应用。');
  const nodes=new Set(items.map(x=>x.node));
  const missing=frpAffectedRoles().filter(x=>nodes.has(x.node.id)&&x.project?.life==='installed'&&frpAuthChange(x.node,x.role)&&!items.some(item=>item.node===x.node.id&&item.role===x.role));
  if(missing.length)return rejectOperation(p,'frp-deploy','同一连接的配对角色仍使用旧认证：'+missing.map(x=>x.node.ip+' '+frpRoles[x.role]).join('、')+'。请明确选择“应用该连接全部角色”，不能形成未确认的认证分叉。');
 }
 for(const item of items){const n=frpNode(item.node),r=item.role,x=pr(frpPid(n,r));
  if(!['deploy','install'].includes(op)&&x.life!=='installed')return rejectOperation(x,'frp-'+op,'所选角色没有完整部署，不能将生成文件当作已安装服务。');
  if(op==='uninstall'&&x.frpInstallation)return rejectOperation(x,'frp-uninstall','此服务端由服务器角色共用，请在对应角色项目详情核对关联连接后卸载角色。');
  if(['deploy','install'].includes(op)&&r==='visitor'&&!n.proxies.some(x=>x.type==='stcp'))return rejectOperation(x,'frp-deploy','已没有 STCP 映射，不再生成新 visitor；已有运行载体需单独确认卸载。');
  if(['deploy','install'].includes(op)&&!['x86_64','aarch64','arm64'].includes(sr(frpHost(n,r))?.arch))return rejectOperation(x,'frp-deploy','目标架构未确定 / 不支持，不能猜测二进制。');
  if(['deploy','install'].includes(op)&&x.frpApplied&&x.life!=='uninstalled'&&(x.frpApplied.files.unitPath!==x.frpDraft.files.unitPath||x.frpApplied.root!==x.frpDraft.root||x.frpApplied.host!==x.frpDraft.host))return rejectOperation(x,'frp-deploy','当前修改涉及既有 unit 身份、运行目录或执行主机改变，不能把普通应用当成隐式迁移 / 清理旧服务；本原型保留原部署事实。');
 }
 const fixed=frpCompileItems(items,op),resources=[...new Set(fixed.flatMap(x=>['project:'+x.project,'frp-node:'+x.node,'frp-bin:'+x.snapshot.host+':'+(x.role==='server'?'frps':'frpc')]))];
 const conflict=conflictFor(resources);if(conflict)return rejectOperation(p,'frp-'+op,'与 '+conflict.label+' 冲突；拒绝此次请求，不排队，不取消原操作。');
 const steps=[{title:'固定输入与模拟前置核对',status:'success'}];for(const x of fixed)for(const title of ['deploy','install'].includes(op)?[frpNode(x.node).roleProjects?.server&&x.role==='client'?'引用已部署 frpc，交付连接 TOML':'交付程序和 TOML','登记 systemd 运行定义',op==='install'?'仅登记安装，不启动':'启动并核对（不等于隧道连通）']:['start','stop','restart'].includes(op)?['执行'+(opLabels[op]||op)+'命令','核对原unit实际状态']:[(opLabels[op]||op)+'所选运行载体'])steps.push({title:frpNode(x.node).ip+' · '+frpRoles[x.role]+' · '+title,status:'pending'});
 if(steps[1])steps[1].status='running';
 const o=record('FRP '+(op==='install'?'安装（不启动）':op==='deploy'?'应用 / 部署':opLabels[op])+' · '+fixed.length+' 个角色','frp-'+op,p.id,'running','输入已固定；仅模拟执行，不连接服务器。',{frp:true,ended:null,input:{items:fixed,cleanup:conditions.cleanup?[...new Map(items.map(x=>frpCleanupPreview(frpNode(x.node))).filter(Boolean).map(x=>[x.project,x])).values()]:[],targetOutcomes:clone(conditions.targetOutcomes||{}),requestedState:['stop','install'].includes(op)?'stopped':'running',operation:op,runtimeEvidence:clone(conditions.runtimeEvidence||null),binaryCondition:'固定公共文件修订的浏览器模拟交付；不执行二进制'},resources,steps,outcome:conditions.outcome,hold:conditions.hold});
 for(const x of fixed){const q=pr(x.project);q.frpLastOp=o.id;if(['start','stop','restart'].includes(op))q.lastRuntimeOperation=o.id;if(['start','restart'].includes(op))q.stopVerified=false;}
 persist();render();closeModal();openModal('opdetail',{id:o.id});if(!conditions.hold)timers.set(o.id,setTimeout(()=>frpFinish(o,o.outcome),1600));return o;
}
