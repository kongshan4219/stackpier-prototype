'use strict';

const dialog=document.getElementById('modal');

let lastFocus=null;

function openModal(kind,data={}){if(!prototypeModals[kind]&&!kind.startsWith('frp-')){closeModal();toast('此入口当前不提供，请从现有页面重新选择。');return;}if(!dialog.open)lastFocus=document.activeElement;ui.modal={kind,...data};renderModal();if(!ui.modal)return;if(!dialog.open)dialog.showModal();setTimeout(()=>{(dialog.querySelector('[autofocus]')||dialog.querySelector('input:not([type=checkbox]):not([disabled]),select,textarea,button'))?.focus()},0)}

function closeModal(){if(dialog.open)dialog.close();ui.modal=null;try{lastFocus?.focus({preventScroll:true})}catch{}}

function layout(title,subtitle,body,foot='',wide=false,form=''){dialog.classList.toggle('wide',wide);dialog.innerHTML=`${form?`<form data-form="${h(form)}" class="dialog-layout">`:'<div class="dialog-layout">'}<div class="dialog-header"><div><h2 id="dialog-title">${h(title)}</h2><p>${h(subtitle)}</p></div><button type="button" class="modal-close" data-action="closemodal" aria-label="关闭">${I('close')}</button></div><div class="dialog-body">${body}<p class="field-error" id="modal-error" role="alert" hidden></p></div><div class="dialog-footer">${foot||btn('关闭','closemodal')}</div>${form?'</form>':'</div>'}`;}

function modalError(text){const el=document.getElementById('modal-error');if(el){el.hidden=false;el.textContent=text;el.scrollIntoView({block:'nearest'});}else toast(text,'error');return false;}

function renderModal() {
  const m = ui.modal;
  if (!m) return;
  const p = pr(m.id), component = prototypeModals[m.kind];
  if (component) return component(m, p);
  layout('原型提示','',notice('此入口需要对应的演示对象','请关闭后从列表重新选择。'));
}
