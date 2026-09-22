'use strict';

function operationTable(rows){return `<section class="card"><div class="table-wrap"><table><thead><tr><th>操作</th><th>触发时间</th><th>执行结果</th><th>已知事实</th><th class="right">详情</th></tr></thead><tbody>${rows.map(o=>`<tr><td><button class="link cell-title" data-action="opdetail" data-id="${h(o.id)}">${h(o.label)}</button><p class="cell-sub mono">${h(o.id)}</p></td><td>${fmt(o.time)}</td><td>${status(o.status)}${o.status==='running'?`<div class="progress"><i style="width:${Math.round(o.steps.filter(s=>s.status==='success').length/o.steps.length*100)}%"></i></div>`:''}</td><td style="max-width:330px"><span class="small muted">${h(o.message||'已固定本次输入，分项执行中。')}</span></td><td class="right">${btn(o.status==='unknown'?'核对原操作':'查看','opdetail',{id:o.id},'small','arrow')}</td></tr>`).join('')}</tbody></table></div>${!rows.length?empty('还没有记录','拒绝与跳过也会留有原因，但不会排队。'):''}</section>`}

function operationsPage(){const rows=S.operations.filter(o=>(o.label+' '+o.id+' '+o.message).toLowerCase().includes(ui.q.toLowerCase())&&(ui.filter==='all'||o.status===ui.filter));return heading('操作记录','查看一次操作完成了哪些部分，哪些失败，哪些结果尚不明确。','','OPERATIONS / HISTORY')+searchFilter('搜索操作、项目或记录编号…',`<select class="filter" data-filter="filter" aria-label="操作结果">${[['all','全部结果'],['running','执行中'],['success','成功'],['failed','明确失败'],['partial','部分完成'],['unknown','待核对'],['rejected','已拒绝'],['skipped','已跳过'],['missed','已错过']].map(([v,t])=>`<option value="${v}" ${ui.filter===v?'selected':''}>${t}</option>`).join('')}</select>`)+operationTable(rows)}

