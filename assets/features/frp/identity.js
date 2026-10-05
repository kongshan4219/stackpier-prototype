'use strict';

function frpInstallationProjectPage(p){
 const snapshot=p.frpDraft||p.frpApplied,links=S.frp.nodes.filter(n=>n.clientInstallation===p.id);
 return heading(p.name,'FRPC 程序安装角色 · 只准备程序，不代表连接服务运行',btn('定位 FRP 角色','frp-locate',{project:p.id},'primary')+btn('查看部署配置','asset-template',{id:p.template,project:p.id}))+detail([['目标服务器',h(sname(p.server))],['程序准备状态',p.life==='installed'?'已准备（历史模拟参照）':'尚未准备'],['连接服务运行 / 连接草稿','不适用 · 独立安装角色'],['关联连接服务',String(links.length)]])+`<div class="toolbar">${btn('查看差异 / 采用程序更新','frp-update',{id:p.id})}${btn('单独确认模拟应用','frp-project-apply',{id:p.id},'primary')}</div>${snapshot?frpProgramPreview(snapshot):notice('程序参照缺失','未生成连接草稿。','warning')}${links.map(n=>card(sname(n.provider)+' → '+n.ip,frpConnectionStatus(n,'client'),btn('查看连接服务','frp-node',{id:n.id}))).join('')}${p.frpLegacyConnectionDraft?`<details><summary>历史误生成的连接草稿 · 已保留供核对</summary><p class="muted">不用于此程序安装角色的应用。</p><pre class="code asset-text">${h(frpMask(p.frpLegacyConnectionDraft.files.toml))}</pre><pre class="code asset-text">${h(p.frpLegacyConnectionDraft.files.unit)}</pre></details>`:''}`;
}
registerPrototypeHandlers(prototypeModals,['frp-role-manage','frp-invalid-link'],m=>{
 if(m.kind==='frp-invalid-link'){layout('FRP 关联失效','原连接 ID 已不存在；项目及应用历史未删除。',notice('无法定位连接','请回到 FRP 连接清单核对来源。','warning'),btn('返回项目','closemodal')+btn('FRP 连接清单','frp-home'));return;}
 const server=sr(m.server),p=pr(m.project||frpInstallationId(m.server,m.role));
 layout('服务器角色管理 · '+sname(m.server),'按服务器 ID 和角色定位，与连接实例分别管理。',`<div class="stack">${detail([['服务器',h(sname(m.server))],['角色',h(frpRoles[m.role])],['安装阶段',h(p?lifeName[p.life]:'尚未安装')],['服务状态',m.role==='client'?'不适用 · 程序准备与连接运行分别管理':p?runtimeBadge(p):'未创建服务']])}${serverOperationError(m.server)?notice('目标不可操作',serverOperationError(m.server),'warning'):''}${S.frp.nodes.filter(n=>frpHost(n,m.role)===m.server).map(n=>card('关联连接 · '+n.ip,frpConnectionStatus(n,m.role),btn('查看对应连接','frp-openfiles',{node:n.id,role:m.role}))).join('')||notice('尚无关联连接','准备程序后，在连接清单中新增连接。')}</div>`,btn('返回来源','closemodal')+(server?btn('部署 / 检查程序落点','frp-install',{server:m.server,role:m.role},'primary'):''));
});
