'use strict';

const assetBaseCloseModal=closeModal;
closeModal=function(){
 const m=ui.modal;
 if(m?.kind==='templateedit'){if(!m.saved)cacheTemplateDraft();m.uploadSequence=(m.uploadSequence||0)+1;m.token='';configurationForgetContext();persist();}
 return assetBaseCloseModal();
};
const assetBaseReset=resetSample;
resetSample=function(...args){const result=assetBaseReset(...args);configurationDrafts.clear();configurationForgetContext();initializeAssets();persist();return result;};
document.addEventListener('input',event=>{if(event.target.closest('form[data-form=templateedit]'))cacheTemplateDraft();});
document.addEventListener('change',event=>{if(event.target.closest('form[data-form=templateedit]'))cacheTemplateDraft();});
function landingPreviewBody(project){
 const preview=deploymentLocation(project);
 return `<section class="landing-preview"><h3>部署落点预览 · 原型模拟</h3>${detail([['目标项目',h(project.name)],['目标服务器',h(sname(project.server)+' · '+(sr(project.server)?.arch||'未知'))],['公共配置修订','C'+(project.cfg.templateRev||'—')],['项目草稿','D'+(project.draftRev||1)],['unit 名称',h(project.type==='systemd'?project.name+'.service':'使用 Compose 项目名称')],['主部署文件',`<code>${h(preview.mainPath)}</code>`]])}${preview.files.map(mapping=>`<article class="asset-reference"><strong>${h(mappingName(mapping))}</strong><code>${h(mapping.targetPath)}</code><p class="small muted">源文件：${h(mapping.binary?.filename||'缺失')} → 目标文件：${h(mapping.targetPath.split('/').at(-1))}</p><p class="small muted">${mapping.binary?h(storedFileArchitectureLabel(mapping.binary)+' · 内容 R'+mapping.binary.revision):'缺少匹配架构 / 文件无效'}</p><code>${h(mapping.binary?.sha256||mapping.binary?.identity||'无内容身份')}</code>${mapping.binary?.provenance==='模拟二进制元数据'?'<p class="small muted">模拟二进制元数据，未验证真实内容或可执行性。</p>':''}</article>`).join('')}${preview.errors.map(message=>notice('阻止执行',message,'error')).join('')}${preview.warnings.map(message=>notice('可能覆盖的目标',message,'warning')).join('')}<details><summary>实际交付正文 · 原样保存</summary><pre class="code asset-text">${h(configText(project))}</pre></details>${project.frpService?frpProgramPreview(project.cfg.frpSnapshot):''}${notice('已保存配置预览','请核对正文中的名称和路径；需要修改时前往部署配置管理。此处只模拟落点，不执行 Compose 解析或真实写入。')}</section>`;
}
registerPrototypeHandlers(prototypeModals,['deploymentpreview','assetupdate'],function(m){
 if(m.kind==='deploymentpreview'){m.serverTarget||=serverOperationSnapshot(m.draft.server);const preview=deploymentLocation(m.draft);layout('确认模拟部署落点','核对目标和已保存的配置。全部成功核对后才建立服务项目。',landingPreviewBody(m.draft)+select('deploy-outcome','模拟部署结果',[['success','完成并核对'],['failed','明确失败'],['partial','部分完成'],['unknown','结果未知']],m.outcome||'success'),btn('返回选择','deployment-preview-back')+btn('前往部署配置管理','deployment-config-manage')+`<button class="btn primary" data-action="deployment-preview-execute" ${preview.errors.length?'disabled':''}>执行模拟部署</button>`,true);return;}
 const project=pr(m.id);if(!project)return closeModal();m.next=projectUpdateCfg(project);
 const versionHint=tpl(project.template)?.editorSchema?'采用公共配置中明确保存的固定文件版本。':'文件最新修订作为项目独立草稿映射采用，不改写公共配置的固定修订。';
 layout('查看可用更新 · '+project.name,'采用只修改这个项目的草稿；已应用参照和服务器读取结果保持不变；'+versionHint,`<div class="stack">${detail([['来源配置',h(tpl(project.template)?.name||'已删除')],['配置修订',`草稿 C${project.cfg.templateRev} → 公共 C${m.next.templateRev}`]])}<div class="diff-grid"><section><h3>当前项目草稿 · D${project.draftRev}</h3><pre class="code asset-text">${h(configText(project))}</pre>${fileMappingPreview(project.cfg.fileMappings)}<pre class="code">${h(projectMappingVersions(project.cfg))}</pre></section><section><h3>采用后的草稿</h3><pre class="code asset-text">${h(configText(project,m.next))}</pre>${fileMappingPreview(m.next.fileMappings)}<pre class="code">${h(projectMappingVersions(m.next))}</pre></section></div>${notice('只影响 '+project.name,'应用配置仍需从项目页面发起单独确认。其他项目不会随此次采用改变。')}</div>`,btn('取消','closemodal')+btn('采用到项目草稿','asset-update-adopt',{id:project.id},'primary'),true);
});
function projectMappingVersions(cfg){return (cfg.fileMappings||[]).map(mapping=>mappingName(mapping)+' · '+(mapping.pins||[]).map(pin=>{const file=assetRevision(pin.fileId,pin.revision);return (file?storedFileArchitectureLabel(file):'缺失')+' R'+pin.revision;}).join(' / ')).join('\n');}
registerPrototypeHandlers(prototypeActions,['deployment-preview-back','deployment-preview-execute','asset-update','asset-update-adopt'],function(event,target,data,action){
 if(action==='asset-update')return openModal('assetupdate',{id:data.id});
 if(action==='asset-update-adopt'){const project=pr(data.id);if(!project)return;adoptProjectUpdate(project);closeModal();render();toast('已采用到 '+project.name+' 的草稿，尚未应用。','success');return;}
 const m=ui.modal;if(m?.kind!=='deploymentpreview')return;
 if(action==='deployment-preview-back'){openModal('newproject',{...m.origin});return;}
 if(tpl(m.draft.template)?.rev!==m.draft.cfg.templateRev)return modalError('部署配置已更新，请返回选择并重新预览。');
 const targetError=serverSnapshotError(m.serverTarget);if(targetError)return modalError(targetError);
 if(sr(m.draft.server)?.arch!==m.serverArchitecture)return modalError('服务器架构在预览后改变，请返回重新预览。');
 const preview=deploymentLocation(m.draft);if(preview.errors.length)return modalError(preview.errors.join('；'));
 const outcome=document.getElementById('deploy-outcome')?.value||'success',draft=clone(m.draft);if(S.projects.some(project=>project.server===draft.server&&project.name===draft.name))return modalError('同名项目已存在，请返回重新选择。');m.saved=true;clearInteractionDraft('newproject');draft.id=uid('project');draft.creationPending=true;navigate('projects');startOperation(draft,'deploy',{},outcome,{newProject:true});
});
// 保留原有单独应用确认，在同一确认界面展示映射落点与明确阻塞原因。
const assetBaseOperationModal=operationModal;
operationModal=function(m){
 assetBaseOperationModal(m);const project=pr(m.id);if(!project||!['deploy','apply','update'].includes(m.op))return;
 const body=dialog.querySelector('.dialog-body');if(body){body.innerHTML=landingPreviewBody(project)+body.innerHTML;const button=dialog.querySelector('button[type="submit"]');if(button)button.disabled=deploymentLocation(project).errors.length>0;}
};
