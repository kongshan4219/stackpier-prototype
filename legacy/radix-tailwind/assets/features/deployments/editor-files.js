'use strict';

function configurationFileError(files){
 if(files.length>32||files.some(file=>!/^files\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(file.path)||file.size<1||file.size>1048576))
  return '附加文件须使用英文、数字或 ._- 命名，单文件 1 B–1 MiB，最多 32 个。';
 if(files.reduce((total,file)=>total+file.size,0)>2097152)return '附加文件总计不超过 2 MiB，最多 32 个。';
 return '';
}
async function configurationUploadFiles(m,chosen){
 if(m.saving)return;syncTemplateEditorDraft();const sequence=m.uploadSequence=(m.uploadSequence||0)+1;m.uploading=true;
 renderModal();
 try{
  const list=[...chosen],metadata=list.map(file=>({path:'files/'+file.name,size:file.size})),error=configurationFileError(metadata);if(error)throw Error(error);
  const values=await Promise.all(list.map(async file=>{
   const bytes=new Uint8Array(await file.arrayBuffer());let binary='';
   for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
   return {path:'files/'+file.name,data:btoa(binary),size:bytes.length};
  }));
  if(ui.modal!==m||m.editor.type!=='compose'||m.uploadSequence!==sequence)return;
  const files=[...new Map([...m.editor.files,...values].map(file=>[file.path,file])).values()],combinedError=configurationFileError(files);if(combinedError)throw Error(combinedError);
  // 读取期间允许修改正文和变量，合并时保留用户的最新输入。
  syncTemplateEditorDraft();m.editor.files=files;m.uploading=false;renderModal();cacheTemplateDraft();
 }catch(error){if(ui.modal===m&&m.uploadSequence===sequence){m.uploading=false;syncTemplateEditorDraft();renderModal();modalError(error.message);}}
 finally{if(ui.modal===m&&m.uploadSequence===sequence)m.uploading=false;}
}

registerPrototypeHandlers(prototypeActions,['configuration-file-remove'],(event,target,data)=>{
 const m=ui.modal;if(m?.kind!=='templateedit'||m.uploading||m.saving)return;
 syncTemplateEditorDraft();m.editor.files=m.editor.files.filter(file=>file.path!==data.path);renderModal();cacheTemplateDraft();
});

function configurationMappingFields(v,m){
 const mappings=v.mappings||[];
 return `<section class="compose-mappings" aria-label="文件与目录映射"><div class="actions"><strong>文件与目录映射</strong>${mappings.length<32?btn('添加映射','configuration-mapping-add',{},'small'):''}</div>${mappings.length?'<div class="mapping-head" aria-hidden="true"><span>类型</span><span>本机绝对路径</span><span>远程绝对路径</span></div>':''}${mappings.map((row,i)=>`<div class="mapping-row" role="group" aria-label="映射 ${i+1}"><div class="mapping-kind"><select id="tpl-map-kind-${i}" name="tpl-map-kind-${i}" aria-label="映射 ${i+1} 类型"><option value="file" ${row.kind==='file'?'selected':''}>文件</option><option value="directory" ${row.kind==='directory'?'selected':''}>目录</option></select>${btn('×','configuration-mapping-remove',{index:i},'small')}</div><input id="tpl-map-local-${i}" name="tpl-map-local-${i}" aria-label="映射 ${i+1} 本机绝对路径" value="${h(row.localPath)}" required pattern="/.*" maxlength="1024" placeholder="/srv/config/nginx.conf"><input id="tpl-map-remote-${i}" name="tpl-map-remote-${i}" aria-label="映射 ${i+1} 远程绝对路径" value="${h(row.remotePath)}" required pattern="/.*" maxlength="1024" placeholder="/srv/nginx/nginx.conf"></div>`).join('')}<p class="muted">本机指运行栈桥管理端的机器。目录同步内容，两端末尾有无 / 均可；文件须填写完整文件名。部署前使用 rsync 完全同步目录，会删除远程映射目录内多余文件和子目录；文件只覆盖对应目标文件。全部同步成功后启动。</p><p class="muted">${v.type==='systemd'?'服务文件中的程序、配置等路径须与远程落点一致。':'Compose 使用远程绝对路径只读挂载。'}最多 32 行、合计 32 MiB／1024 个文件与目录条目。同步目标在卸载时保留。原型仅模拟，不读取本机文件或执行 rsync。</p></section>`;
}
function configurationNormalizeMappings(rows){return rows.map(row=>({...row,...(row.kind==='directory'?{localPath:row.localPath.replace(/\/+$/,''),remotePath:row.remotePath.replace(/\/+$/,'')}:{})}));}
function configurationMappingError(rows){
 if(rows.length>32)return '文件与目录映射最多 32 行';
 const normalized=configurationNormalizeMappings(rows),valid=value=>value.startsWith('/')&&value!=='/'&&value.length<=1024&&!/[\0\r\n]/.test(value)&&!value.split('/').slice(1).some(part=>!part||part==='.'||part==='..'),overlap=(a,b)=>a===b||a.startsWith(b+'/')||b.startsWith(a+'/');
 for(const [i,row] of normalized.entries()){
  if(!['file','directory'].includes(row.kind)||!valid(row.localPath)||!valid(row.remotePath))return '映射两端须为有效绝对路径；文件须填写完整文件名';
  if(['/proc','/sys','/dev','/run','/opt/stackpier','/opt/stackpier-compose','/var/lib/stackpier','/var/lib/stackpier-compose'].some(path=>overlap(path,row.remotePath)))return '映射目标与系统运行目录或栈桥受管目录冲突';
  if(normalized.slice(0,i).some(old=>overlap(old.remotePath,row.remotePath)))return '远程映射路径不能重复或相互包含';
 }
 return '';
}
function configurationMappingSummary(rows,fixed=false){return rows.map(row=>`<p>${row.kind==='file'?'文件 · 覆盖目标文件':!fixed||row.deleteExtraneous?'目录 · 完全同步，删除多余条目':'目录 · 覆盖同名，保留多余条目'} · <code>${h(row.localPath)}</code> → <code>${h(row.remotePath)}</code></p>`).join('')+(rows.length?notice('部署前 rsync 同步','目录按上述规则同步；文件只覆盖目标文件。全部同步成功后启动，卸载保留映射目标。浏览器只做模拟。'):'');}
registerPrototypeHandlers(prototypeActions,['configuration-mapping-add','configuration-mapping-remove'],(event,target,data)=>{
 const m=ui.modal;if(m?.kind!=='templateedit'||m.saving)return;syncTemplateEditorDraft();
 if(target.dataset.action==='configuration-mapping-add'){if(m.editor.mappings.length<32)m.editor.mappings.push({kind:'file',localPath:'',remotePath:''});}
 else m.editor.mappings.splice(Number(data.index),1);
 renderModal();cacheTemplateDraft();
});
