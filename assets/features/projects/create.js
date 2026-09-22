'use strict';

function newProjectModal(m){m.step=m.step||1;m.draft=m.draft||{template:m.template||'t1',server:'s4',name:'',desired:'running'};const d=m.draft,t=tpl(d.template)||S.templates[0],s=sr(d.server);let body=`<div class="stepper">${['选择部署配置','填写项目参数','确认部署范围'].map((a,i)=>`<span class="${m.step===i+1?'active':''}"><i>${i+1}</i>${a}</span>`).join('')}</div>`;
 if(m.step===1)body+=`<div class="stack">${select('np-template','部署配置',S.templates.map(t=>[t.id,t.name+' · '+(t.type==='compose'?'Compose':'systemd')]),d.template)}${notice('同一应用在不同服务器上，是两个独立项目','同配置多次部署不搬移旧数据，不等于复制或迁移。系统不接管任意外部既有部署。')}</div>`;
 else if(m.step===2)body+=`<div class="stack"><div class="field-row">${field('np-name','项目名称',d.name,'英文开头，可含数字、- 和 _。','text','required pattern="[A-Za-z][A-Za-z0-9_-]{0,62}"')}${select('np-server','目标服务器',S.servers.map(s=>[s.id,s.name+' / '+s.arch]),d.server)}</div><div class="field-row">${t.contentMode==='file'?'':field('np-port','对外端口',d.port??t.port,'核对同一机器上已占用的端口。','number','required min="1" max="65535"')}${select('np-desired','部署完成后的运行目标',[['running','启动并运行'],['stopped','保持停止']],d.desired)}</div>${t.contentMode==='file'?`<div><h3>配置文件预览</h3><pre class="code">
${h(t.tpl)}</pre></div>`:area('np-env','项目环境变量',d.env??t.env,'仅虚构配置，不填写真实凭据。')}${notice('只保存也可以','下一步可以只建立未部署项目，不必立即执行。')}</div>`;
 else body+=`<div class="stack">${detail([['项目名称',h(d.name)],['目标服务器',h(s?.name)],['部署配置',h(t.name)],['运行方式',t.type==='compose'?'Docker Compose':'systemd'],...(t.contentMode==='file'?[['配置内容','按所选文件原样使用']]:[['端口',h(d.port)],['数据目录',`<code>/srv/stackpier-demo/${h(d.name)}/data</code>`]]),['运行目标',d.desired==='running'?'运行':'停止']])}${t.contentMode==='file'?`<pre class="code">
${h(t.tpl)}</pre>`:''}${notice('网络配置不随部署修改','不会自动添加 DNS 或防火墙规则；公共 MySQL / Redis 不会随应用默认另建一套。')}${outcomeField()}</div>`;
 const foot=(m.step>1?btn('上一步','newback',{},'left ghost'):btn('取消','closemodal'))+(m.step===3?'<button class="btn" type="submit" name="commit" value="save">仅保存项目</button><button class="btn primary" type="submit" name="commit" value="deploy">确认部署（演示）</button>':'<button class="btn primary" type="submit">下一步</button>');layout('新建项目','创建由栈桥管理的新项目，不接管现有外部部署。',body,foot,false,'newproject');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["newproject"], function(m, p) {
  switch (m.kind) {
case'newproject':newProjectModal(m);break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["newproject","newback"], function(event, target, d, a) {
  switch (a) {
case'newproject':openModal('newproject',{template:d.template});break;
case'newback':ui.modal.step--;renderModal();break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["newproject"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'newproject':{
  if(m.step===1){m.draft.template=get('np-template');m.step=2;renderModal();break;}
  if(m.step===2){if(S.projects.some(p=>p.name===get('np-name')&&p.server===get('np-server'))){modalError('这台服务器已存在同名项目记录，请回到原项目处理。');break;}Object.assign(m.draft,{name:get('np-name'),server:get('np-server'),port:fd.has('np-port')?Number(get('np-port')):null,env:get('np-env'),desired:get('np-desired')});m.step=3;renderModal();break;}
  const d=m.draft,t=tpl(d.template),s=sr(d.server);if(!t||!s){modalError('请先接入服务器并建立部署配置。');break;}if(t.software==='mysql'&&S.projects.some(p=>p.server===d.server&&p.template===t.id&&p.life!=='uninstalled')){modalError('同一服务器已有相同 MySQL 配置的项目。多实例须维护不同配置并核对端口、目录和名称。');break;}
  const cfg={...(t.contentMode==='file'?{source:t.tpl}:{}),port:d.port,version:t.version,dataDir:`/srv/stackpier-demo/${d.name}/data`,env:d.env,templateRev:t.rev,appConfig:'logLevel = "info"',serviceUser:'app',program:t.program};
  const project={id:uid('project'),name:d.name,server:d.server,serverName:s.name,template:t.id,type:t.type,software:t.software,life:'draft',desired:d.desired,runtime:'na',health:'na',observed:null,lastCheck:null,cfg,applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,dataStatus:'in-place',deps:[],depChanges:[],monitor:{hours:24,http:'',tcp:d.port?String(d.port):'',channels:[],inherit:true},hasBusinessData:false};S.projects.push(project);persist();const deploy=event.submitter?.value==='deploy',outcome=get('outcome');closeModal();navigate('project',project.id);if(deploy)startOperation(project,'deploy',{desired:d.desired},outcome);else toast('项目已保存，尚未部署。','success');break;}
  }
});
