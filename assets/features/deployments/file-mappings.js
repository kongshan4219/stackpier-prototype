'use strict';

const templateFileMappingLimit=20;

// 同名文件的通用版本和不同架构版本属于同一个部署选择，部署时再匹配目标服务器。
function deploymentFiles(){
 const groups=new Map();
 for(const file of S.programs){
  if(!deployableFile(file))continue;
  const group=groups.get(file.name)||{name:file.name,architectures:new Set()};
  group.architectures.add(storedFileArchitecture(file));groups.set(file.name,group);
 }
 return [...groups.values()].map(group=>({name:group.name,architectures:[...group.architectures].sort((a,b)=>a===universalFileArchitecture?-1:b===universalFileArchitecture?1:a.localeCompare(b))})).sort((a,b)=>a.name.localeCompare(b.name));
}

function deploymentFileLabel(file){return `${file.name} · ${file.architectures.map(architecture=>architecture===universalFileArchitecture?'通用':architecture).join(' / ')}`;}

function templateFileMappingRows(mappings){
 const files=deploymentFiles();
 return mappings.map((mapping,index)=>{
  const selected=mapping.file||mapping.program||'',missing=selected&&!files.some(file=>file.name===selected);
  const options=`<option value="">选择文件</option>${missing?`<option value="${h(selected)}" selected>已不存在 · ${h(selected)}</option>`:''}${files.map(file=>`<option value="${h(file.name)}" ${file.name===selected?'selected':''}>${h(deploymentFileLabel(file))}</option>`).join('')}`;
  return `<div class="file-mapping-row"><div class="field"><label for="tpl-map-file-${index}">文件</label><select id="tpl-map-file-${index}" name="tpl-map-file" aria-label="文件 ${index+1}">${options}</select></div><div class="field"><label for="tpl-map-path-${index}">目标绝对路径</label><input id="tpl-map-path-${index}" name="tpl-map-path" value="${h(mapping.targetPath)}" placeholder="/srv/example/path/file" autocomplete="off" aria-label="目标绝对路径 ${index+1}"></div>${btn('删除','template-map-remove',{index},'small ghost','trash')}</div>`;
 }).join('');
}

function templateFileMappingSection(mappings){
 const files=deploymentFiles(),limitReached=mappings.length>=templateFileMappingLimit;
 return `<section class="file-mapping-section" aria-labelledby="template-file-mapping-title"><div class="between"><div><h3 id="template-file-mapping-title">文件映射</h3><p class="small muted">选择文件后填写目标服务器上的绝对路径；ELF 优先匹配目标架构，通用文件适用于所有架构。</p></div><button type="button" class="btn small" data-action="template-map-add" ${limitReached||!files.length?'disabled':''}>添加文件映射</button></div>${files.length?'':notice('暂无可映射的文件','请先在“文件”页面上传。','warning')}<div class="file-mapping-list">${mappings.length?templateFileMappingRows(mappings):'<p class="file-mapping-empty small muted">尚未添加文件映射。</p>'}</div>${limitReached?`<p class="small muted">单个部署配置最多 ${templateFileMappingLimit} 项文件映射。</p>`:''}</section>`;
}

function syncTemplateEditorDraft(){
 const m=ui.modal,form=dialog.querySelector('form[data-form="templateedit"]');
 if(m?.kind!=='templateedit'||!form)return;
 const values=new FormData(form),files=values.getAll('tpl-map-file').map(String),paths=values.getAll('tpl-map-path').map(String);
 m.editor={name:String(values.get('tpl-name')||''),type:String(values.get('tpl-type')||'compose'),source:String(values.get('tpl-source')??'')};
 m.fileMappings=files.map((file,index)=>({file,targetPath:paths[index]||''}));
}

