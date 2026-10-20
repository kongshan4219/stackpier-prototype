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
document.addEventListener('change',event=>{if(event.target.id==='tpl-files'&&ui.modal?.kind==='templateedit')return configurationUploadFiles(ui.modal,event.target.files||[]);});
registerPrototypeHandlers(prototypeActions,['configuration-file-remove'],(event,target,data)=>{
 const m=ui.modal;if(m?.kind!=='templateedit'||m.uploading||m.saving)return;
 syncTemplateEditorDraft();m.editor.files=m.editor.files.filter(file=>file.path!==data.path);renderModal();cacheTemplateDraft();
});
