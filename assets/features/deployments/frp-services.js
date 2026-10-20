'use strict';

// 部署配置固定角色参数；首次部署表单只选择配置，不另存一份参数副本。
function frpDeploymentDefaults(t,role=t?.frpRole||'server'){
 const base=tpl('frp-template-'+role),source=clone(t?.frpSource||base?.frpSource||frpSettingsSnapshot());
 return {name:t?.name||'',role,programRef:clone(t?.programRef||base?.programRef||null),inputs:clone(t?.frpInputs||{bind:'127.0.0.1',port:7000,serverService:'',connection:''}),source};
}
function frpDeploymentEditor(m){
 const t=tpl(m.id),cached=S.frpDeploymentDrafts?.[m.id||'new'];m.frpEditor||=cached?clone(cached):frpDeploymentDefaults(t);const v=m.frpEditor,source=v.source,role=v.role,prefix=frpPrefixes[role];
 if(m.editor?.name)v.name=m.editor.name;
 const parameters=role==='server'?`<div class="field-row">${field('fc-bind','FRPS 监听地址',v.inputs.bind,'','text','required')}${field('fc-port','FRPS 控制端口',v.inputs.port,'','number','required min="1" max="65535"')}</div>`:role==='client'?select('fc-server','连接到已部署 FRPS',frpServiceOptions('server'),v.inputs.serverService,'选择固定服务实例，部署时核对其有效性。','required'):select('fc-connection','STCP visitor 配置来源',[['','请选择包含 STCP 的连接'],...S.frp.nodes.filter(n=>n.proxies.some(x=>x.type==='stcp')).map(n=>[n.id,sname(n.provider)+' → '+n.ip])],v.inputs.connection,'部署目标必须是对应 FRPS 主机。','required');
 const programs=assetGroups().filter(g=>g.id===v.programRef?.groupId||g.files.some(f=>storedFileKind(f)==='elf'));
 layout(m.id?'编辑 FRP 部署配置':'新增 FRP 部署配置','角色参数和生成模板统一保存在此配置中；保存不会部署服务。',`<div class="stack">${field('fc-name','配置名称',v.name,'','text','required autofocus')}<div class="field-row">${select('fc-role','FRP 服务角色',Object.entries(frpRoles),role,'已有项目使用时不能更换角色。')}${select('fc-program','程序文件',[['','请选择程序文件'],...programs.map(g=>[g.id,g.name+' · '+g.files.map(f=>storedFileArchitectureLabel(f)).join(' / ')])],v.programRef?.groupId,'保存固定修订，部署时核对架构和文件。','required')}</div>${parameters}<div class="field-row">${field('fc-root','部署根目录',source.root,'','text','required')}${field('fc-user','运行用户',source.user,'','text','required')}</div>${field('fc-token','认证 Token','','留空保留当前值；仅接受 EXAMPLE_ 或 DEMO_ 开头的虚构值。','password')}${notice('公共配置影响范围',templateProjects(m.id).map(p=>p.name).join('、')||'尚无关联项目')}<details><summary>生成模板与 systemd 目录</summary><div class="stack mt">${field('fc-systemd-dir','systemd 目录',source.systemdDir)}${configurationSourceField('fc-toml','TOML 模板',source.templates[prefix+'.toml.tpl']||'')}${configurationSourceField('fc-unit','systemd unit 模板',source.templates[prefix+'.service.tpl']||'')}</div></details><p class="small muted">FRP 连接与 TCP / STCP 映射继续在「FRP」中管理。</p></div>`,(m.returnDeployment?btn('返回部署，保留草稿','deployment-config-return'):btn('取消','closemodal'))+(!m.id?btn('更换配置类型','configuration-type-reset'): '')+`<button class="btn primary" type="submit">${m.returnDeployment?'保存并返回部署':'保存配置'}</button>`,true,'frpdeploymentconfig');
 cacheTemplateDraft();
}
function readFrpDeploymentEditor(m,fd){
 const v=clone(m.frpEditor),prefix=frpPrefixes[v.role],get=(key,fallback='')=>String(fd.get(key)??fallback).trim();
 v.name=get('fc-name',v.name);v.inputs={bind:get('fc-bind',v.inputs.bind),port:Number(get('fc-port',v.inputs.port)),serverService:get('fc-server',v.inputs.serverService),connection:get('fc-connection',v.inputs.connection)};
 const group=assetGroups().find(g=>g.id===get('fc-program',v.programRef?.groupId));
 if(!group&&fd.has('fc-program'))v.programRef=null;
 if(group&&group.id!==v.programRef?.groupId)v.programRef={groupId:group.id,architectureRule:'auto',pins:group.files.map(f=>({fileId:f.id,revision:f.revision}))};
 Object.assign(v.source,{root:get('fc-root',v.source.root),user:get('fc-user',v.source.user),systemdDir:get('fc-systemd-dir',v.source.systemdDir)});
 for(const [field,suffix] of [['fc-toml','.toml.tpl'],['fc-unit','.service.tpl']])v.source.templates[prefix+suffix]=String(fd.get(field)??v.source.templates[prefix+suffix]);
 return v;
}
function cacheFrpDeploymentEditor(){
 const m=ui.modal,form=dialog.querySelector('form[data-form="frpdeploymentconfig"]');if(m?.kind!=='templateedit'||!form)return;
 m.frpEditor=readFrpDeploymentEditor(m,new FormData(form));m.editor={name:m.frpEditor.name,type:'frp'};
 S.frpDeploymentDrafts||={};S.frpDeploymentDrafts[m.id||'new']=clone(m.frpEditor);persist();
}
document.addEventListener('input',event=>{if(event.target.closest('form[data-form="frpdeploymentconfig"]'))cacheFrpDeploymentEditor();});
document.addEventListener('change',event=>{
 if(!event.target.closest('form[data-form="frpdeploymentconfig"]'))return;cacheFrpDeploymentEditor();
 if(event.target.id==='fc-role'){
  const m=ui.modal,role=event.target.value;if(!frpRoles[role])return;
  if(templateProjects(m.id).length){event.target.value=m.frpEditor.role;return modalError('已有项目使用此配置，不能更换角色，请新增一份配置。');}
  const next=frpDeploymentDefaults(null,role);next.name=m.frpEditor.name;m.frpEditor=next;renderModal();cacheFrpDeploymentEditor();
 }
});
registerPrototypeHandlers(prototypeForms,['frpdeploymentconfig'],function(event,form,fd,get,has,all,m){
 const t=tpl(m.id),v=readFrpDeploymentEditor(m,fd),token=String(fd.get('fc-token')||'');
 if(!v.name)return modalError('请填写配置名称。');
 if(t&&templateProjects(t.id).length&&(t.frpRole!==v.role))return modalError('已有项目使用此配置，不能更换运行方式或角色。');
 if(v.role==='server'&&(!validIPv4(v.inputs.bind)&&!validIPv6(v.inputs.bind)||!Number.isInteger(v.inputs.port)||v.inputs.port<1||v.inputs.port>65535))return modalError('监听 IP 与控制端口无效。');
 if(v.role==='client'&&!frpServiceProject(v.inputs.serverService,'server'))return modalError('请选择已部署的 FRPS 服务。');
 if(v.role==='visitor'&&!frpNode(v.inputs.connection)?.proxies.some(p=>p.type==='stcp'))return modalError('请选择包含 STCP 映射的连接。');
 if(!v.programRef?.pins?.length)return modalError('请选择程序文件。');
 if([v.source.root,v.source.systemdDir].some(path=>targetFilePathError(path+'/check')))return modalError('请填写规范的绝对目录。');
 if(!v.source.user)return modalError('请填写运行用户。');
 if(token&&!/^(EXAMPLE_|DEMO_)[A-Za-z0-9_.-]+$/.test(token))return modalError('原型只接受 EXAMPLE_ 或 DEMO_ 开头的虚构 Token。');
 if(token)v.source.token=token;
 const prefix=frpPrefixes[v.role];if(!v.source.templates[prefix+'.toml.tpl']?.trim()||!v.source.templates[prefix+'.service.tpl']?.trim())return modalError('TOML 与 systemd 模板不能为空。');
 try{for(const suffix of ['.toml.tpl','.service.tpl'])frpValidateTemplate(prefix+suffix,v.source.templates[prefix+suffix]);}catch(error){return modalError(error.message);}
 const n={...t,id:t?.id||uid('template'),name:v.name,type:'systemd',software:frpProgramName(v.role),frpRole:v.role,frpInputs:v.inputs,frpSource:v.source,deploymentConfig:true,program:frpProgramName(v.role),programRef:v.programRef,tpl:v.source.templates[prefix+'.service.tpl'],fileMappings:[],rev:(t?.rev||0)+1,desc:'FRP 角色参数与固定程序配置'};
 n.revisions=[...(t?.revisions||[]),clone({...n,revisions:undefined})];if(t)S.templates[S.templates.findIndex(item=>item.id===t.id)]=n;else S.templates.push(n);
 delete S.frpDeploymentDrafts?.[m.id||'new'];delete S.editorDrafts?.[m.id||'new'];m.saved=true;markAssetUpdates();persist();const back=m.returnDeployment;closeModal();render();if(back)returnToDeployment(back,n.id);toast('FRP 部署配置已保存。','success');
});

registerPrototypeHandlers(prototypeActions,['configuration-type-reset'],()=>{const m=ui.modal;if(m?.kind!=='templateedit'||m.id)return;cacheFrpDeploymentEditor();m.editor={name:m.frpEditor.name,type:'compose',source:'',variables:'{}'};m.fileMappings=[];renderModal();});
