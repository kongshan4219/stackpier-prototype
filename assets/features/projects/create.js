'use strict';

function newProjectModal(m){
 const body=`<div class="stack">${select('np-template','部署配置',[['','请选择部署配置'],...S.templates.map(t=>[t.id,t.name+' · '+(t.type==='compose'?'Docker Compose':'systemd')])],m.template||'',S.templates.length?'':'暂无部署配置，请先新增配置。','required')}${select('np-server','服务器',[['','请选择服务器'],...S.servers.map(s=>[s.id,s.name+' / '+s.arch])],'',S.servers.length?'':'暂无服务器，请先添加服务器。','required')}</div>`;
 const disabled=S.templates.length&&S.servers.length?'':'disabled';
 layout('部署项目','项目名称沿用部署配置名称。',body,btn('取消','closemodal')+`<button class="btn primary" type="submit" name="commit" value="deploy" ${disabled}>确认部署（演示）</button>`,false,'newproject');
}

registerPrototypeHandlers(prototypeModals,['newproject'],newProjectModal);
registerPrototypeHandlers(prototypeActions,['newproject'],function(event,target,d){openModal('newproject',{template:d.template});});
registerPrototypeHandlers(prototypeForms,['newproject'],function(event,form,fd,get){
 const t=tpl(get('np-template')),server=get('np-server');
 if(!t||!sr(server)){modalError('请选择有效的部署配置和服务器。');return;}
 if(['frpc','frps'].includes(t.software)){frpGo('connections');toast('FRP 继续通过专用角色流程部署。');return;}
 if(S.projects.some(p=>p.name===t.name&&p.server===server)){modalError('这台服务器已存在同名项目，请管理已有项目或选择其他部署配置、服务器。');return;}
 saveNewProject({template:t.id,name:t.name,server,desired:'running',port:t.contentMode==='file'?null:t.port,env:t.env||''},ui.nextOutcome||'success');
});

// 两个创建入口共用快照复制、唯一性检查及模拟部署。
function saveNewProject(d,outcome){
 const t=tpl(d.template),s=sr(d.server);
 if(!d.name?.trim()){modalError('请填写项目名称。');return;}
 if(S.projects.some(p=>p.name===d.name&&p.server===d.server)){modalError('这台服务器已存在同名项目记录，请修改项目名称。');return;}
 if(!t||!s){modalError('请选择有效的服务器和部署配置。');return;}if(t.software==='mysql'&&S.projects.some(p=>p.server===d.server&&p.template===t.id&&p.life!=='uninstalled')){modalError('同一服务器已有相同 MySQL 配置的项目。多实例须维护不同配置并核对端口、目录和名称。');return;}
  const cfg={fileMappings:clone(t.fileMappings||[]),...(t.contentMode==='file'?{source:t.tpl}:{}),port:d.port,version:t.version,dataDir:`/srv/stackpier-demo/${d.name}/data`,env:d.env,templateRev:t.rev,appConfig:'logLevel = "info"',serviceUser:'app',program:t.program};
  const project={id:uid('project'),name:d.name,server:d.server,serverName:s.name,template:t.id,type:t.type,software:t.software,life:'draft',desired:d.desired,runtime:'na',health:'na',observed:null,lastCheck:null,cfg,applied:null,draftRev:1,appliedRev:0,components:[],monitorPaused:false,dataStatus:'in-place',deps:[],depChanges:[],monitor:{hours:24,http:'',tcp:d.port?String(d.port):'',channels:[],inherit:true},hasBusinessData:false};S.projects.push(project);persist();closeModal();navigate('project',project.id);startOperation(project,'deploy',{desired:d.desired},outcome);return project;
}
