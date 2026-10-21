'use strict';

// 摘要只来自已保存的模拟文件内容；历史元数据缺少内容时保持未知。
const projectTextDigests=new Map(),projectDigestRequests=new Map(),projectFileReads=new Set();
function projectTextSHA(text){return typeof text==='string'?projectTextDigests.get(text)||'':'';}
function digestProjectText(text){
 if(typeof text!=='string')return Promise.resolve('');
 if(projectTextDigests.has(text))return Promise.resolve(projectTextDigests.get(text));
 if(!projectDigestRequests.has(text))projectDigestRequests.set(text,crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)).then(buffer=>{
  const hash=Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');projectTextDigests.set(text,hash);return hash;
 }).finally(()=>projectDigestRequests.delete(text)));
 return projectDigestRequests.get(text);
}
function projectIsFrp(p){return !projectUsesUnitBody(p)&&!!(p.frpService||p.frpRef||p.frpInstallation||['frpc','frps'].includes(p.software));}
function projectSnapshot(p,observed=false){return observed?p.serverReadSnapshot:p.appliedSnapshot;}
function projectReferenceKey(p){return JSON.stringify([p.id,p.server,p.name,p.appliedSnapshot||null,p.frpApplied||null]);}
function projectFixedFiles(p,snapshot=projectSnapshot(p)){
 if(!snapshot)return [];
 const cfg=snapshot.cfg||{},mappings=snapshot.files||[];
 const program=snapshot.program||mappings.find(item=>storedFileKind(item.binary||{})==='elf')?.binary;
 const configMapping=mappings.find(item=>item.binary&&storedFileKind(item.binary)!=='elf');
 const programMapping=program?.id?mappings.find(item=>item.binary?.id===program.id):null;
 const directory=cfg.dataDir?.replace(/\/data\/?$/,'')||`/srv/stackpier-demo/${p.name}`;
 const source=typeof cfg.source==='string'?cfg.source:null;
 if(projectUsesUnitBody(p,cfg))return [{kind:'unit',path:'/etc/systemd/system/'+p.name+'.service',name:p.name+'.service',sha256:snapshot.unitSHA256||projectTextSHA(source),size:source===null?null:new TextEncoder().encode(source).length}];
 const assetFile=(kind,file,path)=>({kind,path,name:file?.filename||file?.name||'历史文件信息缺失',sha256:file?.sha256||'',size:file?.bytes??null});
 return [
  assetFile('program',program,programMapping?.targetPath||directory+'/'+(cfg.program||'program')),
  assetFile('config',configMapping?.binary,configMapping?.targetPath||directory+'/config.json'),
  {kind:'unit',path:'/etc/systemd/system/'+p.name+'.service',name:p.name+'.service',sha256:snapshot.unitSHA256||projectTextSHA(source),size:source===null?null:new TextEncoder().encode(source).length}
 ];
}
async function prepareProjectConfiguration(p){
 await Promise.all([p.appliedSnapshot?.cfg?.source,p.serverReadSnapshot?.cfg?.source].map(digestProjectText));
}
const projectFileStateLabels={same:'一致',changed:'远端被改',missing:'缺失',unknown:'无法读取 / 无法确认'};
const projectFileReasons={reference:'历史部署参照摘要不完整',unavailable:'远端响应无法确认',unreadable:'读取失败、路径不安全、超限或读取期间变化'};
async function checkProjectFiles(p,scenario=p.fileCheckScenario||'same'){
 if(projectIsFrp(p)||p.type!=='systemd'||projectFileReads.has(p.id))return;
 const reference=projectReferenceKey(p);projectFileReads.add(p.id);render();
 try{
  await Promise.all([prepareProjectConfiguration(p),digestProjectText('虚构的远端独立变更')]);
  if(pr(p.id)!==p||reference!==projectReferenceKey(p))return;
  const checked=now(),expected=projectFixedFiles(p),remote=projectFixedFiles(p,projectSnapshot(p,true));
  const failed=scenario==='unknown'||p.life!=='installed'||!!serverOperationError(p.server)||!!p.components?.length;
  const files=expected.map(file=>{
   const seen=remote.find(item=>item.path===file.path),old=p.fileCheck?.files.find(item=>item.path===file.path);
   let state='unknown',reason='',sha256='',size=null;
   if(failed)reason='unavailable';
   else if(!file.sha256)reason='reference';
   else if((file.kind==='config'||projectUsesUnitBody(p)&&file.kind==='unit')&&scenario==='missing')state='missing';
   else if(seen?.sha256){sha256=seen.sha256;size=seen.size;state=sha256===file.sha256?'same':'changed';}
   else reason='unreadable';
   if(!failed&&(file.kind==='config'||projectUsesUnitBody(p)&&file.kind==='unit')&&scenario==='changed'&&file.sha256){state='changed';sha256=projectTextSHA('虚构的远端独立变更');size=new TextEncoder().encode('虚构的远端独立变更').length;}
   const previous=state==='unknown'?(old?.state==='unknown'?old.previous:old):null;
   return {kind:file.kind,path:file.path,expectedSHA256:file.sha256,state,reason,sha256,size,checked,...(previous?{previous:clone(previous)}:{})};
  });
  p.fileCheck={reference,checked,files,error:failed?'远端响应无法确认':''};
  persist();
 }catch{
  // 本次异常不覆盖既有观测，界面明确其历史身份。
  if(pr(p.id)===p)p.fileCheck={...p.fileCheck,error:'本次摘要核对未完成'};
 }finally{projectFileReads.delete(p.id);render();}
}
registerPrototypeHandlers(prototypeActions,['checkprojectfiles'],function(event,target,data){
 const p=pr(data.id);if(p)void checkProjectFiles(p);
});
