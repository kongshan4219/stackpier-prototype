'use strict';

// FRP 程序与公共文件共用稳定 ID、架构分组和固定修订；visitor 始终引用 frpc。
const frpProgramName=role=>role==='server'?'frps':'frpc';
function frpProgramRef(role){return tpl('frp-template-'+role)?.programRef||{groupId:'missing-frp-'+frpProgramName(role),architectureRule:'auto',pins:[]};}
function frpLinkAssets(){
 for(const file of S.programs)ensureAsset(file);
 for(const role of Object.keys(frpRoles)){
  const t=tpl('frp-template-'+role);if(!t)continue;
  if(!t.programRef){const files=S.programs.filter(f=>f.id.startsWith('frp-bin-'+frpProgramName(role)));t.programRef={groupId:files[0]?.groupId||'missing-frp-'+frpProgramName(role),architectureRule:'auto',pins:files.map(f=>({fileId:f.id,revision:f.revision}))};}
  t.frpRole=role;t.generatedFiles=['TOML','systemd unit'];if(!t.frpSource)t.frpSource=frpSettingsSnapshot();t.revisions||=[clone({...t,revisions:undefined})];
 }
}
function frpResolveProgram(ref,host){
 const arch=sr(host)?.arch==='arm64'?'aarch64':sr(host)?.arch;
 const pin=ref?.pins?.find(p=>storedFileArchitecture(assetRevision(p.fileId,p.revision))===arch);
 const live=pin&&assetById(pin.fileId),file=live&&assetRevision(pin.fileId,pin.revision);
 const errors=[];if((ref?.pins||[]).some(p=>!assetById(p.fileId)||!assetRevision(p.fileId,p.revision)))errors.push('引用文件或固定修订失效');if(!arch)errors.push('目标架构缺失');if(!pin)errors.push('缺少匹配架构 '+(arch||'未知'));
 if(pin&&!file)errors.push('引用文件或固定修订失效');
 if(file&&(!deployableFile(file)||!Number.isInteger(file.bytes)||file.bytes<=0))errors.push('0 B / 占位或无效文件不可部署');
 if(file&&storedFileKind(file)!=='elf')errors.push('程序必须为匹配架构的 ELF 元数据');
 return {file,pin,arch,errors};
}
function frpPublicCandidate(n,role){
 const t=tpl('frp-template-'+role),base=frpSnapshot(n,role),ref=newerAssetPins(frpProgramRef(role));
 if(role==='client'&&pr(n.id)?.frpInstallation){base.files={binaryPath:S.frp.root+'/bin/frpc',toml:'',unit:'',tomlPath:'',unitPath:''};base.installationOnly=true;}
 return {...base,programRef:clone(ref),templateId:t?.id||'frp-template-'+role,configurationRevision:t?.rev||1,settings:frpSettingsSnapshot(),program:clone(frpResolveProgram(ref,base.host).file||null)};
}
function frpSettingsSnapshot(){const F=S.frp;return clone({root:F.root,systemdDir:F.systemdDir,user:F.user,token:F.token,naming:F.naming,settingsRev:F.settingsRev,templateRev:F.templateRev,templateRevisions:F.templateRevisions,templates:F.templates});}
function frpSyncPublicTemplates(){
 frpLinkAssets();for(const role of Object.keys(frpRoles)){
  const t=tpl('frp-template-'+role);if(!t)continue;
  const signature=JSON.stringify([S.frp.settingsRev,...['.toml.tpl','.service.tpl'].map(s=>S.frp.templateRevisions[frpPrefixes[role]+s])]);
  if(t.frpSignature&&t.frpSignature!==signature){t.rev++;t.frpSource=frpSettingsSnapshot();t.revisions.push(clone({...t,revisions:undefined}));}t.frpSignature=signature;
 }
}
const frpAssetBaseInitialize=initializeAssets;
initializeAssets=function(){frpAssetBaseInitialize();if(S.frp){frpLinkAssets();frpSyncConfigs();}persist();};
const frpAssetBaseReferences=assetReferences;
assetReferences=function(id,revision=null){
 const refs=frpAssetBaseReferences(id,revision),match=ref=>ref?.pins?.some(pin=>pin.fileId===id&&(revision===null||pin.revision===Number(revision)));
 for(const t of S.templates.filter(t=>t.frpRole&&match(t.programRef)))refs.configurations.push({template:t,mapping:{...t.programRef,targetPath:(t.frpSource?.root||S.frp.root)+'/bin/'+frpProgramName(t.frpRole)}});
 for(const p of S.projects.filter(p=>(p.frpRef||p.frpInstallation)&&p.life!=='uninstalled')){
  const ref=p.frpApplied?.programRef||p.frpAppliedProgramRef;
  if(!p.frpApplied||!match(ref)||p.frpApplied.program&&p.frpApplied.program.id!==id)continue;
  const role=p.frpRef?.role||p.frpInstallation.role,selected=ref.pins.find(pin=>pin.fileId===id),binary=p.frpApplied.program||assetRevision(id,selected.revision);
  refs.projects.push({project:p,mapping:{...ref,targetPath:p.frpApplied.files.binaryPath,binary:{...clone(binary||{}),id,revision:selected.revision,identity:binary?.identity||'历史模拟程序，真实内容身份未知'}}});
 }
 return refs;
};
const frpAssetBaseMark=markAssetUpdates;
markAssetUpdates=function(){frpAssetBaseMark();if(S.frp)frpSyncDrafts();};
function frpLegacyProgram(p,role){
 const file=S.programs.find(f=>f.id.startsWith('frp-bin-'+frpProgramName(role))&&f.arch===(sr(p.server)?.arch==='arm64'?'aarch64':sr(p.server)?.arch));
 if(!file)return {pins:[],groupId:'missing-history',architectureRule:'auto'};
 if(!file.revisions.some(r=>r.revision===-1))file.revisions.push({...clone(file.revisions[0]),revision:-1,bytes:null,size:'历史模拟条件 · 大小未知',placeholder:true,identity:'历史虚构程序参照，未验证真实内容',provenance:'旧原型迁移，未使用当前 0 B 占位执行'});
 return {groupId:file.groupId,architectureRule:'auto',pins:[{fileId:file.id,revision:-1}]};
}
