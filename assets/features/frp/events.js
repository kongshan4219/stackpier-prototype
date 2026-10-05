'use strict';
// FRP 点击、选项变化和表单事件；在工作台及扩展挂钩之后注册。
document.addEventListener('click',event=>{const el=event.target.closest('[data-action]');if(!el)return;const a=el.dataset.action;if(!a.startsWith('frp-'))return;event.preventDefault();event.stopImmediatePropagation();frpEnsure();const d=el.dataset;try{
 if(['frp-install','frp-install-remove','frp-batch','frp-batchconfirm','frp-batchpreview','frp-cloud','frp-group','frp-targets'].includes(a)){closeModal();openModal('newproject',{template:'frp-template-'+(d.role||'client'),server:d.server||selectedServer()});return;}
 if(a==='frp-binding-detach'){openModal('frp-binding-detach',{node:d.node});return;}
 if(a==='frp-configapply'||a==='frp-op'){openModal('frp-configapply',{node:d.node||FRP.node});return;}
 if(a==='frp-connection-delete'){const n=frpNode(d.node);openModal('frp-connection-delete',{node:n.id});return;}
 if(a==='frp-connection-delete-confirm'){const n=frpNode(d.node);if(n.evidenceReview||frpUnresolvedTargets(n.id).length)throw Error('旧目标未解决，先核对或清理固定旧配置，不能通过删除连接释放占用。');n.deletedConfig=true;n.proxies=[];n.revision++;persist();closeModal();render();toast('连接配置已标记删除，尚待应用；服务项目保持。');return;}
 if(a==='frp-public-adopt'){const n=frpNode(d.node);openModal('frp-public-adopt',{node:n.id});return;}
 if(a==='frp-public-adopt-confirm'){const n=frpNode(d.node);n.sourceSettings=frpSettingsSnapshot();n.revision++;persist();closeModal();render();return;}
 if(a==='frp-home')frpGo();else if(a==='frp-tab'){FRP.tab=['deploy','review'].includes(d.id)?'connections':d.id;render();}else if(a==='frp-role'){FRP.role=d.id;render();}else if(a==='frp-node')frpGo('node',d.id);else if(a==='frp-openfiles')frpGo('files',d.node,d.role);

 else if(a==='frp-validate'){const errors=frpValidate();layout(errors.length?'FRP 草稿校验未通过':'FRP 草稿结构校验通过','只核对结构、作用域、路径和已知端口；不是 FRP 二进制 verify 或真实连通性检查。',errors.length?errors.map(x=>notice(x,'','error')).join(''):notice('草稿结构检查通过','结构和生成路径通过浏览器校验；未执行真实 verify、架构运行或隧道连通性检查。'));if(!dialog.open)dialog.showModal();}
 else if(a==='frp-copy'){const f=frpFiles(frpNode(d.node),d.role);copyText(f.toml+'\n# '+f.unitPath+'\n'+f.unit);}
 else if(a==='frp-template-preview'){const name=ui.modal.id,old=S.frp.templates[name];try{S.frp.templates[name]=document.querySelector('#ft-source').value;const errors=frpValidate();if(errors.length)throw Error(errors.join('；'));const n=frpNode(FRP.node)||S.frp.nodes[0],files=frpFiles(n,frpTemplateRole(name));document.querySelector('#ft-preview').innerHTML=notice('未保存的生成预览 · '+n.ip,'只预览当前编辑文本；不保存、不应用。')+'<pre class="code frp-code">'+h(name.endsWith('.toml.tpl')?files.toml:files.unit)+'</pre>';}finally{S.frp.templates[name]=old;}}
 else if(a==='frp-removesave'){const n=frpNode(d.node),next=clone(n);next.proxies.splice(Number(d.index),1);next.revision++;frpSaveNode(next,n);closeModal();render();toast('只移除了映射草稿；已部署 visitor 不自动删除。');}
 else if(frpLinkedAction(a,d))return;else openModal(a,{...d,kind:a});
 }catch(e){if(dialog.open)modalError(e.message);else toast(e.message,'error');}
},true);
document.addEventListener('change',event=>{if(event.target.id==='fn-server')frpSyncConnectionServerFields();if(event.target.id==='frp-current-node'){FRP.node=event.target.value;render();}if(event.target.id==='fp-type'){document.getElementById('fp-tcp').hidden=event.target.value!=='tcp';document.getElementById('fp-stcp').hidden=event.target.value!=='stcp';}});
document.addEventListener('submit',event=>{const form=event.target;if(!form.dataset.form?.startsWith('frp-'))return;event.preventDefault();event.stopImmediatePropagation();const fd=new FormData(form),val=k=>String(fd.get(k)||''),yes=k=>fd.has(k),m=ui.modal;try{
 if(frpLinkedSubmit(form,fd,m))return;
 if(form.dataset.form==='frp-nodeedit'){
  const old=m.id?frpNode(m.id):null,client=frpServiceProject(val('fn-provider'),'client'),server=frpServiceProject(val('fn-server'),'server'),visitor=val('fn-visitor');
  if(!client||!server)throw Error('请选择已部署 FRPC 与 FRPS 服务实例。');
  const n={...(old?clone(old):{id:uid('n'),proxies:[],revision:0}),ip:sr(server.server).host,ssh_user:sr(server.server).user,bind_addr:server.frpApplied.node.bind_addr,bind_port:server.frpApplied.node.bind_port,provider:client.server,server:server.server,arch:sr(server.server).arch,client_enabled:yes('fn-default'),serviceBindings:{client:client.id,server:server.id,...(visitor?{visitor}:{})},roleProjects:{server:server.id},serverUnit:server.frpApplied.unit};
  n.sourceSettings||=frpSettingsSnapshot();n.revision++;frpSaveNode(n,old);FRP.node=n.id;FRP.tab='node';
 }

 else if(form.dataset.form==='frp-proxyedit'){const n=frpNode(m.node),next=clone(n),type=val('fp-type');const x={name:val('fp-name').trim(),type,local_ip:val('fp-localip').trim(),local_port:Number(val('fp-localport'))};if(type==='tcp')x.remote_port=Number(val('fp-remote'));else{if(!/^(EXAMPLE_|DEMO_)/.test(val('fp-secret')))throw Error('原型只接受 EXAMPLE_ / DEMO_ 开头的示例密钥，请勿填写真实凭据。');Object.assign(x,{secret_key:val('fp-secret'),visitor_bind_addr:val('fp-vaddr').trim(),visitor_bind_port:Number(val('fp-vport'))});}if(m.index!==undefined)next.proxies[Number(m.index)]=x;else next.proxies.push(x);next.revision++;frpSaveNode(next,n);}
 else if(form.dataset.form==='frp-template'){const old=S.frp.templates[m.id];frpValidateTemplate(m.id,val('ft-source'));S.frp.templates[m.id]=val('ft-source');const errors=frpValidate();if(errors.length){S.frp.templates[m.id]=old;throw Error(errors.join('；'));}if(old!==S.frp.templates[m.id]){S.frp.templateRev++;S.frp.templateRevisions[m.id]++;}}
 else if(form.dataset.form==='frp-settings'){if(!/^(EXAMPLE_|DEMO_)/.test(val('fs-token')))throw Error('原型只接受 EXAMPLE_ / DEMO_ 开头的示例 token。');const old=clone(S.frp);Object.assign(S.frp,{root:val('fs-root').replace(/\/$/,''),systemdDir:val('fs-systemd').replace(/\/$/,''),user:val('fs-user').trim(),token:val('fs-token'),naming:val('fs-naming')});const errors=frpValidate();if(errors.length){S.frp=old;throw Error(errors.join('；'));}if(['root','systemdDir','user','token','naming'].some(key=>old[key]!==S.frp[key]))S.frp.settingsRev++;}

 frpSyncPublicTemplates();frpSyncConfigs();persist();ui.modal.saved=true;closeModal();render();toast('已保存 FRP 公共修订，未下发、未重启或修改网络。','success');
 }catch(e){modalError(e.message);}
},true);
