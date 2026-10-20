'use strict';

function projectNameError(name){
 if(!name)return '请填写项目名。';
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(name))return '项目名须以英文字母开头，只能包含字母、数字、- 和 _，且不超过 63 个字符。';
 return '';
}

const deploymentTypes={systemd:{name:'systemd 项目',icon:'config',description:'选择程序与配置文件的部署配置。'},compose:{name:'Docker Compose',icon:'box',description:'选择已保存的 Compose 部署配置。'},frp:{name:'FRP 服务',icon:'link',description:'选择 FRPS、FRPC 或 visitor 部署配置。'}};
function deploymentType(template){return template?.frpRole?'frp':template?.type;}
function deploymentTypeModal(m){
 layout('部署项目','选择运行方式，再选择目标服务器和部署配置。',`<div class="deployment-types">${Object.entries(deploymentTypes).map(([type,item])=>`<button type="button" class="deployment-type" data-action="deployment-type" data-type="${type}"><span class="icon-box">${I(item.icon)}</span><span class="grow"><strong>${item.name}</strong><span class="small muted">${item.description}</span></span>${I('arrow')}</button>`).join('')}</div>`,btn('取消','closemodal'));
}
function deploymentConfigurationSummary(id){
 const t=tpl(id);if(!t)return '<p class="small muted">配置正文和文件在「部署配置」统一维护。</p>';
 return `<p class="small muted deployment-config-summary">已保存修订 C${t.rev} · ${t.frpRole?'程序资产与生成模板':t.fileMappings?.length?t.fileMappings.length+' 项附带文件':'无附带文件'}</p>`;
}
function newProjectSelection(m=ui.modal){
 return {deploymentType:m.deploymentType,template:document.getElementById('np-template')?.value??m.template??'',server:document.getElementById('np-server')?.value??m.server??'',name:document.getElementById('np-name')?.value??m.name??''};
}
function newProjectModal(m){
 const type=m.deploymentType===null?null:m.deploymentType||deploymentType(tpl(m.template));if(!deploymentTypes[type])return deploymentTypeModal(m);m.deploymentType=type;
 const templates=S.templates.filter(item=>deploymentType(item)===type),template=templates.some(item=>item.id===m.template)?m.template:'',server=m.server??selectedServer();
 const body=`<div class="stack"><div class="between wrap"><span class="tag">${deploymentTypes[type].name}</span>${btn('更换类型','deployment-type-back',{},'small ghost')}</div>${select('np-server','目标服务器',[['','请选择目标服务器'],...S.servers.map(item=>[item.id,item.name+' / '+item.arch])],server,'','required autofocus')}${field('np-name','服务名称',m.name||'', '以英文字母开头，可包含数字、- 和 _。','text','required pattern="[A-Za-z][A-Za-z0-9_-]{0,62}"')}${select('np-template','部署配置',[['','请选择部署配置'],...templates.map(item=>[item.id,item.name+' · C'+item.rev])],template,'仅显示当前类型的配置。','required')}${templates.length?'':notice('尚无此类型的部署配置','先保存一份配置，再返回这里部署。','warning')}<div id="deployment-config-summary">${deploymentConfigurationSummary(template)}</div><div>${btn('前往部署配置管理','deployment-config-manage',{},'small ghost','config')}</div>${serverOperationError(server)&&server?notice('目标暂不可操作',serverOperationError(server),'warning'):''}</div>`;
 layout('部署 '+deploymentTypes[type].name,'选择已保存的配置，检查部署落点后确认执行。',body,btn('取消','closemodal')+`<button class="btn primary" type="submit" ${templates.length?'':'disabled'}>检查并预览</button>`,false,'newproject');
 saveInteractionDraft(m);
}

registerPrototypeHandlers(prototypeModals,['newproject'],function(m){
 newProjectModal(m);
});

registerPrototypeHandlers(prototypeActions,['newproject'],function(event,target,data){
 openModal('newproject',{template:data.template,server:selectedServer(data.server),deploymentType:data.template?deploymentType(tpl(data.template)):null});
});

registerPrototypeHandlers(prototypeActions,['deployment-type','deployment-type-back','deployment-config-manage','deployment-config-return'],function(event,target,data,action){
 const m=ui.modal;
 if(action==='deployment-config-return')return returnToDeployment(m.returnDeployment);
 if(action==='deployment-type-back'){const selection=newProjectSelection(m);openModal('newproject',{...selection,deploymentType:null,template:null});return;}
 if(action==='deployment-type'){if(!deploymentTypes[data.type])return;openModal('newproject',{...m,deploymentType:data.type,template:deploymentType(tpl(m.template))===data.type?m.template:''});return;}
 const selection=m.kind==='deploymentpreview'?{...m.origin}:newProjectSelection(m);closeModal();navigate('templates');openModal('templateedit',{id:selection.template||undefined,initialType:selection.deploymentType,returnDeployment:selection});
});
function returnToDeployment(selection,template){
 if(!selection)return;const id=template||selection.template;closeModal();navigate('projects');openModal('newproject',{...selection,template:id, ...(tpl(id)?{deploymentType:deploymentType(tpl(id))}:{})});
}
document.addEventListener('change',event=>{if(event.target.id==='np-template'){const summary=document.getElementById('deployment-config-summary');if(summary)summary.innerHTML=deploymentConfigurationSummary(event.target.value);}});

function newProjectDraft(template,server,name){
 return {id:'preview-new',name,server:server.id,serverName:server.name,template:template.id,type:template.type,software:template.software,life:'draft',desired:'running',runtime:'na',health:'na',observed:null,lastCheck:null,cfg:{source:template.tpl,variables:template.variables||'{}',port:template.port??null,version:template.version,dataDir:`/srv/stackpier-demo/${name}/data`,env:template.env||'',templateRev:template.rev,appConfig:'logLevel = "info"',serviceUser:'app',program:template.program,programRef:clone(template.programRef||null),fileMappings:clone(template.fileMappings||[])},applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,dataStatus:'in-place',monitor:{hours:24,method:template.type,http:'',channels:[],inherit:true}};
}
registerPrototypeHandlers(prototypeForms,['newproject'],function(event,form,fd,get,has,all,m){
 const template=tpl(get('np-template')),server=sr(get('np-server')),name=get('np-name'),error=projectNameError(name);
 if(!template||!server)return modalError('请选择有效的配置和目标服务器。');if(m.deploymentType&&deploymentType(template)!==m.deploymentType)return modalError('部署配置与当前类型不匹配，请重新选择。');if(error)return modalError(error);
 if(S.projects.some(project=>project.server===server.id&&project.name===name))return modalError('这台服务器已存在同名项目，请更换项目名。');
 let draft=newProjectDraft(template,server,name);if(template.frpRole){try{draft=configureFrpServiceDraft(draft,fd,m);}catch(error){return modalError(error.message);}}openModal('deploymentpreview',{draft,serverArchitecture:server.arch,origin:{kind:'newproject',deploymentType:deploymentType(template),template:template.id,server:server.id,name}});
});
