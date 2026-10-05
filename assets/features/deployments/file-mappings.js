'use strict';

const templateFileMappingLimit=20;
function deploymentFiles(){return assetGroups().filter(group=>group.files.some(deployableFile)).map(group=>({name:group.name,id:group.id,architectures:group.files.filter(deployableFile).map(storedFileArchitecture)}));}
function deploymentFileLabel(file){return `${file.name} · ${file.architectures.map(architecture=>architecture==='any'?'通用':architecture).join(' / ')}`;}
function templateFileMappingRows(mappings){
 const groups=assetGroups();
 return mappings.map((mapping,index)=>{
  const group=groups.find(item=>item.id===mapping.groupId),selected=group?.id||mapping.groupId||'',missing=selected&&!group;
  const options=`<option value="">选择文件</option>${missing?`<option value="${h(selected)}" selected>已不存在 · ${h(mapping.file||selected)}</option>`:''}${groups.map(item=>`<option value="${h(item.id)}" ${item.id===selected?'selected':''}>${h(item.name+' · '+item.files.map(storedFileArchitectureLabel).join(' / '))}${item.files.every(file=>!deployableFile(file))?' · 占位 / 不可部署':''}</option>`).join('')}<option value="__upload__">＋ 上传新文件…</option>`;
  const pins=mapping.pins||[],versions=pins.map(pin=>{const file=assetRevision(pin.fileId,pin.revision);return file?`${storedFileArchitectureLabel(file)} · R${pin.revision}`:`缺失修订 R${pin.revision}`;}).join(' / ');
  return `<article class="asset-mapping"><div class="field-row"><div class="field"><label for="tpl-map-file-${index}">文件 ${index+1}</label><select id="tpl-map-file-${index}" name="tpl-map-file" data-mapping-index="${index}">${options}</select></div>${select('tpl-map-rule-'+index,'架构选择规则',[['auto','匹配目标架构 / 通用'],['x86_64','仅 x86_64'],['aarch64','仅 aarch64'],['any','通用文件']],mapping.architectureRule||'auto')}</div>${field('tpl-map-path-'+index,'目标绝对路径',mapping.targetPath||'','','text','placeholder="/srv/example/path/file"')}<div class="between wrap"><span class="small muted">固定内容修订：${h(versions||'选择文件后固定当前修订')}</span><div class="flex wrap">${btn('查看文件','mapping-view',{index},'small ghost')}${mappingHasUpdate(mapping)?btn('更新修订','mapping-latest',{index},'small'):''}${btn('移除引用','template-map-remove',{index},'small ghost','trash')}</div></div></article>`;
 }).join('');
}
function templateFileMappingSection(mappings){return `<section class="file-mapping-section" aria-labelledby="template-file-mapping-title"><div class="between wrap"><div><h3 id="template-file-mapping-title">附带文件映射</h3><p class="small muted">固定所选内容修订。移除引用不会删除公共文件；目标架构在部署前检查。</p></div><div class="flex wrap">${btn('上传新文件','mapping-upload',{},'small ghost','upload')}<button type="button" class="btn small" data-action="template-map-add" ${mappings.length>=templateFileMappingLimit?'disabled':''}>添加文件映射</button></div></div><div class="file-mapping-list">${mappings.length?templateFileMappingRows(mappings):'<p class="small muted">尚未添加文件映射，可选择公共文件或上传新文件。</p>'}</div></section>`;}
function syncTemplateEditorDraft(override=null){
 const m=ui.modal,form=dialog.querySelector('form[data-form="templateedit"]');if(m?.kind!=='templateedit'||!form)return;
 const values=override||new FormData(form);m.editor={name:String(values.get('tpl-name')||''),type:String(values.get('tpl-type')||'compose'),source:String(values.get('tpl-source')??'')};
 m.fileMappings=(m.fileMappings||[]).map((mapping,index)=>{
  const selected=String(values.get('tpl-map-file')===null?mapping.groupId:values.getAll('tpl-map-file')[index]||'');const groupId=assetGroups().find(item=>item.name===selected)?.id||selected;
  const group=assetGroups().find(item=>item.id===groupId),changed=groupId!==mapping.groupId;
  return {...mapping,groupId,file:group?.name||mapping.file||'',architectureRule:String(values.get('tpl-map-rule-'+index)||mapping.architectureRule||'auto'),targetPath:String(values.get('tpl-map-path-'+index)??mapping.targetPath??''),pins:changed?(group?.files||[]).map(file=>({fileId:file.id,revision:file.revision})):mapping.pins||[]};
 });
}
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
function readTemplateFileMappings(fd){
 // 保留旧调用接口用于迁移检查；实际编辑器提交从独立草稿读取固定修订。
 const files=fd.getAll('tpl-map-file').map(String),paths=fd.getAll('tpl-map-path').map(String);
 if(files.length!==paths.length)throw new Error('文件映射输入不完整，请重新检查。');
 return validateMappings(files.map((file,index)=>pinMapping({file:assetGroups().find(group=>group.id===file)?.name||file,groupId:assetGroups().find(group=>group.id===file)?.id,targetPath:paths[index].trim()})).filter(mapping=>mapping.file||mapping.targetPath));
}
function deploymentFileFor(name,server,files=S.programs){const candidates=files.filter(file=>deployableFile(file)&&file.name===name);return candidates.find(file=>storedFileArchitecture(file)===server?.arch)||candidates.find(file=>storedFileArchitecture(file)==='any')||null;}
function resolvedFileMappings(mappings,server){return (mappings||[]).map(mapping=>({...clone(mapping),file:mappingName(mapping),binary:pinnedMappingFile(mapping,server)}));}
function fileMappingSummary(mappings){return mappings?.length?`${mappings.length} 项`:'无';}
function fileMappingPreview(mappings,server=null){return mappings?.length?`<div class="file-mapping-preview"><h3>文件映射</h3>${(server?resolvedFileMappings(mappings,server):mappings).map(mapping=>`<div class="between wrap"><strong>${h(mappingName(mapping))}</strong><code>${h(mapping.targetPath)}</code></div>`).join('')}</div>`:'';}
registerPrototypeHandlers(prototypeActions,['template-map-add','template-map-remove','mapping-view','mapping-latest','mapping-upload'],function(event,target,data,action){
 const m=ui.modal;if(m?.kind!=='templateedit')return;syncTemplateEditorDraft();const index=Number(data.index);
 if(action==='mapping-upload'){m.returnFocus=target;openModal('programupload',{returnEditor:m});return;}
 if(action==='mapping-view'){const mapping=m.fileMappings[index],pin=mapping?.pins?.[0];if(!pin){modalError('请先选择公共文件。');return;}openAssetDrawer({kind:'file',id:pin.fileId,revision:pin.revision,groupId:mapping.groupId});return;}
 if(action==='mapping-latest')m.fileMappings[index]=newerAssetPins(m.fileMappings[index]);
 else if(action==='template-map-add'){if(m.fileMappings.length>=templateFileMappingLimit){modalError('文件映射数量已达到上限。');return;}m.fileMappings.push({file:'',groupId:'',pins:[],targetPath:'',architectureRule:'auto'});}
 else m.fileMappings.splice(index,1);renderModal();
});
document.addEventListener('change',event=>{if(event.target.dataset.mappingIndex!==undefined&&ui.modal?.kind==='templateedit'){const m=ui.modal,index=Number(event.target.dataset.mappingIndex);if(event.target.value==='__upload__'){event.target.value=m.fileMappings[index]?.groupId||'';syncTemplateEditorDraft();openModal('programupload',{returnEditor:m,selectMappingIndex:index});return;}syncTemplateEditorDraft();renderModal();}});
