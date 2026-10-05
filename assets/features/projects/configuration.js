'use strict';

function pending(p){return !p.applied||JSON.stringify(p.cfg)!==JSON.stringify(p.applied);}
function configText(p,c=p.cfg){
 if(!c)return '尚无已部署文件';if(typeof c.source==='string')return c.source;
 const env=String(c.env||'').split('\n').filter(Boolean);
 if(p.type==='compose')return `services:\n  ${p.software}:\n    image: ${c.program}:${c.version}\n    ports: ["${c.port}:${p.software==='mysql'?3306:p.software==='redis'?6379:80}"]\n    volumes: ["${c.dataDir}:/data"]\n    environment:\n${env.map(x=>'      - '+x).join('\n')}`;
 return `[Unit]\nDescription=${p.name}\nAfter=network.target\n\n[Service]\nType=simple\nUser=${c.serviceUser}\nWorkingDirectory=/srv/stackpier-demo/${p.name}\nExecStart=/srv/stackpier-demo/${p.name}/${c.program} --config app.conf\n${env.map(x=>'Environment='+x).join('\n')}\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target`;
}
function projectRuntimeFile(p){
 if(!p.serverReadSnapshot||['draft','uninstalled'].includes(p.life))return null;
 return {label:p.type==='compose'?'Docker Compose 文件':'systemd 服务文件',path:p.type==='compose'?`/srv/stackpier-demo/${p.name}/compose.yaml`:`/etc/systemd/system/${p.name}.service`,content:configText(p,p.serverReadSnapshot.cfg)};
}
function projectConfigurationReadState(p){
 if(!p.applied||p.life==='draft')return {tone:'',label:'尚未部署',message:'项目尚未形成服务器运行文件。'};
 if(p.life==='uninstalled')return {tone:'',label:'已卸载',message:'运行文件已随项目卸载，保留的项目记录不代表服务器上仍有文件。'};
 if(p.life==='incomplete'||p.components?.length)return {tone:'warning',label:'读取待核对 · 旧结果',message:'存在未完成变更；保留上次成功读取内容和时间。'};
 if(sr(p.server)?.state!=='online'||p.configurationReadStatus==='unknown')return {tone:'warning',label:'读取失败 · 旧结果',message:'本次未取得新内容；下方为上次成功读取快照，不能代表服务器当前版本。'};
 return {tone:'success',label:'读取成功（模拟）',message:'服务器当前读取结果只读；以下全部为浏览器模拟。'};
}
function latestMappedFileSnapshots(p){return p.serverReadSnapshot?.files||p.deployedFiles||[];}
function projectMappedFiles(p){return ['draft','uninstalled'].includes(p.life)?[]:latestMappedFileSnapshots(p);}
function observedFileIdentity(file){return file?file.sha256?'SHA-256 '+file.sha256:file.identity||'未取得摘要':'未取得文件信息';}
function mappedServerFiles(p){
 const mappings=projectMappedFiles(p),state=projectConfigurationReadState(p);
 return mappings.length?`<div class="server-file-list">${mappings.map(mapping=>{const file=mapping.binary;return `<article class="server-file-item"><div class="between wrap"><div><strong>${h(mappingName(mapping))}</strong><p class="cell-sub mono">${h(mapping.targetPath)}</p></div>${badge(file?(state.tone==='success'?'已读取（模拟）':'上次读取 · 旧结果'):'读取失败',state.tone)}${file?btn('查看公共文件 R'+(file.revision||'历史'),'asset-file',{id:file.id,revision:file.revision,project:p.id},'small ghost'):''}</div>${file?detail([['源文件名',h(file.filename||file.name)],['目标文件名',h(mapping.targetPath.split('/').at(-1))],['内容修订','R'+(file.revision||'历史未知')],['类型 / 适用范围',h(storedFileTypeLabel(file)+' · '+storedFileArchitectureLabel(file))],['大小',h(file.size||'未知')],['内容身份',`<span class="mono server-file-identity">${h(observedFileIdentity(file))}</span>`]]):'<p class="small muted">目标路径有记录，但未取得服务器文件信息。</p>'}</article>`;}).join('')}</div>`:empty('没有映射文件','当前已部署配置没有文件映射。');
}
function projectConfig(p){
 const state=projectConfigurationReadState(p),runtimeFile=projectRuntimeFile(p),readAt=p.serverReadSnapshot?.at,attemptAt=p.configurationReadAttemptAt,template=tpl(p.template);
 const readSummary=`上次成功读取：${fmt(readAt)}${attemptAt?'；最近尝试：'+fmt(attemptAt):''}`;
 const intro=notice('服务器文件只读 · 原型模拟',`${state.message} ${readSummary}。不建立真实 SSH 连接。`,state.tone==='warning'?'warning':'');
 const runtimeBody=runtimeFile?`<div class="server-file-path"><code>${h(runtimeFile.path)}</code>${badge(state.label,state.tone)}</div><pre class="code project-config-file">${h(runtimeFile.content)}</pre>`:empty(state.label,state.message);
 const updates=p.templateUpdate||p.programUpdate;
 const sourceBody=detail([['部署配置',h(template?.name||'已移除')],['公共配置最新版本','C'+(template?.rev||'—')],['项目已应用参照','C'+(p.appliedSnapshot?.templateRevision||'—')+' / A'+p.appliedRev],['项目草稿','C'+(p.cfg.templateRev||'—')+' / D'+p.draftRev],['待应用内容',pending(p)?badge('有','warning'):badge('无','success')],['已应用映射来源',JSON.stringify(p.appliedSnapshot?.cfg.fileMappings||[])===JSON.stringify(template?.fileMappings||[])?'公共配置固定修订':'历史配置 / 项目独立映射，参照单独保留'],['映射文件',fileMappingSummary(p.appliedSnapshot?.files)]])+`<div class="mt">${updates?notice('有可用更新','文件新修订或公共配置新版本尚未采用。查看差异后只更新当前项目草稿。','warning'):''}${btn('查看差异 / 采用更新','asset-update',{id:p.id},'small ghost')}</div>`;
 const appliedBody=p.appliedSnapshot?`<p class="small muted">此参照只在明确应用成功后更新，和服务器读取快照独立保存。</p><details><summary>展开已应用参照正文和文件修订</summary><pre class="code asset-text">${h(configText(p,p.appliedSnapshot.cfg))}</pre><pre class="code">${h(projectMappingVersions(p.appliedSnapshot.cfg))}</pre></details>`:empty('尚无已应用参照','执行模拟部署后建立快照。');
 return `${ui.assetReturn?`<div class="mb">${btn('返回来源详情','asset-return',{},'small ghost')}</div>`:''}<div class="mb">${intro}</div><div class="grid2"><div class="stack"><section class="card"><div class="card-head"><h2>服务器当前读取结果</h2><div class="flex wrap">${btn('重新读取','refreshprojectfiles',{id:p.id},'small ghost','refresh')}${btn('模拟读取失败','asset-read-fail',{id:p.id},'small ghost')}</div></div><div class="card-body stack">${runtimeBody}</div></section>${card('服务器映射文件 · 只读',mappedServerFiles(p))}</div><div class="stack">${card('项目已应用参照',appliedBody)}${card('公共配置与项目草稿',sourceBody,btn('查看部署配置','asset-template',{id:p.template,project:p.id},'small ghost'))}${card('项目草稿 · 待应用',`<pre class="code asset-text">${h(configText(p))}</pre><pre class="code">${h(projectMappingVersions(p.cfg))}</pre>`,pending(p)?btn('应用配置 · 单独确认','projectop',{id:p.id,kind:'apply'},'small primary'):'')}</div></div>`;
}
registerPrototypeHandlers(prototypeActions,['adopttemplate','refreshprojectfiles','asset-read-fail'],function(event,target,data,action){
 const p=pr(data.id);if(!p)return;
 if(action==='adopttemplate'){openModal('assetupdate',{id:p.id});return;}
 p.configurationReadAttemptAt=now();
 const success=action!=='asset-read-fail'&&p.life==='installed'&&!!p.appliedSnapshot&&!serverOperationError(p.server)&&!p.components?.length;
 p.configurationReadStatus=success?'success':'unknown';if(success){p.serverReadSnapshot=clone(p.appliedSnapshot);p.serverReadSnapshot.at=p.configurationReadAttemptAt;p.configurationReadAt=p.configurationReadAttemptAt;}
 persist();render();toast(success?'已重新读取服务器文件（原型模拟）。':'读取失败，保留上次成功内容和时间。',success?'success':'error');
});
