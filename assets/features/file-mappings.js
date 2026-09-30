'use strict';

// 原型只保存文件元数据；文件内容、符号链接及远端上传均不在浏览器内执行。
function fileLibraryPath(file){return `bin/files/${file.id}--${file.filename}`;}
function projectFileLink(project,mapping){return `bin/projects/${project.id}/${mapping.id}--${mapping.filename}`;}
function programArchitecture(value){return value==='any'?'通用文件':value;}
// 旧 FRP 样例首次进入程序页会迁出，不允许新映射引用这一临时占位。
function mappingFileAvailable(file){return !file.placeholder&&!(file.id==='bin3'&&file.identity==='demo-frpc-a'&&file.filename==='frpc-linux-x86_64');}
function mappingDraft(m){
 if(!m.fileMappings)m.fileMappings=clone(tpl(m.id)?.fileMappings||[]);
 return m.fileMappings;
}
function captureTemplateDraft(m){
 const value=id=>document.getElementById(id)?.value;
 m.templateDraft={name:value('tpl-name')??'',type:value('tpl-type')??'compose',tpl:value('tpl-source')??''};
 for(const row of mappingDraft(m)){
  row.targetPath=value(`map-path-${row.id}`)??row.targetPath;
  row.fileId=value(`map-file-${row.id}`)??row.fileId;
 }
}
function mappingRow(row,index){
 const library=S.programs.filter(mappingFileAvailable);
 if(row.upload)library.push(row.upload);
 return `<section class="mapping-row" aria-label="文件映射 ${index+1}"><div class="mapping-row-head"><strong>映射 ${index+1}</strong>${btn('移除','mappingremove',{id:row.id},'small ghost')}</div>
 <div class="field-row"><div class="field"><label for="map-file-${h(row.id)}">程序文件</label><div class="mapping-file-control"><select id="map-file-${h(row.id)}" name="map-file-${h(row.id)}"><option value="">请选择文件</option>${library.map(file=>`<option value="${h(file.id)}" ${file.id===row.fileId?'selected':''}>${h(file.name)} · ${h(file.filename)} · ${h(programArchitecture(file.arch))}</option>`).join('')}</select>${btn('上传','mappingupload',{id:row.id},'','upload')}<input type="file" id="map-upload-${h(row.id)}" data-mapping-upload="${h(row.id)}" hidden></div><small>上传后自动选中，保存配置时同步到程序文件。</small></div>
 ${field(`map-path-${row.id}`,'目标服务器文件路径',row.targetPath||'','填写包含文件名的绝对路径。','text','placeholder="/srv/my-app/config/app.yaml" required')}</div>
 </section>`;
}
function fileMappingEditor(m){
 const rows=mappingDraft(m);
 return `<section class="file-mapping-editor"><div class="mapping-section-head"><div><h3>文件映射 <span class="muted">${rows.length?`· ${rows.length}`:''}</span></h3><p class="small muted">选择文件，并指定部署到目标服务器的位置。</p></div>${btn('添加文件映射','mappingadd',{},'small','plus')}</div>
 <div class="mapping-list">${rows.map(mappingRow).join('')||'<div class="mapping-empty">尚未添加映射。可添加程序、配置或其他配套文件。</div>'}</div>
 <p class="small muted mapping-note">文件统一存放在控制器，项目目录通过符号链接引用；部署时上传文件内容。直接上传在保存配置时登记，取消不新增文件。</p></section>`;
}
function prepareFileMappings(m){
 const files=[],rows=[],targets=new Set();
 for(const row of mappingDraft(m)){
  const targetPath=(row.targetPath||'').trim();
  if(!targetPath.startsWith('/')||targetPath.endsWith('/')||/[\u0000-\u001f\u007f]/.test(targetPath)||targetPath.split('/').slice(1).some(part=>!part||part==='.'||part==='..'))throw new Error('目标路径须为包含文件名的绝对路径，不能含空路径段、. 或 ..。');
  if(targets.has(targetPath))throw new Error('同一配置不能将多个文件映射到同一个目标路径。');
  targets.add(targetPath);
  const uploaded=row.upload?.id===row.fileId;
  const file=uploaded?row.upload:S.programs.find(file=>file.id===row.fileId&&mappingFileAvailable(file));
  if(!file)throw new Error('请为每条映射选择有效的程序文件。');
  if(/[\\/\u0000-\u001f\u007f]/.test(file.filename)||['.','..'].includes(file.filename))throw new Error('文件名不能包含路径分隔符或控制字符。');
  if(uploaded)files.push(file);
  rows.push({id:row.id,fileId:file.id,filename:file.filename,identity:file.identity,targetPath});
 }
 return {files,rows};
}
function fileMappingSummary(rows,project){
 if(!rows?.length)return '';
 return `<section class="card mapping-summary"><div class="card-head"><h2>文件映射</h2><span class="small muted">${rows.length} 个文件</span></div><div class="card-body mapping-summary-list">${rows.map(row=>`<div><strong>${h(row.filename)}</strong><p class="small mono">→ ${h(row.targetPath)}</p>${project?`<p class="cell-sub mono">本地链接：${h(projectFileLink(project,row))}</p>`:''}</div>`).join('')}<p class="small muted">仅保存映射；部署时才向目标服务器上传文件内容。</p></div></section>`;
}
function projectFileDirectories(){
 const projects=S.projects.filter(project=>project.cfg.fileMappings?.length);
 return card('项目文件目录',`<p class="small muted">控制器本地的目录示意。每个项目单独建目录，链接到总目录中的文件。</p>${projects.length?projects.map(project=>`<div class="project-file-directory"><div class="flex"><strong>${h(project.name)}</strong>${btn('查看项目','project',{id:project.id},'small ghost','arrow')}</div><code>bin/projects/${h(project.id)}/</code>${project.cfg.fileMappings.map(row=>{const file=S.programs.find(item=>item.id===row.fileId);return `<div class="file-link-row"><span class="mono">${h(row.id)}--${h(row.filename)}</span><span class="small mono">↳ ${h(file?fileLibraryPath(file):'源文件缺失')}</span><span class="small muted">部署目标：${h(row.targetPath)}</span></div>`;}).join('')}</div>`).join(''):'<div class="mapping-empty">项目采用带有文件映射的配置后，会在这里显示项目子目录和链接。</div>'}`);
}
registerPrototypeHandlers(prototypeActions,['mappingadd','mappingremove','mappingupload'],function(event,target,d,a){
 const m=ui.modal;if(m?.kind!=='templateedit')return;
 if(a==='mappingupload'){document.getElementById(`map-upload-${d.id}`)?.click();return;}
 captureTemplateDraft(m);
 if(a==='mappingadd')mappingDraft(m).push({id:uid('mapping'),fileId:'',targetPath:''});
 else m.fileMappings=mappingDraft(m).filter(row=>row.id!==d.id);
 renderModal();
 if(a==='mappingadd')document.getElementById(`map-file-${m.fileMappings.at(-1).id}`)?.focus();
 else document.querySelector('[data-action="mappingadd"]')?.focus();
});
document.addEventListener('change',event=>{
 const el=event.target,m=ui.modal;if(m?.kind!=='templateedit')return;
 const id=el.dataset.mappingUpload;if(!id||!el.files?.[0])return;
 captureTemplateDraft(m);const row=mappingDraft(m).find(row=>row.id===id);if(!row)return;
 const file=el.files[0];row.upload={id:uid('file'),name:file.name,filename:file.name,arch:'any',size:`${(file.size/1024).toFixed(1)} KB`,time:now(),identity:uid('content')};
 row.fileId=row.upload.id;
 renderModal();document.getElementById(`map-file-${id}`)?.focus();
});
