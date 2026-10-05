'use strict';

function resetSample(preserve=true){formDrafts.clear();timers.forEach(clearInterval);timers.clear();const review=preserve?clone(S.review):null;S=initial();initializeCloudflare();if(review)S.review=review;ui.q='';ui.filter='all';ui.server='all';ui.zone='all';ui.tab='overview';ui.projectsTab='list';ui.auth=null;ui.scenario='';ui.nav=false;persist();closeModal();}

function loadScene(id){if(!scenes.some(scene=>scene.id===id)){toast('此试用场景当前不提供。');return;}resetSample();ui.scenario=id;const p=pr('p1');let op;
 switch(id){
 case'saved':navigate('project','p2');ui.tab='config';render();break;
 case'stop-failed':navigate('project','p1');op=startOperation(p,'stop',{},'failed',{hold:true});finishOperation(op,'failed');break;
 case'update-partial':pr('p2').cfg.version='demo-new-content';pr('p2').draftRev++;navigate('project','p2');op=startOperation(pr('p2'),'update',{},'partial',{hold:true});finishOperation(op,'partial');break;
 case'deploy-failed':case'deploy-partial':case'deploy-unknown':{const outcome=id.slice(7);navigate('project','p9');op=startOperation(pr('p9'),'deploy',{},outcome,{hold:true,newProject:true});finishOperation(op,outcome);break;}
 case'ssh-unknown':navigate('project','p1');op=startOperation(p,'stop',{},'unknown',{hold:true});finishOperation(op,'unknown');break;
 case'uninstall-dns':navigate('project','p1');op=startOperation(p,'uninstall',{deleteData:false,dnsIds:['dns1'],fwIds:[]},'partial',{hold:true});finishOperation(op,'partial');break;
 case'redeploy':navigate('project','p8');break;
 case'host-changed':sr('s1').state='changed';persist();navigate('servers');break;
 case'access':ui.auth='setup';ui.initialized=false;render();break;
 case'empty':S.servers=[];S.projects=[];S.operations=[];S.dns=[];S.firewalls=[];S.notifications=[];S.frp.nodes=[];persist();navigate('servers');break;
 }
 toast('已装载虚构场景；修改意见保留。场景行为尚待审阅。');
}

function copyText(text){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast('已复制，请粘贴到对话中。','success')).catch(()=>fallbackCopy(text));}else fallbackCopy(text);}

function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';(dialog.open?dialog:document.body).appendChild(ta);ta.select();try{document.execCommand('copy');toast('已复制，请粘贴到对话中。','success');}catch{toast('浏览器未允许复制，请直接选择意见文本复制。','error')}ta.remove();}

function notesText(){return '# StackPier 原型修改意见\n\n'+S.review.notes.map((n,i)=>`${i+1}. ${n.page}\n${n.text}\n记录：${fmt(n.time)}`).join('\n\n');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["about","feedback","scenes","resetconfirm"], function(m, p) {
  switch (m.kind) {
case'about':layout('原型说明','先通过原型确认页面和操作流程，再继续正式业务开发。',`<div class="stack">${notice('这是可交互的模拟应用','服务器、项目、FRP、DNS 和通知均使用虚构数据，不连接真实服务。请使用示例输入体验流程。')}<div class="detail-list">${detail([['当前阶段','原型持续审阅与迭代'],['公开预览','GPT Sites · 任何人持有链接即可访问'],['数据保存',storageOK?'当前浏览器的 localStorage':'当前页面内存，刷新后不保留'],['修改意见','保存在此浏览器，复制后可粘贴到对话']])}</div><p class="small muted">演示登录用于讨论登录流程；网站本身公开访问。原型中的模拟结果不代表真实执行，也不固定正式应用的接口或数据库设计。</p>${notice('刷新后的操作记录','在途模拟操作会转为待核对，不自动重放。清理浏览器存储后恢复虚构样例。')}</div>`,btn('重置全部演示','resetconfirm',{},'danger')+btn('开始体验','closemodal',{},'primary'),true);break;
case'feedback':layout('记下修改','记录当前页面哪里不符合使用习惯；不会自动发送到对话。',`<div class="stack">${field('feedback-page','所在页面',m.page||((ui.page==='project'?pname(ui.project)+' / '+ui.tab:navItems.find(x=>x[0]===ui.page)?.[1])||ui.page))}${area('feedback-text','希望怎样修改','','例如：停止失败后，我希望这里首先显示实际仍在运行。',4)}<div class="between"><span class="small muted">已记录 ${S.review.notes.length} 条 · 仅此浏览器</span>${btn('复制全部意见','copynotes',{},'small')}</div>${S.review.notes.slice().reverse().map(n=>`<div class="feedback-note"><div class="between"><strong class="small">${h(n.page)}</strong>${btn('移除','deletenote',{id:n.id},'small ghost','trash')}</div><p>${h(n.text)}</p><span class="tiny muted">${fmt(n.time)}</span></div>`).join('')}</div>`,btn('关闭','closemodal')+'<button type="submit" class="btn primary">保存这条意见</button>',false,'feedback');break;
case'scenes':layout('试用一个具体场景','切换场景会重置当前演示操作和数据；已记录的修改意见会保留。',`<div class="review-scenes">${scenes.map((s,i)=>`<button class="scene-card" data-action="loadscene" data-id="${s.id}"><span class="tiny muted">${String(i+1).padStart(2,'0')}</span><strong>${h(s.title)}</strong><p>${h(s.desc)}</p></button>`).join('')}</div><div class="mt">${notice('业务主线也能直接操作','不需要依赖场景工具：接入服务器 → 部署项目 → 保存 / 应用 → 卸载，使用页面按钮即可推进。')}</div>`,btn('关闭','closemodal'),true);break;
case'resetconfirm':layout('重置演示数据','仅影响此浏览器中的原型，不操作任何真实环境。',notice('将恢复最初的虚构服务器、项目与记录','已记录的修改意见会保留。正在运行的演示计时器将停止。','warning'),btn('取消','closemodal')+btn('确认重置','resetdemo',{},'danger'));break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["about","feedback","scenes","resetconfirm","loadscene","resetdemo","copynotes","deletenote"], function(event, target, d, a) {
  switch (a) {
case'about':case'feedback':case'scenes':case'resetconfirm':openModal(a);break;
case'loadscene':loadScene(d.id);break;
case'resetdemo':resetSample();navigate('overview');toast('演示数据已重置，修改意见保留。');break;
case'copynotes':if(S.review.notes.length)copyText(notesText());else toast('还没有修改意见，先保存一条。');break;
case'deletenote':S.review.notes=S.review.notes.filter(n=>n.id!==d.id);persist();renderModal();break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["feedback"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'feedback':if(!get('feedback-text')){modalError('请写下希望怎样修改。');break;}S.review.notes.push({id:uid('note'),page:get('feedback-page'),text:get('feedback-text'),time:now()});persist();renderModal();toast('意见只保存在此浏览器；可复制后粘贴到对话。','success');break;
  }
});
