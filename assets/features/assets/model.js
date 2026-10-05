'use strict';

// 文件实体按稳定 ID 保留每次内容修订；分组只在迁移/首次上传时按逻辑名称建立。
function projectProgramFile(project){const file=project.cfg.programRef?pinnedMappingFile(project.cfg.fileMappings?.find(mapping=>mapping.groupId===project.cfg.programRef.groupId)||project.cfg.programRef,sr(project.server)):executableFileFor(project.cfg.program,sr(project.server));return file&&storedFileKind(file)==='elf'&&storedFileArchitecture(file)===sr(project.server)?.arch?file:null;}

function assetById(id){return S.programs.find(file=>file.id===id);}
function assetRevision(id,revision){const file=assetById(id);return file?.revisions?.find(item=>item.revision===Number(revision))||null;}
function assetGroups(){
 const groups=new Map();
 for(const file of S.programs){ensureAsset(file);const group=groups.get(file.groupId)||{id:file.groupId,name:file.name,files:[]};group.files.push(file);groups.set(group.id,group);}
 return [...groups.values()];
}
function ensureAsset(file){
 if(!file.groupId)file.groupId=S.programs.find(other=>other!==file&&other.name===file.name&&other.groupId)?.groupId||'asset-'+file.id;
 file.revision||=1;
 if(!file.revisions)file.revisions=[{...clone(file),revisions:undefined}];
}
function pinMapping(mapping){
 if(mapping.pins)return clone(mapping);
 const candidates=S.programs.filter(file=>file.groupId===mapping.groupId||!mapping.groupId&&file.name===(mapping.file||mapping.program));
 return {...mapping,groupId:mapping.groupId||candidates[0]?.groupId||'missing-'+(mapping.file||''),architectureRule:mapping.architectureRule||'auto',pins:candidates.map(file=>({fileId:file.id,revision:file.revision}))};
}
function pinnedMappingFile(mapping,server){
 if(!mapping.pins){const file=deploymentFileFor(mapping.file||mapping.program,server);if(file)ensureAsset(file);return file;}
 const files=mapping.pins.map(pin=>assetRevision(pin.fileId,pin.revision)).filter(deployableFile);
 const rule=mapping.architectureRule||'auto';if(rule==='any')return files.find(file=>storedFileArchitecture(file)==='any')||null;
 if(rule!=='auto'&&rule!=='any'&&rule!==server?.arch)return null;
 return files.find(file=>storedFileArchitecture(file)===server?.arch)||files.find(file=>storedFileArchitecture(file)==='any');
}
function mappingName(mapping){return assetGroups().find(group=>group.id===mapping.groupId)?.name||mapping.file||'缺失文件';}
function initializeAssets(){
 const migrating=!S.assetSchema;
 for(const file of S.programs)ensureAsset(file);
 for(const template of S.templates){
  if(['frpc','frps'].includes(template.software))continue;
  template.fileMappings=(template.fileMappings||[]).map(pinMapping);
  if(template.program&&!template.programRef)template.programRef=pinMapping({file:template.program});
  if(!template.revisions)template.revisions=[clone({...template,revisions:undefined})];
 }
 for(const project of S.projects){
  if(project.frpRef||project.frpInstallation||['frpc','frps'].includes(project.software))continue;
  project.cfg.fileMappings=(project.cfg.fileMappings||[]).map(pinMapping);
  if(project.cfg.program&&!project.cfg.programRef)project.cfg.programRef=pinMapping({file:project.cfg.program});
  if(project.applied){
   if(project.applied.program&&!project.applied.programRef)project.applied.programRef=clone(project.cfg.programRef);
   // 历史交付记录优先于当前公共资产，不能用新内容冒充旧服务器版本。
   project.applied.fileMappings=(project.applied.fileMappings||[]).map(mapping=>{
    const snapshot=project.deployedFiles?.find(item=>item.targetPath===mapping.targetPath);
    if(mapping.pins)return clone(mapping);
    if(snapshot?.binary){const old=snapshot.binary,live=assetById(old.id);if(live){ensureAsset(live);let historical=live.revisions.find(item=>item.identity===old.identity);if(!historical){historical={...clone(old),revision:Math.min(0,...live.revisions.map(item=>item.revision))-1,provenance:'迁移的历史交付元数据，历史修订标识不代表真实版本号'};live.revisions.push(historical);}snapshot.binary={...clone(historical),fileId:live.id};const pinned=pinMapping(mapping);return {...pinned,pins:pinned.pins.map(pin=>pin.fileId===live.id?{...pin,revision:historical.revision}:pin)};}}
    return pinMapping(mapping);
   });
   project.appliedSnapshot??={templateId:project.template,templateRevision:project.applied.templateRev||1,cfg:clone(project.applied),files:clone(project.deployedFiles||(project.applied.fileMappings||[]).map(mapping=>({...mapping,binary:null}))),at:project.configurationReadAt||project.observed};
   project.serverReadSnapshot??=clone(project.appliedSnapshot);
  }
 }
 markAssetUpdates();S.assetSchema=2;
 if(migrating)persist();
}
function assetReferences(id,revision=null){
 const match=mapping=>(mapping.pins||[]).some(pin=>pin.fileId===id&&(revision===null||pin.revision===Number(revision)));
 const configurations=S.templates.flatMap(template=>(template.fileMappings||[]).filter(match).map(mapping=>({template,mapping})));
 const projects=S.projects.filter(project=>project.life!=='uninstalled').flatMap(project=>(project.appliedSnapshot?.files||[]).filter(mapping=>mapping.binary?.id===id&&(revision===null||mapping.binary.revision===Number(revision))).map(mapping=>({project,mapping})));
 return {configurations,projects};
}
function templateProjects(id){return S.projects.filter(project=>project.template===id);}
function newerAssetPins(mapping){return {...mapping,file:mappingName(mapping),pins:assetGroups().find(group=>group.id===mapping.groupId)?.files.map(file=>({fileId:file.id,revision:file.revision}))||(mapping.pins||[])};}
function mappingHasUpdate(mapping,server=null){if(server){const before=pinnedMappingFile(mapping,server),after=pinnedMappingFile(newerAssetPins(mapping),server);return before?.id!==after?.id||before?.revision!==after?.revision;}return (mapping.pins||[]).some(pin=>assetById(pin.fileId)?.revision>pin.revision)||assetGroups().find(group=>group.id===mapping.groupId)?.files.some(file=>!(mapping.pins||[]).some(pin=>pin.fileId===file.id))||false;}
function markAssetUpdates(){for(const project of S.projects){
  if(project.frpRef||project.frpInstallation||['frpc','frps'].includes(project.software))continue;project.templateUpdate=(tpl(project.template)?.rev||0)>(project.cfg.templateRev||0);project.programUpdate=(project.cfg.fileMappings||[]).some(mapping=>mappingHasUpdate(mapping,sr(project.server)))||!!project.cfg.programRef&&mappingHasUpdate(project.cfg.programRef,sr(project.server));}}
