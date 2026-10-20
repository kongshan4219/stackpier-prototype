'use strict';

function templatesPage(){const rows=S.templates.filter(t=>(t.name+' '+(t.software||'')).toLowerCase().includes(ui.q.toLowerCase()));return heading('部署配置','集中管理 systemd、Compose 和 FRP 部署配置。部署时选择已保存的配置。',btn('新增配置','templateedit',{},'primary','plus'),'CONFIGURATION / TEMPLATES')+searchFilter('搜索配置名称或软件…')+`<div class="grid3">${rows.map(t=>`<section class="card project-card"><div class="project-header"><div class="icon-box">${I(t.type==='compose'?'box':'config')}</div><div class="grow"><h3>${h(t.name)}</h3><p class="cell-sub">${t.frpRole?'FRP · '+frpRoles[t.frpRole]:t.type==='compose'?'Docker Compose':'systemd'} · 修订 ${t.rev}</p></div></div><p class="small muted" style="min-height:42px">${h(['frpc','frps'].includes(t.software)&&!t.frpRole?'历史自定义配置 · 保留旧正文、端口和项目，不静默迁移':t.contentMode==='file'?'完整配置文件 · 原样保存':t.desc)}</p><div class="project-facts"><div><small>${t.contentMode==='file'?'模板内容':'预设端口'}</small>${t.contentMode==='file'?'完整文件':h(t.port)}</div><div><small>文件映射</small>${btn(t.frpRole?'程序资产 1 · 生成 TOML / unit':fileMappingSummary(t.fileMappings),'asset-template',{id:t.id},'small ghost')}</div><div><small>关联项目</small>${btn(templateProjects(t.id).length+' 个','asset-template',{id:t.id},'small ghost')}</div></div><div class="card-actions">${btn('编辑配置','templateedit',{id:t.id},'small','edit')}${btn('使用此配置部署','newproject',{template:t.id},'small ghost','arrow')}</div></section>`).join('')}</div><div class="mt">${notice('公共配置修改不会自动部署','已有项目保留自己的已应用版本。保存配置和文件不会启动部署；首次部署需选择配置并重新预览。')}</div>`}

function templateEditor(m){
 const t=tpl(m.id)||{name:'',type:m.initialType||'compose',tpl:''};
 const cached=S.editorDrafts?.[m.id||'new'];if(!m.editor&&cached&&(!m.initialType||cached.editor.type===m.initialType)){m.editor=clone(cached.editor);m.fileMappings=clone(cached.fileMappings||[]);}
 if(!m.returnDeployment&&cached?.returnDeployment)m.returnDeployment=clone(cached.returnDeployment);
 if(!m.editor)m.editor={name:t.name,type:deploymentType(t),source:t.tpl||'',variables:t.variables||'{}'};
 if(m.editor.type==='frp')return frpDeploymentEditor(m);
 if(!m.fileMappings)m.fileMappings=clone(t.fileMappings||[]);
 layout(m.id?'编辑部署配置':'新增部署配置','保存配置后可用于项目，保存不会执行部署。',`<div class="stack"><div class="field-row">${field('tpl-name','配置名称',m.editor.name,'','text','required autofocus')}${select('tpl-type','运行方式',[['compose','Docker Compose'],['systemd','systemd'],['frp','FRP 服务',!!m.id]],m.editor.type)}</div>${m.sourceProject?notice('来源项目：'+pname(m.sourceProject),'编辑公共配置会提示所有关联项目，但不会自动采用或应用。'):''}${notice('公共配置影响范围',templateProjects(m.id).map(project=>project.name).join('、')||'尚无关联项目')}${templateFileMappingSection(m.fileMappings)}<section class="stack"><h3>部署正文</h3>${configurationSourceField('tpl-source',m.editor.type==='compose'?'Compose YAML 正文':'systemd 正文',m.editor.source)}${m.editor.type==='compose'?area('tpl-variables','显式变量（JSON，可选）',m.editor.variables||'{}','与正文和附带文件一起保存；部署时不再填写。原型只固定输入，不执行 Compose 解析。',4):''}</section></div>`,(m.returnDeployment?btn('返回部署，保留草稿','deployment-config-return'):btn('取消','closemodal'))+`<button class="btn primary" type="submit">${m.returnDeployment?'保存并返回部署':'保存配置'}</button>`,true,'templateedit');
 cacheTemplateDraft();
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
  let variables='{}';if(type==='compose'){try{variables=String(fd.get('tpl-variables')||'{}');const value=JSON.parse(variables);if(!value||Array.isArray(value)||typeof value!=='object'||Object.entries(value).some(([key,item])=>!/^[_A-Za-z][_A-Za-z0-9]*$/.test(key)||typeof item!=='string'))throw Error();}catch{modalError('显式变量须为 JSON 对象，名称合法且所有值为字符串。');return;}}
  let fileMappings;try{syncTemplateEditorDraft(fd);fileMappings=fd.getAll('tpl-map-path').length?readTemplateFileMappings(fd):validateMappings(m.fileMappings.filter(mapping=>mapping.groupId||mapping.targetPath));}catch(error){modalError(error.message);break;}
  if(t&&t.type!==type&&S.projects.some(p=>p.template===t.id)){modalError('已有项目使用此配置，不能把其运行方式直接换成另一类；请建立一份新配置。');break;}
  const n={software:'custom',program:'',port:null,version:'',env:'',desc:'',...t,id:t?.id||uid('template'),name,type,tpl:source,variables,fileMappings,contentMode:'file',rev:(t?.rev||0)+1};
  n.revisions=[...(t?.revisions||[]),clone({...n,revisions:undefined})];
  if(t)S.templates[S.templates.findIndex(x=>x.id===t.id)]=n;else S.templates.push(n);
  markAssetUpdates();delete S.editorDrafts?.[m.id||'new'];m.saved=true;persist();const back=m.returnDeployment;closeModal();render();if(back)returnToDeployment(back,n.id);toast('配置已保存，可用于部署项目；已有项目需另行采用和应用。','success');break;
 }
  }
});

document.addEventListener('change',event=>{if(event.target.id==='tpl-type'&&ui.modal?.kind==='templateedit'){syncTemplateEditorDraft();renderModal();}});
