'use strict';

function programReferences(file){
 return {templates:S.templates.filter(t=>t.fileMappings?.some(row=>row.fileId===file.id)),projects:S.projects.filter(p=>p.cfg.fileMappings?.some(row=>row.fileId===file.id))};
}
function programsPage(){
 const rows=S.programs.filter(b=>(b.name+' '+b.filename+' '+b.arch).toLowerCase().includes(ui.q.toLowerCase()));
 return heading('程序文件','统一管理程序与配套文件，供部署配置和项目引用。',btn('上传文件','programupload',{},'primary','upload'),'CONFIGURATION / BIN')+
 `<section class="card file-library-banner"><div class="icon-box">${I('file')}</div><div><strong>控制器文件总目录 <code>bin/</code></strong><p class="small muted"><code>files/</code> 集中存放文件；<code>projects/项目ID/</code> 使用符号链接引用。部署时将文件内容上传到目标服务器指定路径。</p></div></section>`+
 searchFilter('搜索文件名称、文件名或架构…')+`<div class="file-library-layout"><section class="card"><div class="table-wrap"><table><thead><tr><th>文件</th><th>适用架构</th><th>总目录中的文件</th><th>大小</th><th>引用</th><th class="right">操作</th></tr></thead><tbody>${rows.map(b=>{const refs=programReferences(b);return `<tr><td><div class="flex"><span class="icon-box">${I('file')}</span><div><strong class="cell-title">${h(b.name)}</strong><p class="cell-sub">${fmt(b.time)}</p></div></div></td><td><span class="tag">${h(programArchitecture(b.arch))}</span></td><td class="program-file-path"><span class="mono">${h(b.filename)}</span><p class="cell-sub mono">${h(fileLibraryPath(b))}</p></td><td>${h(b.size)}</td><td><span>${refs.templates.length} 个部署配置</span><p class="cell-sub">${refs.projects.length} 个项目</p></td><td class="right">${btn('替换文件','programupload',{id:b.id},'small')}</td></tr>`;}).join('')}</tbody></table></div>${!rows.length?empty('没有匹配的文件','上传文件，或在部署配置的文件映射中直接上传。'):''}</section>${projectFileDirectories()}</div><div class="mt">${notice('上传和链接不等于部署','本原型仅保存文件名、大小及引用关系，不读取文件内容或创建真实目录。替换文件不会自动更新目标服务器。')}</div>`;
}

function programEditor(m){
 const b=S.programs.find(x=>x.id===m.id)||{};
 layout(m.id?'替换文件':'上传文件','文件集中保存在控制器，部署配置可以按需引用。',`<div class="stack"><div class="field-row">${field('bin-name','文件名称',b.name||'','用于在程序文件和文件映射中识别。','text','required')}${select('bin-arch','适用架构',[['any','通用文件（配置、资源等）'],['x86_64','x86_64'],['aarch64','aarch64'],['armv7l','armv7l']],b.arch||'any')}</div><div class="file-drop">${I('upload')}<p class="small">选择本地程序、配置或配套文件</p><input id="bin-file" name="bin-file" type="file" aria-label="选择本地文件"></div>${field('bin-filename','文件名',b.filename||'','原型也可填写虚构文件名进行演示。','text','required')}${notice('统一存放，项目通过链接引用','文件存放在 bin/files/，项目链接位于 bin/projects/项目ID/；远端目标路径由部署配置的文件映射指定。')}${m.id?notice('替换不会自动部署','文件引用保持关联；现有项目需明确更新后才向目标服务器重新交付。'):''}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">保存文件记录</button>',false,'programupload');
}

registerPrototypeHandlers(prototypeModals,['programupload'],function(m){programEditor(m);});
registerPrototypeHandlers(prototypeForms,['programupload'],function(event,form,fd,get,has,all,m){
 const f=fd.get('bin-file'),filename=get('bin-filename'),name=get('bin-name');
 if(!filename||!name){modalError('请填写文件名称，并选择文件或填写演示文件名。');return;}
 if(/[\\/\u0000-\u001f\u007f]/.test(filename)||['.','..'].includes(filename)){modalError('文件名不能包含路径分隔符或控制字符。');return;}
 const old=S.programs.find(b=>b.id===m.id),n={id:old?.id||uid('bin'),name,arch:get('bin-arch'),filename,size:f&&typeof f.size==='number'?`${(f.size/1024).toFixed(1)} KB`:'未读取（演示）',time:now(),identity:uid('content')};
 const ix=S.programs.findIndex(b=>b.id===n.id);if(ix>=0)S.programs[ix]=n;else S.programs.push(n);
 S.projects.filter(p=>p.cfg.fileMappings?.some(row=>row.fileId===n.id)||p.cfg.program===n.name&&sr(p.server)?.arch===n.arch).forEach(p=>p.programUpdate=true);
 persist();closeModal();render();toast('文件记录已保存到总目录，未向目标服务器上传。','success');
});