function operationModal(m){const p=pr(m.id),kind=m.op||m.operation||'backup';m.op=kind;if(!p){closeModal();return}const scope=resourcesFor(p,kind);let body=`<div class="stack">${detail([['项目',h(p.name)],['服务器',h(sname(p.server))],['当前状态',lifeName[p.life]+' · '+runtimeName[p.runtime]],['操作',opLabels[kind]],['本次资源范围',`<code>${h(scope.join('\n'))}</code>`]])}`;
 if(['apply','update','deploy'].includes(kind))body+=`<div class="diff-grid"><div><h3>最后完整应用参照</h3><pre class="code">
${h(configText(p,p.applied))}</pre></div><div><h3>本次固定输入 · D${p.draftRev}</h3><pre class="code">
${h(configText(p))}</pre></div></div>${notice('本次输入在受理时固定','之后保存的新草稿不影响这次执行；成功后仍保留后续待应用内容。普通更新不会擅自启动主动停止的项目。')}${kind==='deploy'&&p.dataStatus==='retained'?check('reuse-data','已核对保留数据来源，并确认本次复用','',p.cfg.dataDir+'；不会按同名目录自动决定。'):''}`;
 if(kind==='stop')body+=notice('停止不是卸载','停止成功后保留项目与数据；只免除对应停止造成的不可用告警。停止失败如何保留意图可在原型试验设置中切换。');
 if(kind==='restart')body+=notice('重启不改变长期运行目标','主动停止的项目请使用明确的“启动”，不通过重启偷偷改成希望运行。');
 if(kind==='backup')body+=`${detail([['项目文件',`<code>${h(p.backup.path||p.cfg.dataDir)}</code>`],['数据库范围',p.software==='redis'?'Redis 实例整体数据':p.backup.mysql?h(pname(p.backup.mysql))+' / '+h(p.backup.databases.join('、')):p.software==='mysql'?'本 MySQL 实例数据库（演示范围）':'未指定额外数据库'],['备份账号',h(p.backup.account||'单独配置的演示账号')],['保存目的地',p.backup.destination==='controller'?'栈桥所在机器':'其他目的地（尚未选定适配）'],['停服要求',p.backup.stop?'允许临时停服，上限 '+p.backup.maxMinutes+' 分钟':'不允许停服']])}${check('preclean','在备份前执行保护性清理',true,'不能直接清空旧副本，新备份未核对不计入保护底线。')}${select('backup-policy','共享保护策略',S.policies.map(x=>[x.id,x.name]))}${notice('冲突操作会被拒绝，不排队','本次备份使用的数据库可能位于另一个项目。冲突按实际范围判断，不只比较项目编号。')}`;
 if(kind==='uninstall'){const ns=S.dns.filter(x=>x.projects.includes(p.id)),fs=S.firewalls.filter(x=>x.projects.includes(p.id));body+=notice('卸载核心服务，数据和网络分别选择','默认保留数据和关联网络条目；历史备份与操作记录不会删除。核心卸载完成后暂停此项目的定时检查、备份和清理。','warning')+check('delete-data','同时删除确认直接归属本项目的业务数据',false,'仅本项目目录 / 数据卷，不含共享 MySQL 中的应用数据库或历史备份。')+`<div class="checks"><h3>关联 DNS · 默认保留</h3>${ns.length?ns.map(x=>check('dns-'+x.id,x.name+'.'+x.zone,false,x.projects.length>1?'共享用途：'+x.projects.map(pname).join('、'):'只登记了当前项目用途，仍须核对归属。')).join(''):'<p class="small muted">没有登记的关联记录。</p>'}<h3 class="mt">关联防火墙 · 默认保留</h3>${fs.length?fs.map(x=>check('fw-'+x.id,`${sname(x.server)} / ${x.protocol} ${x.port}`,false,x.projects.length>1?'共享用途，删除影响多个项目':'仅删除选中的条目。')).join(''):'<p class="small muted">没有登记的关联规则。</p>'}</div>${check('shared-ack','若选择共享条目，已确认其他项目的访问也会受到影响',false)}${field('uninstall-name','输入项目名称以确认', '', p.name,'text','required')}`;}
 const opts=kind==='backup'?[['success','备份及必要收尾完成'],['failed','备份明确失败（演示：执行结束且数据安全）'],['partial',p.backup.stop?'产物完成，但恢复运行失败':'前置清理失败，空间足够，备份仍完成'],['unknown','响应丢失，备份结果待核对']]:kind==='uninstall'?[['success','核心及选定分项完成'],['failed','核心卸载未开始就明确失败'],['partial','核心已卸载，选定的网络清理失败'],['unknown','核心卸载结果未知']]:null;
 body+=outcomeField(m.outcome||ui.nextOutcome,opts)+'</div>';layout(opLabels[kind]+' · '+p.name,'确认只触发模拟执行，不会访问真实服务器。',body,btn('取消','closemodal')+`<button type="submit" class="btn ${kind==='uninstall'?'danger':'primary'}">确认${opLabels[kind]}（演示）</button>`,['apply','update','deploy','uninstall'].includes(kind),'projectop');}

function opDetail(m){const o=S.operations.find(o=>o.id===m.id);if(!o){closeModal();return}const completed=o.steps.filter(s=>s.status==='success').length;layout(o.label,'操作结果与当前服务状态分别保存，不自动重跑整单。',`<div class="stack"><div class="between">${status(o.status)}<span class="tiny muted mono">${h(o.id)}</span></div>${notice(o.message||'本次输入已固定，执行中…',o.status==='unknown'?'核对原操作，不按固定超时认定远端已结束。':o.status==='rejected'?'此次请求没有受理，不排队，也不会在冲突解除后偷偷执行。':'已完成的分项不会因为后续失败而消失。',o.status==='failed'?'error':['partial','unknown','rejected'].includes(o.status)?'warning':'')}<div><div class="progress"><i style="width:${o.steps.length?Math.round(completed/o.steps.length*100):0}%"></i></div><p class="tiny muted">已核对 ${completed} / ${o.steps.length} 个分项 · ${fmt(o.time)}</p></div><div class="step-list">${o.steps.map((s,i)=>`<div class="step-item"><span class="step-circle ${s.status}">${s.status==='success'?I('check'):s.status==='failed'?I('close'):i+1}</span><div class="grow"><strong class="step-label">${h(s.title)}</strong><p class="step-note">${h(s.note||({success:'此分项已核对',failed:'此分项明确失败',pending:'尚未执行',running:'执行中',unknown:'缺少足够证据'}[s.status]||s.status))}</p></div>${status(s.status)}</div>`).join('')}</div>${o.project?detail([['项目当前部署阶段',h(lifeName[pr(o.project)?.life]||'—')],['项目当前运行观测',h(runtimeName[pr(o.project)?.runtime]||'—')],['本次固定输入',h(o.input?.cfg?'D'+o.input.draftRev+' / '+o.input.cfg.version:'按确认时的范围')]]):''}${o.resources?.length?`<div><h3 class="mb">影响范围</h3><pre class="code">${h(o.resources.join('\n'))}</pre></div>`:''}</div>`,btn('关闭','closemodal')+(o.project?btn('查看项目','project',{id:o.project}):'')+(o.status==='running'?btn('原型：完成本次演示','finishdemo',{id:o.id},'primary'):o.status==='unknown'?btn('核对原操作','verifyop',{id:o.id},'primary'):o.kind==='restore'&&o.dataRestored&&o.status==='partial'?btn('只重试启动','projectop',{id:o.project,kind:'start'},'primary'):''),false);}

