'use strict';

function templatesPage(){const rows=S.templates.filter(t=>(t.name+' '+(t.software||'')).toLowerCase().includes(ui.q.toLowerCase()));return heading('部署配置','集中保存 Compose 和 systemd 配置文件，已有项目自行选择何时采用。',btn('新增配置','templateedit',{},'primary','plus'),'CONFIGURATION / TEMPLATES')+searchFilter('搜索配置名称或软件…')+`<div class="grid3">${rows.map(t=>`<section class="card project-card"><div class="project-header"><div class="icon-box">${I(t.type==='compose'?'box':'config')}</div><div class="grow"><h3>${h(t.name)}</h3><p class="cell-sub">${t.type==='compose'?'Docker Compose':'systemd'} · 修订 ${t.rev}</p></div></div><p class="small muted" style="min-height:42px">${h(t.contentMode==='file'?'完整配置文件 · 原样保存':t.desc)}</p><div class="project-facts"><div><small>${t.contentMode==='file'?'模板内容':'预设端口'}</small>${t.contentMode==='file'?'完整文件':h(t.port)}</div><div><small>文件映射</small>${(t.fileMappings||[]).length} 个</div></div><div class="card-actions">${btn('编辑配置','templateedit',{id:t.id},'small','edit')}${btn('部署','deploytemplate',{id:t.id},'small ghost','arrow')}</div></section>`).join('')}</div><div class="mt">${notice('公共配置修改不会自动部署','更新提示只提供采用入口。采用到项目草稿后，仍需明确应用；配置文件正文不会自动替换变量或生成参数。')}</div>`}

function templateEditor(m){
 const t=m.templateDraft||tpl(m.id)||{name:'',type:'compose',tpl:''};
 layout(m.id?'编辑部署配置':'新增部署配置','保存配置后可用于项目，保存不会执行部署。',`<div class="stack"><div class="field-row">${field('tpl-name','配置名称',t.name,'','text','required autofocus')}${select('tpl-type','运行方式',[['compose','Docker Compose'],['systemd','systemd']],t.type)}</div>${configurationSourceField('tpl-source','模板内容',t.tpl||'')}${fileMappingEditor(m)}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存配置</button>',true,'templateedit');
}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["templateedit"], function(m, p) {
  switch (m.kind) {
case'templateedit':templateEditor(m);break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["templateedit"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'templateedit':{
  const t=tpl(m.id),source=String(fd.get('tpl-source')??''),name=get('tpl-name'),type=get('tpl-type');
  if(!name){modalError('请填写配置名称。');break;}
  if(!['compose','systemd'].includes(type)){modalError('请选择运行方式。');break;}
  if(!source.trim()){modalError('请填写完整配置文件内容。');break;}
  if(t&&t.type!==type&&S.projects.some(p=>p.template===t.id)){modalError('已有项目使用此配置，不能把其运行方式直接换成另一类；请建立一份新配置。');break;}
  let mapped;try{captureTemplateDraft(m);mapped=prepareFileMappings(m);}catch(error){modalError(error.message);break;}
  const n={software:'custom',program:'',port:null,version:'',env:'',desc:'',...t,fileMappings:mapped.rows,id:t?.id||uid('template'),name,type,tpl:source,contentMode:'file',rev:(t?.rev||0)+1};
  S.programs.push(...mapped.files);
  if(t)S.templates[S.templates.findIndex(x=>x.id===t.id)]=n;else S.templates.push(n);
  S.projects.filter(p=>p.template===n.id).forEach(p=>p.templateUpdate=true);persist();closeModal();render();toast('配置已保存，可用于新项目；已有项目需另行采用和应用。','success');break;
 }
  }
});

// 配置列表的部署入口只收集项目名和目标服务器；项目建立复用项目模块。
function deployTemplateModal(m){
 const t=tpl(m.id);
 if(!t){closeModal();toast('部署配置已不存在，请重新选择。','error');return;}
 layout('部署 · '+t.name,'按此配置创建项目并模拟部署。',`<div class="stack">${field('deploy-name','项目名称',t.name,'','text','required autofocus')}${select('deploy-server','目标服务器',[['','请选择服务器'],...S.servers.map(s=>[s.id,s.name+' / '+s.arch])],'',S.servers.length?'':'暂无服务器，请先添加服务器。','required')}</div>`,btn('取消','closemodal')+`<button class="btn primary" type="submit" ${S.servers.length?'':'disabled'}>部署</button>`,false,'deploytemplate');
}
registerPrototypeHandlers(prototypeModals,['deploytemplate'],deployTemplateModal);
registerPrototypeHandlers(prototypeActions,['deploytemplate'],function(event,target,d){openModal('deploytemplate',{id:d.id});});
registerPrototypeHandlers(prototypeForms,['deploytemplate'],function(event,form,fd,get,has,all,m){
 const t=tpl(m.id);
 if(!t){modalError('部署配置已不存在，请关闭后重新选择。');return;}
 saveNewProject({template:t.id,name:get('deploy-name'),server:get('deploy-server'),desired:'running',port:t.contentMode==='file'?null:t.port,env:t.env||''},ui.nextOutcome||'success');
});
