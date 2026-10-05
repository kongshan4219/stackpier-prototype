'use strict';
// 清理生成记录只删除明确列出的浏览器记录，不停止服务或移除已安装 unit。
function frpGeneratedAction(action,d){
 if(action==='frp-generated-files'){openModal('frp-generated-files');return true;}
 if(action==='frp-generated-remove'){openModal('frp-generated-remove',{id:d.id,binding:JSON.stringify(S.frpGenerated?.[d.id])});return true;}
 if(action==='frp-generated-confirm'){
  const m=ui.modal,entry=S.frpGenerated?.[m.id];if(!entry||JSON.stringify(entry)!==m.binding)throw Error('生成记录已变化，请重新确认清理范围。');
  const f=entry.snapshot.files;delete S.frpGenerated[m.id];record('FRP 清理生成记录','frp-generated-cleanup',pr(m.id)?.id||null,'success','模拟清理 '+(f.generatedToml||f.tomlPath)+' 与 '+(f.generatedUnit||f.unitPath)+'；不停止服务、不移除安装 unit、不改变应用参照。');persist();closeModal();render();toast('只清理了所选生成记录。','success');return true;
 }
 return false;
}
function frpGeneratedModal(m){
 if(m.kind==='frp-generated-files'){
  const rows=Object.entries(S.frpGenerated||{});layout('生成文件记录与残留清理','生成不会自动清除旧文件；这里逐项确认，仅清理本地模拟记录。',`<div class="stack">${rows.map(([id,row])=>`<article class="asset-reference"><strong>${h(pname(id))}</strong><p class="small muted">${frpNode(row.snapshot.node.id)?'来源连接保留':'来源节点已删除 · 残留记录'} · ${h(row.at)}</p><code>${h(row.snapshot.files.generatedToml||row.snapshot.files.tomlPath)}</code><code>${h(row.snapshot.files.generatedUnit||row.snapshot.files.unitPath)}</code>${btn('清理这组生成记录','frp-generated-remove',{id},'small danger')}</article>`).join('')||empty('没有生成记录','预览、保存和部署不冒充手动生成。')}</div>`,btn('关闭','closemodal'),true);return true;
 }
 if(m.kind==='frp-generated-remove'){
  const row=S.frpGenerated?.[m.id];if(!row)throw Error('生成记录已不存在');layout('确认清理生成记录','这是与停止服务、移除安装 unit 分开的动作。',detail([['项目记录',h(pname(m.id))],['生成 TOML',h(row.snapshot.files.generatedToml||row.snapshot.files.tomlPath)],['生成 unit',h(row.snapshot.files.generatedUnit||row.snapshot.files.unitPath)]])+notice('保留服务器模拟事实','不停止服务、不删除安装配置和 unit，不清理共享程序，不更改已应用参照或读取快照。','warning'),btn('取消','closemodal')+btn('仅清理列出的生成记录','frp-generated-confirm',{},'danger'));return true;
 }
 return false;
}
