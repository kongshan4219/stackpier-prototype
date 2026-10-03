'use strict';

function pending(p){return !p.applied||JSON.stringify(p.cfg)!==JSON.stringify(p.applied)}

function configText(p,c=p.cfg){
 if(!c)return '尚无已部署文件';
 if(typeof c.source==='string')return c.source;
 const env=String(c.env||'').split('\n').filter(Boolean);
 if(p.type==='compose')return `services:\n  ${p.software}:\n    image: ${c.program}:${c.version}\n    ports: ["${c.port}:${p.software==='mysql'?3306:p.software==='redis'?6379:80}"]\n    volumes: ["${c.dataDir}:/data"]\n    environment:\n${env.map(x=>'      - '+x).join('\n')}`;
 return `[Unit]\nDescription=${p.name}\nAfter=network.target\n\n[Service]\nType=simple\nUser=${c.serviceUser}\nWorkingDirectory=/srv/stackpier-demo/${p.name}\nExecStart=/srv/stackpier-demo/${p.name}/${c.program} --config app.conf\n${env.map(x=>'Environment='+x).join('\n')}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target`;
}

function projectRuntimeFile(p){
 if(!p.applied||['draft','uninstalled'].includes(p.life))return null;
 return p.type==='compose'
  ?{label:'Docker Compose 文件',path:`/srv/stackpier-demo/${p.name}/compose.yaml`,content:configText(p,p.applied)}
  :{label:'systemd 服务文件',path:`/etc/systemd/system/${p.name}.service`,content:configText(p,p.applied)};
}

function projectConfigurationReadState(p){
 if(!p.applied||p.life==='draft')return {tone:'',label:'尚未部署',message:'项目尚未形成服务器运行文件。'};
 if(p.life==='uninstalled')return {tone:'',label:'已卸载',message:'运行文件已随项目卸载，保留的项目记录不代表服务器上仍有文件。'};
 if(p.life==='incomplete'||p.components?.length)return {tone:'warning',label:'读取待核对',message:'服务器文件存在未完成变更；下方保留最近一次可确认的完整文件快照。'};
 if(sr(p.server)?.state!=='online'||p.configurationReadStatus==='unknown')return {tone:'warning',label:'读取失败',message:'当前无法读取目标服务器；下方保留最近一次可确认的文件快照。'};
 return {tone:'success',label:'读取成功',message:'展示目标服务器上的当前文件，内容只读。'};
}

function latestMappedFileSnapshots(p){
 if(p.deployedFiles?.length)return p.deployedFiles;
 const operation=S.operations.find(item=>item.project===p.id&&item.status==='success'&&['deploy','apply','update'].includes(item.kind)&&item.input?.mappedFiles?.length);
 return operation?.input.mappedFiles||[];
}

function projectMappedFiles(p){
 if(['draft','uninstalled'].includes(p.life))return [];
 const snapshots=latestMappedFileSnapshots(p);
 return (p.applied?.fileMappings||[]).map(mapping=>{
  const snapshot=snapshots.find(item=>item.targetPath===mapping.targetPath&&item.file===mapping.file);
  return {...mapping,binary:snapshot?.binary||null};
 });
}

function observedFileIdentity(file){
 if(!file)return '未取得文件信息';
 if(file.sha256)return 'SHA-256 '+file.sha256;
 return file.identity||'样例文件没有可验证摘要';
}

function mappedServerFiles(p){
 const mappings=projectMappedFiles(p),current=p.life==='installed'&&!p.components?.length&&sr(p.server)?.state==='online'&&p.configurationReadStatus!=='unknown';
 if(!mappings.length)return empty('没有映射文件','当前已部署配置没有文件映射。');
 return `<div class="server-file-list">${mappings.map(mapping=>{const file=mapping.binary;return `<article class="server-file-item"><div class="between"><div><strong>${h(mapping.file)}</strong><p class="cell-sub mono">${h(mapping.targetPath)}</p></div>${badge(file?(current?'已读取':'上次读取'):'读取失败',file?(current?'success':'warning'):'warning')}</div>${file?detail([['服务器文件名',h(file.filename||file.name)],['类型 / 适用范围',h(storedFileTypeLabel(file)+' · '+storedFileArchitectureLabel(file))],['大小',h(file.size||'未知')],['内容身份',`<span class="mono server-file-identity">${h(observedFileIdentity(file))}</span>`]]):`<p class="small muted">目标路径仍在项目记录中，但没有取得服务器文件信息。</p>`}</article>`}).join('')}</div>`;
}

function projectConfig(p){
 const state=projectConfigurationReadState(p),runtimeFile=projectRuntimeFile(p),readAt=p.configurationReadAt||p.observed||sr(p.server)?.checked,attemptAt=p.configurationReadAttemptAt;
 const readSummary=state.tone==='warning'&&attemptAt?`最近成功读取：${fmt(readAt)}；最近尝试：${fmt(attemptAt)}`:`最近读取：${fmt(readAt)}`;
 const intro=notice('直接读取服务器文件',`${state.message} ${readSummary}。原型仅模拟读取结果，不建立真实 SSH 连接。`,state.tone==='warning'?'warning':'');
 const runtimeBody=runtimeFile?`<div class="server-file-path"><code>${h(runtimeFile.path)}</code>${badge(state.label,state.tone)}</div><pre class="code project-config-file">${h(runtimeFile.content)}</pre>`:empty(state.label,state.message);
 const sourceBody=detail([['部署配置',h(tpl(p.template)?.name||'已移除')],['当前修订',h(tpl(p.template)?.rev||'—')],['已部署修订',h(p.appliedRev||'—')],['待应用内容',pending(p)?badge('有','warning'):badge('无','success')],['映射文件',h(fileMappingSummary(p.applied?.fileMappings))]])+`${p.templateUpdate?`<div class="mt">${notice('部署配置有新修订','采用后仍需明确执行应用，服务器文件不会因保存配置自动改变。','warning')}${btn('采用到项目','adopttemplate',{id:p.id},'mt')}</div>`:''}`;
 return `<div class="mb">${intro}</div><div class="grid2"><section class="card"><div class="card-head"><h2>${h(runtimeFile?.label||'运行文件')}</h2>${btn('重新读取','refreshprojectfiles',{id:p.id},'small ghost','refresh')}</div><div class="card-body stack">${runtimeBody}</div></section><div class="stack">${card('映射到服务器的文件',mappedServerFiles(p))}${card('部署来源',sourceBody,btn('查看部署配置','templateedit',{id:p.template},'small ghost'))}</div></div>`;
}

registerPrototypeHandlers(prototypeActions,['adopttemplate','refreshprojectfiles'],function(event,target,data,action){
 const p=pr(data.id);if(!p)return;
 if(action==='refreshprojectfiles'){
  p.configurationReadAttemptAt=now();
  p.configurationReadStatus=p.life==='installed'&&!!p.applied&&sr(p.server)?.state==='online'?'success':'unknown';
  if(p.configurationReadStatus==='success')p.configurationReadAt=p.configurationReadAttemptAt;
  persist();render();toast(p.configurationReadStatus==='success'?'已重新读取服务器文件（演示）。':'当前无法读取目标服务器文件。',p.configurationReadStatus==='success'?'success':'error');return;
 }
 const t=tpl(p.template);if(!t)return;
 if(t.contentMode==='file')p.cfg.source=t.tpl;else{p.cfg.port=t.port;p.cfg.env=t.env;}
 p.cfg.fileMappings=clone(t.fileMappings||[]);p.cfg.templateRev=t.rev;p.templateUpdate=false;p.draftRev++;persist();render();toast('部署配置已采用到项目，尚未下发。');
});
