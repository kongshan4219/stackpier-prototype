'use strict';

// 和正式编辑器一样，未保存正文只留在本页内存；持久状态只记录返回部署的标识。
const configurationDrafts=new Map();
const configurationNames={systemd:'systemd 项目',compose:'Compose 项目',frp:'FRP 服务'};
function configurationDraftKey(id,type){return id||'new:'+type;}
function configurationVersionValue(pin){return pin?pin.fileId+'@'+pin.revision:'';}
function configurationVersion(value){const at=String(value).lastIndexOf('@');return at>0?assetRevision(value.slice(0,at),Number(value.slice(at+1))):null;}
function configurationPin(value){
 const file=configurationVersion(value);if(!file)return null;
 return {groupId:assetById(file.id)?.groupId,architectureRule:storedFileArchitecture(file),pins:[{fileId:file.id,revision:file.revision}]};
}
function configurationVersions(kind,type){
 return S.programs.flatMap(file=>(file.revisions||[]).filter(version=>deployableFile(version)&&(kind==='program'?storedFileKind(version)==='elf'&&(type!=='frp'||storedFileArchitecture(version)==='x86_64'):storedFileKind(version)!=='elf')).map(version=>({...version,id:file.id})));
}
function configurationInitial(t,type='systemd'){
 const role=t?.frpRole||'server',config=t?.configRef||t?.fileMappings?.find(mapping=>mapping.pins?.some(pin=>storedFileKind(assetRevision(pin.fileId,pin.revision)||{})!=='elf'));
 return {name:t?.name||'',type:t?deploymentType(t):type,revision:t?.rev||0,programVersion:configurationVersionValue(t?.programRef?.pins?.[0]),configVersion:configurationVersionValue(config?.pins?.[0]),port:t?.port||18080,
  source:t?.tpl||'',variables:t?.variables||'{}',files:clone(t?.composeFiles||[]),mappings:clone(t?.pathMappings||[]),role,frp:configurationFrpDefaults(t,role)};
}
function readConfigurationDraft(m,fd){
 const v=clone(m.editor),value=(name,fallback)=>fd.has(name)?String(fd.get(name)):fallback;
 v.name=value('tpl-name',v.name);v.source=value('tpl-source',v.source);v.variables=value('tpl-variables',v.variables);
 v.mappings=(v.mappings||[]).map((row,i)=>({...row,kind:value('tpl-map-kind-'+i,row.kind),localPath:value('tpl-map-local-'+i,row.localPath),remotePath:value('tpl-map-remote-'+i,row.remotePath)}));
 v.programVersion=value('tpl-program',v.programVersion);v.configVersion=value('tpl-config',v.configVersion);v.port=Number(value('tpl-port',v.port));
 for(const [field,key] of [['fc-bind','controlAddr'],['fc-port','controlPort'],['fc-admin','adminPort'],['fc-start','allowedPortStart'],['fc-end','allowedPortEnd']])
  v.frp[key]=key==='controlAddr'?value(field,v.frp[key]):Number(value(field,v.frp[key]));
 return v;
}
function syncTemplateEditorDraft(override=null){
 const m=ui.modal,form=dialog.querySelector('form[data-form="templateedit"]');
 if(m?.kind==='templateedit'&&m.editor&&form&&!m.saving)m.editor=readConfigurationDraft(m,override||new FormData(form));
}
function cacheTemplateDraft(){
 const m=ui.modal;if(m?.kind!=='templateedit'||!m.editor||m.saved)return;
 syncTemplateEditorDraft();configurationDrafts.set(configurationDraftKey(m.id,m.editor.type),clone(m.editor));
 if(m.returnDeployment){S.configurationEditorReturn={id:m.id||'',type:m.editor.type,selection:clone(m.returnDeployment)};persist();}
}
function configurationForgetContext(){delete S.configurationEditorReturn;}
function configurationSwitchType(m,type){
 if(m.id||!configurationNames[type])return;
 cacheTemplateDraft();m.uploadSequence=(m.uploadSequence||0)+1;m.uploading=false;
 const next=clone(configurationDrafts.get(configurationDraftKey(null,type))||configurationInitial(null,type));
 if(!next.name)next.name=m.editor.name;m.editor=next;m.token='';configurationDrafts.set(configurationDraftKey(null,type),clone(next));renderModal();
}
document.addEventListener('change',event=>{
 const m=ui.modal;if(m?.kind!=='templateedit'||!m.editor)return;
 if(event.target.id==='tpl-type')configurationSwitchType(m,event.target.value);
 if(event.target.id==='fc-role'&&!m.id){
  syncTemplateEditorDraft();m.editor.role=event.target.value;m.editor.frp=configurationFrpDefaults(null,m.editor.role);m.token='';renderModal();cacheTemplateDraft();
 }
});
