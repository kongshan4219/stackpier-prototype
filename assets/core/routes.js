'use strict';

// URL 只包含白名单对象 ID、标签和筛选；正文、Token、密钥绝不进入历史。
let routeReady=false,routeRestoring=false,routeLast='';
const routePages=new Set(['overview','servers','projects','project','templates','programs','dns','firewall','frp','monitor','settings','operations','review']);
const routeModals=new Set(['serverdetail','opdetail','verifyop','dnsedit','cfaccount','cfconnect','newproject','templateedit','firewalledit','frp-role-manage','frp-nodeedit']);
function routeURL(){
 const url=new URL('https://prototype.invalid/');url.hash=ui.page;
 const query=url.searchParams,put=(key,value)=>{if(value&&value!=='all')query.set(key,String(value));};
 if(ui.page==='project'){put('project',ui.project);put('tab',ui.tab);}
 if(['programs','servers','monitor','operations'].includes(ui.page))put('filter',ui.filter);
 if(ui.page==='monitor')put('section',ui.monitorTab);
 if(['projects','firewall','servers'].includes(ui.page))put('server',ui.server);
 if(ui.page==='projects'){put('view',ui.view);put('section',ui.projectsTab);put('filter',ui.filter);}
 if(ui.page==='templates')put('section',ui.templateTab);
 if(ui.page==='dns'){put('account',ui.cfAccount);put('zone',ui.zone);}
 if(ui.page==='frp'){put('tab',FRP.tab);if(FRP.tab!=='connections'&&FRP.tab!=='review')put('node',FRP.node);put('role',FRP.role);}
 if(assetDrawer){put('detail',assetDrawer.kind);put('asset',assetDrawer.id);put('revision',assetDrawer.revision);put('source',assetDrawer.projectId);}
 const modal=ui.modal?.kind==='interaction-discard'?ui.modal.previous:ui.modal;let kind=modal?.kind;if(kind==='dnsconfirm')kind='dnsedit';if(kind==='firewallconfirm')kind='firewalledit';if(['deploymentpreview','deploymentadapt'].includes(kind))kind='newproject';
 if(routeModals.has(kind)){put('dialog',kind);put('id',modal.editorId||modal.editor?.id||modal.id);if(kind==='frp-role-manage'){put('host',ui.modal.server);put('role',ui.modal.role);}}
 return '#'+ui.page+(query.toString()?'?'+query.toString():'');
}
function routeIdentity(hash){const [page,query='']=hash.split('?'),p=new URL('https://prototype.invalid/?'+query).searchParams;return [page,p.get('project'),p.get('tab'),p.get('detail'),p.get('asset'),p.get('dialog'),p.get('id'),p.get('host')].join('|');}
function updateRoute(){
 if(!routeReady||routeRestoring||!window.history)return;
 const next=routeURL();if(next===routeLast)return;
 const method=routeLast&&routeIdentity(next)!==routeIdentity(routeLast)?'pushState':'replaceState';
 window.history[method](null,'',next);routeLast=next;
}
function restoreRoute(){
 routeRestoring=true;saveInteractionDraft();frpCacheEditor();cacheTemplateDraft();
 if(assetDialog.open)assetDialog.close();assetDrawer=null;assetDrawerStack.length=0;
 if(dialog.open)dialog.close();ui.modal=null;
 const [requested,query='']=String(location.hash||'#overview').slice(1).split('?'),p=new URL('https://prototype.invalid/?'+query).searchParams;
 ui.routeNotice='';ui.page=routePages.has(requested)?requested:'overview';
 if(!routePages.has(requested))ui.routeNotice='页面入口无效，已返回总览。';
 ui.server=p.get('server')||'all';ui.cfAccount=p.get('account')||'all';ui.zone=p.get('zone')||'all';ui.q='';ui.filter=p.get('filter')||'all';
 if(ui.server!=='all'&&!sr(ui.server))ui.routeNotice='筛选服务器已移除；请重新选择目标，不会自动换机。';
 if(ui.page==='project'){ui.project=p.get('project')||ui.project;ui.tab=['overview','config','monitor','logs','history'].includes(p.get('tab'))?p.get('tab'):'overview';}
 if(ui.page==='projects'){ui.projectsTab=p.get('section')==='failures'?'failures':'list';ui.view=p.get('view')==='cards'?'cards':'table';ui.filter=p.get('filter')||'all';}
 if(ui.page==='templates')ui.templateTab=p.get('section')==='programs'?'programs':'templates';
 if(ui.page==='frp'){
  FRP.tab=['connections','node','files','deploy','review'].includes(p.get('tab'))?p.get('tab'):'connections';FRP.role=Object.hasOwn(frpRoles,p.get('role'))?p.get('role'):'client';
  if(p.get('node')){if(frpNode(p.get('node')))FRP.node=p.get('node');else{FRP.tab='connections';ui.routeNotice='FRP 连接关联失效；返回连接清单核对，不替换成其他连接。';}}
 }
 render();
 const asset=p.get('asset'),kind=p.get('detail');
 if(asset&&['file','template'].includes(kind)){if(kind==='file'?assetById(asset):tpl(asset))openAssetDrawer({kind,id:asset,revision:p.get('revision')?Number(p.get('revision')):null,projectId:p.get('source')||undefined});else{ui.routeNotice='公共资产已不存在；返回列表核对。';render();}}
 const modal=p.get('dialog'),id=p.get('id');
 if(routeModals.has(modal)){
  const valid=modal==='serverdetail'?!!sr(id):['opdetail','verifyop'].includes(modal)?S.operations.some(o=>o.id===id):modal==='dnsedit'?(!id||S.dns.some(r=>r.id===id)):modal==='firewalledit'?(!id||S.firewalls.some(r=>r.id===id)):modal==='cfconnect'?(!id||!!cfConnection(id)):modal==='templateedit'?(!id||!!tpl(id)):modal==='frp-role-manage'?!!sr(p.get('host'))&&['client','server'].includes(p.get('role')):modal==='frp-nodeedit'?(!id||!!frpNode(id)):true;
  if(valid)openModal(modal,{...(id?{id}:{}),...(modal==='frp-role-manage'?{server:p.get('host'),role:p.get('role')}:{})});else{ui.routeNotice='详情对象已失效；请从当前列表重新选择。';render();}
 }
 routeRestoring=false;routeLast=routeURL();if(window.history)window.history.replaceState(null,'',routeLast);
}
const routeRender=render,routeRenderModal=renderModal,routeRenderAsset=renderAssetDrawer,routeClose=closeModal,routeAssetClose=closeAssetDrawer;
render=function(...args){const result=routeRender(...args);updateRoute();return result;};
renderModal=function(...args){const result=routeRenderModal(...args);updateRoute();return result;};
renderAssetDrawer=function(...args){const result=routeRenderAsset(...args);updateRoute();return result;};
closeModal=function(...args){const result=routeClose(...args);updateRoute();return result;};
closeAssetDrawer=function(...args){const result=routeAssetClose(...args);updateRoute();return result;};
const routePageContent=pageContent;
pageContent=function(){return (ui.routeNotice?notice('导航提示',ui.routeNotice,'warning')+btn('安全返回总览','navigate',{page:'overview'}):'')+routePageContent();};
window.addEventListener('popstate',restoreRoute);
function initializeRoutes(){routeReady=true;restoreRoute();}
