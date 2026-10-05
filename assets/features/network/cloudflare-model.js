'use strict';

const CF_DEMO_TOKEN='STACKPIER_DEMO_TOKEN_ONLY';
const cfProfiles=[['normal','正常读写'],['readonly','只读'],['invalid','凭据失效'],['denied','Zone 权限不足'],['dnsdenied','Zone 可读 · DNS 权限不足'],['nozones','无授权域名'],['network','网络失败'],['limited','范围缩小 · 仅第一个 Zone'],['mixed','分 Zone 权限 · 首个可写，其余只读']];
const cfDemoAccounts=[['cf-account-legacy','demo-account-001','旧版演示账号',['example.com','example.net']],['cf-account-readonly','demo-account-002','只读演示账号',['readonly.example.org']],['cf-account-extra','demo-account-003','第二个可写账号',['team.example.org']]];
function cfAccount(id){return S.cloudflare.accounts.find(a=>a.id===id);}
function cfConnection(id){return S.cloudflare.connections.find(c=>c.id===id);}
function cfCurrent(accountId){return S.cloudflare.connections.find(c=>c.accountId===accountId&&!c.removedAt);}
function cfZone(id){return S.cloudflare.zones.find(z=>z.id===id);}
function cfCredential(c){return S.cloudflare.credentials.find(v=>v.id===c?.credentialId&&v.revision===c.credentialRevision);}
function cfAccountName(id){return cfCurrent(id)?.name||cfAccount(id)?.name||'归属待核对';}
function cfProbe(profile,zones){
 const valid=!['invalid','network'].includes(profile),zoneRead=valid&&profile!=='denied',dnsRead=zoneRead&&profile!=='dnsdenied',dnsWrite=dnsRead&&profile!=='readonly';
 return {profile,valid,zoneRead,dnsRead,dnsWrite,network:profile!=='network',at:now(),grants:zones.filter((z,i)=>profile!=='nozones'&&(profile!=='limited'||i===0)).map((z,i)=>({zoneId:z.id,read:dnsRead,write:dnsWrite&&(profile!=='mixed'||i===0)}))};
}
function cfAccess(zoneId,write=false,connectionId){
 const z=cfZone(zoneId);if(!z)return {ok:false,reason:'Zone 引用不存在，归属待核对'};
 const c=connectionId?cfConnection(connectionId):cfCurrent(z.accountId);
 if(!c||c.removedAt||c.accountId!==z.accountId)return {ok:false,reason:'连接已移除 · 保留缓存及项目关联'};
 if(!cfCredential(c))return {ok:false,reason:'凭据引用失效'};
 const p=c.check;if(!p?.network)return {ok:false,reason:'模拟网络失败 · 缓存不可写'};
 if(!p.valid)return {ok:false,reason:'模拟凭据失效'};
 if(!p.zoneRead)return {ok:false,reason:'无 Zone 读取权限'};
 const grant=p.grants.find(g=>g.zoneId===z.id);
 if(!grant?.read||!p.dnsRead)return {ok:false,reason:'无 DNS 读取权限或授权已缩小 · 保留缓存'};
 if(write&&!grant.write)return {ok:false,reason:'此 Zone 只读，不能增改删'};
 return {ok:true,connection:c,zone:z,grant};
}
function cfTarget(r){const a=cfAccess(r.zoneId,true,r.connectionId||cfCurrent(r.accountId)?.id);return a.ok?{accountId:r.accountId,zoneId:r.zoneId,connectionId:a.connection.id,credentialId:a.connection.credentialId,credentialRevision:a.connection.credentialRevision}:null;}
function cfTargetError(t,{write=true,fixedRevision=true}={}){
 if(!t)return '历史操作没有可靠账号身份，需核对归属';
 const z=cfZone(t.zoneId);if(!z||z.accountId!==t.accountId)return '账号与 Zone 身份不一致';
 const a=cfAccess(t.zoneId,write,t.connectionId);if(!a.ok)return a.reason;
 if(fixedRevision&&(a.connection.credentialId!==t.credentialId||a.connection.credentialRevision!==t.credentialRevision))return '凭据修订已改变，请重新核对本次目标';
 return '';
}
function cfBusy(c){return S.operations.find(o=>['running','unknown'].includes(o.status)&&!o.protectionReleased&&(o.input?.cfTarget?.connectionId===c.id||(o.input?.dnsTargets||[]).some(t=>t.connectionId===c.id)||o.input?.cfNeedsReview));}
function cfConnectionState(c){const p=c.check;if(c.removedAt)return '连接已移除';if(!p?.network)return '网络失败';if(!p.valid)return '凭据失效';if(!p.zoneRead||!p.dnsRead)return '权限不足';if(!p.grants.length)return '无授权域名';return p.grants.some(g=>g.write)?'已连接 · 按 Zone 授权':'已连接 · 只读';}
function cfEnsureAccount(state,id,name){
 const cf=state.cloudflare;let a=cf.accounts.find(a=>a.id===id);if(a)return a;
 const demo=cfDemoAccounts.find(a=>a[0]===id);a={id,displayId:demo?.[1]||'demo-account-migrated',name:name||demo?.[2]||'迁移账号'};cf.accounts.push(a);return a;
}
function cfEnsureZone(state,accountId,name,id){
 const cf=state.cloudflare;let z=id&&cf.zones.find(z=>z.id===id);if(z)return z;
 z=cf.zones.find(z=>z.accountId===accountId&&z.name===name);if(z)return z;
 z={id:id||uid('cf-zone'),accountId,name};cf.zones.push(z);return z;
}
function cfCreateConnection(state,accountId,name,profile='normal'){
 const cf=state.cloudflare,zones=cf.zones.filter(z=>z.accountId===accountId),credential={id:uid('cf-credential'),revision:1,profile};cf.credentials.push(credential);
 const c={id:uid('cf-connection'),accountId,name,credentialId:credential.id,credentialRevision:1,check:cfProbe(profile,zones)};cf.connections.push(c);return c;
}
// 每一步只补缺失关系，空列表和已移除连接不会在刷新时被示例重新填充。
function migrateCloudflare(state){
 state.cloudflare||={schema:1,accounts:[],connections:[],credentials:[],zones:[]};const cf=state.cloudflare;
 for(const key of ['accounts','connections','credentials','zones'])cf[key]||=[];
 cf.recordVersions||={};
 if(!cf.legacyMigrated){
  const a=cfEnsureAccount(state,'cf-account-legacy',state.settings.cfName||'旧版演示账号');
  for(const r of state.dns){if(!r.accountId&&!r.zoneId){const z=cfEnsureZone(state,a.id,r.zone);r.accountId=a.id;r.zoneId=z.id;}else if(r.zoneId&&!r.accountId){r.accountId=cf.zones.find(z=>z.id===r.zoneId)?.accountId||null;}}
  if(!cf.connections.some(c=>c.accountId===a.id))cfCreateConnection(state,a.id,a.name);
  for(const o of state.operations){if((o.kind==='network'&&o.input?.netType==='dns'&&!o.input.cfTarget)||(o.input?.dnsIds?.length&&!o.input.dnsTargets)){o.input.cfNeedsReview=true;o.message=(o.message||'')+' · 历史账号归属待核对';}}
  cf.legacyMigrated=true;
 }
 if(!cf.examplesAdded){
  const a=cfEnsureAccount(state,'cf-account-readonly');const z=cfEnsureZone(state,a.id,'readonly.example.org','cf-zone-readonly');
  if(!cf.connections.some(c=>c.accountId===a.id))cfCreateConnection(state,a.id,a.name,'readonly');
  // 保留旧四条记录；新示例仅初次补充，用户后续清空不会恢复。
  if(state.dns.length&&!state.dns.some(r=>r.id==='dns-demo-readonly'))state.dns.push({id:'dns-demo-readonly',accountId:a.id,zoneId:z.id,zone:z.name,name:'status',type:'TXT',content:'stackpier simulation',ttl:'300',proxy:false,projects:[]});
  cf.examplesAdded=true;
 }
 cf.schema=1;return state;
}
function initializeCloudflare(){migrateCloudflare(S);ui.cfAccount??='all';}
function cfSaveConnection(candidate){
 const existing=cfCurrent(candidate.accountId),updating=candidate.updateId&&cfConnection(candidate.updateId);
 if(updating&&updating.accountId!==candidate.accountId)return '新凭据选择了另一账号，请新增连接，不迁移旧数据';
 if(existing&&existing.id!==candidate.updateId)return '此 Account ID 已有连接，请更新已有连接';
 if(updating&&(updating.removedAt||updating.credentialRevision!==candidate.beforeRevision))return '连接已改变，请重新检查';
 if(updating&&cfBusy(updating))return '存在进行中或结果未知的操作，请先核对原操作';
 if(!candidate.probe.valid||!candidate.probe.zoneRead||!candidate.probe.dnsRead||!candidate.probe.network)return '检查未通过，原连接保持不变';
 cfEnsureAccount(S,candidate.accountId);for(const z of candidate.zones)cfEnsureZone(S,z.accountId,z.name,z.id);
 let c=updating;if(!c)c=cfCreateConnection(S,candidate.accountId,candidate.name,candidate.profile);
 else{const v={id:c.credentialId,revision:c.credentialRevision+1,profile:candidate.profile};S.cloudflare.credentials.push(v);c.credentialRevision=v.revision;}
 c.name=candidate.name;c.check=clone(candidate.probe);persist();return '';
}
function cfRemoveConnection(id){const c=cfConnection(id);if(!c||c.removedAt)return '连接已移除';const busy=cfBusy(c);if(busy)return '请先核对“'+busy.label+'”：进行中或结果未知，不能移除连接';c.removedAt=now();persist();return '';}