function verifyOpModal(m){const o=S.operations.find(o=>o.id===m.id);layout('核对原操作','这里只注入模拟核对证据，不提供生产环境的“强制成功”。',`<div class="stack">${notice(o.label,'确认执行是否仍可能继续写入，再核对各项结果。不会重新运行原命令。','warning')}${select('verify-result','模拟取得的核对证据',[['working','仍在执行，继续保留保护'],['success','确认原执行已结束，全部分项成功'],['partial','确认原执行已结束，部分完成'],['failed','确认原执行已结束，明确失败'],['ended-unknown','确认不会继续写入且当前资源安全，但历史结果无法证明']])}${check('verify-evidence','已核对原操作身份、停止写入证据及当前相关资源',false,'没有充分证据时继续保持未知。')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">记录模拟核对结论</button>',false,'verifyop');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["projectop","opdetail","verifyop"], function(m, p) {
  switch (m.kind) {
case'projectop':operationModal(m);break;
case'opdetail':opDetail(m);break;
case'verifyop':verifyOpModal(m);break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["projectop","finishdemo"], function(event, target, d, a) {
  switch (a) {
case'projectop':openModal('projectop',{id:d.id,op:d.kind});break;
case'finishdemo':{const o=S.operations.find(o=>o.id===d.id);finishOperation(o,o.outcome);break;}
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["projectop","verifyop"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'projectop':{
  const op=m.op,outcome=get('outcome'),input={};
  if(op==='deploy'&&p.dataStatus==='retained'&&!has('reuse-data')){modalError('请核对并确认复用保留数据，不按同名目录自动判断。');break;}
  if(op==='uninstall'){
   if(get('uninstall-name')!==p.name){modalError('请输入完全一致的项目名称。');break;}
   input.deleteData=has('delete-data');input.dnsIds=S.dns.filter(r=>r.projects.includes(p.id)&&has('dns-'+r.id)).map(r=>r.id);input.fwIds=S.firewalls.filter(r=>r.projects.includes(p.id)&&has('fw-'+r.id)).map(r=>r.id);
   const shared=S.dns.some(r=>input.dnsIds.includes(r.id)&&r.projects.length>1)||S.firewalls.some(r=>input.fwIds.includes(r.id)&&r.projects.length>1);
   if(shared&&!has('shared-ack')){modalError('已选择共享网络条目，请另外确认对其他项目的影响。');break;}
   if(outcome==='partial'&&!input.dnsIds.length&&!input.fwIds.length){modalError('要演示“网络清理失败”，请至少选择一项要清理的网络条目；否则请选正常完成。');break;}
  }
  if(op==='backup'){input.preclean=has('preclean');input.policy=get('backup-policy');}
  if(op==='deploy')input.desired=p.desired;
  startOperation(p,op,input,outcome);break;}
case'verifyop':{const o=S.operations.find(o=>o.id===m.id),v=get('verify-result');if(v==='working'){o.message='演示核对发现原执行尚未结束，结果继续待核对；保护保持。';persist();openModal('opdetail',{id:o.id});break;}if(!has('verify-evidence')){modalError('请先核对原操作身份、停止写入与当前资源证据。');break;}if(v==='ended-unknown'){o.protectionReleased=true;o.ended=now();o.message='已证实原执行不会继续写入且当前资源安全；历史结果仍无法证明，保留未知，不伪造成功。';persist();render();openModal('opdetail',{id:o.id});}else{openModal('opdetail',{id:o.id});finishOperation(o,v);}break;}
  }
});
