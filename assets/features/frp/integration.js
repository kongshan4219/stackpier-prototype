'use strict';
// FRP 与工作台共用导航、项目、操作记录及模态框。
// 与原有工作台共用导航、项目、操作记录、模态框及演示数据；不另建独立应用。
const frpOldPage=pageContent;pageContent=function(){return ui.page==='frp'?frpPage():frpOldPage();};
const frpOldPending=pending;pending=function(p){return p?.frpRef?frpPending(frpNode(p.frpRef.node),p.frpRef.role):frpOldPending(p);};
const frpOldActive=activeOps;activeOps=function(p){return p?.frpRef?S.operations.filter(o=>(o.status==='running'||o.status==='unknown'&&!o.protectionReleased)&&(o.project===p.id||o.frp&&o.input.items.some(x=>x.project===p.id))):frpOldActive(p);};
const frpOldConfigText=configText;configText=function(p,c=p.cfg){if(p.frpRef){if(!c)return'尚无完整应用参照';const n=frpNode(p.frpRef.node),f=c===p.applied?p.frpApplied?.files:frpRenderSafe(n,p.frpRef.role);return f?f.toml+'\n# systemd unit\n'+f.unit:'尚无完整应用参照';}return frpOldConfigText(p,c);};
const frpOldProject=projectPage;projectPage=function(){const p=pr(ui.project);if(p?.frpInstallation)return heading(p.name,'服务器角色部署 · '+frpRoles[p.frpInstallation.role],btn('FRP 部署','frp-home')+btn('部署 FRP','frp-batch',{role:p.frpInstallation.role,server:p.frpApplied?.host||p.server},'primary')+(p.life==='installed'?btn('卸载角色','frp-install-remove',{id:p.id},'danger'):''))+stateGrid(p)+notice(p.frpInstallation.role==='client'?'frpc 程序与连接配置分别维护':'frps 监听配置由服务器角色维护',p.frpInstallation.role==='client'?'程序部署完成后创建连接，再明确应用对应连接配置。':'多个连接共用此服务端，不重复创建 frps 运行载体。')+operationTable(S.operations.filter(o=>o.project===p.id));if(p?.frpRef){const n=frpNode(p.frpRef.node),r=p.frpRef.role;return heading(p.name,'独立 systemd 项目 · '+frpRoles[r]+' · 参考数据，不是自动接管',btn('编辑 FRP 配置','frp-node',{id:n.id})+btn('生成文件与参照','frp-openfiles',{node:n.id,role:r},'primary'))+stateGrid(p)+notice('服务运行与代理连通分别核对','这里的角色来自脱敏清单；完整操作记录与其他项目共用。即使 systemd 已模拟运行，也不标记 STCP 端到端可用。')+`<div class="mt">${frpDeployPage(n)}</div>`;}let html=frpOldProject();if(p?.software==='frpc'||p?.software==='frps')html=`<div class="mb">${notice('这是旧的通用 FRP 占位样例','参考方案已补充专用的三角色表单，不再用通用 Go 的 listen / --config 作为 FRP 配置。')}${btn('使用已分析的 FRP 部署方案','frp-home',{},'primary mt')}</div>`+html;return html;};
const frpOldModal=renderModal;renderModal=function(){const m=ui.modal;if(m?.kind.startsWith('frp-'))return frpModal(m);if(m?.kind==='newproject'&&m.step>1&&['frpc','frps'].includes(tpl(m.draft?.template)?.software)){frpGo('connections');toast('FRP 使用已还原的角色表单，不套用通用程序的单端口模板。');return;}if(m?.kind==='templateedit'&&['frpc','frps'].includes(tpl(m.id)?.software)){closeModal();FRP.tab='review';navigate('frp');return;}if(m?.kind==='projectop'&&pr(m.id)?.frpRef){const p=pr(m.id);return openModal('frp-op',{node:p.frpRef.node,role:p.frpRef.role,op:m.op==='apply'||m.op==='update'?'deploy':m.op});}return frpOldModal();};
const frpOldStart=startOperation;startOperation=function(p,kind,...args){if(p?.frpInstallation)return rejectOperation(p,kind,'请通过 FRP 部署入口或对应角色项目详情操作，连接配置另行管理。');if(p?.frpRef)return rejectOperation(p,kind,'请通过 FRP 专用确认执行，避免通用命令、单端口或共享目录假设覆盖真实角色关系。');if(p?.software==='frpc'||p?.software==='frps')return rejectOperation(p,kind,'旧通用 FRP 占位项目未配置正确角色，请进入 FRP 部署方案选择服务端、提供端或 visitor。');return frpOldStart(p,kind,...args);};
const frpOldFinish=finishOperation;finishOperation=function(o,result='success'){return o?.frpInstallation?frpFinishInstallation(o,result):o?.frp?frpFinish(o,result):frpOldFinish(o,result);};
const frpOldReset=resetSample;resetSample=function(...a){const x=frpOldReset(...a);frpEnsure();FRP.tab='connections';FRP.node='n4';persist();return x;};
const frpOldPrograms=programsPage;programsPage=function(){frpEnsure();return `<div class="mb">${notice('FRP 参考包提供的是四个空文件','frpc、frpc-arm64、frps、frps-arm64 都为 0 B。按文件名展示架构约定，不把存在文件或上传元数据当成可执行 / 校验通过。')}</div>`+frpOldPrograms();};
function frpGo(tab='connections',node=FRP.node,role=FRP.role){frpEnsure();FRP.tab=tab;FRP.node=node;FRP.role=role;closeModal();navigate('frp');persist();}
if(!navItems.some(x=>x[0]==='frp'))navItems.splice(3,0,['frp','FRP 部署','link','']);

// 所有脚本加载完成后，由入口统一恢复 FRP 状态并首次渲染。
function initializeFrp(){
 frpInit();
 // 初始化当前虚构样例；已有用户草稿、部署参照与未知操作不被样例替换。
 if(S.frp.samplePending||location.hash==='#frp')frpEnsure();
 if(location.hash==='#frp')ui.page='frp';
 persist();render();
}
