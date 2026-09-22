'use strict';

function resetSample(preserve=true){formDrafts.clear();timers.forEach(clearInterval);timers.clear();const review=preserve?clone(S.review):null;S=initial();if(review)S.review=review;ui.q='';ui.filter='all';ui.server='all';ui.zone='all';ui.tab='overview';ui.auth=null;ui.scenario='';ui.nav=false;persist();closeModal();}

function loadScene(id){resetSample();ui.scenario=id;const p=pr('p1');let op;
 switch(id){
 case'normal-backup':navigate('project','p1');startOperation(p,'backup',{preclean:true},'success',{hold:true});break;
 case'saved':navigate('project','p2');ui.tab='config';render();break;
 case'stop-failed':navigate('project','p1');op=startOperation(p,'stop',{},'failed',{hold:true});finishOperation(op,'failed');break;
 case'temporary-stop':p.backup.stop=true;persist();navigate('project','p1');startOperation(p,'backup',{preclean:true},'success',{hold:true});break;
 case'update-partial':pr('p2').cfg.version='demo-new-content';pr('p2').draftRev++;navigate('project','p2');op=startOperation(pr('p2'),'update',{},'partial',{hold:true});finishOperation(op,'partial');break;
 case'deploy-partial':navigate('project','p9');op=startOperation(pr('p9'),'deploy',{desired:'running'},'partial',{hold:true});finishOperation(op,'partial');break;
 case'ssh-unknown':navigate('project','p1');op=startOperation(p,'backup',{preclean:true},'unknown',{hold:true});finishOperation(op,'unknown');break;
 case'uninstall-dns':navigate('project','p1');op=startOperation(p,'uninstall',{deleteData:false,dnsIds:['dns1'],fwIds:[]},'partial',{hold:true});finishOperation(op,'partial');break;
 case'restore-start':navigate('project','p1');op=startOperation(p,'restore',{backupId:'b1'},'start-failed',{hold:true});finishOperation(op,'start-failed');break;
 case'backup-conflict':navigate('project','p3');startOperation(p,'backup',{},'success',{hold:true,silent:true});startOperation(pr('p3'),'update',{},'success');break;
 case'redeploy':navigate('project','p8');break;
 case'schedule-skip':startOperation(p,'backup',{preclean:true},'success',{hold:true,silent:true,planId:'plan1'});record('错过计划 · 控制器未运行','schedule',null,'missed','本次演示计划时间错过。不补跑，不执行该次前置清理。');navigate('plans');triggerPlan(S.plans[0]);break;
 case'replica-init':{const n=clone(pr('p3'));n.id='p10';n.name='mysql-fresh';n.server='s4';n.serverName=sname('s4');n.hasBusinessData=false;n.replicaOf=null;n.replication='na';n.cfg.dataDir='/srv/stackpier-demo/mysql-fresh/data';n.applied=clone(n.cfg);n.backup.path=n.cfg.dataDir;S.projects.push(n);sr('s4').docker=true;persist();navigate('project','p10');openModal('replica',{id:'p10'});break;}
 case'host-changed':sr('s1').state='changed';persist();navigate('servers');break;
 case'access':ui.auth='setup';ui.initialized=false;render();break;
 case'empty':S.servers=[];S.projects=[];S.backups=[];S.plans=[];S.operations=[];S.dns=[];S.firewalls=[];S.notifications=[];persist();navigate('servers');break;
 }
 toast('已装载虚构场景；修改意见保留。场景行为尚待审阅。');
}

function copyText(text){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(text).then(()=>toast('已复制，请粘贴到对话中。','success')).catch(()=>fallbackCopy(text));}else fallbackCopy(text);}

