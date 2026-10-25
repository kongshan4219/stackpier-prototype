'use strict';

function firewallSetupCheckSummary(plan){
 const checks=plan.checks;if(!checks)return notice('接入检查未通过','缺少新版阶段证据，请重新生成。','error');
 const labels={packages:'安装依赖',scope:'接口作用范围',conversion:'规则转换',target:'目标策略与绑定'},status={ready:'已核实','not-needed':'无需安装',failed:'检查未通过','not-evaluated':'前置条件未满足，尚未完成'};
 const reasons={'apt-uri-protocol':'软件包来源协议不受支持','apt-size-range':'软件包大小超出支持范围','scope-unproven':'接口包含未证明可保留的桥接、VPN 或动态绑定','conversion-dependent':'前置条件未通过，尚未生成完整规则转换证明','target-unproven':'尚未证明目标策略与完整接口绑定'};
 const render=issue=>notice('检查说明',reasons[issue.code]?(reasons[issue.code]+(issue.object?'：'+issue.object:'')+(issue.field?'；失败字段 '+issue.field:'')+(issue.protocol?'；协议 '+issue.protocol:'')+(issue.actual!==undefined&&issue.limit!==undefined?'；实际 '+issue.actual+' 字节，上限 '+issue.limit+' 字节':'')+(issue.dependsOn?.length?'；受前置检查影响':'')):'接入检查遇到未识别的问题，请重新检查','error');
 const direct=(checks.issues||[]).filter(issue=>!issue.dependsOn?.length),dependent=(checks.issues||[]).filter(issue=>issue.dependsOn?.length);
 return '<section aria-label="接入检查结果"><h3>接入检查</h3>'+detail(Object.entries(labels).map(([key,label])=>[label,h(status[checks[key]]||'尚未核实')]))+direct.map(render).join('')+(dependent.length?'<details><summary>受前置问题影响的检查（'+dependent.length+'）</summary>'+dependent.map(render).join('')+'</details>':'')+'<div class="table-scroll"><table aria-label="双栈默认策略"><thead><tr><th>地址族</th><th>原默认策略</th><th>目标策略</th></tr></thead><tbody>'+['ipv4','ipv6'].map(family=>'<tr><td>'+family.toUpperCase()+'</td><td>'+h(checks.target==='ready'?checks[family]:'未核实')+'</td><td>'+h(checks.target==='ready'?plan.targetPolicy:'尚未确定')+'</td></tr>').join('')+'</tbody></table></div></section>';
}

