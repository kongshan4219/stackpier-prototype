'use strict';

function programEditor(m){
 if(m.id&&!m.original)m.original=clone(S.programs.find(binary=>binary.id===m.id)||null);
 const impact=m.id?assetReferences(m.id):null,impactBody=impact?notice('替换影响范围',`当前配置：${impact.configurations.map(item=>item.template.name+' C'+item.template.rev).join('、')||'无'}；已应用项目：${impact.projects.map(item=>item.project.name).join('、')||'无'}。替换产生新内容修订，原配置固定修订及所有已部署项目保持原版本。`,'warning'):'';
 layout(m.id?'替换文件':'上传文件','选择任意文件后自动分析，点击保存确认文件名。',`${impactBody}<label class="file-drop program-drop" data-program-drop="true" for="bin-file">${I('upload')}<strong id="program-selected-name">${h(m.analysis?.sourceName||'选择文件')}</strong><span class="small">点击选择，或将文件拖到这里</span><input id="bin-file" name="bin-file" type="file" aria-label="选择文件" aria-describedby="program-file-status"><span id="program-file-status" class="small" role="status" aria-live="polite"></span></label>`,btn('取消','closemodal')+'<button id="program-upload-save" class="btn primary" type="submit" disabled>保存</button>',false,'programupload');
 updateProgramUpload(m);
}

function programAnalysisLabel(analysis){return analysis.kind==='elf'?`${analysis.arch} · ELF 程序`:`通用 · ${analysis.mediaType||analysis.format}`;}

function updateProgramUpload(m){
 if(ui.modal!==m)return;
 const status=document.getElementById('program-file-status'),save=document.getElementById('program-upload-save');
 if(status)status.textContent=m.busy?'正在分析文件并校验内容…':m.analysis?`已识别 ${programAnalysisLabel(m.analysis)} · ${m.analysis.size}`:'支持任意类型；ELF 自动识别架构，其他文件适用于所有架构。';
 if(save)save.disabled=m.busy||!m.analysis;
}

async function selectProgramFile(files){
 const m=ui.modal;
 if(m?.kind!=='programupload')return;
 const request={};m.request=request;m.analysis=null;m.filename=undefined;m.busy=false;
 const error=document.getElementById('modal-error');if(error)error.hidden=true;
 const selected=document.getElementById('program-selected-name');if(selected)selected.textContent=files?.[0]?.name||'选择文件';
 if(files?.length!==1){updateProgramUpload(m);modalError('请一次选择一个文件。');return;}
 m.busy=true;updateProgramUpload(m);
 try{
  const analysis=await programAnalysisTimeout(analyzeProgramFile(files[0]));
  // 关闭弹窗、重新选择或跳到其他弹窗之后，旧读取结果不可回写。
  if(ui.modal!==m||m.request!==request)return;
  const problem=programUploadError({...m,analysis});
  if(problem)throw new Error(problem);
  m.analysis=analysis;
 }catch(err){
  if(ui.modal===m&&m.request===request)modalError(err.message||'文件分析失败，请重新选择。');
 }finally{
  if(ui.modal===m&&m.request===request){m.busy=false;updateProgramUpload(m);}
 }
}

function programNameEditor(m){
 const draft=m.draft,analysis=draft?.analysis;
 if(!analysis){closeModal();return;}
 layout('确认文件名',`${programAnalysisLabel(analysis)} · ${analysis.size}`,field('bin-filename','文件名',draft.filename??analysis.sourceName,'不同适用范围可使用相同文件名。','text','required autofocus'),btn('返回','program-upload-back')+'<button class="btn primary" type="submit">确认保存</button>',false,'programname');
}

function projectUsesStoredFile(project,file,files){
 const server=sr(project.server);
 if(executableFileFor(project.cfg.program,server,files)?.id===file.id)return true;
 return project.cfg.fileMappings?.some(mapping=>deploymentFileFor(mapping.file||mapping.program,server,files)?.id===file.id);
}

function saveProgramFile(m,filename){
 if(ui.modal!==m||m.kind!=='programname')return;
 const draft=m.draft,problem=programNameError(filename)||programUploadError(draft);
 if(problem){modalError(problem);return;}
 const analysis=draft.analysis,name=draft.original?.name||filename;
 const collision=S.programs.find(binary=>binary.id!==draft.id&&storedFileArchitecture(binary)===analysis.arch&&(binary.filename===filename||binary.name===name&&(!draft.original?.groupId||binary.groupId===draft.original.groupId)));
 if(collision){modalError(`“${collision.name}”在 ${storedFileArchitectureLabel(analysis)} 范围已有文件，请更换文件名，或从列表选择“替换文件”。`);return;}
 const original=draft.original;
 const binary={id:draft.id||uid('bin'),name,filename,...analysis,time:now(),identity:`sha256:${analysis.sha256}`,revision:Math.max(original?.revision||0,...(original?.revisions||[]).map(item=>item.revision))+1,groupId:original?.groupId||assetGroups().find(group=>group.name===name)?.id||uid('asset')};
 binary.revisions=[...(original?.revisions||[]),clone(binary)];
 const programs=draft.id?S.programs.map(item=>item.id===draft.id?binary:item):[...S.programs,binary];
 const projects=S.projects.map(project=>projectUsesStoredFile(project,binary,programs)?{...project,programUpdate:true}:project);
 const next={...S,programs,projects};
 // 只保存识别结果和摘要；先写浏览器记录，失败时保留原状态与确认弹窗。
 try{localStorage.setItem(STORE,JSON.stringify(next));}catch{storageOK=false;modalError('保存失败，浏览器存储不可用或空间不足。请释放空间后重试。');return;}
 S=next;storageOK=true;if(draft.returnEditor&&Number.isInteger(draft.selectMappingIndex)){const old=draft.returnEditor.fileMappings[draft.selectMappingIndex];draft.returnEditor.fileMappings[draft.selectMappingIndex]=pinMapping({...old,file:binary.name,groupId:binary.groupId,pins:undefined});}markAssetUpdates();persist();closeModal();render();toast('文件记录已保存。','success');
}

registerPrototypeHandlers(prototypeModals,['programupload','programname'],m=>m.kind==='programupload'?programEditor(m):programNameEditor(m));

registerPrototypeHandlers(prototypeForms,['programupload','programname'],function(event,form,fd,get,has,all,m){
 if(m?.kind==='programupload'&&form.dataset.form==='programupload'){
  const problem=programUploadError(m);
  if(problem){modalError(problem);return;}
  openModal('programname',{draft:m});
 }else if(m?.kind==='programname'&&form.dataset.form==='programname')saveProgramFile(m,get('bin-filename'));
});

registerPrototypeHandlers(prototypeActions,['program-upload-back'],()=>{
 if(ui.modal?.kind!=='programname')return;
 const draft=ui.modal.draft;
 openModal('programupload',{id:draft.id,original:draft.original,analysis:draft.analysis,filename:document.getElementById('bin-filename').value,returnEditor:draft.returnEditor,selectMappingIndex:draft.selectMappingIndex});
});

document.addEventListener('change',event=>{if(event.target.id==='bin-file')return selectProgramFile(event.target.files);});
document.addEventListener('dragover',event=>{if(event.target.closest('[data-program-drop]'))event.preventDefault();});
document.addEventListener('drop',event=>{
 if(!event.target.closest('[data-program-drop]'))return;
 event.preventDefault();return selectProgramFile(event.dataTransfer?.files);
});
