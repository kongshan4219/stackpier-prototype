'use strict';

function projectNameError(name){
 if(!name)return '请填写项目名。';
 if(!/^[A-Za-z][A-Za-z0-9_-]{0,62}$/.test(name))return '项目名须以英文字母开头，只能包含字母、数字、- 和 _，且不超过 63 个字符。';
 return '';
}

function newProjectModal(m){
 const template=m.template||S.templates[0]?.id||'',server=m.server||S.servers.find(item=>item.state==='online')?.id||S.servers[0]?.id||'';
 const body=`<div class="stack">${select('np-template','部署配置',S.templates.map(item=>[item.id,item.name+' · '+(item.type==='compose'?'Compose':'systemd')]),template,'','required autofocus')}${select('np-server','目标服务器',S.servers.map(item=>[item.id,item.name+' / '+item.arch]),server,'','required')}${field('np-name','项目名',m.name||'', '以英文字母开头，可包含数字、- 和 _。','text','required pattern="[A-Za-z][A-Za-z0-9_-]{0,62}"')}</div>`;
 layout('部署项目','选择部署配置和目标服务器，填写项目名后查看部署落点。',body,btn('取消','closemodal')+'<button class="btn primary" type="submit">预览部署落点</button>',false,'newproject');
}

registerPrototypeHandlers(prototypeModals,['newproject'],function(m){
 newProjectModal(m);
});

registerPrototypeHandlers(prototypeActions,['newproject'],function(event,target,data){
 openModal('newproject',{template:data.template,server:data.server});
});

function newProjectDraft(template,server,name){
 return {id:'preview-new',name,server:server.id,serverName:server.name,template:template.id,type:template.type,software:template.software,life:'draft',desired:'running',runtime:'na',health:'na',observed:null,lastCheck:null,cfg:{source:template.tpl,port:template.port??null,version:template.version,dataDir:`/srv/stackpier-demo/${name}/data`,env:template.env||'',templateRev:template.rev,appConfig:'logLevel = "info"',serviceUser:'app',program:template.program,programRef:clone(template.programRef||null),fileMappings:clone(template.fileMappings||[])},applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,dataStatus:'in-place',monitor:{hours:24,method:template.type,http:'',channels:[],inherit:true}};
}
registerPrototypeHandlers(prototypeForms,['newproject'],function(event,form,fd,get){
 const template=tpl(get('np-template')),server=sr(get('np-server')),name=get('np-name'),error=projectNameError(name);
 if(!template||!server)return modalError('请选择有效的配置和目标服务器。');if(error)return modalError(error);
 if(S.projects.some(project=>project.server===server.id&&project.name===name))return modalError('这台服务器已存在同名项目，请更换项目名。');
 const draft=newProjectDraft(template,server,name);openModal('deploymentpreview',{draft,serverArchitecture:server.arch,origin:{kind:'newproject',template:template.id,server:server.id,name}});
});
