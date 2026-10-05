'use strict';
// 角色选择、影响范围及运行证据表单。
// 单次只选择一个角色、一台服务器和一条连接配置。
function frpSyncDeployConnection(){
 const error=document.getElementById('modal-error');if(error)error.textContent='';
 const role=document.querySelector('#fb-role')?.value,host=document.querySelector('#fb-server')?.value;
 const nodes=S.frp.nodes.filter(n=>frpHost(n,role)===host&&(role!=='visitor'||n.proxies.some(x=>x.type==='stcp')));
 document.getElementById('fb-connection-field').innerHTML=select('fb-node','连接配置',[['','请选择连接'],...nodes.map(n=>[n.id,sname(n.provider)+' → '+n.ip+':'+n.bind_port])],nodes.length===1?nodes[0].id:'');
}
function frpBatchItems(){
 const role=document.querySelector('#fb-role')?.value,host=document.querySelector('#fb-server')?.value,n=frpNode(document.querySelector('#fb-node')?.value);
 if(!Object.hasOwn(frpRoles,role)||!host||!n||frpHost(n,role)!==host||(role==='visitor'&&!n.proxies.some(x=>x.type==='stcp')))throw Error('请选择部署角色、服务器和适用的连接配置。');
 return [{node:n.id,role}];
}
function frpImpactTable(role){return `<div class="table-wrap"><table><thead><tr><th>受影响连接</th><th>角色 / 安装主机</th><th>保存后的处理</th></tr></thead><tbody>${frpAffectedRoles(role).map(({node,role,project})=>`<tr><td>${h(node.ip)}</td><td>${h(frpRoles[role])}<p class="cell-sub">${h(sname(frpHost(node,role)))}</p></td><td>${project?.frpApplied?'保留草稿和已应用参照；明确采用后再应用':'提示可用更新，需采用到指定草稿'}</td></tr>`).join('')}</tbody></table></div>`;}
function frpRuntimeEvidenceFields(op,prefix='fr'){
 const target=op==='stop'?'stopped':'running';
 return notice('命令结果与实际核对分开','不论命令返回成功、报错或断连，都核对原unit的实际状态；没有身份、原执行结束或新观测证据时保留未知。')+select(prefix+'-command','模拟命令返回',[['success','命令返回成功'],['error','命令明确报错'],['unknown','命令响应丢失']],'success')+select(prefix+'-observed','命令后的实际状态',[['running','已核对运行'],['stopped','已核对停止'],['partial','已知部分成员运行'],['unknown','无法取得新观测']],target)+check(prefix+'-ended','已核对原执行结束、没有在途命令',true)+check(prefix+'-identity','核对观测来自原主机及原unit',true)+(op==='restart'?check(prefix+'-restart','有本次停止再启动或新进程证据',false,'只看到running不能证明此次重启完成。'):'');
}
function frpReadRuntimeEvidence(fd,op,prefix='fr'){return {commandResult:String(fd.get(prefix+'-command')||'unknown'),executionEnded:fd.has(prefix+'-ended'),identityVerified:fd.has(prefix+'-identity'),observedState:String(fd.get(prefix+'-observed')||'unknown'),restartVerified:op==='restart'&&fd.has(prefix+'-restart')};}
function frpReconcileModal(o){layout('核对 FRP 原操作实际状态','仅追加逐角色证据，不重新执行启停命令。',`<div class="stack">${o.input.items.map((x,i)=>`<section>${notice(frpNode(x.node).ip+' · '+frpRoles[x.role],x.snapshot.unit)}${frpRuntimeEvidenceFields(o.input.operation,'fr-'+i)}</section>`).join('')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存本次核对</button>',true,'frp-reconcile');}

function frpSyncConnectionServerFields(){
 const deployment=frpServerDeployment(document.querySelector('#fn-server')?.value,'server'),node=deployment?.frpApplied?.node;
 const bind=document.querySelector('#fn-bind'),port=document.querySelector('#fn-port');if(bind&&port&&node){bind.value=node.bind_addr;port.value=node.bind_port;}
}
