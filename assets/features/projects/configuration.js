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
function projectFileObservation(file){
 return `<span>${h(projectFileStateLabels[file.state]||projectFileStateLabels.unknown)}</span>${file.checked?`<span class="muted"> · 观测于 ${fmt(file.checked)}</span>`:''}${file.sha256?`<p class="file-digest">远端 SHA-256：<code>${h(file.sha256)}</code>${file.size!==null&&file.size!==undefined?' · '+h(file.size)+' B':''}</p>`:''}`;
}
function projectFilesView(p){
 const check=p.fileCheck,busy=projectFileReads.has(p.id);
 return `<section class="stack project-file-check" aria-label="已部署文件核对"><div class="flex wrap"><h3>已部署文件核对</h3><button type="button" class="btn" data-action="checkprojectfiles" data-id="${h(p.id)}" ${busy?'disabled':''}>${busy?'核对中…':'核对受管文件'}</button></div><p class="muted">对照本项目成功部署参照，只读取程序、配置和 unit 的摘要。核对不应用配置，也不启停服务。</p>
 ${check?.error?notice('本次核对未确认：'+check.error+'。下方保留的结果为历史观测。','','error'):''}
 ${check?.reference&&check.reference!==projectReferenceKey(p)?notice('此观测对应旧部署参照，已过期；请重新核对受管文件。'):''}
 ${check?.checked?`<p class="muted">最近核对尝试：${fmt(check.checked)}；结果仅代表观测时刻。</p>`:''}
 ${!check?.files?.length?'<p class="muted">尚未核对受管文件。</p>':check.files.map(file=>`<article class="file-observation"><h4><code>${h(file.path)}</code></h4><div>${projectFileObservation(file)}</div><p class="file-digest">已部署参照 SHA-256：<code>${h(file.expectedSHA256||'无法确认')}</code></p>${file.state==='unknown'?notice((projectFileReasons[file.reason]||'无法确认本次观测')+'。','','error'):''}${file.previous?`<div class="file-history"><strong>历史观测 · 已过期</strong><div>${projectFileObservation(file.previous)}</div></div>`:''}</article>`).join('')}</section>`;
}
function projectConfig(p){
 // 异步计算已保存文本的摘要；完成后只刷新仍在查看的同一项目。
 const texts=[p.appliedSnapshot?.cfg?.source,p.serverReadSnapshot?.cfg?.source].filter(text=>typeof text==='string'&&!projectTextDigests.has(text));
 if(texts.length&&!texts.some(text=>projectDigestRequests.has(text)))void prepareProjectConfiguration(p).then(()=>{if(pr(p.id)===p&&ui.page==='project'&&ui.project===p.id&&ui.tab==='config')render();}).catch(()=>{});
 const returnLink=ui.assetReturn?`<div class="mb">${btn('返回来源详情','asset-return',{},'small ghost')}</div>`:'';
 return returnLink+card('已应用配置与文件',projectAppliedPlan(p)+(p.type==='systemd'&&!projectIsFrp(p)?projectFilesView(p):''),badge('固定版本'));
}
function projectDraftBody(p){
 const template=tpl(p.template);
 const updates=p.templateUpdate||p.programUpdate;
 const sourceBody=detail([['部署配置',h(template?.name||'已移除')],['公共配置最新版本','C'+(template?.rev||'—')],['项目已应用参照','C'+(p.appliedSnapshot?.templateRevision||'—')+' / A'+p.appliedRev],['项目草稿','C'+(p.cfg.templateRev||'—')+' / D'+p.draftRev],['待应用内容',pending(p)?badge('有','warning'):badge('无','success')],['已应用映射来源',JSON.stringify(p.appliedSnapshot?.cfg.fileMappings||[])===JSON.stringify(template?.fileMappings||[])?'公共配置固定修订':'历史配置 / 项目独立映射，参照单独保留'],['映射文件',fileMappingSummary(p.appliedSnapshot?.files)]])+`<div class="mt">${updates?notice('有可用更新','文件新修订或公共配置新版本尚未采用。查看差异后只更新当前项目草稿。','warning'):''}${btn('查看差异 / 采用更新','asset-update',{id:p.id},'small ghost')}</div>`;
 const appliedBody=p.appliedSnapshot?`<p class="small muted">此参照只在明确应用成功后更新，和服务器读取快照独立保存。</p><details><summary>展开已应用参照正文和文件修订</summary><pre class="code asset-text">${h(configText(p,p.appliedSnapshot.cfg))}</pre><pre class="code">${h(projectMappingVersions(p.appliedSnapshot.cfg))}</pre></details>`:empty('尚无已应用参照','执行模拟部署后建立快照。');
 return `<div class="stack">${card('公共配置与项目草稿',sourceBody,btn('查看部署配置','asset-template',{id:p.template,project:p.id},'small ghost'))}${card('项目已应用参照',appliedBody)}${card('项目草稿 · 待应用',`<pre class="code asset-text">${h(configText(p))}</pre><pre class="code">${h(projectMappingVersions(p.cfg))}</pre>`,pending(p)?btn('应用配置 · 单独确认','projectop',{id:p.id,kind:'apply'},'small primary'):'')}</div>`;
}
registerPrototypeHandlers(prototypeActions,['projectdraft'],(event,target,data)=>openModal('projectdraft',{id:data.id}));
registerPrototypeHandlers(prototypeModals,['projectdraft'],function(m,p){
 if(!p)return closeModal();
 layout('项目草稿与更新 · '+p.name,'原型保留的配置采用与应用流程；只修改此项目，执行仍需单独确认。',projectIsFrp(p)?frpProjectDraftBody(p):projectDraftBody(p),btn('返回项目','closemodal'),true);
});
registerPrototypeHandlers(prototypeActions,['adopttemplate'],(event,target,data)=>openModal('assetupdate',{id:data.id}));
