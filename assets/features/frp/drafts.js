'use strict';

// 公共来源、角色草稿、完整应用参照及读取快照相互独立。
function frpSyncDrafts(){
 frpLinkAssets();
 for(const p of S.projects.filter(p=>p.frpRef||p.frpInstallation)){
  const role=p.frpRef?.role||p.frpInstallation.role,n=p.frpRef?frpNode(p.frpRef.node):p.frpApplied?.node;if(!n)continue;
  if(!p.frpDraft){
   const fresh=frpPublicCandidate(n,role);p.frpDraft=clone(fresh);
   // 旧用户正文优先于公共生成内容；从未有正文的新草稿才初始化。
   if(p.cfg.appConfig){p.frpDraft.files.toml=p.cfg.appConfig;p.frpDraft.files.unit=p.frpDraftUnit||p.frpApplied?.files.unit||fresh.files.unit;}
   else {p.cfg.appConfig=fresh.files.toml;p.frpDraftUnit=fresh.files.unit;}
   p.frpDraftRefs={nodeRevision:n.revision,settingsRevision:p.frpDraft.settingsRevision,templateRevisions:clone(p.frpDraft.templateRevisions)};
  }
  if(p.frpApplied&&!p.frpApplied.programRef&&!p.frpAppliedProgramRef)p.frpAppliedProgramRef=frpLegacyProgram(p,role);
  if(p.frpApplied&&!p.frpReadSnapshot)p.frpReadSnapshot={files:clone(p.frpApplied.files),program:clone(p.frpApplied.program||null),at:p.lastCheck||p.observed||null,source:'旧模拟应用参照，非实时远端读取'};
  // 非当前清单的项目保留归档的草稿与更新提示，不套用另一个参考清单。
  if(p.frpRef&&!S.frp.nodes.some(x=>x.id===n.id))continue;
  const latest=frpPublicCandidate(n,role);
  p.frpAvailableUpdate=JSON.stringify([latest.files,latest.programRef,latest.settingsRevision,latest.templateRevisions,n.revision])!==JSON.stringify([p.frpDraft.files,p.frpDraft.programRef,p.frpDraft.settingsRevision,p.frpDraft.templateRevisions,p.frpDraft.node.revision]);
 }
}
function frpAdoptProject(p,next){
 if(!p||!next)throw Error('目标项目或更新已缺失');p.frpDraft=clone(next);p.cfg.appConfig=next.files.toml;p.frpDraftUnit=next.files.unit;p.cfg.dataDir=next.root;p.cfg.serviceUser=next.settings.user;p.cfg.port=next.role==='server'?next.node.bind_port:0;const program=frpResolveProgram(next.programRef,next.host).file;p.cfg.version=program?'内容 R'+program.revision+' · 元数据，未验证运行':'程序无效 / 架构缺失';p.draftRev++;
 p.frpDraftRefs={nodeRevision:next.node.revision,settingsRevision:next.settingsRevision,templateRevisions:clone(next.templateRevisions)};frpSyncConfigs();persist();
}
function frpDraftSnapshot(n,role){const p=pr(frpPid(n,role));if(!p?.frpDraft)frpSyncConfigs();return clone(p?.frpDraft);}
function frpUniqueItems(items){return [...new Map(items.map(x=>[frpPid(frpNode(x.node),x.role),x])).values()];}
function frpDeployErrors(items){
 return frpUniqueItems(items).flatMap(x=>{const n=frpNode(x.node),p=pr(frpPid(n,x.role)),snapshot=p?.frpDraft,program=frpResolveProgram(snapshot?.programRef,snapshot?.host);return program.errors.map(e=>p.name+'：'+e);});
}
function frpNormalizeIP(value){try{const text=String(value).trim();if(!validIPv4(text)&&!validIPv6(text))return text.toLowerCase();return text.includes(':')?new URL('http://['+text+']/').hostname.slice(1,-1):text.split('.').map(part=>String(Number(part))).join('.');}catch{return String(value).trim().toLowerCase();}}
function frpListenerHost(id){return frpNormalizeIP(sr(id)?.host||id);}
function frpMask(text){return String(text).replace(/^(\s*(?:auth\.token|secretKey)\s*=\s*).*$/gm,(line,prefix)=>/\$\{?auth_token\}?/.test(line)?line:prefix+'"•••• 示例凭据已隐藏"');}
function frpCleanupPreview(n){const p=pr(frpPid(n,'visitor')),draft=pr(frpPid(n,'client'))?.frpDraft?.node||n;return !draft.proxies.some(x=>x.type==='stcp')&&p?.life==='installed'&&p.frpApplied?{project:p.id,host:p.frpApplied.host,unit:p.frpApplied.files.unitPath,config:p.frpApplied.files.tomlPath,generated:p.frpApplied.files.generatedToml||'generated/frpc-visitor/'+p.frpApplied.node.ip+'.toml'}:null;}
function frpSelectTargets(role,scope='default',id=''){
 if(scope==='specified'){const n=frpNode(id);return n?[n]:[];}
 return S.frp.nodes.filter(n=>scope==='all'||role!=='client'||n.client_enabled===true);
}
function frpSwitchProfile(profile){
 if(S.frp.profile===profile)return;S.frpProfiles||={};S.frpProfiles[S.frp.profile||'workspace']=clone(S.frp);
 if(profile==='attachment'&&!S.frpProfiles.attachment){const F=frpReferenceSample();F.sampleVersion='attachment';F.profile='attachment';for(const n of F.nodes)n.id='ref-'+n.id;S.frpProfiles.attachment=F;}
 const next=S.frpProfiles[profile];if(!next)throw Error('该清单尚未载入');S.frp=clone(next);S.frp.profile=profile;frpEnsure();frpSyncConfigs();FRP.node=S.frp.nodes[0]?.id;FRP.tab='connections';closeModal();navigate('frp');persist();
}

function frpActiveProject(p){return p.frpRef?S.frp.nodes.some(n=>n.id===p.frpRef.node):!S.frpProfiles||S.frp.profile!=='attachment';}
function frpPairErrors(items){
 const selected=new Map(frpUniqueItems(items).map(x=>[frpPid(frpNode(x.node),x.role),pr(frpPid(frpNode(x.node),x.role))?.frpDraft])),errors=[];
 const snapshot=(n,r)=>selected.get(frpPid(n,r))||pr(frpPid(n,r))?.frpApplied;
 const token=s=>s?.files.toml.match(/^\s*auth\.token\s*=.*$/m)?.[0]?.trim();
 for(const n of S.frp.nodes){
  const relevant=Object.keys(frpRoles).some(r=>selected.has(frpPid(n,r)));if(!relevant)continue;
  const server=snapshot(n,'server'),client=snapshot(n,'client'),visitor=frpCleanupPreview(n)?null:snapshot(n,'visitor');
  const complete=[server,client,visitor].filter(Boolean);if(new Set(complete.map(token).filter(Boolean)).size>1)errors.push(n.ip+'：配对角色仍使用旧认证，请先明确采用相同来源再选择相关角色应用；共用 frps 的关联连接也要核对。');
  if(client&&visitor&&visitor.node.proxies.some(x=>x.type==='stcp')){
   const provided=client.node.proxies.filter(x=>x.type==='stcp');for(const x of visitor.node.proxies.filter(x=>x.type==='stcp')){
    const match=provided.find(other=>other.name===x.name);if(!match||match.secret_key!==x.secret_key)errors.push(n.ip+'：STCP serverName / secretKey 与对应提供端不一致，须共同采用、确认应用；不能让两份版本漂移。');
   }
  }
 }
 return [...new Set(errors)];
}
