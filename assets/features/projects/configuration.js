'use strict';

function pending(p){return !p.applied||JSON.stringify(p.cfg)!==JSON.stringify(p.applied)}

function configText(p,c=p.cfg){if(!c)return '尚无已应用参照';if(typeof c.source==='string')return c.source;return p.type==='compose'?`services:\n  ${p.software}:\n    image: ${c.program}:${c.version}\n    ports: ["${c.port}:${p.software==='mysql'?3306:p.software==='redis'?6379:80}"]\n    volumes: ["${c.dataDir}:/data"]\n    environment:\n${c.env.split('\n').filter(Boolean).map(x=>'      - '+x).join('\n')}`:`# 应用配置（演示渲染）\n${c.appConfig}\nlisten = ":${c.port}"\n\n# systemd 服务文件\n[Unit]\nDescription=${p.name}\n[Service]\nUser=${c.serviceUser}\nExecStart=/srv/stackpier-demo/${p.name}/${c.program} --config app.conf\n# 内容身份: ${c.version}\n# data: ${c.dataDir}\n${c.env.split('\n').filter(Boolean).map(x=>'Environment='+x).join('\n')}`;}

function fileProjectConfig(p){return `<div class="mb">${notice('保存只改变草稿，不会下发或重启服务',`当前草稿 D${p.draftRev}，最后完整应用参照 ${p.applied?'A'+p.appliedRev:'尚未建立'}。`)}</div><div class="grid2"><section class="card"><div class="card-head"><h2>项目配置</h2></div><div class="card-body"><form data-form="fileprojectconfig" data-id="${h(p.id)}" class="stack">${configurationSourceField('cfg-source','配置文件内容',p.cfg.source)}<div class="form-bottom"><span class="form-aside">保存与应用分开。</span><button type="submit" class="btn primary">保存草稿</button></div></form></div></section><div class="stack">${card('已应用参照',`<pre class="code">
${h(configText(p,p.applied))}</pre>`,btn('对比差异','configdiff',{id:p.id},'small ghost'))}${card('配置来源',detail([['公共配置',h(tpl(p.template)?.name)],['已采用修订',h(p.cfg.templateRev)],['当前修订',h(tpl(p.template)?.rev)]]),btn('查看公共配置','templateedit',{id:p.template},'small ghost'))}${p.templateUpdate?notice('公共配置有新修订','采用到草稿后，仍需单独应用。','warning')+btn('采用公共配置到草稿','adopttemplate',{id:p.id}):''}</div></div>`;}

function projectConfig(p){if(typeof p.cfg.source==='string')return fileProjectConfig(p);return `<div class="mb">${notice('保存只改变草稿，不会下发或重启服务',`当前草稿 D${p.draftRev}，最后完整应用参照 ${p.applied?'A'+p.appliedRev:'尚未建立'}。执行期间再次保存，也不会改变已经受理的那次操作。`)}</div><div class="grid2"><section class="card"><div class="card-head"><h2>项目配置</h2><span class="tag">单项目修改</span></div><div class="card-body"><form data-form="projectconfig" data-id="${p.id}" class="stack"><div class="field-row">${field('cfg-port','对外端口',p.cfg.port,'不自动联动 DNS 或防火墙','number','min="1" max="65535" required')}${field('cfg-version',p.type==='compose'?'镜像标签（演示）':'程序内容标识（演示）',p.cfg.version,'不会建立独立回退版本库')}</div>${field('cfg-data','业务数据目录',p.cfg.dataDir,'改变该字段不代表已执行数据搬移；本轮不支持跨机迁移。')}${p.type==='systemd'?field('cfg-user','应用运行用户',p.cfg.serviceUser,'与 SSH 管理身份不同'):''}${area('cfg-env','环境变量',p.cfg.env,'仅使用虚构值；不要在原型中输入真实密钥。')}${p.type==='systemd'?area('cfg-app','应用配置参数',p.cfg.appConfig,'对应运行后维护的表单与模板；本原型为可编辑文本模拟。'):''}<div class="form-bottom"><span class="form-aside">不会发送真实配置，也不会启动任何服务。</span><button type="submit" class="btn primary">保存草稿</button></div></form></div></section><div class="stack">${card('已应用参照',`<pre class="code">
${h(configText(p,p.applied))}</pre>`,btn('对比差异','configdiff',{id:p.id},'small ghost'))}${card('配置来源',detail([['公共配置',h(tpl(p.template)?.name)],['已采用模板修订',h(p.cfg.templateRev||1)],['模板当前修订',h(tpl(p.template)?.rev||1)],['待部署程序',h(p.cfg.program)]]),btn('查看公共配置','templateedit',{id:p.template},'small ghost'))}${p.templateUpdate?notice('公共配置有新修订','需要明确采用到本项目草稿，再单独应用；不会批量自动更新。','warning'):''}${p.templateUpdate?btn('采用公共配置到草稿','adopttemplate',{id:p.id}):''}</div></div>`}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["configdiff"], function(m, p) {
  switch (m.kind) {
case'configdiff':layout('配置对比 · '+p.name,'比较最新保存内容与最后完整应用参照；不代表真实远端文件逐项一致。',`<div class="diff-grid"><div><h3>已应用参照 ${p.applied?'A'+p.appliedRev:'未建立'}</h3><pre class="code">
${h(configText(p,p.applied))}</pre></div><div><h3>最新保存草稿 D${p.draftRev}</h3><pre class="code">
${h(configText(p))}</pre></div></div>${p.components.length?`<div class="mt">${notice('存在部分交付事实','完整旧参照仅作历史基线，不能冒充当前全部远端内容。','warning')}</div>`:''}`,btn('关闭','closemodal')+btn('应用草稿','projectop',{id:p.id,kind:'apply'},'primary'),true);break;
  }
});

// 本组件的按钮动作。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeActions, ["adopttemplate"], function(event, target, d, a) {
  switch (a) {
case'adopttemplate':{const p=pr(d.id),t=tpl(p.template);if(t.contentMode==='file')p.cfg.source=t.tpl;else{p.cfg.port=t.port;p.cfg.env=t.env;}p.cfg.templateRev=t.rev;p.templateUpdate=false;p.draftRev++;persist();render();toast('公共配置已采用到草稿，尚未下发。');break;}
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["fileprojectconfig","projectconfig"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'fileprojectconfig':{const x=pr(form.dataset.id),source=String(fd.get('cfg-source')??'');if(!source.trim()){toast('请填写完整配置文件内容。','error');break;}x.cfg={...x.cfg,source};x.draftRev++;persist();render();toast('草稿已保存，已应用配置保持不变。','success');break;}
case'projectconfig':{const x=pr(form.dataset.id),port=Number(get('cfg-port'));if(!Number.isInteger(port)||port<1||port>65535){toast('端口应在 1–65535。','error');break;}x.cfg={...x.cfg,port,version:get('cfg-version')||x.cfg.version,dataDir:get('cfg-data'),env:get('cfg-env'),appConfig:form.querySelector('#cfg-app')?get('cfg-app'):x.cfg.appConfig,serviceUser:form.querySelector('#cfg-user')?get('cfg-user'):x.cfg.serviceUser};x.draftRev++;persist();render();toast('草稿已保存。远端参照、运行状态和在途操作输入保持不变。','success');break;}
  }
});
