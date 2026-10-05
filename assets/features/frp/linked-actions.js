'use strict';

function frpLinkedAction(action,d){
 if(action==='frp-reference-load'){openModal('frp-reference-confirm');return true;}
 if(action==='frp-reference-confirmload'){frpSwitchProfile('attachment');return true;}
 if(action==='frp-profile-toggle'){frpSwitchProfile(S.frp.profile==='attachment'?'workspace':'attachment');return true;}
 if(action==='frp-locate'){
  const project=d.project&&pr(d.project);if(project?.frpInstallation){openModal('frp-role-manage',{server:project.server,role:project.frpInstallation.role,project:project.id});return true;}
  const n=frpNode(d.node||project?.frpRef?.node);if(!n){openModal('frp-invalid-link',{project:d.project});return true;}const context={ui:{page:ui.page,project:ui.project,tab:ui.tab,q:ui.q,filter:ui.filter,server:ui.server},frp:clone(FRP),modal:ui.modal?clone(ui.modal):null,drawer:clone(assetDrawer),label:ui.page==='project'?pname(ui.project):assetDrawer?'公共资产详情':'FRP 连接'};
  closeAssetDrawer();if(!S.frp.nodes.some(x=>x.id===n.id)){const profile=Object.entries(S.frpProfiles||{}).find(([,F])=>F.nodes.some(x=>x.id===n.id))?.[0];if(profile)frpSwitchProfile(profile);}frpGo('files',n.id,d.role||project?.frpRef?.role);FRP.returnContext=context;render();return true;
 }
 if(action==='frp-return'){const c=FRP.returnContext;delete FRP.returnContext;if(c){Object.assign(ui,c.ui);Object.assign(FRP,c.frp);render();if(c.modal)openModal(c.modal.kind,c.modal);if(c.drawer)openAssetDrawer(c.drawer);}return true;}
 if(action==='frp-update'){const p=pr(d.id);if(p?.frpRef&&!frpNode(p.frpRef.node)){openModal('frp-invalid-link',{project:p.id});return true;}openModal('frp-update',{id:d.id});return true;}
 if(action==='frp-adopt'){const m=ui.modal,p=pr(m.id);if(JSON.stringify(frpPublicCandidate(m.next.node,m.next.role))!==m.binding)throw Error('查看后公共版本变化，请重新查看差异');frpAdoptProject(p,m.next);closeModal();render();toast('只采用到 '+p.name+' 草稿；已应用和读取结果保持。','success');return true;}
 if(action==='frp-project-apply'){const p=pr(d.id);if(p?.frpRef&&!frpNode(p.frpRef.node)){openModal('frp-invalid-link',{project:p.id});return true;}const shared=p.frpInstallation?.role==='server'&&S.frp.nodes.find(n=>frpPid(n,'server')===p.id);if(shared){openModal('frp-op',{node:shared.id,role:'server',op:'deploy'});return true;}if(p.frpRef)openModal('frp-op',{node:p.frpRef.node,role:p.frpRef.role,op:'deploy'});else openModal('frp-install',{plan:frpInstallationPlan(p.server,p.frpInstallation.role,true)});return true;}
 if(action==='frp-read'){const p=pr(d.id);if(d.fail==='true'||serverOperationError(p.server)){p.frpReadError=(serverOperationError(p.server)||'模拟读取失败')+'；保留上次成功内容及时间';}else if(p.frpApplied){p.frpReadSnapshot={files:clone(p.frpApplied.files),program:clone(p.frpApplied.program||null),at:now(),source:'浏览器模拟读取'};delete p.frpReadError;}else p.frpReadError='没有服务器文件模拟读取来源';persist();render();return true;}
 if(action==='frp-generate'){
  const n=frpNode(d.node),role=d.role,p=pr(frpPid(n,role));if(role==='visitor'&&!p.frpDraft.node.proxies.some(x=>x.type==='stcp'))throw Error('TCP-only 不生成 visitor；旧生成文件须在清理确认中处理');
  const errors=frpValidate([p.frpDraft.node]);if(errors.length)throw Error(errors.join('；'));S.frpGenerated||={};S.frpGenerated[p.id]={snapshot:clone(p.frpDraft),at:now()};persist();toast('已生成草稿 TOML / unit（模拟）；未安装或启动。','success');return true;
 }
 if(action==='frp-targets'){openModal('frp-targets');return true;}
 if(action==='frp-target-preview'){
  const role=document.querySelector('#targets-role').value,scope=document.querySelector('#targets-scope').value,id=document.querySelector('#targets-node').value,operation=document.querySelector('#targets-op').value;
  const nodes=frpSelectTargets(role,scope,id),items=frpUniqueItems(role==='all'?nodes.flatMap(n=>['server','client',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])].map(r=>({node:n.id,role:r}))):nodes.filter(n=>role!=='visitor'||n.proxies.some(x=>x.type==='stcp')).map(n=>({node:n.id,role})));
  if(!items.length)throw Error('没有适用目标；默认客户端只选 client_enabled=true，visitor 只处理 STCP');
  if(operation==='generate'){for(const item of items)frpLinkedAction('frp-generate',item);closeModal();return true;}
  if(operation==='validate'){const errors=frpValidate(nodes);layout('所选目标结构校验 · '+nodes.length+' 个','只校验结构，不运行程序。',errors.length?errors.map(e=>notice('未通过',e,'error')).join(''):notice('通过','默认目标、全部和指定目标已按选择解析。'),btn('关闭','closemodal'));return true;}
  openModal('frp-op',{items,op:operation});return true;
 }
 if(frpGeneratedAction(action,d))return true;
 if(action==='frp-program-pin'){openModal('frp-program-pin',{role:d.role});return true;}
 return false;
}
function frpLinkedModal(m){
 if(frpGeneratedModal(m))return true;
 if(m.kind==='frp-reference-confirm'){layout('载入附件参考示例','一个本地 FRPC 提供端 → 四个远端 FRPS，不是四台客户端。',notice('保留当前工作连接','当前连接、草稿与编辑缓存保存在工作清单；载入只切换到独立的附件参考清单，可随时返回。公共文件和已有项目不会被删除。')+detail([['参考数量','4 节点 · 6 TCP · 2 STCP · 2 默认客户端目标 · 2 visitor'],['二进制','四个 0 B 占位；不可部署']]),btn('取消','closemodal')+btn('载入并查看附件参考示例','frp-reference-confirmload',{},'primary'));return true;}
 if(m.kind==='frp-update'){
  const p=pr(m.id),role=p?.frpRef?.role||p?.frpInstallation?.role,n=p?.frpRef?frpNode(p.frpRef.node):p?.frpApplied?.node;if(!p||!n)throw Error('目标角色不存在');m.next=frpPublicCandidate(n,role);m.binding=JSON.stringify(m.next);
  layout('查看更新差异 · '+p.name,'采用只修改所选项目草稿，应用是下一次独立确认。',`<div class="diff-grid"><section><h3>当前项目草稿 · D${p.draftRev}</h3><pre class="code asset-text">${h(frpMask(p.frpDraft.files.toml))}</pre><pre class="code asset-text">${h(p.frpDraft.files.unit)}</pre><p>设置 G${p.frpDraft.settingsRevision} · 配置 C${p.frpDraft.configurationRevision}</p>${frpProgramPreview(p.frpDraft)}</section><section><h3>采用后的草稿</h3><pre class="code asset-text">${h(frpMask(m.next.files.toml))}</pre><pre class="code asset-text">${h(m.next.files.unit)}</pre><p>设置 G${m.next.settingsRevision} · 配置 C${m.next.configurationRevision}</p>${frpProgramPreview(m.next)}</section></div>${notice('明确目标：'+p.name,'其他角色草稿、已应用参照、服务器读取结果和模拟运行状态全部保持。')}`,btn('取消','closemodal')+btn('采用到这个项目 / 角色草稿','frp-adopt',{},'primary'),true);return true;
 }
 if(m.kind==='frp-targets'){
  layout('批量目标与操作','客户端默认只选择 client_enabled=true；all 包含全部；指定 false 仍可操作。服务端默认全部。',`<div class="stack">${select('targets-role','角色',[...Object.entries(frpRoles),['all','三角色组合（共享 FRPS 去重）']],'client')}${select('targets-scope','目标范围',[['default','默认目标'],['all','全部目标'],['specified','指定目标']],'default')}${select('targets-node','指定连接',S.frp.nodes.map(n=>[n.id,n.ip+' · 默认 '+String(n.client_enabled)]),FRP.node)}${select('targets-op','模拟动作',[['validate','结构校验（无程序执行）'],['generate','生成草稿文件（不安装）'],['install','安装文件与 unit（不启动）'],['deploy','部署并启动（独立确认）'],['start','启动已有 unit'],['stop','停止服务（保留 unit / 文件）'],['restart','重启已有 unit'],['uninstall','停止并移除 unit（保留生成文件）']],'validate')}${notice('监听冲突规则','TCP 按服务器公网通配监听，visitor 按对应 FRPS 回环监听。IPv6 :: 保守视作可能双栈，与同端口 IPv4 也冲突；不假定双栈一定互不影响。')}</div>`,btn('取消','closemodal')+btn('查看目标 / 执行前预览','frp-target-preview',{},'primary'));return true;
 }
 if(m.kind==='frp-program-pin'){
  const t=tpl('frp-template-'+m.role),files=S.programs.filter(f=>f.groupId===t.programRef.groupId);layout('固定公共程序修订 · '+t.name,'只更新公共配置修订并提示影响，项目需采用后再应用。',`<div class="stack">${files.map(f=>select('pin-'+f.id,f.filename+' · '+f.arch,f.revisions.filter(r=>r.revision>0).map(r=>[r.revision,'R'+r.revision+' · '+r.size]),t.programRef.pins.find(p=>p.fileId===f.id)?.revision)).join('')}${frpImpactTable(m.role)}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存固定程序修订</button>',false,'frp-program-pin');return true;
 }
 return false;
}
function frpLinkedSubmit(form,fd,m){if(form.dataset.form!=='frp-program-pin')return false;const t=tpl('frp-template-'+m.role);t.programRef.pins=t.programRef.pins.map(pin=>({...pin,revision:Number(fd.get('pin-'+pin.fileId))}));t.rev++;t.revisions.push(clone({...t,revisions:undefined}));frpSyncConfigs();persist();m.saved=true;closeModal();render();return true;}
// FRP 表单输入即时缓存；取消、详情、页面切换和刷新均保留未提交编辑。
function frpCacheEditor(){const m=ui.modal,form=dialog.querySelector('form');if(!m||!['frp-template','frp-settings','frp-nodeedit','frp-proxyedit'].includes(m.kind)||!form||m.saved)return;const fields={};new FormData(form).forEach((value,key)=>fields[key]=String(value));S.frpEditorDrafts||={};S.frpEditorDrafts[frpEditorKey(m)]={fields,at:now()};persist();}
function frpEditorKey(m){return [m.kind,m.id||m.node||'',m.index??'new'].join('|');}
function frpRestoreEditor(m){const saved=S.frpEditorDrafts?.[frpEditorKey(m)];if(!saved)return;for(const [id,value] of Object.entries(saved.fields)){const field=document.getElementById(id)||dialog.querySelector('[name="'+id+'"]');if(field){if(field.type==='checkbox')field.checked=true;else field.value=value;}}const checkbox=dialog.querySelector('[name=fn-default]');if(checkbox&&!Object.hasOwn(saved.fields,'fn-default'))checkbox.checked=false;}
document.addEventListener('input',frpCacheEditor);document.addEventListener('change',frpCacheEditor);
const frpEditorBaseClose=closeModal;
closeModal=function(){const m=ui.modal;if(m?.saved&&S.frpEditorDrafts)delete S.frpEditorDrafts[frpEditorKey(m)];else frpCacheEditor();persist();return frpEditorBaseClose();};
const frpEditorBaseOpen=openModal;
openModal=function(kind,data={}){frpCacheEditor();return frpEditorBaseOpen(kind,data);};
