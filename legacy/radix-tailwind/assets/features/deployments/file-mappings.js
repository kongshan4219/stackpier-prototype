'use strict';

const templateFileMappingLimit=20;
function deploymentFiles(){return assetGroups().filter(group=>group.files.some(deployableFile)).map(group=>({name:group.name,id:group.id,architectures:group.files.filter(deployableFile).map(storedFileArchitecture)}));}
function targetFilePathError(path){
 if(typeof path!=='string'||!path.startsWith('/')||path==='/')return '目标路径必须是包含文件名的绝对路径。';
 if(/[\u0000-\u001f\u007f]/.test(path))return '目标路径不能包含控制字符。';
 if(new TextEncoder().encode(path).length>4096)return '目标路径过长，请缩短后再保存。';
 if(path.endsWith('/')||path.includes('//')||path.split('/').some(part=>part==='.'||part==='..'))return '目标路径须使用规范的绝对文件路径，不能包含空段、. 或 ..。';return '';
}
function validateMappings(mappings){
 if(mappings.length>templateFileMappingLimit)throw new Error(`单个部署配置最多 ${templateFileMappingLimit} 项文件映射。`);
 const targets=new Set();
 for(const mapping of mappings){
  const error=targetFilePathError(mapping.targetPath);if(error)throw new Error(error);
  if(targets.has(mapping.targetPath))throw new Error('目标路径 '+mapping.targetPath+' 重复，不能由多个文件覆盖。');targets.add(mapping.targetPath);
  if(!mapping.file||!mapping.targetPath)throw new Error('需要同时选择文件并填写目标路径。');
  if(!mapping.pins?.length||mapping.pins.some(pin=>!deployableFile(assetRevision(pin.fileId,pin.revision))))throw new Error('引用文件不存在或不可部署：修订缺失或为 0 B 占位，不能作为可部署资产。');
  if(!['auto','x86_64','aarch64','any'].includes(mapping.architectureRule||'auto'))throw new Error('架构选择规则无效。');
  if(mapping.architectureRule==='any'&&mapping.pins.some(pin=>storedFileArchitecture(assetRevision(pin.fileId,pin.revision))!=='any'))throw new Error('通用规则只能引用通用文件。');
 }return mappings;
}
function deploymentFileFor(name,server,files=S.programs){const candidates=files.filter(file=>deployableFile(file)&&file.name===name);return candidates.find(file=>storedFileArchitecture(file)===server?.arch)||candidates.find(file=>storedFileArchitecture(file)==='any')||null;}
function resolvedFileMappings(mappings,server){return (mappings||[]).map(mapping=>({...clone(mapping),file:mappingName(mapping),binary:pinnedMappingFile(mapping,server)}));}
function fileMappingSummary(mappings){return mappings?.length?`${mappings.length} 项`:'无';}
function fileMappingPreview(mappings,server=null){return mappings?.length?`<div class="file-mapping-preview"><h3>文件映射</h3>${(server?resolvedFileMappings(mappings,server):mappings).map(mapping=>`<div class="between wrap"><strong>${h(mappingName(mapping))}</strong><code>${h(mapping.targetPath)}</code></div>`).join('')}</div>`:'';}
