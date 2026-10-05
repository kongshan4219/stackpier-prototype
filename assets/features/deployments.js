'use strict';

function templatesPage(){const rows=S.templates.filter(t=>(t.name+' '+(t.software||'')).toLowerCase().includes(ui.q.toLowerCase()));return heading('部署配置','集中保存 Compose 和 systemd 配置文件，已有项目自行选择何时采用。',btn('新增配置','templateedit',{},'primary','plus'),'CONFIGURATION / TEMPLATES')+searchFilter('搜索配置名称或软件…')+`<div class="grid3">${rows.map(t=>`<section class="card project-card"><div class="project-header"><div class="icon-box">${I(t.type==='compose'?'box':'config')}</div><div class="grow"><h3>${h(t.name)}</h3><p class="cell-sub">${t.type==='compose'?'Docker Compose':'systemd'} · 修订 ${t.rev}</p></div></div><p class="small muted" style="min-height:42px">${h(['frpc','frps'].includes(t.software)&&!t.frpRole?'历史自定义配置 · 保留旧正文、端口和项目，不静默迁移':t.contentMode==='file'?'完整配置文件 · 原样保存':t.desc)}</p><div class="project-facts"><div><small>${t.contentMode==='file'?'模板内容':'预设端口'}</small>${t.contentMode==='file'?'完整文件':h(t.port)}</div><div><small>文件映射</small>${btn(t.frpRole?'程序资产 1 · 生成 TOML / unit':fileMappingSummary(t.fileMappings),'asset-template',{id:t.id},'small ghost')}</div><div><small>关联项目</small>${btn(templateProjects(t.id).length+' 个','asset-template',{id:t.id},'small ghost')}</div></div><div class="card-actions">${btn('编辑配置','templateedit',{id:t.id},'small','edit')}${btn('使用此配置部署','newproject',{template:t.id},'small ghost','arrow')}</div></section>`).join('')}</div><div class="mt">${notice('公共配置修改不会自动部署','更新提示只提供采用入口。采用到项目草稿后，仍需明确应用；配置文件正文不会自动替换变量或生成参数。')}</div>`}

function templateEditor(m){
 const t=tpl(m.id)||{name:'',type:'compose',tpl:''};
 const cached=S.editorDrafts?.[m.id||'new'];if(!m.editor&&cached){m.editor=clone(cached.editor);m.fileMappings=clone(cached.fileMappings);}
 if(!m.editor)m.editor={name:t.name,type:t.type,source:t.tpl||''};
 if(!m.fileMappings)m.fileMappings=clone(t.fileMappings||[]);
 layout(m.id?'编辑部署配置':'新增部署配置','保存配置后可用于项目，保存不会执行部署。',`<div class="stack"><div class="field-row">${field('tpl-name','配置名称',m.editor.name,'','text','required autofocus')}${select('tpl-type','运行方式',[['compose','Docker Compose'],['systemd','systemd']],m.editor.type)}</div>${m.sourceProject?notice('来源项目：'+pname(m.sourceProject),'编辑公共配置会提示所有关联项目，但不会自动采用或应用。'):''}${notice('公共配置影响范围',templateProjects(m.id).map(project=>project.name).join('、')||'尚无关联项目')}${templateFileMappingSection(m.fileMappings)}<section class="stack"><h3>部署正文</h3><p class="small muted">原样保存；不会替换变量。请先填写实际正文内容。</p>${configurationSourceField('tpl-source','Compose / systemd 正文',m.editor.source)}</section></div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存配置</button>',true,'templateedit');
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
  let fileMappings;try{syncTemplateEditorDraft(fd);fileMappings=validateMappings(m.fileMappings.filter(mapping=>mapping.groupId||mapping.targetPath));}catch(error){modalError(error.message);break;}
  if(t&&t.type!==type&&S.projects.some(p=>p.template===t.id)){modalError('已有项目使用此配置，不能把其运行方式直接换成另一类；请建立一份新配置。');break;}
  if(fd.getAll('tpl-map-path').length){try{fileMappings=readTemplateFileMappings(fd);}catch(error){modalError(error.message);return;}}
  const n={software:'custom',program:'',port:null,version:'',env:'',desc:'',...t,id:t?.id||uid('template'),name,type,tpl:source,fileMappings,contentMode:'file',rev:(t?.rev||0)+1};
  n.revisions=[...(t?.revisions||[]),clone({...n,revisions:undefined})];
  if(t)S.templates[S.templates.findIndex(x=>x.id===t.id)]=n;else S.templates.push(n);
  markAssetUpdates();delete S.editorDrafts?.[m.id||'new'];m.saved=true;persist();closeModal();render();toast('配置已保存，可用于部署项目；已有项目需另行采用和应用。','success');break;
 }
  }
});
