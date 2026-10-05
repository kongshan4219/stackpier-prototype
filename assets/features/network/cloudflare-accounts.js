'use strict';

function cfPermissionSummary(p){return detail([['凭据有效性',p.network?(p.valid?'有效（模拟）':'失效（模拟）'):'网络失败 · 未确定'],['Zone 读取',p.zoneRead?'允许':'不可用'],['DNS 读取',p.dnsRead?'按下方 Zone 授权':'不可用'],['DNS 修改',p.dnsWrite?'逐 Zone 核对，非全账号授权':'不可写']]);}
function cfGrantList(p){return (p?.grants||[]).map(g=>`<div class="between wrap"><code>${h(cfZone(g.zoneId)?.name||'Zone 引用待核对')}</code>${badge(g.read?(g.write?'DNS 可读写':'DNS 只读'):'不可访问',g.write?'success':'warning')}</div>`).join('')||'<p class="small muted">没有授权 Zone</p>'; }
function cfManager(){
 const rows=S.cloudflare.connections;layout('管理 Cloudflare 账号','DNS 与设置共用同一份账号连接；所有检查均为浏览器模拟。',`<div class="stack">${notice('只使用虚构凭据','禁止填写真实 Token。仅保存演示凭据引用及修订；localStorage 不是生产密钥库。')}${rows.map(c=>`<section class="card"><div class="card-body stack"><div class="between wrap"><strong>${h(c.name)}</strong>${badge(cfConnectionState(c),c.removedAt?'':'warning')}</div>${detail([['演示 Account ID',`<code>${h(cfAccount(c.accountId)?.displayId)}</code>`],['授权域名数',c.check?.grants.filter(g=>g.read).length||0],['最近检查',fmt(c.check?.at)],['凭据引用',`<code>${h(c.credentialId)} / R${c.credentialRevision}</code>`]])}${cfPermissionSummary(c.check||{})}${cfGrantList(c.check)}<div class="flex wrap">${c.removedAt?'<span class="muted small">缓存、历史和项目关联已保留；未撤销 Token 或删除 DNS。</span>':btn('重命名','cfrename',{id:c.id},'small')+btn('检查连接','cfinspect',{id:c.id},'small')+btn('更新 Token','cfconnect',{id:c.id},'small')+btn('移除连接','cfremove',{id:c.id},'small danger')}</div></div></section>`).join('')||empty('没有管理连接','新增虚构连接后按 Zone 管理 DNS。')}</div>`,btn('关闭','closemodal')+btn('新增连接','cfconnect',{},'primary'),true);
}
function cfConnectModal(m){
 const c=m.id&&cfConnection(m.id),candidate=m.candidate;
 if(m.checking){layout('模拟检查中','关闭或取消不会保存新连接。',notice('正在核对虚构凭据与授权范围','不访问 Cloudflare，不把输入保存到浏览器存储。'),btn('取消','closemodal'));return;}
 if(candidate){
  const duplicate=cfCurrent(candidate.accountId),wrong=c&&c.accountId!==candidate.accountId;
  const good=candidate.probe.valid&&candidate.probe.zoneRead&&candidate.probe.dnsRead&&candidate.probe.network;
  const canSave=good&&!wrong&&(!duplicate||duplicate.id===m.id);
  layout('核对账号和授权域名','检查结果只代表下列能力与 Zone，不代表所有域名均可读写。',`<div class="stack">${detail([['名称',h(candidate.name)],['演示 Account ID',h(cfDemoAccounts.find(a=>a[0]===candidate.accountId)?.[1])],['本次管理账号',h(cfDemoAccounts.find(a=>a[0]===candidate.accountId)?.[2])]])}${cfPermissionSummary(candidate.probe)}${candidate.probe.grants.map(g=>`<div class="between wrap"><code>${h(candidate.zones.find(z=>z.id===g.zoneId)?.name)}</code>${badge(g.read?(g.write?'DNS 可读写':'DNS 只读'):'不可访问',g.write?'success':'warning')}</div>`).join('')||notice('没有授权域名','可保存无域名连接；空授权不等于 DNS 记录已被删除。')}${wrong?notice('属于另一账号','请新增连接；不会把原 Zone、记录与项目关系改挂过去。','error'):duplicate&&duplicate.id!==m.id?notice('此账号已有当前连接','一期每个 Account ID 只维护一个当前连接，请更新已有连接。','warning'):!good?notice('检查未通过','不会保存或替换原连接。','error'):c?notice('确认更换凭据修订','账号、Zone、记录 ID 和项目关联保持不变；失去授权的记录保留为不可访问缓存。','warning'):''}${canSave?check('cf-confirm','已核对本账号及逐 Zone 权限，确认保存',false):''}</div>`,btn('返回修改 / 重新填写','cf-back-edit')+(duplicate&&duplicate.id!==m.id?btn('更新已有连接','cfconnect',{id:duplicate.id},'primary'):wrong?btn('新增连接','cfconnect',{},'primary'):canSave?'<button class="btn primary" type="submit">确认保存连接</button>':''),false,'cfsave');return;
 }
 layout(c?'更新演示 Token':'新增 Cloudflare 连接','同一个虚构凭据可访问多个账号；请明确选择本次管理的账号。',`<div class="stack">${notice('禁止输入真实凭据','使用“一键填入演示值”。任意其他输入会被拒绝且清空，不保存到 localStorage、历史或导出。','warning')}${field('cf-name','连接名称',m.nonSecret?.name??c?.name??'Cloudflare · 新演示连接','','text','required maxlength="100"')}${select('cf-target','本次管理的演示 Account',cfDemoAccounts.map(a=>[a[0],a[2]+' · '+a[1]]),m.nonSecret?.accountId??c?.accountId??'cf-account-extra')}${field('cf-token','演示 Token','','仅接受固定虚构值；不回填已保存原文。','password','required')}${btn('一键填入演示值','cfdemofill',{},'small')}${select('cf-profile','模拟授权情况',cfProfiles,m.nonSecret?.profile??cfCredential(c)?.profile??'normal')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">模拟检查凭据</button>',false,'cfcheck');
}
function cfCheckInput(m,form,get){
 const token=get('cf-token');const input=document.getElementById('cf-token');if(input)input.value='';
 m.nonSecret={name:get('cf-name'),accountId:get('cf-target'),profile:get('cf-profile')};saveInteractionDraft(m);
 if(token!==CF_DEMO_TOKEN){modalError('仅接受固定演示值，输入已清空；请勿填写真实凭据。');return;}
 const accountId=get('cf-target'),profile=get('cf-profile'),demo=cfDemoAccounts.find(a=>a[0]===accountId);if(!demo||!cfProfiles.some(p=>p[0]===profile)){modalError('请选择有效演示账号与授权情况');return;}
 const name=get('cf-name');if(!name||name.length>100){modalError('请填写 1–100 字的连接名称');return;}
 const zones=(S.cloudflare.zones.filter(z=>z.accountId===accountId).length?S.cloudflare.zones.filter(z=>z.accountId===accountId):demo[3].map((name,i)=>({id:accountId+'-zone-'+i,accountId,name}))).map(clone);
 m.nonSecret={name,accountId,profile};saveInteractionDraft(m);const candidate={name,accountId,profile,zones,updateId:m.id||null,beforeRevision:cfConnection(m.id)?.credentialRevision,probe:cfProbe(profile,zones)};m.checking=true;renderModal();
 setTimeout(()=>{if(ui.modal!==m)return;m.checking=false;m.candidate=candidate;renderModal();},700);
}
registerPrototypeHandlers(prototypeModals,['cfaccount','cfconnect','cfrename','cfinspect','cfremove'],m=>{
 if(m.kind==='cfaccount')return cfManager();if(m.kind==='cfconnect')return cfConnectModal(m);
 const c=cfConnection(m.id);if(!c){closeModal();return;}
 if(m.kind==='cfrename')layout('重命名连接','名称不改变账号或记录身份。',field('cf-name','连接名称',c.name,'','text','required maxlength="100"'),btn('取消','closemodal')+'<button class="btn primary" type="submit">保存名称</button>',false,'cfrename');
 if(m.kind==='cfinspect')layout('模拟检查连接','分别核对凭据及逐 Zone 能力，不发出网络请求。',`<div class="stack">${detail([['连接',h(c.name)],['演示 Account ID',h(cfAccount(c.accountId)?.displayId)]])}${cfPermissionSummary(c.check)}${cfGrantList(c.check)}${select('cf-profile','本次模拟检查结果',cfProfiles,cfCredential(c)?.profile||'normal')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">执行模拟检查</button>',false,'cfinspect');
 if(m.kind==='cfremove')layout('移除账号连接','仅移除栈桥管理连接。',`<div class="stack">${notice(c.name,'不会删除 Cloudflare 账号、域名或 DNS，不代表撤销 Token；保留历史与项目关联。','warning')}${cfBusy(c)?notice('当前不能移除',cfBusy(c).label+' 尚在执行或结果未知，请先核对。','error'):check('cf-confirm','确认只移除此管理连接',false)}</div>`,btn('取消','closemodal')+(cfBusy(c)?'':'<button class="btn danger" type="submit">确认移除连接</button>'),false,'cfremove');
});
registerPrototypeHandlers(prototypeActions,['cfaccount','cfconnect','cfrename','cfinspect','cfremove','cfdemofill'],(event,target,d,a)=>{if(a==='cfdemofill'){document.getElementById('cf-token').value=CF_DEMO_TOKEN;return;}openModal(a,{id:d.id||null});});
registerPrototypeHandlers(prototypeForms,['cfcheck','cfsave','cfrename','cfinspect','cfremove'],(event,form,fd,get,has,all,m,p,kind)=>{
 if(kind==='cfcheck'){if(!m.checking)cfCheckInput(m,form,get);return;}
 if(kind==='cfsave'){if(!m.candidate||!has('cf-confirm')){modalError('请核对并确认保存');return;}const err=cfSaveConnection(m.candidate);if(err){modalError(err);return;}m.saved=true;clearInteractionDraft('cfconnect',m.id);openModal('cfaccount');render();toast('演示连接已保存；没有访问真实 Cloudflare。');return;}
 const c=cfConnection(m.id);if(!c||c.removedAt){modalError('连接已移除，请重新选择');return;}
 if(kind==='cfrename'){const name=get('cf-name');if(!name||name.length>100){modalError('请填写 1–100 字的名称');return;}c.name=name;}
 if(kind==='cfinspect'){const profile=get('cf-profile');if(!cfProfiles.some(p=>p[0]===profile)){modalError('无效演示状态');return;}c.check=cfProbe(profile,S.cloudflare.zones.filter(z=>z.accountId===c.accountId));}
 if(kind==='cfremove'){if(!has('cf-confirm')){modalError('请确认移除');return;}const err=cfRemoveConnection(c.id);if(err){modalError(err);return;}}
 persist();render();openModal('cfaccount');
});

registerPrototypeHandlers(prototypeActions,['cf-back-edit'],()=>{const m=ui.modal;if(m?.kind==='cfconnect')openModal('cfconnect',{id:m.id,nonSecret:clone(m.nonSecret||{name:m.candidate?.name,accountId:m.candidate?.accountId,profile:m.candidate?.profile})});});
