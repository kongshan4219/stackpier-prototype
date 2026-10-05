'use strict';

registerPrototypeHandlers(prototypeActions,['deployment-adapt'],()=>{
 const m=ui.modal;if(m?.kind!=='deploymentpreview')return;
 openModal('deploymentadapt',{draft:clone(m.draft),origin:clone(m.origin),serverArchitecture:m.serverArchitecture});
});
registerPrototypeHandlers(prototypeModals,['deploymentadapt'],m=>{
 layout('复制为此项目配置 · '+m.draft.name,'只编辑本次项目副本；公共配置和其他项目保持。正文原样交付，不做变量替换。',`<div class="stack">${detail([['项目显示名称',h(m.draft.name)],['目标服务器',h(sname(m.draft.server))],['unit 名称',h(m.draft.name+'.service')]])}${area('adapt-body','实际交付正文',m.draft.cfg.source||'','请自行核对 ExecStart、WorkingDirectory、程序和数据路径；原型不理解任意脚本语义。',14)}${field('adapt-port','声明的监听端口',m.draft.cfg.port??'','用于已知同机端口冲突检查；不从正文推断。','number','min="1" max="65535"')}<h3>全部附带文件落点</h3>${(m.draft.cfg.fileMappings||[]).map((mapping,i)=>field('adapt-path-'+i,mappingName(mapping),mapping.targetPath,'目标绝对路径；更改不会修改公共文件。','text','required')).join('')||'<p class="muted">没有附带文件。</p>'}</div>`,btn('返回预览，保留编辑','adapt-back')+'<button class="btn primary" type="submit">保存副本并重新预览</button>',true,'deploymentadapt');
});
function readAdaptation(m,fd){
 const cfg=clone(m.draft.cfg);cfg.source=String(fd.get('adapt-body')||'');const port=String(fd.get('adapt-port')||'');cfg.port=port?Number(port):null;cfg.projectLocal=true;cfg.localTemplateId=m.draft.template;
 cfg.fileMappings=(cfg.fileMappings||[]).map((mapping,i)=>({...mapping,targetPath:String(fd.get('adapt-path-'+i)||'').trim()}));return cfg;
}
function saveAdaptationDraft(){const m=ui.modal;if(m?.kind!=='deploymentadapt')return;const form=dialog.querySelector('form');if(!form)return;m.draft.cfg=readAdaptation(m,new FormData(form));S.interactionDrafts||={};S.interactionDrafts['newproject|new']={...m.origin,projectConfig:clone(m.draft.cfg)};persist();}
document.addEventListener('input',saveAdaptationDraft);document.addEventListener('change',saveAdaptationDraft);
registerPrototypeHandlers(prototypeForms,['deploymentadapt'],(event,form,fd,get,has,all,m)=>{
 if(m?.kind!=='deploymentadapt')return;const cfg=readAdaptation(m,fd);if(!cfg.source.trim())return modalError('正文不能为空。');if(cfg.port!==null&&(!Number.isInteger(cfg.port)||cfg.port<1||cfg.port>65535))return modalError('声明端口须为 1–65535 整数。');
 try{cfg.fileMappings=validateMappings(cfg.fileMappings);}catch(error){return modalError(error.message);}
 m.draft.cfg=cfg;openModal('deploymentpreview',{draft:clone(m.draft),origin:{...m.origin,projectConfig:clone(cfg)},serverArchitecture:m.serverArchitecture});
});
registerPrototypeHandlers(prototypeActions,['adapt-back'],()=>{saveAdaptationDraft();const m=ui.modal;if(m?.kind==='deploymentadapt')openModal('deploymentpreview',{draft:clone(m.draft),origin:{...m.origin,projectConfig:clone(m.draft.cfg)},serverArchitecture:m.serverArchitecture});});