function fallbackCopy(text){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';(dialog.open?dialog:document.body).appendChild(ta);ta.select();try{document.execCommand('copy');toast('已复制，请粘贴到对话中。','success');}catch{toast('浏览器未允许复制，请直接选择意见文本复制。','error')}ta.remove();}

function notesText(){return '# StackPier 原型修改意见\n\n'+S.review.notes.map((n,i)=>`${i+1}. ${n.page}\n${n.text}\n记录：${fmt(n.time)}`).join('\n\n');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["about","feedback","reviewsettings","scenes","resetconfirm"], function(m, p) {
  switch (m.kind) {
case'about':layout('原型说明','从现有原型和前端延续，而不是另起一套视觉体系。',`<div class="stack">${notice('这是可交互的模拟应用','所有数据都在当前浏览器；没有真实 SSH、数据库、通知、DNS、防火墙或定时任务。请勿输入真实凭据。')}<div class="detail-list">${detail([['参考提交','<code>ef41df2bd4001ddee61fb60203e9fa74aebb7d52</code>'],['已读取原型','source/main.jsx、source/styles.css'],['已读取前端','WorkspaceShell.tsx、ServerFields.tsx、servers.css'],['现行需求','01_需求基线.md'],['暂缓 / 不做','复制迁移、独立回退、网页终端、通用文件管理、控制器自备份']])}</div><p class="small muted">样式、品牌和服务器紧凑布局沿用仓库。业务范围来自需求基线；新增页面结构和状态行为仍待审。此 HTML 不是正式 React 前端实现，也不固定后端、API 或数据库设计。</p>${notice('纯静态交互原型','此文件通过 GitHub Pages 托管，所有操作仍仅在当前浏览器内模拟。网页可以公开访问，演示登录不是实际访问保护。')}<p class="small muted">刷新保留非敏感演示状态；在途模拟操作会变为待核对，不自动重放。浏览器存储被清理后会恢复样例。页面标注仅存在此浏览器，不会自动发送给对话。</p></div>`,btn('重置全部演示','resetconfirm',{},'danger')+btn('查看试用设置','reviewsettings')+btn('开始体验','closemodal',{},'primary'),true);break;
case'feedback':layout('记下修改','记录当前页面哪里不符合使用习惯；不会自动发送到对话。',`<div class="stack">${field('feedback-page','所在页面',m.page||((ui.page==='project'?pname(ui.project)+' / '+ui.tab:navItems.find(x=>x[0]===ui.page)?.[1])||ui.page))}${area('feedback-text','希望怎样修改','','例如：停止失败后，我希望这里首先显示实际仍在运行。',4)}<div class="between"><span class="small muted">已记录 ${S.review.notes.length} 条 · 仅此浏览器</span>${btn('复制全部意见','copynotes',{},'small')}</div>${S.review.notes.slice().reverse().map(n=>`<div class="feedback-note"><div class="between"><strong class="small">${h(n.page)}</strong>${btn('移除','deletenote',{id:n.id},'small ghost','trash')}</div><p>${h(n.text)}</p><span class="tiny muted">${fmt(n.time)}</span></div>`).join('')}</div>`,btn('关闭','closemodal')+'<button type="submit" class="btn primary">保存这条意见</button>',false,'feedback');break;
case'reviewsettings':layout('原型试验设置','这三个行为尚未获批准。修改这里只影响演示，不代表确认需求。',`<div class="stack">${select('review-p1','停止失败后，是否还记住你的停止意图？',[['accepted','请求受理后就记住；失败仍保留目标'],['success','只有执行成功才改变目标']],S.review.p1,'显示失败和实际状态，不自动重试。P1 待审。')}${check('review-p2','备份明确失败，但确认安全后，尝试恢复原先运行一次',S.review.p2,'前提：原执行已结束、数据安全、原本运行、长期目标未改变；未知不启动。P2 待审。')}${check('review-p3','恢复已卸载项目时，也重新登记运行载体，但不启动',S.review.p3,'未选择时只恢复原位置文件和数据，仍已卸载，随后另行部署。P3 待审。')}${notice('不是要求你先回答技术选择题','可以先按默认演示体验具体流程，再通过“记下修改”描述不合适之处。')}</div>`,btn('返回场景','scenes')+'<button type="submit" class="btn primary">用于本次演示</button>',false,'reviewsettings');break;
case'scenes':layout('试用一个具体场景','切换场景会重置当前演示操作和数据；已记录的修改意见会保留。',`<div class="review-scenes">${scenes.map((s,i)=>`<button class="scene-card" data-action="loadscene" data-id="${s.id}"><span class="tiny muted">${String(i+1).padStart(2,'0')}</span><strong>${h(s.title)}</strong><p>${h(s.desc)}</p></button>`).join('')}</div><div class="mt">${notice('业务主线也能直接操作','不需要依赖场景工具：接入服务器 → 创建项目 → 保存 / 应用 → 备份 → 恢复 → 卸载，使用页面按钮即可推进。')}</div>`,btn('调整待审行为','reviewsettings',{},'ghost')+btn('关闭','closemodal'),true);break;
case'resetconfirm':layout('重置演示数据','仅影响此浏览器中的原型，不操作任何真实环境。',notice('将恢复最初的虚构服务器、项目与记录','已记录的修改意见会保留。正在运行的演示计时器将停止。','warning'),btn('取消','closemodal')+btn('确认重置','resetdemo',{},'danger'));break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["about","feedback","reviewsettings","scenes","resetconfirm","loadscene","resetdemo","copynotes","deletenote"], function(event, target, d, a) {
  switch (a) {
case'about':case'feedback':case'reviewsettings':case'scenes':case'resetconfirm':openModal(a);break;
case'loadscene':loadScene(d.id);break;
case'resetdemo':resetSample();navigate('overview');toast('演示数据已重置，修改意见保留。');break;
case'copynotes':if(S.review.notes.length)copyText(notesText());else toast('还没有修改意见，先保存一条。');break;
case'deletenote':S.review.notes=S.review.notes.filter(n=>n.id!==d.id);persist();renderModal();break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["feedback","reviewsettings"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'feedback':if(!get('feedback-text')){modalError('请写下希望怎样修改。');break;}S.review.notes.push({id:uid('note'),page:get('feedback-page'),text:get('feedback-text'),time:now()});persist();renderModal();toast('意见只保存在此浏览器；可复制后粘贴到对话。','success');break;
case'reviewsettings':S.review.p1=get('review-p1');S.review.p2=has('review-p2');S.review.p3=has('review-p3');persist();closeModal();toast('已更改演示分支；不代表任何产品决定已获批准。');break;
  }
});
