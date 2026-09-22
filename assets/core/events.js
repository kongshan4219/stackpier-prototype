'use strict';

document.addEventListener('input',event=>{const el=event.target;if(el.closest('form[data-form=templateedit]'))document.getElementById('modal-error').hidden=true;cacheFormInput(el);if(el.dataset.filter==='q'){ui.q=el.value;render();}});

document.addEventListener('change',event=>{const el=event.target;cacheFormInput(el);if(el.dataset.filter&&el.dataset.filter!=='q'){ui[el.dataset.filter]=el.value;render();}if(el.id==='bin-file'&&el.files?.[0]){document.getElementById('bin-filename').value=el.files[0].name;}});

dialog.addEventListener('cancel',event=>{event.preventDefault();closeModal();});

document.addEventListener('keydown',event=>{if(event.key==='Escape'&&ui.nav){ui.nav=false;render();}});

document.addEventListener('click',event=>{const target=event.target.closest('[data-action]');if(!target||target.disabled)return;const d=target.dataset,a=d.action;
 { const handler = prototypeActions[a]; if (handler) handler(event, target, d, a); else { toast('没有找到对应的演示动作：'+a,'error'); } }
});

document.addEventListener('submit',event=>{const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();const fd=new FormData(form),get=n=>String(fd.get(n)||'').trim(),has=n=>fd.has(n),all=n=>fd.getAll(n).map(String),m=ui.modal,p=m&&pr(m.id);const kind=form.dataset.form;formDrafts.delete(kind+'|'+(form.dataset.id||''));
 try{{ const handler = prototypeForms[kind]; if (handler) handler(event, form, fd, get, has, all, m, p, kind); else { modalError('暂未匹配到此表单的演示处理。'); } }}catch(err){modalError(err.message||'本次演示输入无法处理。');console.error('Prototype interaction error',err);}
});
