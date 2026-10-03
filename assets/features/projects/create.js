'use strict';

function projectNameError(name){
 if(!name)return '请填写项目名。';
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(name))return '项目名须以英文字母开头，只能包含字母、数字、- 和 _，且不超过 63 个字符。';
 return '';
}

function newProjectModal(m){
 const template=m.template||S.templates[0]?.id||'',server=m.server||S.servers.find(item=>item.state==='online')?.id||S.servers[0]?.id||'';
 const body=`<div class="stack">${select('np-template','部署配置',S.templates.map(item=>[item.id,item.name+' · '+(item.type==='compose'?'Compose':'systemd')]),template,'','required autofocus')}${select('np-server','目标服务器',S.servers.map(item=>[item.id,item.name+' / '+item.arch]),server,'','required')}${field('np-name','项目名','', '以英文字母开头，可包含数字、- 和 _。','text','required pattern="[A-Za-z][A-Za-z0-9_-]{0,62}"')}</div>`;
 layout('部署项目','选择部署配置和目标服务器，填写项目名后开始部署。',body,btn('取消','closemodal')+'<button class="btn primary" type="submit">部署项目</button>',false,'newproject');
}

registerPrototypeHandlers(prototypeModals,['newproject'],function(m){
 newProjectModal(m);
});

registerPrototypeHandlers(prototypeActions,['newproject'],function(event,target,data){
 openModal('newproject',{template:data.template,server:data.server});
});

registerPrototypeHandlers(prototypeForms,['newproject'],function(event,form,fd,get){
 const templateId=get('np-template'),serverId=get('np-server'),name=get('np-name');
 const template=tpl(templateId),server=sr(serverId),nameError=projectNameError(name);
 if(!template){modalError('请选择有效的部署配置。');return;}
 if(!server){modalError('请选择有效的目标服务器。');return;}
 if(nameError){modalError(nameError);return;}
 if(S.projects.some(project=>project.server===serverId&&project.name===name)){modalError('这台服务器已存在同名项目，请更换项目名。');return;}
 if(template.software==='mysql'&&S.projects.some(project=>project.server===serverId&&project.template===template.id&&project.life!=='uninstalled')){modalError('同一服务器已有相同 MySQL 配置的项目。多实例须维护不同配置并核对端口、目录和名称。');return;}
 const desired='running',port=template.port??null,env=template.env||'';
 const cfg={...(template.contentMode==='file'?{source:template.tpl}:{}),port,version:template.version,dataDir:`/srv/stackpier-demo/${name}/data`,env,templateRev:template.rev,appConfig:'logLevel = "info"',serviceUser:'app',program:template.program,fileMappings:clone(template.fileMappings||[])};
 const project={id:uid('project'),name,server:serverId,serverName:server.name,template:template.id,type:template.type,software:template.software,life:'draft',desired,runtime:'na',health:'na',observed:null,lastCheck:null,cfg,applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,dataStatus:'in-place',monitor:{hours:24,method:template.type,http:'',channels:[],inherit:true},creationPending:true};
 S.projects.push(project);navigate('project',project.id);
 startOperation(project,'deploy',{},'success',{newProject:true});
});
