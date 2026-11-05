'use strict';

// React 管理工作台与浮层；领域状态、表单和恢复流程仍由已有注册表处理。
function dispatchPrototypeEvent(type,target){const event=new Event(type,{cancelable:true});Object.defineProperty(event,'target',{value:target});document.dispatchEvent(event);}
window.StackPierUI={
 action(action,data={}){const target=document.createElement('button');for(const [k,v]of Object.entries(data))target.dataset[k]=v;target.dataset.action=action;dispatchPrototypeEvent('click',target);},
 submit(form){dispatchPrototypeEvent('submit',form);},
 closeModal(){closeModal();},closeAsset(){closeAssetDrawer();},
 filter(key,value){ui[key]=value;render();},clearFilters(){ui.q='';ui.server='all';ui.filter='all';render();},
 refresh(){saveInteractionDraft();frpCacheEditor();cacheTemplateDraft();render();if(ui.modal)renderModal();if(assetDrawer)renderAssetDrawer();},
 inventory(){return {pages:navItems.map(n=>({id:n[0],label:n[1]})),modals:Object.keys(prototypeModals),forms:Object.keys(prototypeForms),actions:Object.keys(prototypeActions)};}
};

function radixView(){
 const title=ui.page==='project'?pname(ui.project):ui.page==='projects'&&ui.projectsTab==='failures'?'失败记录':navItems.find(n=>n[0]===ui.page)?.[1]||'工作台';
 const rows=projectListRows();
 const issue=projectListIssue;
 const p=pr(ui.project);
 return {
  ui:{...ui},title,nav:navItems,servers:S.servers,failedCount:S.failedProjects?.length||0,
  activeOperations:S.operations.filter(o=>o.status==='running'||o.status==='unknown').length,
  operationCount:projectPendingOperations().length+(S.serviceMigration?.evidence.filter(e=>e.needsReview).length||0),
  operationHTML:projectOperationBanner(),html:ui.auth?'':pageContent(),authHTML:ui.auth?authPage():'',
  projects:rows.map(p=>({...p,serverName:sname(p.server),host:sr(p.server)?.host||'原主机信息已保留',typeLabel:(p.type==='compose'?'Docker Compose':'systemd')+(p.frpService?' · '+frpRoles[p.frpService.role]:''),runtimeHTML:runtimeBadge(p),observedLabel:fmt(p.observed),issueHTML:issue(p)+(activeOps(p).length?status(activeOps(p)[0].status):'')})),
  project:ui.page==='project'&&p?{...p,unit:projectUsesUnitBody(p),subtitle:`${sname(p.server)} · ${p.type==='compose'?'Docker Compose':'systemd'} · ${sr(p.server)?.arch||'架构待核对'}`,summary:stateGrid(p),content:projectTab(p),notices:
   (p.programUpdate?notice('有新的文件可以部署','当前服务仍使用已交付文件；通过“更多 → 项目草稿与更新”查看差异，再单独确认应用。','warning'):'')+
   (p.cleanup?notice('清理待处理','项目尚未完成全部专属清理，保留服务与残留证据。','warning'):'')+
   (p.components.length?notice('本次变更只完成了一部分',p.components.map(c=>c.name+'：'+c.result).join('；')+'。没有自动回退。','warning'):'')}:null
 };
}

if(window.RadixPrototype){
 // 容器是普通 div；不叠加原生 dialog，Radix 独立负责模态、焦点隔离和 Escape。
 for(const host of [dialog,assetDialog]){
  host.open=false;host.showModal=()=>{host.open=true;};
  host.close=()=>{host.open=false;RadixPrototype.clear(host);};
 }
 render=function(){
  syncServerStatusTimer();
  const active=document.activeElement,id=active?.id,start=active?.selectionStart,end=active?.selectionEnd;
  const view=radixView();document.title=view.title+' · 栈桥交互原型';
  RadixPrototype.render(view);restoreFormInputs();updateRoute();
  if(id){const el=document.getElementById(id);el?.focus({preventScroll:true});try{el?.setSelectionRange(start,end);}catch{}}
 };
 layout=function(title,subtitle,body,foot='',wide=false,form=''){
  RadixPrototype.modal(dialog,{title,subtitle,body:body+'<p class="field-error" id="modal-error" role="alert" hidden></p>',foot:foot||btn('关闭','closemodal'),wide,form,restoreFocus:lastFocus});
 };
 renderAssetDrawer=function(){
  if(!assetDrawer)return;
  RadixPrototype.modal(assetDialog,{...assetDrawerView(),asset:true,restoreFocus:assetDrawerFocus});
  updateRoute();
 };

 toast=(text,tone)=>RadixPrototype.feedback(text,tone);
}
