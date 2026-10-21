'use strict';

function configurationVersionSelect(id,label,kind,value,type){
 const versions=configurationVersions(kind,type),options=versions.map(file=>[configurationVersionValue({fileId:file.id,revision:file.revision}),file.name+' · '+(file.sha256?.slice(0,12)||'摘要未知 · R'+file.revision)]);
 if(value&&!options.some(([id])=>id===value))options.unshift([value,'固定版本已失效，请重新选择',true]);
 return select(id,label,[['',kind==='program'?'选择程序版本':'选择配置文件版本'],...options],value,'','required');
}
function configurationLegacySystemdNotice(t,v){
 const names=[v.programVersion,v.configVersion].map(value=>configurationVersion(value)?.name).filter(Boolean);
 return notice('旧版配置待重新填写',`${t.editorSchema===1?'旧配置使用固定程序和配置文件，需填写服务文件正文与本机路径映射。':'已有服务文件正文按原样载入；旧文件资产引用不能推导本机路径，请重新填写映射。'}${names.length?' 原固定文件：'+names.join('、')+'。':''}保存为新修订后才采用；历史修订和已有项目保持原样。`,'warning');
}
function templateEditor(m){
 const t=tpl(m.id),context=S.configurationEditorReturn;
 if(m.id&&!t)return layout('编辑部署配置','保存配置后再选择服务器部署；已有项目保留各自的固定版本。',notice('部署配置已不存在，请返回列表核对。','','error'),btn(m.returnDeployment?'返回部署':'关闭',m.returnDeployment?'deployment-config-return':'closemodal'));
 if(!m.editor){
  const type=t?deploymentType(t):m.initialType||context?.type||'systemd';
  m.editor=clone(configurationDrafts.get(configurationDraftKey(m.id,type))||configurationInitial(t,type));
  if(!m.returnDeployment&&context&&context.id===(m.id||''))m.returnDeployment=clone(context.selection);
 }
 const v=m.editor;
 let body=field('tpl-name','配置名称',v.name,'','text','required maxlength="100"')+
  select('tpl-type','配置类型',Object.entries(configurationNames),v.type,'',m.id?'disabled':'')+
  (m.id?`<p class="muted">正在编辑 C${v.revision}；保存生成新修订，已有项目与操作不自动采用。</p>`:'');
 if(v.type==='frp')body+=configurationVersionSelect('tpl-program','FRP 程序固定版本','program',v.programVersion,v.type);
 // HTML 会忽略 textarea 起始标签后的首个换行，先补一行以保留正文原有换行。
 if(v.type==='systemd')body+=(v.legacySystemd?configurationLegacySystemdNotice(t,v):'')+
  area('tpl-source','服务文件正文',v.source,'',12).replace('<textarea ','<textarea required ').replace(/(<textarea\b[^>]*>)/,'$1\n')+
  '<p class="muted">正文按原样保存，部署时写入以服务名称命名的 .service 文件。请使用目标服务器上的实际路径。</p>'+
  configurationMappingFields(v,m)+notice('部署成功条件','默认核验 systemd 服务运行状态；业务健康检查后续单独配置。');
 if(v.type==='compose')body+=area('tpl-source','Compose YAML 正文',v.source,'',12).replace('<textarea ','<textarea required ')+area('tpl-variables','显式变量（JSON）',v.variables,'',4)+
  '<p class="muted">仅支持显式字符串变量；变量值与文件内容不出现在操作记录中。</p>'+
  configurationMappingFields(v,m)+
  (v.files.length?'<p class="muted">旧版附件保留固定内容；迁移到路径映射后可移除。</p>':'')+
  v.files.map(file=>`<div class="configuration-file"><code>${h(file.path)}</code><span>${file.size} B</span>${btn('移除 '+file.path,'configuration-file-remove',{path:file.path},'small')}</div>`).join('');
 if(v.type==='frp')body+=configurationFrpFields(v,!!m.id,m.token||'');
 const footer=(m.returnDeployment?btn('返回部署（不保存）','deployment-config-return'):btn('取消','closemodal'))+
  `<button class="btn primary" type="submit" ${m.uploading||m.saving?'disabled':''}>${m.saving?'正在保存…':m.uploading?'正在读取文件…':m.returnDeployment?'保存并返回部署':'保存部署配置'}</button>`;
 layout(m.id?'编辑部署配置':'新增部署配置','保存配置后再选择服务器部署；已有项目保留各自的固定版本。',`<div class="configuration-editor">${body}</div>`,footer,false,'templateedit');
 dialog.classList.add('configuration-dialog');cacheTemplateDraft();
}
registerPrototypeHandlers(prototypeModals,['templateedit'],m=>templateEditor(m));
document.addEventListener('input',event=>{if(event.target.id==='fc-token'&&ui.modal?.kind==='templateedit')ui.modal.token=event.target.value;});

function configurationFileSummary(t){return t.editorSchema?(t.type==='compose'||t.type==='systemd'&&!t.frpRole&&t.editorSchema===2?(t.pathMappings?.length||0)+' 项文件／目录映射':'程序 / 配置固定版本'):fileMappingSummary(t.fileMappings);}
function configurationSavedDetail(template,record,projects){
 const pinRow=(title,ref)=>{const pin=ref?.pins?.[0],file=pin&&assetRevision(pin.fileId,pin.revision);return [title,file?h(file.name)+' · R'+pin.revision+' '+btn('查看文件','asset-file',{id:pin.fileId,revision:pin.revision},'small ghost'):'固定版本已失效'];};
 const rows=[['运行方式',configurationNames[deploymentType(record)]],['配置修订','C'+record.rev]];
 const unit=record.type==='systemd'&&!record.frpRole&&record.editorSchema===2;
 if(unit)rows.push(['部署成功条件','默认核验 systemd 服务运行状态；业务健康检查后续单独配置。']);
 else if(record.type==='systemd'&&!record.frpRole)rows.push(pinRow('程序固定版本',record.programRef),pinRow('配置固定版本',record.configRef),['健康检查',`GET 127.0.0.1:${record.port}/health`]);
 if(record.frpRole)rows.push(pinRow('FRP 程序固定版本',record.programRef),['服务角色',frpRoles[record.frpRole]],['控制端点',h(record.frpParameters.controlAddr)+':'+record.frpParameters.controlPort],['回环管理端口',record.frpParameters.adminPort]);
 const content=unit||record.type==='compose'?`<h3>${unit?'服务文件正文':'Compose YAML 正文'}</h3><pre class="code asset-text">${h(record.tpl)}</pre><h3>文件与目录映射</h3>${configurationMappingSummary(record.pathMappings||[])||'<p class="muted">未配置文件或目录映射。</p>'}${record.type==='compose'?`<p>旧版附件 · ${(record.composeFiles||[]).length}</p>${(record.composeFiles||[]).map(file=>`<code>${h(file.path)} · ${file.size} B</code>`).join('')}`:''}`:'';
 return `<div class="stack">${select('asset-template-revision','配置历史修订',template.revisions.map(item=>[item.rev,'C'+item.rev]),record.rev)}${detail(rows)}${content}<h3>关联项目 · ${projects.length}</h3>${projects.map(p=>btn(p.name+' · '+sname(p.server),'asset-project',{id:p.id},'ghost')).join('')}${notice('公共配置不会自动部署','已有项目与操作保留各自的固定版本。')}${btn('编辑公共配置','asset-edit-template',{id:template.id},'primary')}</div>`;
}
