'use strict';

function activeOps(p){return S.operations.filter(o=>(o.status==='running'||o.status==='unknown'&&!o.protectionReleased)&&o.project===p.id)}

const opLabels={deploy:'部署',apply:'应用配置',update:'更新程序 / 镜像',start:'启动',stop:'停止',restart:'重启',backup:'备份',restore:'恢复',uninstall:'卸载',replica:'初始化只读副本',env:'补齐缺失环境'};

function resourcesFor(p,kind){const keys=['project:'+p.id];if(p.software==='mysql')keys.push('mysql:'+p.id+':*');if(p.software==='redis')keys.push('redis:'+p.id+':*');if(['backup','restore'].includes(kind)&&p.backup.mysql)p.backup.databases.forEach(db=>keys.push('mysql:'+p.backup.mysql+':'+db));return keys;}

function intersects(a,b){return a===b||(a.endsWith(':*')&&b.startsWith(a.slice(0,-1)))||(b.endsWith(':*')&&a.startsWith(b.slice(0,-1)));}

function conflictFor(resources){return S.operations.find(o=>['running','unknown'].includes(o.status)&&!o.protectionReleased&&o.resources?.some(a=>resources.some(b=>intersects(a,b))));}

function record(label,kind,project,statusValue,message,extra={}){const o={id:uid('op'),label,kind,project,status:statusValue,time:now(),ended:now(),message,steps:[],input:{},resources:[],...extra};S.operations.unshift(o);persist();return o;}

function rejectOperation(p,kind,message,extra={}){const o=record((opLabels[kind]||kind)+' '+(p?.name||''),kind,p?.id,'rejected',message,extra);closeModal();render();openModal('opdetail',{id:o.id});return null;}

function stepsFor(kind,input){const titles={deploy:['核对环境、身份与本次输入','交付程序 / 镜像与配置','建立核心运行定义','按目标启停并核对'],apply:['固定草稿与检查冲突','逐项交付配置内容','必要激活 / 保持停止','核对结果与完整参照'],update:['固定程序 / 镜像内容','交付程序及相关配置','必要激活 / 保持停止','核对实际更新结果'],start:['检查运行前提','提交启动','核对运行与端点'],stop:['检查目标与影响范围','提交停止','核对实际停止'],restart:['核对原运行目标','停止运行实体','重新启动','核对运行结果'],backup:['核对显式范围和副本保护','前置清理及可用空间检查','备份配置、程序、文件与指定数据','核对备份产物',input.stop?'恢复原运行状态 / 安全收尾':'完成记录（不改变服务运行）'],restore:['核对来源、范围及恢复前状态','覆盖项目文件','覆盖选定数据库并核对','按既定成功条件启动'],uninstall:['核对核心资源和清理选项','停止并移除核心运行实体','处理明确选定的业务数据','删除明确选定的网络条目'],replica:['核对主库条件与目标空库','准备并导入初始数据','写入复制配置并保持只读','核对复制运行'],env:['核对已授权管理身份','安装缺失依赖','检查已存在及新安装环境'],network:['核对目标、权限与影响','提交本次网络修改','读取核对目标条目']};return (titles[kind]||titles.network).map(title=>({title,status:'pending',note:''}));}