function targetFilePathError(path){
 if(!path.startsWith('/')||path==='/')return '目标路径必须是包含文件名的绝对路径。';
 if(/[\u0000-\u001f\u007f]/.test(path))return '目标路径不能包含控制字符。';
 if(new TextEncoder().encode(path).length>4096)return '目标路径过长，请缩短后再保存。';
 if(path.endsWith('/')||path.includes('//')||path.split('/').some(part=>part==='.'||part==='..'))return '目标路径须使用规范的绝对文件路径，不能包含空段、. 或 ..。';
 return '';
}

function readTemplateFileMappings(fd){
 const files=fd.getAll('tpl-map-file').map(value=>String(value).trim()),paths=fd.getAll('tpl-map-path').map(value=>String(value).trim());
 if(files.length!==paths.length)throw new Error('文件映射输入不完整，请重新检查。');
 if(files.length>templateFileMappingLimit)throw new Error(`单个部署配置最多 ${templateFileMappingLimit} 项文件映射。`);
 const available=new Set(deploymentFiles().map(file=>file.name)),targets=new Set(),pairs=new Set(),mappings=[];
 for(let index=0;index<files.length;index++){
  const file=files[index],targetPath=paths[index];
  if(!file&&!targetPath)continue;
  if(!file||!targetPath)throw new Error(`第 ${index+1} 项文件映射需要同时选择文件并填写目标路径。`);
  if(!available.has(file))throw new Error(`第 ${index+1} 项选择的文件已不存在或不可部署。`);
  const pathError=targetFilePathError(targetPath);if(pathError)throw new Error(`第 ${index+1} 项：${pathError}`);
  if(targets.has(targetPath))throw new Error(`目标路径 ${targetPath} 重复，不能由多个文件覆盖。`);
  const pair=file+'\0'+targetPath;if(pairs.has(pair))throw new Error('存在重复的文件映射。');
  targets.add(targetPath);pairs.add(pair);mappings.push({file,targetPath});
 }
 return mappings;
}

function deploymentFileFor(name,server,files=S.programs){
 const candidates=files.filter(file=>deployableFile(file)&&file.name===name);
 return candidates.find(file=>storedFileArchitecture(file)===server?.arch)||candidates.find(file=>storedFileArchitecture(file)===universalFileArchitecture)||null;
}

function resolvedFileMappings(mappings,server){
 return (mappings||[]).map(mapping=>{const file=mapping.file||mapping.program;return {file,targetPath:mapping.targetPath,binary:deploymentFileFor(file,server)};});
}

function fileMappingSummary(mappings){return mappings?.length?`${mappings.length} 项`:'无';}

function fileMappingPreview(mappings,server=null){
 if(!mappings?.length)return '';
 const resolved=server?resolvedFileMappings(mappings,server):mappings.map(mapping=>({...mapping,binary:null}));
 return `<div class="file-mapping-preview"><h3>文件映射</h3><div class="stack">${resolved.map(mapping=>`<div class="between"><span><strong>${h(mapping.file||mapping.program)}</strong>${server?`<small class="cell-sub">${mapping.binary?h(mapping.binary.filename+' · '+storedFileArchitectureLabel(mapping.binary)):'缺少适用于 '+h(server.arch)+' 的文件'}</small>`:''}</span><code>${h(mapping.targetPath)}</code></div>`).join('')}</div></div>`;
}

registerPrototypeHandlers(prototypeActions,['template-map-add','template-map-remove'],function(event,target,data,action){
 const m=ui.modal;if(m?.kind!=='templateedit')return;
 syncTemplateEditorDraft();
 if(action==='template-map-add'){
  if(m.fileMappings.length>=templateFileMappingLimit){modalError(`单个部署配置最多 ${templateFileMappingLimit} 项文件映射。`);return;}
  m.fileMappings.push({file:'',targetPath:''});
 }else{
  const index=Number(data.index);if(!Number.isInteger(index)||index<0||index>=m.fileMappings.length)return;
  m.fileMappings.splice(index,1);
 }
 renderModal();
});
