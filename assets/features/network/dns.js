'use strict';

function dnsPage(){const rows=S.dns.filter(r=>(ui.zone==='all'||ui.zone===r.zone)&&(r.name+'.'+r.zone+' '+r.content).toLowerCase().includes(ui.q.toLowerCase()));return heading('DNS 记录','Cloudflare 单账号、多域名集中管理。关联项目仅说明用途，不是独占证明。',btn('新增记录','dnsedit',{},'primary','plus'),'NETWORK / DNS')+searchFilter('搜索域名、记录或解析内容…',`<select class="filter" data-filter="zone" aria-label="域名筛选"><option value="all">全部域名</option>${['example.com','example.net'].map(z=>`<option ${ui.zone===z?'selected':''}>${z}</option>`).join('')}</select><span class="tag">${h(S.settings.cfName)}</span>`)+`<section class="card"><div class="table-wrap"><table><thead><tr><th>类型</th><th>记录名称</th><th>内容</th><th>代理 / TTL</th><th>关联用途</th><th class="right">操作</th></tr></thead><tbody>${rows.map(r=>`<tr><td><span class="tag mono">${h(r.type)}</span></td><td><strong class="cell-title">${h(r.name==='@'?r.zone:r.name+'.'+r.zone)}</strong><p class="cell-sub">${h(r.zone)}</p></td><td><code>${h(r.content)}</code></td><td>${badge(r.proxy?'已代理':'仅 DNS',r.proxy?'warning':'')}<p class="cell-sub">TTL ${h(r.ttl)}</p></td><td>${r.projects.length?r.projects.map(id=>`<button class="link small" data-action="project" data-id="${h(id)}">${h(pname(id))}</button>`).join('<br>'):'<span class="muted">未关联</span>'}${r.projects.length>1?'<p class="cell-sub">共享用途</p>':''}</td><td class="right">${btn('编辑','dnsedit',{id:r.id},'small ghost')}${btn('删除','dnsdelete',{id:r.id},'small ghost','trash')}</td></tr>`).join('')}</tbody></table></div>${!rows.length?empty('没有匹配的 DNS 记录','可选择域名并新增一条虚构记录。'):''}</section><div class="mt">${notice('确认修改后立即开始本次提交','不是输入字段时即时修改，也不需要先保存草稿再应用；提供商确认结果与公网传播时间不是同一件事。')}</div>`}

function dnsEditor(m){const r=S.dns.find(r=>r.id===m.id)||{zone:'example.com',type:'A',name:'',content:'',ttl:'300',proxy:false,projects:[]};layout(m.id?'修改 DNS 记录':'新增 DNS 记录','Cloudflare 单账号；明确确认后立即提交本次变更。',`<div class="stack"><div class="field-row">${select('dns-zone','域名 / Zone',['example.com','example.net'],r.zone)}${select('dns-type','记录类型',['A','AAAA','CNAME','TXT'],r.type)}</div><div class="field-row">${field('dns-name','记录名称',r.name,'@ 表示根域名。','text','required')}${field('dns-ttl','TTL',r.ttl,'自动或有效秒数。','text','required')}</div>${field('dns-content','记录内容',r.content,'使用虚构地址；此原型不会调用 Cloudflare。','text','required')}${check('dns-proxy','开启 Cloudflare 代理',r.proxy,'只对支持代理的 A、AAAA、CNAME 演示。')}<h3>关联项目用途 · 可为空或共享</h3>${projectChecks('dns-project',r.projects)}${check('network-ack','已核对本次变更及对关联项目的影响',false)}${outcomeField('success',[['success','提供商记录核对成功'],['failed','提供商明确拒绝'],['unknown','响应丢失，需读取核对']])}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">确认并提交（演示）</button>',false,'dnsedit');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["dnsedit","dnsdelete","cfaccount"], function(m, p) {
  switch (m.kind) {
case'dnsedit':dnsEditor(m);break;
case'dnsdelete':networkDelete(m,'dns');break;
case'cfaccount':layout('Cloudflare 演示账号','仅维护显示名称，无真实账号连接。',field('cf-name','账号名称',S.settings.cfName),btn('取消','closemodal')+'<button class="btn primary" type="submit">保存名称</button>',false,'cfaccount');break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["cfaccount"], function(event, target, d, a) {
  switch (a) {
case'cfaccount':openModal('cfaccount');break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["dnsedit","cfaccount"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'dnsedit':{if(!has('network-ack')){modalError('请核对并明确确认本次网络变更影响。');break;}const type=get('dns-type'),content=get('dns-content');if(type==='A'&&!validIPv4(content)){modalError('A 记录内容应为有效 IPv4 地址。');break;}if(type==='AAAA'&&!validIPv6(content)){modalError('AAAA 记录内容应为有效 IPv6 地址。');break;}const ttl=get('dns-ttl');if(ttl!=='自动'&&(!/^\d+$/.test(ttl)||Number(ttl)<60||Number(ttl)>86400)){modalError('演示 TTL 请使用“自动”或 60–86400 秒。');break;}if(type==='TXT'&&has('dns-proxy')){modalError('TXT 不支持此代理选项。');break;}const r={id:m.id||uid('dns'),zone:get('dns-zone'),type,name:get('dns-name'),content,ttl,proxy:has('dns-proxy'),projects:all('dns-project')};networkOperation('dns','upsert',r,get('outcome'));break;}
case'cfaccount':S.settings.cfName=get('cf-name')||'Cloudflare · 演示账号';persist();closeModal();render();toast('演示账号名称已修改，没有连接真实账号。');break;
  }
});