function projectUpdateCfg(project){const template=tpl(project.template);return {...clone(project.cfg),...(template?{source:template.tpl,templateRev:template.rev}:{}),programRef:template?.programRef?newerAssetPins(template.programRef):project.cfg.programRef,fileMappings:(template?.fileMappings||project.cfg.fileMappings||[]).map(newerAssetPins)};}
function adoptProjectUpdate(project){project.cfg=projectUpdateCfg(project);project.draftRev++;markAssetUpdates();persist();}
function deploymentLocation(project){
 const server=sr(project.server),mainPath=project.type==='compose'?`/srv/stackpier-demo/${project.name}/compose.yaml`:`/etc/systemd/system/${project.name}.service`;
 const files=resolvedFileMappings(project.cfg.fileMappings,server),errors=[],warnings=[],targets=new Set([mainPath]);
 const targetError=serverOperationError(project.server);if(targetError)errors.push(targetError);
 if(project.type==='systemd'&&project.cfg.program&&!projectProgramFile(project))errors.push('主程序缺少匹配架构 '+(server?.arch||'未知')+'。');
 for(const mapping of files){const error=targetFilePathError(mapping.targetPath);if(error)errors.push(error);if(targets.has(mapping.targetPath))errors.push('路径冲突：'+mapping.targetPath);targets.add(mapping.targetPath);if(!mapping.binary)errors.push(mappingName(mapping)+'：文件无效、占位或缺少匹配架构 '+(server?.arch||'未知'));}
 if(project.type==='compose'&&!server?.docker)errors.push('目标缺少 Docker / Compose（模拟环境状态）。');
 const occupied=S.projects.find(other=>other.id!==project.id&&other.server===project.server&&other.life==='installed'&&project.cfg.port&&Number(other.applied?.port)===Number(project.cfg.port));if(occupied)errors.push('端口已由 '+occupied.name+' 使用。');
 for(const other of S.projects.filter(other=>other.server===project.server&&other.life==='installed')){
  const paths=[other.type==='compose'?`/srv/stackpier-demo/${other.name}/compose.yaml`:`/etc/systemd/system/${other.name}.service`,...(other.appliedSnapshot?.files||[]).map(file=>file.targetPath)];
  for(const path of targets)if(other.id!==project.id&&paths.includes(path)){errors.push('目标路径已由 '+other.name+' 使用：'+path+'；请适配此项目配置。');warnings.push('可能覆盖 '+other.name+' 的目标：'+path+'（模拟记录）');}
 }
 return {mainPath,files,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
