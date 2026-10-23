'use strict';

function firewallTransferRule(r){return {protocol:r.protocol.toLowerCase().replace('/','+'),port:String(r.port),family:r.address.includes(':')?'ipv6':'ipv4',source:r.address,action:r.action,description:r.description||''};}
function firewallParseImport(text,server){
 if(new TextEncoder().encode(text).length>262144)throw Error('导入文件不能超过 256 KiB。');
 const data=JSON.parse(text);
 if(data.format!=='stackpier-port-rules'||data.version!==1||!Array.isArray(data.rules)||data.rules.length<1||data.rules.length>50)throw Error('需要版本 1 的端口规则文件，每次 1–50 条。');
 if(Object.keys(data).some(k=>!['format','version','rules'].includes(k)))throw Error('导入文件包含未知字段。');
 const seen=new Set();
 return data.rules.map((r,index)=>{
  if(Object.keys(r).some(k=>!['protocol','port','family','source','action','description'].includes(k)))throw Error(`第 ${index+1} 条包含未知字段。`);
  const ports=String(r.port).split('-').map(Number);
  if(!['tcp','udp','tcp+udp'].includes(r.protocol)||!['ipv4','ipv6'].includes(r.family)||!['allow','deny'].includes(r.action)||ports.length>2||ports.some(n=>!Number.isInteger(n)||n<1||n>65535)||(ports.length===2&&ports[0]>ports[1])||!validAddress(r.source)||String(r.description||'').length>256)throw Error(`第 ${index+1} 条端口规则无效。`);
  if(r.family!==(r.source.includes(':')?'ipv6':'ipv4'))throw Error(`第 ${index+1} 条地址族与来源不一致。`);
  if(r.action==='deny'&&r.protocol!=='udp'&&ports[0]<=sr(server).port&&(ports[1]||ports[0])>=sr(server).port)throw Error(`第 ${index+1} 条可能覆盖 SSH 管理端口。`);
  const signature=JSON.stringify([r.protocol,r.port,r.source,r.action]);
  if(seen.has(signature)||S.firewalls.some(old=>old.server===server&&JSON.stringify([old.protocol.toLowerCase().replace('/','+'),String(old.port),old.address,old.action])===signature))throw Error(`第 ${index+1} 条与已有或导入规则重复。`);
  seen.add(signature);
  return {id:uid('fw'),server,protocol:r.protocol.toUpperCase().replace('+','/'),port:String(r.port),address:r.source,action:r.action,description:r.description||'',direction:'in',scope:'host',projects:[],protected:false};
 });
}

registerPrototypeHandlers(prototypeActions,['fw-import','fw-export','fw-batch-delete'],(event,target,d,a)=>{
 const server=selectedServer();
 if(!server){toast('请先选择服务器。','warning');return;}
 if(a==='fw-import'){openModal('fw-import',{server});return;}
 const rows=firewallPortRules().filter(r=>!(ui.fwSelected||[]).length||(ui.fwSelected||[]).includes(r.id));
 if(a==='fw-batch-delete'){
  if(!(ui.fwSelected||[]).length){toast('请先选择端口规则。','warning');return;}
  if(rows.some(firewallProtected)){toast('SSH 管理通路不能删除。','error');return;}
  openModal('fw-batch-confirm',{server,records:clone(rows),before:clone(rows),mode:'delete'});return;
 }
 const content=JSON.stringify({format:'stackpier-port-rules',version:1,rules:rows.map(firewallTransferRule)},null,2);
 const url=URL.createObjectURL(new Blob([content],{type:'application/json'})),link=document.createElement('a');
 link.href=url;link.download='stackpier-port-rules.json';link.click();URL.revokeObjectURL(url);toast(`已导出 ${rows.length} 条端口规则。`);
});

registerPrototypeHandlers(prototypeModals,['fw-import','fw-batch-confirm'],m=>{
 if(m.kind==='fw-import'){
  layout('导入端口规则','固定当前服务器，先校验和预览，再确认执行。',`<div class="stack">${detail([['服务器',h(sname(m.server))]])}<div class="field"><label for="fw-import-file">JSON 文件</label><input id="fw-import-file" type="file" accept=".json,application/json"></div>${area('fw-import-json','端口规则 JSON',m.text||'','版本 1；最多 50 条、256 KiB。')}<p>仅包含协议、端口、来源、策略和描述；不导入命令、服务器身份或凭据。</p></div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">校验并预览</button>',false,'fw-import');return;
 }
 layout(m.mode==='delete'?'确认删除端口规则':'确认导入端口规则','只执行本次固定差异，服务器或已有规则变化后必须重新预览。',`<div class="stack">${detail([['服务器',h(sname(m.server))],['数量',String(m.records.length)]])}<div class="table-wrap"><table><thead><tr><th>协议</th><th>端口</th><th>来源</th><th>策略</th></tr></thead><tbody>${m.records.map(r=>`<tr><td>${h(r.protocol)}</td><td>${h(r.port)}</td><td>${h(r.address)}</td><td>${r.action==='allow'?'允许':'拒绝'}</td></tr>`).join('')}</tbody></table></div>${check('fw-batch-ack','确认固定服务器和以上端口规则变更',false)+check('fw-runtime','确认仅修改当前运行态，重启或外部重载可能恢复原配置',false)}${outcomeField('success',[['success','规则修改并读回成功'],['failed','明确失败并撤销本次差异'],['unknown','响应丢失，保留原操作核对']])}</div>`,btn('取消','closemodal')+'<button class="btn primary" type="submit">确认并提交（演示）</button>',false,'fw-batch-confirm');
});

registerPrototypeHandlers(prototypeForms,['fw-import','fw-batch-confirm'],(event,form,fd,get,has,all,m)=>{
 if(m.kind==='fw-import'){
  m.text=get('fw-import-json');
  try{const records=firewallParseImport(m.text,m.server);openModal('fw-batch-confirm',{server:m.server,records,before:[],mode:'add'});}catch(error){modalError(error.message);}
  return;
 }
 if(!has('fw-batch-ack')||!has('fw-runtime'))return modalError('请确认固定目标和规则差异。');
 const error=serverOperationError(m.server);if(error)return modalError(error);
 if(m.mode==='delete'&&m.before.some(r=>JSON.stringify(S.firewalls.find(old=>old.id===r.id))!==JSON.stringify(r)))return modalError('原规则已变化，请重新预览。');
 ui.fwSelected=[];
 startOperation(null,'network',{label:(m.mode==='delete'?'批量删除':'导入')+'端口规则',netType:'firewall',action:'port-batch',mode:m.mode,records:clone(m.records),before:clone(m.before),serverTarget:serverOperationSnapshot(m.server),targetId:m.server,resources:m.records.map(r=>'firewall:'+r.id)},get('outcome'));
});

document.addEventListener('change',async event=>{
 if(event.target.id!=='fw-import-file')return;
 const file=event.target.files?.[0],modal=ui.modal;if(!file||modal?.kind!=='fw-import')return;
 if(file.size>262144){modalError('导入文件不能超过 256 KiB。');return;}
 try{const text=await file.text();if(ui.modal===modal){modal.text=text;document.getElementById('fw-import-json').value=text;}}catch{modalError('无法读取导入文件。');}
});
