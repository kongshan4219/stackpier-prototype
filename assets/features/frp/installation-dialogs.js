'use strict';
// 独立角色部署的预览、确认及单服务器选择。
function frpInstallationModal(m){
 const plan=m.plan,remove=m.kind==='frp-install-remove',role=plan.role;
 layout((remove?'卸载 ':'部署 ')+frpRoles[role],'确认服务器角色操作；这里只执行浏览器模拟。',`<div class="stack">${detail([['服务器',h(sname(plan.server))],['角色',h(frpRoles[role])],['程序路径',`<code>${h(plan.files.binaryPath)}</code>`],...(role==='server'?[['监听地址与控制端口',`<code>${h(frpConnectionAddress(plan.node.bind_addr,plan.node.bind_port))}</code>`],['运行定义',`<code>${h(plan.files.unitPath)}</code>`]]:[]),['部署后的处理',remove?'保留共享程序及其他角色':role==='client'?'frpc 程序就绪；创建连接并应用配置后启动连接服务':'交付 frps 监听配置与 unit，核对服务端运行']])}${!remove?notice('程序仍为零字节占位','需明确勾选虚构程序条件才能演示后续流程；不会执行实际程序。','warning')+check('fi-binary','仅在演示中假设程序已提供且匹配架构',false):check('fi-remove','确认只卸载所选服务器角色，保留共享程序',false)}${check('fi-identity','在演示中确认目标服务器身份和权限',false)}${check('fi-impact','已核对共享程序与关联连接影响',false)}${outcomeField('success')}${check('fi-hold','保持执行中，便于核对冲突与固定输入',false)}</div>`,btn('取消','closemodal')+'<button class="btn '+(remove?'danger':'primary')+'" type="submit">确认此次模拟'+(remove?'卸载':'部署')+'</button>',false,remove?'frp-install-remove':'frp-install');
}
function frpSyncBatchSelection(){
 const role=document.querySelector('#fb-role')?.value,server=document.querySelector('#fb-server');if(!server)return;
 const hosts=role==='visitor'?[...new Set(S.frp.nodes.filter(n=>n.proxies.some(x=>x.type==='stcp')).map(n=>frpHost(n,role)))]:S.servers.filter(s=>validIPv4(s.host)||validIPv6(s.host)).map(s=>s.id);
 const previous=server.value;server.innerHTML='<option value="">请选择服务器</option>'+hosts.map(id=>`<option value="${h(id)}">${h(sname(id))} · ${h(sr(id)?.host)}</option>`).join('');server.value=hosts.includes(previous)?previous:'';server.disabled=!hosts.length;
 frpSyncDeploymentFields();
}
function frpSyncDeploymentFields(){
 const error=document.getElementById('modal-error');if(error)error.textContent='';
 const role=document.querySelector('#fb-role')?.value,fields=document.getElementById('fb-connection-field');if(!fields)return;
 if(role==='visitor'){frpSyncDeployConnection();return;}
 fields.innerHTML=role==='server'?'':notice('先部署 frpc，再创建连接','本次仅准备客户端程序；连接创建后再应用配置，启动对应连接服务。');
}
function frpInstallationPreview(plan){
 layout('FRP 服务器角色部署预览','先部署服务器角色，再创建连接；预览不触发执行。',`<div class="stack">${detail([['服务器',h(sname(plan.server))],['部署角色',h(frpRoles[plan.role])],['程序路径',`<code>${h(plan.files.binaryPath)}</code>`]])}${plan.role==='server'?`<pre class="code frp-code">${h(plan.files.toml)}</pre><pre class="code frp-code">${h(plan.files.unit)}</pre>`:notice('frpc 程序就绪后等待连接配置','没有连接时不生成目标服务配置，也不启动连接服务。')}</div>`,btn('返回选择','frp-batch',{server:plan.server,role:plan.role})+btn('进入部署确认','frp-install-previewconfirm',{},'primary'),true);
}
