'use strict';

let S,storageOK=true;

try{const raw=localStorage.getItem(STORE);S=raw?JSON.parse(raw):initial();if(S.version!==1)S=initial();}catch{S=initial();storageOK=false;}

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

S.operations.forEach(o=>{if(o.status==='running'){o.status='unknown';o.message='页面刷新时演示执行尚未完成。保留输入及已确认步骤，需核对原操作，不自动重跑。';o.interrupted=true;}});

let ui={page:'overview',project:'p1',tab:'overview',templateTab:'templates',monitorTab:'checks',q:'',filter:'all',server:'all',zone:'all',view:'table',nav:false,auth:null,initialized:true,password:DEMO_PASSWORD,scenario:'',nextOutcome:'success',modal:null,showAllOps:false};

const timers=new Map();

function persist(){try{localStorage.setItem(STORE,JSON.stringify(S));}catch{storageOK=false;}}

function pr(id){return S.projects.find(p=>p.id===id)}

function sr(id){return S.servers.find(s=>s.id===id)}

function tpl(id){return S.templates.find(t=>t.id===id)}

function pname(id){return pr(id)?.name||'已删除的演示项目'}

function sname(id){return sr(id)?.name||S.projects.find(p=>p.server===id)?.serverName||'已移除连接记录'}
