'use strict';

let S,storageOK=true;

try{const raw=localStorage.getItem(STORE);S=raw?JSON.parse(raw):initial();if(!S||typeof S!=='object'||Array.isArray(S))throw new Error('无效存储');}catch{S=initial();storageOK=false;}

// 只迁出本轮暂停的功能状态，其余项目、草稿、FRP、通知和反馈保持原值。
function migrateDeferredProtection(state){
 const retiredKinds=new Set(['backup','restore','cleanup','verify-backup']);
 const retiredPlans=(state.plans||[]).filter(plan=>['backup','cleanup'].includes(plan.kind));
 const retiredPlanIds=new Set(retiredPlans.map(plan=>plan.id));
 state.operations=state.operations.filter(operation=>{
  const retiredSchedule=operation.kind==='schedule'&&(/备份|前置清理|保护性清理/.test(operation.message||'')||retiredPlans.some(plan=>(operation.label||'').includes(plan.name)));
  return !retiredKinds.has(operation.kind)&&!retiredSchedule&&!retiredPlanIds.has(operation.planId);
 });
 for(const project of state.projects){
  project.monitorPaused=project.monitorPaused??!!project.plansPaused;
  delete project.plansPaused;delete project.backup;delete project.temporary;
 }
 for(const template of state.templates){
  if(template.desc==='备份整个实例，不按应用拆分 Redis 数据')template.desc='独立管理的 Redis 实例';
 }
 for(const operation of state.operations){
  if(operation.input){for(const key of ['backup','backupId','restoreSource','policy','policySnapshot','preclean'])delete operation.input[key];}
  delete operation.planId;
 }
 delete state.backups;delete state.plans;delete state.policies;
 delete state.review.p2;delete state.review.p3;
 return state;
}

migrateDeferredProtection(S);

// 项目配置改为服务器文件观测，巡检只保留一种明确方式；清理已经移除的依赖与复制状态。
function migrateProjectObservation(state){
 state.operations=(state.operations||[]).filter(operation=>operation.kind!=='replica');
 for(const operation of state.operations)delete operation.dependencyNotificationChecked;
 for(const project of state.projects){
  const monitor=project.monitor||{};
  const method=monitor.method==='http'||monitor.method===project.type?monitor.method:monitor.http?'http':project.type==='compose'?'compose':'systemd';
  project.monitor={hours:Number(monitor.hours)||24,method,http:monitor.http||'',channels:Array.isArray(monitor.channels)?monitor.channels:[],inherit:monitor.inherit!==false};
  delete project.deps;delete project.depChanges;delete project.replicaOf;delete project.replication;delete project.hasBusinessData;delete project.initResidue;
  if(!project.deployedFiles){const operation=state.operations.find(item=>item.project===project.id&&item.status==='success'&&['deploy','apply','update'].includes(item.kind)&&item.input?.mappedFiles?.length);if(operation)project.deployedFiles=clone(operation.input.mappedFiles);}
 }
 return state;
}

migrateProjectObservation(S);

// 旧 P1 只改变受理意图，不能升级成当前实际状态或预期停止的证据。
function migrateRuntimeReview(state){
 const legacyIntent=Object.hasOwn(state.review,'p1');
 for(const project of state.projects){
  const last=state.operations.find(operation=>operation.project===project.id&&['start','stop','restart'].includes(operation.kind)&&operation.status!=='rejected');
  if(legacyIntent&&last&&['running','unknown','failed','partial'].includes(last.status)&&last.input?.before?.desired)project.desired=last.input.before.desired;
  if(project.stopVerified===undefined)project.stopVerified=project.life==='installed'&&project.desired==='stopped'&&project.runtime==='stopped'&&!!project.observed&&!(last&&['running','unknown'].includes(last.status));
 }
 for(const operation of state.operations){
  if(['start','stop','restart'].includes(operation.kind)&&operation.input)operation.input.requestedState??=operation.kind==='stop'?'stopped':'running';
 }
 delete state.review.p1;
}

migrateRuntimeReview(S);

S.operations.forEach(o=>{if(o.status==='running'){o.status='unknown';o.message='页面刷新时演示执行尚未完成。保留输入及已确认步骤，需核对原操作，不自动重跑。';o.interrupted=true;}});
let ui={page:'overview',project:'p1',tab:'overview',projectsTab:'list',templateTab:'templates',monitorTab:'checks',q:'',filter:'all',server:'all',zone:'all',view:'table',nav:false,auth:null,initialized:true,password:DEMO_PASSWORD,scenario:'',nextOutcome:'success',modal:null,showAllOps:false};

const timers=new Map();

function persist(){try{localStorage.setItem(STORE,JSON.stringify(S));}catch{storageOK=false;}}

function pr(id){return S.projects.find(p=>p.id===id)}

function sr(id){return S.servers.find(s=>s.id===id)}

function tpl(id){return S.templates.find(t=>t.id===id)}

function pname(id){return pr(id)?.name||S.serviceMigration?.evidence.find(e=>e.projectId===id)?.name||S.operations.find(o=>o.project===id)?.input?.deployment?.project?.name||'历史关联（已移除或待核对）'}

function sname(id){return sr(id)?.name||S.projects.find(p=>p.server===id)?.serverName||'已移除连接记录'}
