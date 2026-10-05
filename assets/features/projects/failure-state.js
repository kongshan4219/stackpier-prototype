'use strict';

const failedDeploymentResults=['failed','partial','unknown','rejected'];

// 清理范围在部署受理时固定，后续配置编辑不能扩大旧部署的清理范围。
function deploymentCleanupTargets(project,cfg=project.cfg){
 if(project.frpService&&cfg.frpSnapshot){const f=cfg.frpSnapshot.files;return [...(cfg.dataDir===cfg.frpSnapshot.root+'/projects/'+project.name?[{kind:'directory',path:cfg.dataDir,label:'独立服务配置目录（含专属数据）',ownership:'project'}]:[]),{kind:'runtime',path:'systemd:'+project.name,label:'systemd 服务',ownership:'project'},{kind:'file',path:f.unitPath,label:'服务 unit',ownership:'project'},{kind:'file',path:f.tomlPath,label:'服务 TOML 配置',ownership:'project'},{kind:'file',path:f.binaryPath,label:'共享 FRP 程序',shared:true,ownership:'shared'}];}
 const root=`/srv/stackpier-demo/${project.name}`,targets=[];
 const add=(kind,path,label)=>{if(path&&!targets.some(item=>item.kind===kind&&item.path===path))targets.push({kind,path,label});};
 add('runtime',`${project.type}:${project.name}`,project.type==='compose'?'项目容器与专属网络':'systemd 服务');
 add('file',project.type==='compose'?`${root}/compose.yaml`:`/etc/systemd/system/${project.name}.service`,project.type==='compose'?'Docker Compose 文件':'systemd 服务文件');
 if(project.type==='systemd'&&typeof cfg.source!=='string'){
  if(cfg.program)add('file',`${root}/${cfg.program}`,'程序文件');
  add('file',`${root}/app.conf`,'应用配置');
 }
 for(const mapping of cfg.fileMappings||[])add('file',mapping.targetPath,`映射文件 · ${mapping.file||mapping.program}`);
 if(cfg.dataDir)add('directory',cfg.dataDir,'项目数据目录');
 return targets;
}

function deploymentSnapshot(project,cfg=project.cfg){
 const server=sr(project.server);
 return {project:{...clone(project),cfg:clone(cfg)},server:server?{id:server.id,name:server.name,host:server.host,port:server.port,fp:server.fp}:null,templateName:tpl(project.template)?.name||'未保留部署配置名称',targets:deploymentCleanupTargets(project,cfg).filter(t=>!t.shared)};
}

function failedProject(id){return (S.failedProjects||[]).find(item=>item.id===id);}
function failedProjectForOperation(id){return (S.failedProjects||[]).find(item=>item.operation===id);}
function needsFailedCleanup(failure){return !['success','none'].includes(failure.cleanup.status);}

function archiveFailedDeployment(operation,project=pr(operation.project)){
 if(!operation.newProject||!failedDeploymentResults.includes(operation.status))return null;
 S.failedProjects||=[];
 let failure=failedProjectForOperation(operation.id);
 if(!failure){
  const fallback={id:operation.project,name:operation.label.replace(/^部署\s*/,''),server:'',type:operation.input?.binary?'systemd':'compose',cfg:clone(operation.input?.cfg||{})};
  const deployment=clone(operation.input?.deployment||deploymentSnapshot(project||fallback,operation.input?.cfg||project?.cfg||{}));
  failure={id:uid('failure'),operation:operation.id,time:operation.ended||operation.time,result:operation.status,message:operation.message,deployment,cleanup:{status:operation.status==='rejected'?'none':'pending',items:[]}};
  S.failedProjects.unshift(failure);
 }
 // 已建立的项目不会因一条旧失败记录被删除。
 const otherDeployment=S.operations.some(item=>item.id!==operation.id&&item.project===project?.id&&item.kind==='deploy'&&['running','unknown'].includes(item.status)&&!item.protectionReleased);
 if(project&&!project.applied&&!otherDeployment){
  S.projects=S.projects.filter(item=>item.id!==project.id);
  if(ui.page==='project'&&ui.project===project.id){ui.page='projects';ui.project='';ui.tab='overview';ui.projectsTab='failures';}
 }
 return failure;
}

function initializeFailedDeployments(){
 S.failedProjects||=[];
 for(const operation of S.operations){
  if(operation.kind==='deploy'&&!operation.frp&&failedDeploymentResults.includes(operation.status)){
   const project=pr(operation.project);
   if(project&&!project.applied)operation.newProject=true;
   if(operation.newProject)archiveFailedDeployment(operation,project);
  }
 }
 for(const failure of S.failedProjects){
  const cleanup=S.operations.find(operation=>operation.id===failure.cleanup.operation);
  if(cleanup?.status==='unknown'&&failure.cleanup.status==='running')failure.cleanup.status='unknown';
 }
}

function cleanupTargetsOverlap(first,second){
 if(first.kind==='runtime'||second.kind==='runtime')return first.kind===second.kind&&first.path===second.path;
 return first.path===second.path||first.kind==='directory'&&second.path.startsWith(first.path+'/')||second.kind==='directory'&&first.path.startsWith(second.path+'/');
}

function deploymentScopesOverlap(first,second){
 return first.project.server===second.project.server&&first.targets.some(a=>second.targets.some(b=>cleanupTargetsOverlap(a,b)));
}

function activeDeploymentConflict(deployment,ignoreId=''){
 return S.operations.find(operation=>operation.id!==ignoreId&&['running','unknown'].includes(operation.status)&&!operation.protectionReleased&&operation.input?.deployment&&deploymentScopesOverlap(deployment,operation.input.deployment));
}
