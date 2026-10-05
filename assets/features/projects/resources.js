'use strict';

// 独占资源按稳定项目 / 类型 / 路径归档，旧路径在确认清理前不会被新配置覆盖。
const resourceKey=t=>t.kind+'|'+t.path;
function resourceOwnership(t){return t.shared?'shared':t.ownership||'project';}
function projectResourceLedger(p){
 p.resourceLedger||={schema:1,entries:[],events:[],unresolvedScopes:[]};
 const ledger=p.resourceLedger;
 const add=(targets,source,presence)=>{for(const t of targets||[]){const key=resourceKey(t);let entry=ledger.entries.find(e=>e.key===key);if(!entry){entry={...clone(t),id:uid('resource'),key,ownership:resourceOwnership(t),presence,sources:[source]};ledger.entries.push(entry);}else {if(!entry.sources.includes(source))entry.sources.push(source);if(entry.ownership!==resourceOwnership(t))entry.ownership='unknown';}}
 };
 // ownedResources 是台账导出的兼容副本；重复导入不能给已知资源追加虚假的历史来源。
 add((p.ownedResources||[]).filter(t=>{const e=ledger.entries.find(e=>e.key===resourceKey(t));return !e||e.ownership!==resourceOwnership(t);}), '历史归属登记','present');
 if(!ledger.initialized){
  if(p.applied)add(deploymentCleanupTargets(p,p.applied),'已应用参照','present');
  if(!p.frpService)add([{kind:'directory',path:'/srv/stackpier-demo/'+p.name,label:'独立部署目录（含专属数据）',ownership:'project'}],'已部署项目独立目录','possible');
  ledger.initialized=true;
 }
 // 只从固定操作输入恢复遗漏；不会拿当前未保存草稿猜测历史交付内容。
 for(const o of [...S.operations].reverse().filter(o=>o.project===p.id&&['deploy','apply','update'].includes(o.kind))){
  if(ledger.events.some(e=>e.operationId===o.id))continue;
  const targets=o.input?.resourceTargets||o.input?.deployment?.targets;
  if(targets&&['success','partial','unknown'].includes(o.status))recordProjectResources(p,o,o.status,targets);
  else if(['partial','unknown'].includes(o.status)&&!targets&&!o.resolved){if(!ledger.unresolvedScopes.includes(o.id))ledger.unresolvedScopes.push(o.id);}
 }
 return ledger;
}
function recordProjectResources(p,o,result,targets=o.input?.resourceTargets||o.input?.deployment?.targets||[]){
 const ledger=p.resourceLedger||={schema:1,entries:[],events:[],unresolvedScopes:[],initialized:true};
 if(ledger.events.some(e=>e.operationId===o.id&&e.result===result))return;
 if(!['success','partial','unknown'].includes(result))return;
 const facts=o.resourceResults||targets.map(t=>({...clone(t),presence:result==='success'?'present':'possible'}));
 for(const t of facts){
  if(t.presence==='absent')continue;const key=resourceKey(t);let entry=ledger.entries.find(e=>e.key===key);
  if(!entry){entry={...clone(t),id:uid('resource'),key,ownership:resourceOwnership(t),presence:t.presence||'possible',sources:[]};ledger.entries.push(entry);}
  else {if(result==='success'||t.presence==='present'||entry.presence==='absent')entry.presence=t.presence||'possible';if(entry.ownership!==resourceOwnership(t))entry.ownership='unknown';}
  if(!entry.sources.includes(o.id))entry.sources.push(o.id);
 }
 ledger.events.push({operationId:o.id,result,targets:clone(facts),at:o.ended||o.time});
 ledger.unresolvedScopes=ledger.unresolvedScopes.filter(id=>id!==o.id);
 p.ownedResources=clone(ledger.entries.filter(e=>e.presence!=='absent'));
}
function projectOwnedResources(p){return projectResourceLedger(p).entries.filter(e=>e.presence!=='absent');}
function projectResourceSignature(p){return JSON.stringify(projectOwnedResources(p).map(e=>[e.id,e.key,e.ownership,e.presence]));}
function recordResourceCleanup(p,o,items){
 const ledger=projectResourceLedger(p);
 for(const t of items.filter(t=>t.status==='success')){const entry=ledger.entries.find(e=>e.id===t.id||e.key===resourceKey(t));if(entry){entry.presence='absent';entry.cleanedBy=o.id;}}
 if(!ledger.events.some(e=>e.operationId===o.id))ledger.events.push({operationId:o.id,result:o.status,cleanup:clone(items),at:o.ended||o.time});
 p.ownedResources=clone(ledger.entries.filter(e=>e.presence!=='absent'));
}
function initializeResourceLedgers(){for(const p of S.projects)projectResourceLedger(p);}
