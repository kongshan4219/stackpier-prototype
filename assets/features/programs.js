'use strict';

function programsPage(){const rows=S.programs.filter(b=>(b.name+' '+b.filename+' '+b.arch).toLowerCase().includes(ui.q.toLowerCase()));return heading('程序文件','维护现成二进制及其架构；不拉取源码、不编译、不自动部署。',btn('上传程序','programupload',{},'primary','upload'),'CONFIGURATION / BIN')+searchFilter('搜索程序名称或架构…')+`<section class="card"><div class="table-wrap"><table><thead><tr><th>程序</th><th>系统架构</th><th>文件名 / 内容身份</th><th>大小</th><th>最近替换</th><th class="right">操作</th></tr></thead><tbody>${rows.map(b=>`<tr><td><div class="flex"><span class="icon-box">${I('file')}</span><strong class="cell-title">${h(b.name)}</strong></div></td><td><span class="tag">${h(b.arch)}</span></td><td><span class="mono">${h(b.filename)}</span><p class="cell-sub mono">${h(b.identity)}</p></td><td>${h(b.size)}</td><td>${fmt(b.time)}</td><td class="right">${btn('替换文件','programupload',{id:b.id},'small')}</td></tr>`).join('')}</tbody></table></div>${!rows.length?empty('尚无程序文件','上传仅模拟文件选择，不会向服务器传输文件。'):''}</section><div class="grid2 mt">${card('部署时按目标架构匹配',`<p class="small muted">相同程序可以提供多种架构文件。这里的 x86_64 与 aarch64 只是演示样例，不限制正式产品的 ARM / x86 范围。缺少适配文件时，部署应明确提示。</p>`)}${card('上传不是部署',`<p class="small muted">替换当前文件只产生可采用更新；现有项目继续使用已部署内容。不会自动保留历史二进制作为回退库。</p>`)}</div>`}

function programEditor(m){const b=S.programs.find(x=>x.id===m.id)||{};layout(m.id?'替换当前程序文件':'上传程序文件','仅记录演示文件名、大小和架构，不读取内容、不上传或执行。',`<div class="stack"><div class="field-row">${field('bin-name','程序名称',b.name||'','同一名称按目标架构匹配。','text','required')}${select('bin-arch','目标架构',[['x86_64','x86_64（示例）'],['aarch64','aarch64（示例）'],['armv7l','armv7l（示例）']],b.arch||'x86_64')}</div><div class="file-drop">${I('upload')}<p class="small">选择一个演示文件，或手动填写演示文件名</p><input id="bin-file" name="bin-file" type="file" aria-label="选择演示程序文件"></div>${field('bin-filename','演示文件名',b.filename||'','正式文件位于控制器可执行文件旁的 bin/。')}${notice('替换当前文件不自动部署','现有项目只出现可采用更新。不会保留独立历史二进制回退库。')}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存演示文件记录</button>',false,'programupload');}

// 本组件的弹窗。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeModals, ["programupload"], function(m, p) {
  switch (m.kind) {
case'programupload':programEditor(m);break;
  }
});

// 本组件的表单提交。保留原来的分支和中断语义。
registerPrototypeHandlers(prototypeForms, ["programupload"], function(event, form, fd, get, has, all, m, p, kind) {
  switch (kind) {
case'programupload':{const f=fd.get('bin-file'),filename=get('bin-filename');if(!filename){modalError('请选择演示文件，或填写一个演示文件名。');break;}const old=S.programs.find(b=>b.id===m.id),same=S.programs.find(b=>b.name===get('bin-name')&&b.arch===get('bin-arch')),n={id:old?.id||same?.id||uid('bin'),name:get('bin-name'),arch:get('bin-arch'),filename,size:f&&f.size?`${(f.size/1024).toFixed(1)} KB`:'未读取（演示）',time:now(),identity:uid('content')};const ix=S.programs.findIndex(b=>b.id===n.id);if(ix>=0)S.programs[ix]=n;else S.programs.push(n);S.projects.filter(p=>p.cfg.program===n.name&&sr(p.server)?.arch===n.arch).forEach(p=>p.programUpdate=true);persist();closeModal();render();toast('当前程序文件记录已替换；没有读取文件内容，也没有自动部署。','success');break;}
  }
});
