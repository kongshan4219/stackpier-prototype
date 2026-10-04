'use strict';

function toast(text,tone=''){const r=document.getElementById('toasts'),d=document.createElement('div');d.className='toast '+tone;d.setAttribute('role',tone==='error'?'alert':'status');d.innerHTML=I(tone==='error'?'alert':'check')+`<span>${h(text)}</span>`;r.appendChild(d);setTimeout(()=>d.remove(),5200);}

function navigate(page,id){ui.page=page==='project'||navItems.some(item=>item[0]===page)?page:'overview';if(id)ui.project=id;ui.q='';ui.filter='all';ui.server='all';ui.zone='all';ui.tab='overview';ui.nav=false;persist();render();window.scrollTo({top:0});document.querySelector('.page-heading h1')?.focus({preventScroll:true});}

// 收起的移动导航退出键盘焦点顺序，打开时将焦点限制在抽屉中。
function syncNavigationAccessibility(){
 if(typeof window.matchMedia!=='function')return;
 const narrow=window.matchMedia('(max-width:820px)').matches;
 const sidebar=document.getElementById('workspace-navigation');
 const trigger=document.querySelector('[data-action="navtoggle"]');
 const content=document.querySelector('.workspace-content');
 if(sidebar)sidebar.inert=narrow&&!ui.nav;
 if(content)content.inert=narrow&&ui.nav;
 if(trigger){trigger.setAttribute('aria-expanded',String(narrow&&ui.nav));trigger.setAttribute('aria-controls','workspace-navigation');}
}

function toggleNavigation(open){
 ui.nav=open;render();
 const target=open?document.querySelector('.sidebar-link.current'):document.querySelector('[data-action="navtoggle"]');
 target?.focus({preventScroll:true});
}

const formDrafts=new Map();

function cacheFormInput(el){const f=el.closest('form[data-form]');if(!f||!['projectmonitor','settings'].includes(f.dataset.form))return;const values={};new FormData(f).forEach((v,k)=>(values[k]||=([])).push(String(v)));formDrafts.set(f.dataset.form+'|'+(f.dataset.id||''),values);}

function restoreFormInputs(){document.querySelectorAll('form[data-form]').forEach(f=>{const values=formDrafts.get(f.dataset.form+'|'+(f.dataset.id||''));if(!values)return;f.querySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=(values[el.name]||[]).includes(el.value);else if(values[el.name])el.value=values[el.name][0];});});document.querySelectorAll('#mon-method').forEach(syncMonitorMethodField);}

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["navigate","project","navtoggle","navclose","tab","closemodal","projectmore","opdetail","verifyop","templateedit","programupload","dnsedit","dnsdelete","firewalledit","firewalldelete"], function(event, target, d, a) {
  switch (a) {
case'navigate':closeModal();navigate(d.page);break;
case'project':closeModal();navigate('project',d.id);break;
case'navtoggle':toggleNavigation(!ui.nav);break;
case'navclose':toggleNavigation(false);break;
case'tab':ui.tab=['overview','config','monitor','logs','history'].includes(d.id)?d.id:'overview';ui.q='';render();break;
case'closemodal':closeModal();break;
case'projectmore':case'opdetail':case'verifyop':openModal(a,{id:d.id});break;
case'templateedit':case'programupload':case'dnsedit':case'dnsdelete':case'firewalledit':case'firewalldelete':openModal(a,{id:d.id});break;
  }
});