function firewallSetupPlan(id,targetPolicy=''){
 const host=firewallHost(id);if(!host)throw Error('请先检查目标防火墙。');
 const blockers=[...host.blockers],error=serverOperationError(id);if(error)blockers.push(error);
 if(host.serviceManager!=='systemd')blockers.push('尚未核实此服务管理器的独立恢复能力。');
 if(!['x86_64','aarch64','amd64','arm64'].includes(host.arch))blockers.push('尚未识别受支持的 64 位 Linux 架构。');
 if(!['未安装','firewalld'].includes(host.manager)&&!['ACCEPT','DROP','REJECT'].includes(host.defaultPolicy))blockers.push('尚未核实既有主机入站默认策略。');
 if(host.manager!=='未安装'&&host.zones.some(zone=>!['default','ACCEPT','DROP','REJECT'].includes(zone.target)))blockers.push('存在未核实的 Zone 原策略，不能迁移。');
 if(!host.zones.length)blockers.push('尚未确定网卡或来源对应的目标 Zone。');
 if(S.firewalls.some(r=>r.server===id&&r.scope==='host'&&r.direction&&r.direction!=='in'))blockers.push('存在非入站主机规则，需要先核对迁移范围，不能忽略后直接切换。');
 if(firewallHostRules(id).some(rule=>!firewallChosenZone(id,firewallRuleZone(rule))))blockers.push('存在未能唯一确定 Zone 归属的主机规则。');
 if(firewallActiveOperation(id))blockers.push('存在未完成的主机防火墙操作。');
 if(!['needs-setup','blocked'].includes(host.state))blockers.push('当前状态不能生成安装或迁移计划，请重新检查。');
 const plan={id:uid('fw-plan'),server:serverOperationSnapshot(id),before:clone(host),rules:firewallHostRules(id).map(rule=>({...clone(rule),zone:firewallRuleZone(rule)})),allRules:clone(S.firewalls.filter(r=>r.server===id)),expires:new Date(Date.now()+300000).toISOString(),mode:host.manager==='未安装'?'install':'migrate',currentPolicy:host.manager==='firewalld'?'按各 Zone 保留':host.defaultPolicy,targetPolicy:host.manager==='未安装'?targetPolicy:host.manager==='firewalld'?'按各 Zone 保留':host.defaultPolicy,packages:['firewalld（发行版软件源）','nftables 与发行版所需 Python / D-Bus 依赖'],disable:host.manager==='未安装'?[]:[host.manager+' 主机防火墙管理服务及已识别的启动加载器'],zones:host.zones.map(zone=>({...clone(zone),target:host.manager==='未安装'?targetPolicy:zone.target})),preserved:clone(host.preserved),blockers};
 plan.checks=host.setupChecks?clone(host.setupChecks):{packages:host.manager==='firewalld'?'not-needed':'ready',scope:'ready',conversion:blockers.length?'failed':'ready',target:blockers.length||host.manager==='未安装'&&!targetPolicy?'not-evaluated':'ready',ipv4:host.defaultPolicy,ipv6:host.defaultPolicy,issues:[]};
 if(plan.checks.packages==='failed')plan.packages=[];
 return plan;
}
function firewallSetupPlanError(plan){
 if(!plan||Date.now()>=Date.parse(plan.expires))return '接入预览已过期，请重新检查。';
 if(plan.mode==='install'&&!['ACCEPT','DROP','REJECT'].includes(plan.targetPolicy))return '请明确选择新机器的初始入站策略。';
 if(plan.mode!=='install'&&plan.targetPolicy!==plan.currentPolicy)return '既有机器默认策略必须保持不变。';
 if(plan.mode==='install'&&plan.zones.some(zone=>zone.target!==plan.targetPolicy))return '新机目标 Zone 策略与固定选择不一致。';
 if(plan.mode!=='install'&&JSON.stringify(plan.zones)!==JSON.stringify(plan.before.zones))return '既有 Zone 策略与绑定必须保持不变。';
 if(plan.blockers.length)return plan.blockers.join('；');
 if(!plan.checks||!['ready','not-needed'].includes(plan.checks.packages)||['scope','conversion','target'].some(stage=>plan.checks[stage]!=='ready'))return '接入检查未通过，请重新生成预览。';
 if(serverSnapshotError(plan.server))return '服务器连接或身份已变化，请重新检查。';
 if(JSON.stringify(firewallHost(plan.server.id))!==JSON.stringify(plan.before)||JSON.stringify(S.firewalls.filter(r=>r.server===plan.server.id))!==JSON.stringify(plan.allRules))return '原配置或规则在预览后变化，请重新检查。';
 if(firewallActiveOperation(plan.server.id))return '已有未完成防火墙操作，请核对原操作。';
 return '';
}
function firewallSetupSummary(plan){
 const list=values=>`<ul>${values.map(value=>`<li>${h(value)}</li>`).join('')}</ul>`;
 return `<div class="stack">${firewallSetupCheckSummary(plan)}${detail([['固定服务器',h(plan.server.name+' · '+plan.server.host+':'+plan.server.port)],['当前 → 目标',h(plan.before.manager)+' → firewalld / nftables'],['系统与架构',h(plan.before.os+' / '+plan.before.arch)],['服务管理器',h(plan.before.serviceManager)],['原入站默认策略',h(plan.checks?.target==='ready'?plan.currentPolicy:'未核实')],['目标入站默认策略',h(plan.checks?.target==='ready'?plan.targetPolicy:'尚未确定')]])}<div><h3>安装依赖</h3>${plan.checks?.packages==='failed'?'<p>依赖计划生成失败；尚未固定完整安装清单。</p>':plan.checks?.packages==='not-needed'?'<p>无需安装软件包，已核实现有依赖。</p>':list(plan.packages)}</div><div><h3>切换范围</h3>${plan.disable.length?list(plan.disable):'<p>没有已识别的主机防火墙管理器需要停用。</p>'}<p>仅停用冲突的主机管理入口；底层查看工具和其他软件所需组件可以保留。</p></div><div><h3>规则与作用范围</h3><p>${plan.rules.length} 条可解释的主机入站规则将保留并转入 firewalld；SSH 管理通路持续受保护。</p>${list(plan.zones.map(zone=>zone.name+' · '+(zone.interfaces.join('、')||'无网卡绑定')+' · '+(zone.sources.join('、')||'所有来源')+' · 原策略 '+(plan.mode==='install'?'未安装（入站 '+plan.currentPolicy+'）':plan.before.zones.find(old=>old.name===zone.name)?.target||'未知')+' → 目标策略 '+(plan.checks?.target==='ready'?zone.target:'尚未确定')))}${plan.rules.length?firewallBatchSummary({records:plan.rules,serverTarget:plan.server}):''}</div><div><h3>保留其他软件规则</h3>${list(plan.preserved)}</div>${notice('独立恢复保护','先保存配置、规则归属与服务状态，再装设恢复保护。安装、切换或新 SSH 核验失败时沿原操作恢复；不会清空整机规则集。')}${plan.blockers.map(reason=>notice('无法执行',reason,'error')).join('')}<p class="tiny muted">预览有效至 ${fmt(plan.expires)}。实际接口、安装步骤与系统支持以正式实施结果为准；当前只模拟流程。</p></div>`;
}
registerPrototypeHandlers(prototypeActions,['fw-setup'],(event,target,d)=>{
 const server=d.server||selectedServer();if(!server){toast('请先选择服务器。','warning');return;}
 try{openModal('fw-setup',{plan:firewallSetupPlan(server)});}catch(error){toast(error.message,'error');}
});
registerPrototypeHandlers(prototypeModals,['fw-setup'],m=>{
 const choosing=m.plan.mode==='install'&&!m.plan.targetPolicy,blocked=m.plan.blockers.length||!m.plan.checks||(!choosing&&['scope','conversion','target'].some(stage=>m.plan.checks[stage]!=='ready'));
 layout(blocked?'接入检查未通过':choosing?'选择新机器初始策略':'确认统一防火墙接入','目标固定为 firewalld / nftables；查看此页面不会修改服务器。',firewallSetupSummary(m.plan)+(choosing?select('fw-initial-policy','初始入站默认策略',[['','请选择初始策略'],['ACCEPT','ACCEPT · 允许未匹配规则的入站流量'],['DROP','DROP · 丢弃未匹配规则的入站流量'],['REJECT','REJECT · 明确拒绝未匹配规则的入站流量']],'','','required')+notice('需要明确选择','不会预选默认策略。下一步将展示固定策略、SSH 保护及安装范围。'):blocked?'':check('fw-setup-ack','确认以上固定服务器、依赖安装与规则迁移范围',false)),btn('取消','closemodal')+(!choosing?btn('重新检查','fw-setup-repreview',{server:m.plan.server.id}):'')+(blocked?'':`<button class="btn primary" type="submit">${choosing?'生成固定接入预览':'安装并迁移（演示）'}</button>`),true,'fw-setup');
});
registerPrototypeHandlers(prototypeForms,['fw-setup'],(event,form,fd,get,has,all,m)=>{
 if(m.plan.mode==='install'&&!m.plan.targetPolicy){const policy=get('fw-initial-policy');if(!['ACCEPT','DROP','REJECT'].includes(policy))return modalError('请明确选择初始入站策略。');openModal('fw-setup',{plan:firewallSetupPlan(m.plan.server.id,policy)});return;}
 if(m.plan.blockers.length)return modalError(m.plan.blockers.join('；'));
 if(!has('fw-setup-ack'))return modalError('请确认固定服务器及安装迁移范围。');
 const error=firewallSetupPlanError(m.plan);if(error)return modalError(error);
 startFirewallSetup(m.plan,ui.firewallOutcome||'success');
});
function startFirewallSetup(plan,outcome='success',options={}){
 const error=firewallSetupPlanError(plan);if(error){toast(error,'error');return null;}
 const o=startOperation(null,'network',{label:(plan.mode==='install'?'安装':'迁移')+' firewalld · '+plan.server.name,netType:'firewall',action:'setup',plan:clone(plan),serverTarget:clone(plan.server),targetId:plan.server.id,resources:['host-network:'+plan.server.id]},outcome,options);
 if(!o)return null;
 o.steps=['复核系统、身份与固定计划','备份原配置并装设独立恢复保护','安装依赖并准备 firewalld 配置','切换已识别的主机管理器','新 SSH 核验与运行／永久配置核对'].map((title,i)=>({title,status:i===0?'running':'pending',note:''}));
 const host=firewallHost(plan.server.id);host.state='pending';host.operationId=o.id;host.reason='正在执行受保护的统一接入。';persist();render();if(ui.modal?.kind==='opdetail')renderModal();return o;
}

registerPrototypeHandlers(prototypeActions,['fw-setup-repreview'],(event,target,d)=>{openModal('fw-setup',{plan:firewallSetupPlan(d.server)});});
