'use strict';

function configurationVersionSelect(id,label,kind,value,type){
 const versions=configurationVersions(kind,type),options=versions.map(file=>[configurationVersionValue({fileId:file.id,revision:file.revision}),file.name+' · '+(file.sha256?.slice(0,12)||'摘要未知 · R'+file.revision)]);
 if(value&&!options.some(([id])=>id===value))options.unshift([value,'固定版本已失效，请重新选择',true]);
 return select(id,label,[['',kind==='program'?'选择程序版本':'选择配置文件版本'],...options],value,'','required');
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
 if(v.type!=='compose')body+=configurationVersionSelect('tpl-program',v.type==='frp'?'FRP 程序固定版本':'程序固定版本','program',v.programVersion,v.type);
 if(v.type==='systemd')body+=configurationVersionSelect('tpl-config','配置固定版本','config',v.configVersion,v.type)+field('tpl-port','健康检查端口',v.port,'','number','required min="1024" max="65535"')+notice('程序须通过 STACKPIER_CONFIG 读取配置，并在所填回环端口提供 /health。');
 if(v.type==='compose')body+=area('tpl-source','Compose YAML 正文',v.source,'',12).replace('<textarea ','<textarea required ')+area('tpl-variables','显式变量（JSON）',v.variables,'',4)+
  '<p class="muted">仅支持显式字符串变量；变量值与文件内容仅在配置编辑时读取，不出现在操作记录中。</p>'+
  '<div class="field"><label for="tpl-files">附加文件</label><input id="tpl-files" type="file" multiple '+(m.uploading?'disabled':'')+'></div>'+
  '<p class="muted">Compose 中使用 ./files/文件名 只读挂载；同名上传替换当前草稿中的文件。</p>'+
  v.files.map(file=>`<div class="configuration-file"><code>${h(file.path)}</code><span>${file.size} B</span>${btn('移除 '+file.path,'configuration-file-remove',{path:file.path},'small')}</div>`).join('')+
  (!t?.editorSchema&&t?.fileMappings?.length?notice('历史文件映射需要重新选择','已有绝对路径映射保留在历史修订。保存新修订前，请将所需文件通过“附加文件”重新上传。','warning'):'');
 if(v.type==='frp')body+=configurationFrpFields(v,!!m.id,m.token||'');
 const footer=(m.returnDeployment?btn('返回部署（不保存）','deployment-config-return'):btn('取消','closemodal'))+
  `<button class="btn primary" type="submit" ${m.uploading||m.saving?'disabled':''}>${m.saving?'正在保存…':m.uploading?'正在读取文件…':m.returnDeployment?'保存并返回部署':'保存部署配置'}</button>`;
 layout(m.id?'编辑部署配置':'新增部署配置','保存配置后再选择服务器部署；已有项目保留各自的固定版本。',`<div class="configuration-editor">${body}</div>`,footer,false,'templateedit');
 dialog.classList.add('configuration-dialog');cacheTemplateDraft();
}
registerPrototypeHandlers(prototypeModals,['templateedit'],m=>templateEditor(m));
document.addEventListener('input',event=>{if(event.target.id==='fc-token'&&ui.modal?.kind==='templateedit')ui.modal.token=event.target.value;});

function configurationFileSummary(t){return t.editorSchema?(t.type==='compose'?(t.composeFiles?.length||0)+' 项附加文件':'程序 / 配置固定版本'):fileMappingSummary(t.fileMappings);}
function configurationSavedDetail(template,record,projects){
 const pinRow=(title,ref)=>{const pin=ref?.pins?.[0],file=pin&&assetRevision(pin.fileId,pin.revision);return [title,file?h(file.name)+' · R'+pin.revision+' '+btn('查看文件','asset-file',{id:pin.fileId,revision:pin.revision},'small ghost'):'固定版本已失效'];};
 const rows=[['运行方式',configurationNames[deploymentType(record)]],['配置修订','C'+record.rev]];
 if(record.type==='systemd'&&!record.frpRole)rows.push(pinRow('程序固定版本',record.programRef),pinRow('配置固定版本',record.configRef),['健康检查',`GET 127.0.0.1:${record.port}/health`]);
 if(record.frpRole)rows.push(pinRow('FRP 程序固定版本',record.programRef),['服务角色',frpRoles[record.frpRole]],['控制端点',h(record.frpParameters.controlAddr)+':'+record.frpParameters.controlPort],['回环管理端口',record.frpParameters.adminPort]);
 return `<div class="stack">${select('asset-template-revision','配置历史修订',template.revisions.map(item=>[item.rev,'C'+item.rev]),record.rev)}${detail(rows)}${record.type==='compose'?`<h3>Compose YAML 正文</h3><pre class="code asset-text">${h(record.tpl)}</pre><p>附加文件 · ${record.composeFiles.length}</p>${record.composeFiles.map(file=>`<code>${h(file.path)} · ${file.size} B</code>`).join('')}`:''}<h3>关联项目 · ${projects.length}</h3>${projects.map(p=>btn(p.name+' · '+sname(p.server),'asset-project',{id:p.id},'ghost')).join('')}${notice('公共配置不会自动部署','已有项目与操作保留各自的固定版本。')}${btn('编辑公共配置','asset-edit-template',{id:template.id},'primary')}</div>`;
}
