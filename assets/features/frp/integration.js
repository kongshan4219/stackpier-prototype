'use strict';
// FRP 与工作台共用导航、项目、操作记录及模态框。
// 与原有工作台共用导航、项目、操作记录、模态框及演示数据；不另建独立应用。
const frpOldPage=pageContent;pageContent=function(){return ui.page==='frp'?frpPage():frpOldPage();};
const frpOldPending=pending;pending=function(p){return p?.frpRef?frpPending(frpNode(p.frpRef.node),p.frpRef.role):frpOldPending(p);};
const frpOldActive=activeOps;activeOps=function(p){return p?.frpRef?S.operations.filter(o=>(o.status==='running'||o.status==='unknown'&&!o.protectionReleased)&&(o.project===p.id||o.frp&&o.input.items.some(x=>x.project===p.id))):frpOldActive(p);};
const frpOldConfigText=configText;configText=function(p,c=p.cfg){if(p.frpRef){if(!c)return'尚无完整应用参照';const n=frpNode(p.frpRef.node),f=c===p.applied?p.frpApplied?.files:frpRenderSafe(n,p.frpRef.role);return f?f.toml+'\n# systemd unit\n'+f.unit:'尚无完整应用参照';}return frpOldConfigText(p,c);};
const frpOldProject=projectPage;projectPage=function(){const p=pr(ui.project);if(p?.frpRef){const n=frpNode(p.frpRef.node),r=p.frpRef.role;return heading(p.name,'独立 systemd 项目 · '+frpRoles[r]+' · 参考数据，不是自动接管',btn('编辑 FRP 配置','frp-node',{id:n.id})+btn('生成文件与参照','frp-openfiles',{node:n.id,role:r},'primary'))+stateGrid(p)+notice('服务运行、代理连通与数据库复制分开','这里的角色来自脱敏清单；完整操作记录与其他项目共用。即使 systemd 已模拟运行，也不标记 STCP 端到端或 MySQL 复制健康。')+`<div class="mt">${frpDeployPage(n)}</div>`;}let html=frpOldProject();if(p?.software==='frpc'||p?.software==='frps')html=`<div class="mb">${notice('这是旧的通用 FRP 占位样例','参考方案已补充专用的三角色表单，不再用通用 Go 的 listen / --config 作为 FRP 配置。')}${btn('使用已分析的 FRP 部署方案','frp-home',{},'primary mt')}</div>`+html;return html;};
const frpOldModal=renderModal;renderModal=function(){const m=ui.modal;if(m?.kind.startsWith('frp-'))return frpModal(m);if(m?.kind==='newproject'&&m.step>1&&['frpc','frps'].includes(tpl(m.draft?.template)?.software)){frpGo('connections');toast('FRP 使用已还原的角色表单，不套用通用程序的单端口模板。');return;}if(m?.kind==='templateedit'&&['frpc','frps'].includes(tpl(m.id)?.software)){closeModal();FRP.tab='review';navigate('frp');return;}if(m?.kind==='projectop'&&pr(m.id)?.frpRef){const p=pr(m.id);return openModal('frp-op',{node:p.frpRef.node,role:p.frpRef.role,op:m.op==='apply'||m.op==='update'?'deploy':m.op});}return frpOldModal();};
const frpOldStart=startOperation;startOperation=function(p,kind,...args){if(p?.frpRef)return rejectOperation(p,kind,'请通过 FRP 专用确认执行，避免通用命令、单端口或共享目录假设覆盖真实角色关系。');if(p?.software==='frpc'||p?.software==='frps')return rejectOperation(p,kind,'旧通用 FRP 占位项目未配置正确角色，请进入 FRP 部署方案选择服务端、提供端或 visitor。');return frpOldStart(p,kind,...args);};
const frpOldFinish=finishOperation;finishOperation=function(o,result='success'){return o?.frp?frpFinish(o,result):frpOldFinish(o,result);};
const frpOldReset=resetSample;resetSample=function(...a){const x=frpOldReset(...a);frpInit();FRP.tab='connections';FRP.node='n4';return x;};
const frpOldPrograms=programsPage;programsPage=function(){frpEnsure();return `<div class="mb">${notice('FRP 参考包提供的是四个空文件','frpc、frpc-arm64、frps、frps-arm64 都为 0 B。按文件名展示架构约定，不把存在文件或上传元数据当成可执行 / 校验通过。')}${btn('查看 FRP 文件与部署','frp-openfiles',{node:'n4',role:'visitor'},'mt')}</div>`+frpOldPrograms();};
function frpGo(tab='connections',node=FRP.node,role=FRP.role){frpEnsure();FRP.tab=tab;FRP.node=node;FRP.role=role;closeModal();navigate('frp');persist();}
if(!navItems.some(x=>x[0]==='frp'))navItems.splice(3,0,['frp','FRP 部署','link','']);

// 所有脚本加载完成后，由入口统一恢复 FRP 状态并首次渲染。
function initializeFrp(){
 frpInit();
 // 首次升级只添加参考入口，不清空旧演示、反馈或未知操作。FRP 角色在打开该模块时创建。
 if(location.hash==='#frp'){frpEnsure();ui.page='frp';}
 persist();render();
}
