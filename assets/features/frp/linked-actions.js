'use strict';

function frpLinkedAction(action,d){
 if(action==='frp-reference-load'){openModal('frp-reference-confirm');return true;}
 if(action==='frp-reference-confirmload'){frpSwitchProfile('attachment');return true;}
 if(action==='frp-profile-toggle'){frpSwitchProfile(S.frp.profile==='attachment'?'workspace':'attachment');return true;}
 if(action==='frp-locate'){
  const p=d.project&&pr(d.project),n=frpNode(d.node)||S.frp.nodes.find(n=>Object.values(n.serviceBindings||{}).includes(p?.id));if(!n){openModal('frp-invalid-link',{project:p?.id});return true;}
  const context={ui:{page:ui.page,project:ui.project,tab:ui.tab,q:ui.q,filter:ui.filter,server:ui.server},frp:clone(FRP),modal:ui.modal?clone(ui.modal):null,drawer:clone(assetDrawer),label:ui.page==='project'?pname(ui.project):'来源详情'};closeAssetDrawer();frpGo('node',n.id,d.role||p?.frpService?.role);FRP.returnContext=context;render();return true;
 }
 if(action==='frp-return'){const c=FRP.returnContext;delete FRP.returnContext;if(c){Object.assign(ui,c.ui);Object.assign(FRP,c.frp);render();if(c.modal)openModal(c.modal.kind,c.modal);if(c.drawer)openAssetDrawer(c.drawer);}return true;}
 if(action==='frp-update'){const p=pr(d.id);if(p?.frpRef&&!frpNode(p.frpRef.node)){openModal('frp-invalid-link',{project:p.id});return true;}openModal('frp-update',{id:d.id});return true;}
 if(action==='frp-adopt'){const m=ui.modal,p=pr(m.id);if(JSON.stringify(frpProjectCandidate(p))!==m.binding)throw Error('查看后公共版本变化，请重新查看差异');frpAdoptProject(p,m.next);closeModal();render();toast('只采用到 '+p.name+' 草稿；已应用和读取结果保持。','success');return true;}
 if(action==='frp-project-apply'){openModal('projectop',{id:d.id,op:'apply'});return true;}
 if(action==='frp-read'){const p=pr(d.id);if(d.fail==='true'||serverOperationError(p.server)){p.frpReadError=(serverOperationError(p.server)||'模拟读取失败')+'；保留上次成功内容及时间';}else if(p.frpApplied){p.frpReadSnapshot={files:clone(p.frpApplied.files),program:clone(p.frpApplied.program||null),at:now(),source:'浏览器模拟读取'};delete p.frpReadError;}else p.frpReadError='没有服务器文件模拟读取来源';persist();render();return true;}
 if(action==='frp-program-pin'){openModal('frp-program-pin',{role:d.role});return true;}
 return false;
}
function frpLinkedModal(m){
 if(m.kind==='frp-reference-confirm'){layout('载入附件参考示例','一个本地 FRPC 提供端 → 四个远端 FRPS，不是四台客户端。',notice('保留当前工作连接','当前连接、草稿与编辑缓存保存在工作清单；载入只切换到独立的附件参考清单，可随时返回。公共文件和已有项目不会被删除。')+detail([['参考数量','4 节点 · 6 TCP · 2 STCP · 2 默认客户端目标 · 2 visitor'],['二进制','四个 0 B 占位；不可部署']]),btn('取消','closemodal')+btn('载入并查看附件参考示例','frp-reference-confirmload',{},'primary'));return true;}
 if(m.kind==='frp-update'){
  const p=pr(m.id),role=p?.frpService?.role||p?.frpRef?.role||p?.frpInstallation?.role,n=p?.frpRef?frpNode(p.frpRef.node):p?.frpApplied?.node;if(!p||!n)throw Error('目标角色不存在');m.next=frpProjectCandidate(p);m.binding=JSON.stringify(m.next);
  layout('查看更新差异 · '+p.name,'采用只修改所选项目草稿，应用是下一次独立确认。',`<div class="diff-grid"><section><h3>当前项目草稿 · D${p.draftRev}</h3><pre class="code asset-text">${h(frpMask(p.frpDraft.files.toml))}</pre><pre class="code asset-text">${h(p.frpDraft.files.unit)}</pre><p>设置 G${p.frpDraft.settingsRevision} · 配置 C${p.frpDraft.configurationRevision}</p>${frpProgramPreview(p.frpDraft)}</section><section><h3>采用后的草稿</h3><pre class="code asset-text">${h(frpMask(m.next.files.toml))}</pre><pre class="code asset-text">${h(m.next.files.unit)}</pre><p>设置 G${m.next.settingsRevision} · 配置 C${m.next.configurationRevision}</p>${frpProgramPreview(m.next)}</section></div>${notice('明确目标：'+p.name,'其他角色草稿、已应用参照、服务器读取结果和模拟运行状态全部保持。')}`,btn('取消','closemodal')+btn('采用到这个项目 / 角色草稿','frp-adopt',{},'primary'),true);return true;
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
