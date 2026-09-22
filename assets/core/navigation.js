'use strict';

function toast(text,tone=''){const r=document.getElementById('toasts'),d=document.createElement('div');d.className='toast '+tone;d.setAttribute('role',tone==='error'?'alert':'status');d.innerHTML=I(tone==='error'?'alert':'check')+`<span>${h(text)}</span>`;r.appendChild(d);setTimeout(()=>d.remove(),5200);}

function navigate(page,id){ui.page=page==='project'||navItems.some(item=>item[0]===page)?page:'overview';if(id)ui.project=id;ui.q='';ui.filter='all';ui.server='all';ui.zone='all';ui.tab='overview';ui.nav=false;persist();render();window.scrollTo({top:0});}

const formDrafts=new Map();

function cacheFormInput(el){const f=el.closest('form[data-form]');if(!f||!['projectconfig','fileprojectconfig','projectmonitor','dependencies','settings'].includes(f.dataset.form))return;const values={};new FormData(f).forEach((v,k)=>(values[k]||=([])).push(String(v)));formDrafts.set(f.dataset.form+'|'+(f.dataset.id||''),values);}

function restoreFormInputs(){document.querySelectorAll('form[data-form]').forEach(f=>{const values=formDrafts.get(f.dataset.form+'|'+(f.dataset.id||''));if(!values)return;f.querySelectorAll('input[name],select[name],textarea[name]').forEach(el=>{if(el.type==='checkbox'||el.type==='radio')el.checked=(values[el.name]||[]).includes(el.value);else if(values[el.name])el.value=values[el.name][0];});});}

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["navigate","project","navtoggle","navclose","tab","closemodal","projectmore","configdiff","opdetail","verifyop","replica","templateedit","programupload","dnsedit","dnsdelete","firewalledit","firewalldelete"], function(event, target, d, a) {
  switch (a) {
case'navigate':closeModal();navigate(d.page);break;
case'project':closeModal();navigate('project',d.id);break;
case'navtoggle':ui.nav=!ui.nav;render();break;
case'navclose':ui.nav=false;render();break;
case'tab':ui.tab=['overview','config','monitor','deps','logs','history'].includes(d.id)?d.id:'overview';ui.q='';render();break;
case'closemodal':closeModal();break;
case'projectmore':case'configdiff':case'opdetail':case'verifyop':case'replica':openModal(a,{id:d.id});break;
case'templateedit':case'programupload':case'dnsedit':case'dnsdelete':case'firewalledit':case'firewalldelete':openModal(a,{id:d.id});break;
  }
});
