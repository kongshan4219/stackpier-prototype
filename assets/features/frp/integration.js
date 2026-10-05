'use strict';
const frpOldPage=pageContent;pageContent=function(){return ui.page==='frp'?frpPage():frpOldPage();};
const frpOldPending=pending;pending=function(p){return !!p?.frpAvailableUpdate||frpOldPending(p);};
const frpOldActive=activeOps;activeOps=function(p){return S.operations.filter(o=>(o.status==='running'||o.status==='unknown'&&!o.protectionReleased)&&(o.project===p.id||o.input?.serviceIds?.includes(p.id)));};
const frpOldConfigText=configText;configText=function(p,c=p.cfg){if(p?.frpService&&c?.frpSnapshot)return c.frpSnapshot.files.toml+'\n# systemd unit\n'+c.frpSnapshot.files.unit;return frpOldConfigText(p,c);};
const frpOldModal=renderModal;renderModal=function(){const m=ui.modal;if(m?.kind.startsWith('frp-'))return prototypeModals[m.kind]?prototypeModals[m.kind](m,pr(m.id)):frpModal(m);if(m?.kind==='templateedit'&&tpl(m.id)?.frpRole){const t=tpl(m.id);return openModal('frp-template',{id:frpPrefixes[t.frpRole]+'.toml.tpl',sourceProject:m.sourceProject,returnSource:m.returnSource});}return frpOldModal();};
const frpOldFinish=finishOperation;finishOperation=function(o,result='success'){return o?.kind==='frp-config'?finishFrpConfiguration(o,result):o?.frpInstallation||o?.frp?retainLegacyFrpResult(o):frpOldFinish(o,result);};
const frpOldReset=resetSample;resetSample=function(...a){const x=frpOldReset(...a);frpEnsure();migrateServiceProjects();FRP.tab='connections';FRP.node=S.frp.nodes[0]?.id;persist();return x;};
const frpOldPrograms=programsPage;programsPage=function(){frpEnsure();return notice('FRP 参考包提供四个空文件','frpc、frpc-arm64、frps、frps-arm64 为 0 B，不可部署。上传与替换统一在公共文件页管理。')+frpOldPrograms();};
function frpGo(tab='connections',node=FRP.node,role=FRP.role){frpEnsure();FRP.tab=['deploy','review'].includes(tab)?'connections':tab;FRP.node=node;FRP.role=role;closeModal();navigate('frp');persist();}
if(!navItems.some(x=>x[0]==='frp'))navItems.splice(navItems.findIndex(x=>x[0]==='templates')+1,0,['frp','FRP','link','']);
function initializeFrp(){frpEnsure();migrateServiceProjects();persist();render();}
