'use strict';

function stateGrid(p){const op=activeOps(p)[0]||S.operations.find(o=>o.project===p.id);return `<div class="state-grid"><div class="state-cell"><small>部署阶段</small><strong>${lifeName[p.life]}</strong><span class="sub">${p.components.length?'存在未完成的变更':'核心资源的管理阶段'}</span></div><div class="state-cell"><small>你希望它</small><strong>${p.life==='uninstalled'||p.life==='draft'?'—':'保持'+(p.desired==='running'?'运行':'停止')}</strong><span class="sub">不会因巡检异常自动修复</span></div><div class="state-cell"><small>最近实际观测</small>${runtimeBadge(p)}<span class="sub">${fmt(p.observed)}</span></div><div class="state-cell"><small>保存与应用</small><strong>${pending(p)?'有待应用内容':'已应用'}</strong><span class="sub">草稿 D${p.draftRev} · 参照 ${p.applied?'A'+p.appliedRev:'未建立'}</span></div><div class="state-cell"><small>${activeOps(p).length?'当前操作':'最近操作'}</small>${op?status(op.status):'<strong>暂无操作</strong>'}<span class="sub">${h(op?.label||'保存不等于远端执行')}</span></div></div>`}

function projectPage(){const p=pr(ui.project);if(!p)return empty('项目不存在','回到项目列表继续。',btn('项目列表','navigate',{page:'projects'}));const deployable=p.life==='draft'||p.life==='uninstalled'||p.life==='incomplete';
 const actions=deployable?btn(p.life==='uninstalled'?'再次部署':'部署项目','projectop',{id:p.id,kind:'deploy'},'primary','play')+btn('更多操作','projectmore',{id:p.id},'','down'):btn(p.runtime==='running'?'停止':'启动','projectop',{id:p.id,kind:p.runtime==='running'?'stop':'start'},'',''+(p.runtime==='running'?'stop':'play'))+btn('应用配置','projectop',{id:p.id,kind:'apply'},'primary','upload')+btn('更多','projectmore',{id:p.id},'','down');
 return heading(p.name,`${sname(p.server)} · ${p.type==='compose'?'Docker Compose':'systemd'} · ${sr(p.server)?.arch||'架构待核对'}`,actions,'WORKSPACE / PROJECT DETAIL')+(p.programUpdate?notice('有新的程序文件可以部署','当前服务仍使用已交付文件；通过“更多 → 更新程序 / 镜像”明确执行，正在进行的操作输入不变。','warning'):'')+stateGrid(p)+(p.life==='uninstalled'?`<div class="mb">${notice('项目已卸载，记录仍然保留',`数据${p.dataStatus==='deleted'?'已明确删除':'保留在 '+p.cfg.dataDir}。定时巡检已暂停，重新部署后需人工恢复巡检。`)}</div>`:'')+(p.components.length?`<div class="mb">${notice('本次变更只完成了一部分',p.components.map(c=>c.name+'：'+c.result).join('；')+'。没有自动回退。','warning')}</div>`:'')+tabs([['overview','概览'],['config','配置'],['monitor','巡检'],['deps','依赖与复制'],['logs','日志'],['history','操作记录']],ui.tab)+projectTab(p);
}

function projectTab(p){if(ui.tab==='config')return projectConfig(p);if(ui.tab==='monitor')return projectMonitor(p);if(ui.tab==='deps')return dependencies(p);if(ui.tab==='logs')return projectLogs(p);if(ui.tab==='history')return operationTable(S.operations.filter(o=>o.project===p.id));
 const ops=S.operations.filter(o=>o.project===p.id);return `<div class="grid2"><div class="stack">${card('部署信息',detail([['运行方式',p.type==='compose'?'Docker Compose':'systemd'],['部署配置',h(tpl(p.template)?.name)],['已应用程序 / 镜像',h(p.applied?.version||'尚未交付')],['当前远端端口',h(p.applied?.port||'—')],['业务数据位置',`<code>${h(p.cfg.dataDir)}</code>`],['数据去留',h({retained:'卸载时保留',deleted:'已明确删除','in-place':'原位置管理'}[p.dataStatus]||p.dataStatus)],['最近核对',fmt(p.observed)]]))}${p.depChanges.length?notice('有依赖变化待确认','打开详情不会清除标记。请在“依赖与复制”中确认已经处理。','warning'):''}</div><div class="stack"><section class="card"><div class="card-head"><h2>当前可用性</h2>${btn('立即检查','projectcheck',{id:p.id},'small ghost','refresh')}</div><div class="card-body">${probes(p)}</div></section><section class="card"><div class="card-head"><h2>最近操作</h2>${btn('查看记录','tab',{id:'history'},'small ghost')}</div>${ops.slice(0,3).map(activity).join('')||'<div class="card-body muted small">还没有操作。可从上方按钮开始体验。</div>'}</section></div></div>`;
}

function projectLogs(p){const lines=[`[示例日志] ${p.name} / ${p.type}`,`${fmt(p.observed)}  INFO  recent_runtime=${p.runtime}`,`${fmt(p.observed)}  INFO  applied_content=${p.applied?.version||'none'}`,`${fmt(p.observed)}  INFO  configuration_reference=A${p.appliedRev}`,`${fmt(p.observed)}  INFO  ${p.runtime==='running'?'service is serving requests':p.runtime==='stopped'?'service stopped':'runtime requires verification'}`,...S.operations.filter(o=>o.project===p.id).slice(0,8).map(o=>`${fmt(o.time)}  ${o.status==='failed'?'ERROR':'INFO'}  ${o.label}: ${statusName[o.status]}`)].filter(l=>l.toLowerCase().includes(ui.q.toLowerCase()));return searchFilter('搜索示例日志…',btn('刷新观测','projectcheck',{id:p.id},'','refresh'))+`<pre class="code logbox" style="max-height:none;min-height:320px">${h(lines.join('\n')||'没有匹配行。')}</pre><p class="cell-sub mt">只读示例日志，不是可执行终端；不会拉取真实服务器日志。</p>`}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["projectmore"], function(m, p) {
  switch (m.kind) {
case'projectmore':layout(p.name+' · 更多操作','所有动作都只是演示；不提供已取消或暂缓的功能。',`<div class="stack">${['restart','update'].map(k=>btn(opLabels[k],'projectop',{id:p.id,kind:k},'','refresh')).join('')}${p.software==='mysql'?btn('初始化只读副本','replica',{id:p.id},'','link'):''}${btn('卸载项目','projectop',{id:p.id,kind:'uninstall'},'danger','trash')}</div>`,btn('关闭','closemodal'));break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["projectview"], function(event, target, d, a) {
  switch (a) {
case'projectview':ui.view=d.id;render();break;
  }
});
