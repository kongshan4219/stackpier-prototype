'use strict';

function dependencies(p){const others=S.projects.filter(x=>x.id!==p.id&&x.life!=='uninstalled');return `<div class="grid2"><section class="card"><div class="card-head"><h2>提示性依赖</h2><span class="tag">不级联操作</span></div><div class="card-body"><form data-form="dependencies" data-id="${p.id}" class="stack"><p class="small muted">这里只标记依赖及已应用变化，不生成数据库连接、不自动部署或启停其他项目。</p><div class="checks">${others.map(x=>`<label class="check"><input name="deps" value="${x.id}" type="checkbox" ${p.deps.includes(x.id)?'checked':''}><span>${h(x.name)} <small class="muted">${h(sname(x.server))}</small></span></label>`).join('')}</div><div class="form-bottom"><span></span><button class="btn primary" type="submit">保存依赖</button></div></form></div></section><div class="stack">${card('待确认的已应用变化',p.depChanges.length?p.depChanges.map(c=>`<div class="probe"><div class="grow"><strong class="small">${h(pname(c.project))}</strong><p class="cell-sub">${h(c.text)}</p><p class="cell-sub">${h(c.change)} · ${fmt(c.time)}</p></div>${btn('确认已处理','confirmdep',{id:p.id,change:c.change},'small')}</div>`).join(''):'<p class="small muted">没有待确认的依赖变化。保存草稿、单纯启停不会产生这个标记。</p>')}${p.software==='mysql'?card('MySQL 主从关系',detail([['项目角色',p.replicaOf?'独立只读副本':'普通 MySQL 项目'],['复制来源',p.replicaOf?h(pname(p.replicaOf)):'尚未配置'],['复制观测',badge(p.replication==='healthy'?'只读复制正常':p.replicaOf?'待核对':'不适用',p.replication==='healthy'?'success':p.replicaOf?'warning':'')]])+`<p class="cell-sub mt">主库条件不足只提示；目标已有业务数据则拒绝初始化。不提供自动切主。</p>`,btn('初始化只读副本','replica',{id:p.id},'small')):''}</div></div>`}

function replicaModal(m){const mysqls=S.projects.filter(p=>p.software==='mysql'&&p.life==='installed');layout('初始化 MySQL 只读副本','从库独立管理；主库条件不足只提示，不自行改主库或创建账号。',`<div class="stack"><div class="field-row">${select('r-primary','主库',mysqls.map(p=>[p.id,p.name]),'p3')}${select('r-target','目标从库',mysqls.map(p=>[p.id,p.name]),m.id||'p6')}</div>${notice('目标已有业务数据将拒绝','不清空、不合并、不覆盖目标旧业务数据。之前未结束初始化的残留应核对原操作，不能当成新空库重做。','warning')}${select('r-ready','模拟主库条件',[['ready','配置、复制账号及授权已由用户准备'],['missing','主库条件仍不满足，仅提示缺项']])}${field('r-user','既有复制账号（演示）','repl_demo','栈桥不代建此账号。')}${field('r-secret','凭据（原型不保存）','','请勿输入真实凭据。','password')}${check('r-full','同步主库全部数据库；已知对象边界另行技术验证',false,'不是按应用挑选部分库。')}${check('r-readonly','日常保持从库只读，只接收复制和查询',true)}${outcomeField()}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">检查并初始化（演示）</button>',false,'replica');}

function appliedConfigContent(p,c){return c?configText(p,p.type==='systemd'&&typeof c.source!=='string'?{...c,version:''}:c):null;}

function notifyDependencies(p,o){
 if(o.status!=='success'||!['deploy','apply','update'].includes(o.kind)||o.dependencyNotificationChecked||!Object.prototype.hasOwnProperty.call(o.input,'applied')||!p.applied)return;
 const previous=o.input.applied,current=p.applied;
 // 旧演示数据缺少程序内容身份时不能由当前文件记录倒推出历史身份。
 const programChanged=typeof previous?.contentIdentity==='string'&&previous.contentIdentity!==''&&typeof current.contentIdentity==='string'&&current.contentIdentity!==''&&previous.contentIdentity!==current.contentIdentity;
 const changed=appliedConfigContent(p,previous)!==appliedConfigContent(p,current)||programChanged;
 o.dependencyNotificationChecked=true;
 if(!changed)return;
 S.projects.forEach(x=>{if(x.deps.includes(p.id)&&!x.depChanges.some(c=>c.operation===o.id))x.depChanges.push({project:p.id,change:uid('chg'),operation:o.id,text:`${opLabels[o.kind]}已完整完成，实际配置或程序内容已改变`,time:now()});});
}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["replica"], function(m, p) {
  switch (m.kind) {
case'replica':replicaModal(m);break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["confirmdep"], function(event, target, d, a) {
  switch (a) {
case'confirmdep':{const p=pr(d.id);p.depChanges=p.depChanges.filter(c=>c.change!==d.change);persist();render();toast('仅确认了当前这次变化，新变化仍将保留。');break;}
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["dependencies","replica"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'dependencies':pr(form.dataset.id).deps=all('deps');persist();render();toast('依赖仅用于提示，不级联操作。');break;
case'replica':{const target=pr(get('r-target')),primary=pr(get('r-primary'));if(!target||!primary||target.id===primary.id){modalError('主库和目标从库必须是两个不同的独立项目。');break;}if(get('r-ready')!=='ready'){rejectOperation(target,'replica','主库条件不满足：只提示缺少配置、复制账号或授权，不修改主库、不创建账号、不重启主库。');break;}if(target.hasBusinessData!==false||target.initResidue||target.replicaOf){rejectOperation(target,'replica','目标已有业务数据或初始化残留。拒绝本次初始化，不清空、覆盖或合并。');break;}if(!has('r-full')||!has('r-readonly')){modalError('请核对全库目标和日常只读要求。');break;}const cf=conflictFor(['mysql:'+primary.id+':*']);if(cf){rejectOperation(target,'replica','主库正被 '+cf.label+' 使用，请稍后重新提交。');break;}startOperation(target,'replica',{primary:primary.id,replicationUser:get('r-user'),extraResources:['mysql:'+primary.id+':*']},get('outcome'));break;}
  }
});
