'use strict';

let S,storageOK=true;

try{const raw=localStorage.getItem(STORE);S=raw?JSON.parse(raw):initial();if(S.version!==1)S=initial();}catch{S=initial();storageOK=false;}

S.operations.forEach(o=>{if(o.status==='running'){o.status='unknown';o.message='页面刷新时演示执行尚未完成。保留输入及已确认步骤，需核对原操作，不自动重跑。';o.interrupted=true;}});

let ui={page:'overview',project:'p1',tab:'overview',backupTab:'archives',templateTab:'templates',monitorTab:'checks',planTab:'plans',q:'',filter:'all',server:'all',zone:'all',view:'table',nav:false,auth:null,initialized:true,password:DEMO_PASSWORD,scenario:'',nextOutcome:'success',modal:null,showAllOps:false};

const timers=new Map();

function persist(){try{localStorage.setItem(STORE,JSON.stringify(S));}catch{storageOK=false;}}

function pr(id){return S.projects.find(p=>p.id===id)}

function sr(id){return S.servers.find(s=>s.id===id)}

function tpl(id){return S.templates.find(t=>t.id===id)}

function pname(id){return pr(id)?.name||'已删除的演示项目'}

function sname(id){return sr(id)?.name||S.projects.find(p=>p.server===id)?.serverName||'已移除连接记录'}