function startOperation(p,kind,input={},outcome='success',options={}){
 if(p){
  if(['apply','update','start','stop','restart','backup','uninstall','replica'].includes(kind)&&p.life!=='installed')return rejectOperation(p,kind,'当前项目不是完整已部署状态，不能直接执行此操作。请先处理现有部署事实。');
  if(p.unsafe&&['start','restart','backup'].includes(kind))return rejectOperation(p,kind,'已有部分覆盖尚未处理，不能用普通启动掩盖不安全的数据状态。');
  if(kind==='restart'&&p.desired==='stopped')return rejectOperation(p,kind,'项目是主动停止目标。需要运行请明确提交启动，不通过重启隐式改变目标。');
  if(kind==='restore'&&p.life!=='uninstalled'&&p.runtime==='unknown')return rejectOperation(p,kind,'恢复前实际运行状态未知，先核对原项目状态，不以期望运行冒充恢复前正在运行。');
  const resources=[...resourcesFor(p,kind),...(input.extraResources||[])];const conflict=conflictFor(resources);
  if(conflict)return rejectOperation(p,kind,`与“${conflict.label}”（${statusName[conflict.status]}）影响同一资源。本次拒绝、不排队、不取消原操作。`,{conflict:conflict.id});
  if(['deploy','apply','update'].includes(kind)){
   const server=sr(p.server);if(!server||server.state!=='online')return rejectOperation(p,kind,'主机身份或连接尚未核对，不能执行部署变更。');
   if(p.type==='compose'&&!server.docker)return rejectOperation(p,kind,'缺少 Docker / Compose。请在服务器详情中明确执行环境准备；巡检不会自动安装。');
   if(p.type==='systemd'&&!S.programs.some(b=>b.name===p.cfg.program&&b.arch===server.arch))return rejectOperation(p,kind,`未找到程序 ${p.cfg.program} 对应 ${server.arch} 的文件，请先在“程序文件”提供演示文件。`);
   const occupied=p.cfg.port&&S.projects.find(x=>x.id!==p.id&&x.server===p.server&&x.life==='installed'&&Number(x.applied?.port)===Number(p.cfg.port));
   if(occupied)return rejectOperation(p,kind,`端口 ${p.cfg.port} 已由同机项目 ${occupied.name} 使用，不擅自覆盖。`);
   if(p.applied&&p.cfg.dataDir!==p.applied.dataDir)return rejectOperation(p,kind,'业务数据目录发生变化；这不等于已完成数据搬移。当前原型不假装支持目录迁移，请先恢复为已应用目录再体验其他配置变更。');
  }
  if(kind==='backup'&&p.backup.destination!=='controller')return rejectOperation(p,kind,'其他目的地尚未选定适配；保留配置选择，不冒充已经支持该目的地备份。');
  if(kind==='backup'&&p.backup.mysql&&p.backup.databases.length===0)return rejectOperation(p,kind,'选择了 MySQL 项目但未明确完整数据库集合，不能猜测备份范围。');
 }
 const resources=p?[...resourcesFor(p,kind),...(input.extraResources||[])]:input.resources||[];const cf=conflictFor(resources);if(cf)return rejectOperation(p,kind,'与原操作 '+cf.label+' 冲突，本次不受理。');
 const fixed={...clone(input),policySnapshot:clone(S.policies.find(x=>x.id===input.policy)||null),restoreSource:kind==='restore'?clone(S.backups.find(b=>b.id===input.backupId)||null):null,...(p?{cfg:clone(p.cfg),applied:clone(p.applied),draftRev:p.draftRev,before:{life:p.life,runtime:p.runtime,desired:p.desired,health:p.health},backup:clone(p.backup),stop:kind==='backup'&&p.backup.stop}:{} )};
 if(p?.type==='systemd'&&['deploy','update'].includes(kind)){const binary=S.programs.find(b=>b.name===p.cfg.program&&b.arch===sr(p.server)?.arch);if(binary){fixed.binary=clone(binary);fixed.cfg.contentIdentity=binary.identity;}}
 if(p&&['start','stop'].includes(kind)&&S.review.p1==='accepted')p.desired=kind==='start'?'running':'stopped';
 if(p&&kind==='deploy'&&input.desired)p.desired=input.desired;
 if(p&&kind==='backup'&&p.backup.stop&&p.runtime==='running'){p.temporary=true;p.runtime='stopped';p.health='na';p.observed=now();}
 const o={id:uid('op'),kind,project:p?.id,label:input.label||`${opLabels[kind]||'修改网络'} ${p?.name||''}`,status:'running',time:now(),input:fixed,resources,outcome,steps:stepsFor(kind,fixed),message:'已受理并固定输入；这里仅执行浏览器模拟。',planId:options.planId||null,hold:!!options.hold};o.steps[0].status='running';S.operations.unshift(o);persist();render();closeModal();if(!options.silent)openModal('opdetail',{id:o.id});
 if(!o.hold)timers.set(o.id,setInterval(()=>tick(o.id),900));return o;
}

function tick(id){const o=S.operations.find(o=>o.id===id);if(!o||o.status!=='running'){clearInterval(timers.get(id));timers.delete(id);return;}const i=o.steps.findIndex(s=>s.status==='running');const last=o.outcome==='failed'?Math.min(1,o.steps.length-1):o.outcome==='unknown'?Math.max(1,o.steps.length-2):o.steps.length-1;
 if(i>=last){finishOperation(o,o.outcome);return;}if(i>=0)o.steps[i].status='success';o.steps[i+1].status='running';persist();render();if(ui.modal?.kind==='opdetail'&&ui.modal.id===id)renderModal();}
