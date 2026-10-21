'use strict';

function configurationVariableError(source){
 let value;try{value=JSON.parse(source);}catch{return '显式变量需为 JSON 对象。';}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>64||Object.entries(value).some(([key,item])=>!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key)||typeof item!=='string'||new TextEncoder().encode(item).length>8192||item.includes('\0')))return '显式变量名称须合法，所有值须为字符串。';
 return '';
}
function configurationSaveError(t,v,token){
 if(!v.name.trim()||v.name.trim().length>100)return '请填写不超过 100 字符的配置名称。';
 if(t&&t.rev!==v.revision)return '部署配置已更新，请重新读取后编辑；本次未覆盖保存';
 if(t&&deploymentType(t)!==v.type)return '已有部署配置不能更换类型，请新建对应类型的配置';
 if(t?.frpRole&&t.frpRole!==v.role)return '已有 FRP 配置不能更换角色，请新建配置';
 if(v.type!=='compose'&&!configurationVersions('program',v.type).some(file=>configurationVersionValue({fileId:file.id,revision:file.revision})===v.programVersion))return '请选择有效的程序固定版本。';
 if(v.type==='systemd'){
  if(!configurationVersions('config',v.type).some(file=>configurationVersionValue({fileId:file.id,revision:file.revision})===v.configVersion)||!Number.isInteger(v.port)||v.port<1024||v.port>65535)return '配置需程序、配置文件及 1024–65535 健康检查端口';
 }
 if(v.type==='compose'){
  if(!v.source.trim())return '请填写 Compose YAML 正文。';
  return configurationVariableError(v.variables)||configurationFileError(v.files)||configurationMappingError(v.mappings||[]);
 }
 if(v.type==='frp')return configurationFrpError(v,token);
 return '';
}
registerPrototypeHandlers(prototypeForms,['templateedit'],(event,form,fd,get,has,all,m)=>{
 if(!m?.editor||m.saving||m.uploading)return;
 const t=tpl(m.id),v=readConfigurationDraft(m,fd),token=String(fd.get('fc-token')||'');
 if(m.id&&!t)return modalError('部署配置已不存在，本次未保存。');
 if(fd.has('tpl-type')&&fd.get('tpl-type')!==v.type)return modalError('配置类型已改变，请重新选择后编辑。');
 const error=configurationSaveError(t,v,token);m.editor=v;cacheTemplateDraft();if(error)return modalError(error);
 const common={...t,id:t?.id||uid('template'),name:v.name.trim(),type:v.type,editorSchema:1,rev:(t?.rev||0)+1};
 let n;
 if(v.type==='systemd')n={...common,programRef:configurationPin(v.programVersion),configRef:configurationPin(v.configVersion),program:configurationVersion(v.programVersion).name,port:v.port,software:t?.software||'custom',tpl:'',contentMode:'managed',fileMappings:[],desc:'固定程序、配置文件与健康检查端口'};
 else if(v.type==='compose')n={...common,tpl:v.source,variables:v.variables,composeFiles:clone(v.files),pathMappings:configurationNormalizeMappings(v.mappings||[]),fileMappings:[],programRef:null,program:'',port:null,contentMode:'file',desc:'已保存 Compose 正文、显式变量与文件／目录映射'};
 else n={...common,...configurationFrpTemplate(t,v,token)};
 n.revisions=[...(t?.revisions||[]),clone({...n,revisions:undefined})];
 m.saving=true;
 const templates=t?S.templates.map(item=>item.id===t.id?n:item):[...S.templates,n],next={...S,templates};delete next.configurationEditorReturn;
 // 附件可能超过浏览器配额，先确认持久化成功，再替换当前配置与清除草稿。
 try{localStorage.setItem(STORE,JSON.stringify(next));}catch{m.saving=false;return modalError('浏览器存储空间不足或不可用，本次未保存；请移除部分附件后重试。');}
 S.templates=templates;storageOK=true;
 configurationDrafts.delete(configurationDraftKey(m.id,v.type));m.saved=true;m.token='';configurationForgetContext();markAssetUpdates();persist();
 const back=m.returnDeployment;closeModal();render();if(back)returnToDeployment(back,n.id);toast('部署配置已保存；已有项目保留各自的固定版本。','success');
});
