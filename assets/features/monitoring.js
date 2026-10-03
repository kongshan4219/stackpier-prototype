'use strict';

function monitorMethod(p){
 const method=p.monitor?.method;
 if(method==='http'||method===p.type)return method;
 return p.monitor?.http?'http':p.type==='compose'?'compose':'systemd';
}

function monitorMethodOptions(p){return [[p.type,p.type==='compose'?'Docker Compose 命令':'systemd 命令'],['http','指定 HTTP 地址']];}

function monitorMethodLabel(p,method=monitorMethod(p)){return method==='http'?'HTTP':method==='compose'?'Docker Compose 命令':'systemd 命令';}

function monitorTarget(p,method=monitorMethod(p)){
 if(method==='http')return p.monitor?.http||'尚未填写地址';
 if(method==='compose')return `docker compose -f /srv/stackpier-demo/${p.name}/compose.yaml ps --status running`;
 return `systemctl is-active ${p.name}.service`;
}

function monitorMethodResult(p,inactive,stop){
 const method=monitorMethod(p);
 if(inactive)return ['不适用',''];
 if(stop)return ['符合停止基线','success'];
 if(method==='http')return [p.health==='healthy'?'通过':p.health==='unknown'?'待核对':'未通过',p.health==='healthy'?'success':'warning'];
 return [p.runtimeCheckStatus==='unknown'?'当前待核对；上次 '+runtimeName[p.runtime]:runtimeName[p.runtime],p.runtimeCheckStatus==='unknown'?'warning':p.runtime==='running'?'success':'warning'];
}

function probes(p){
 const server=sr(p.server),stop=isExpectedStop(p),inactive=['uninstalled','draft'].includes(p.life),result=monitorMethodResult(p,inactive,stop);
 const files=!p.applied?'尚无服务器文件':server?.state!=='online'?'读取待核对':p.components.length?'读取到部分变更':'已读取';
 const list=[
  ['SSH 连接',server?.state==='online'?'可达':'无法确认',server?.state==='online'?'success':'warning',server?.checked],
  [monitorMethodLabel(p),result[0],result[1],p.lastCheck],
  ['项目文件',files,!p.applied?'':server?.state!=='online'||p.components.length?'warning':'success',p.configurationReadAt||p.observed],
 ];
 return list.map(([name,value,tone,time])=>`<div class="probe"><div><div class="probe-name">${h(name)}</div><div class="probe-time">${fmt(time)}</div></div>${badge(value,tone)}</div>`).join('');
}

function monitorHttpField(p,method){
 const shown=method==='http';
 return `<div class="field" data-monitor-http-field ${shown?'':'hidden'}><label for="mon-http">HTTP 检查地址</label><input id="mon-http" name="mon-http" type="url" value="${h(p.monitor?.http||'')}" placeholder="https://example.com/health" autocomplete="off" ${shown?'required':'disabled'}><small>使用 HTTP 或 HTTPS，选择此方式时必填。</small></div>`;
}

function syncMonitorMethodField(selectElement){
 const form=selectElement.form,field=form?.querySelector('[data-monitor-http-field]'),input=field?.querySelector('#mon-http');if(!field||!input)return;
 const shown=selectElement.value==='http';field.hidden=!shown;input.disabled=!shown;input.required=shown;
}

function projectMonitor(p){
 const method=monitorMethod(p);
 return (p.monitorPaused?`<div class="mb">${notice('定时巡检已暂停','保存设置或重新部署不会自动恢复。项目重新部署后，可在这里明确恢复定时巡检。')}${p.life==='installed'?btn('恢复定时巡检','resumemonitor',{id:p.id},'mt'):''}</div>`:'')+`<div class="grid2">${card('最近检查结果',probes(p)+`<div class="monitor-target"><small>本次检查目标</small><code>${h(monitorTarget(p,method))}</code></div><p class="cell-sub mt">每个项目只执行所选检查方式，不同时执行其他服务命令或 TCP 检查。</p>`,btn('立即检查','projectcheck',{id:p.id},'small','refresh'))}<section class="card"><div class="card-head"><h2>项目巡检设置</h2><span class="tag">仅检查和通知</span></div><div class="card-body"><form data-form="projectmonitor" data-id="${h(p.id)}" class="stack">${field('mon-hours','检查间隔（小时）',p.monitor?.hours||24,'新项目默认 24 小时；这里不会创建真实定时任务。','number','min="1" max="8760" required')}${select('mon-method','检查方式',monitorMethodOptions(p),method,p.type==='compose'?'使用当前项目的 Compose 文件，或请求指定 HTTP 地址。':'使用当前项目的 systemd 单元，或请求指定 HTTP 地址。','required')}${monitorHttpField(p,method)}${check('mon-inherit','使用全局通知渠道',p.monitor?.inherit!==false)}<div class="flex wrap">${channelChecks('mon-channel',p.monitor?.channels||[])}</div><div class="form-bottom"><span class="form-aside">异常每次检查仍通知；恢复不另发通知。</span><button class="btn primary" type="submit">保存设置</button></div></form></div></section></div>`;
}

function monitorPage(){
 return heading('巡检与通知','每个项目选择 systemd、Docker Compose 或 HTTP 检查；发现异常只通知。',btn('检查适用项目','checkall',{},'primary','refresh'),'OPERATIONS / MONITORING')+tabs([['checks','检查结果'],['notifications','通知记录']],ui.monitorTab,'monitortab')+(ui.monitorTab==='checks'?`<section class="card"><div class="table-wrap"><table><thead><tr><th>项目</th><th>服务器</th><th>检查方式</th><th>最近结果 / 周期</th><th class="right">操作</th></tr></thead><tbody>${S.projects.map(p=>{const result=monitorMethodResult(p,['uninstalled','draft'].includes(p.life),isExpectedStop(p));return `<tr><td><button class="link cell-title" data-action="project" data-id="${p.id}">${h(p.name)}</button><p class="cell-sub">${p.type==='compose'?'Docker Compose':'systemd'}</p></td><td>${badge(sr(p.server)?.state==='online'?'可达':'待核对',sr(p.server)?.state==='online'?'success':'warning')}<p class="cell-sub">${h(sname(p.server))}</p></td><td><strong class="small">${h(monitorMethodLabel(p))}</strong><p class="cell-sub mono monitor-table-target">${h(monitorTarget(p))}</p></td><td>${badge(result[0],result[1])}<p class="cell-sub">${p.monitorPaused?'卸载后已暂停':(p.monitor?.hours||24)+' 小时 / 次（示例）'} · ${fmt(p.lastCheck)}</p></td><td class="right">${btn('设置','projectmonitorsettings',{id:p.id},'small ghost')}${p.monitorPaused&&p.life==='installed'?btn('恢复定时巡检','resumemonitor',{id:p.id},'small'):''}${btn('检查','projectcheck',{id:p.id},'small')}</td></tr>`}).join('')}</tbody></table></div></section><div class="mt">${notice('检查方式按项目运行类型提供','systemd 项目执行对应 systemctl 查询，Compose 项目执行对应 docker compose 查询；也可改为请求指定 HTTP 地址。')}</div>`:`<section class="card"><div class="card-head"><h2>演示通知记录</h2>${btn('通知设置','navigate',{page:'settings'},'small')}</div><div class="table-wrap"><table><thead><tr><th>时间</th><th>项目</th><th>通知内容</th><th>渠道</th><th>模拟交付</th></tr></thead><tbody>${S.notifications.map(n=>`<tr><td>${fmt(n.time)}</td><td>${h(n.project?pname(n.project):'全局')}</td><td>${h(n.text)}</td><td>${h(n.channel)}</td><td>${status(n.status)}</td></tr>`).join('')}</tbody></table></div><div class="card-foot">持续异常：每次检查仍通知；恢复正常：不发送额外恢复通知。这里没有真实发送。</div></section>`);
}

function runProjectCheck(p,observation){
 if(p.life==='uninstalled'||p.life==='draft'){toast('该项目没有适用的活动部署，未执行服务巡检。');return;}
 const server=sr(p.server),method=monitorMethod(p);p.lastCheck=now();
 if(method==='http'){
  const health=observation?.health||p.health;
  p.health=isExpectedStop(p)?'na':server?.state==='online'&&['healthy','unhealthy'].includes(health)?health:'unknown';
 }else{
  const current=observation?.runtime||(p.runtimeCheckStatus==='unknown'?'unknown':p.runtime);
  if(server?.state==='online'&&['running','stopped','partial'].includes(current)){
   p.runtime=current;p.observed=observation?.observedAt||now();p.runtimeCheckStatus='verified';if(current==='running')p.stopVerified=false;p.health=current==='running'?'healthy':isExpectedStop(p)?'na':'unhealthy';
  }else{p.runtimeCheckStatus='unknown';p.health='unknown';}
 }
 const failures=[];
 if(server?.state!=='online')failures.push('SSH 连接无法核对');
 if(method==='http'){
  if(!isExpectedStop(p)){
   if(!p.monitor?.http)failures.push('HTTP 检查地址未配置');
   else if(p.health==='unknown')failures.push('HTTP 检查结果待核对');
   else if(p.health!=='healthy')failures.push('HTTP 检查未通过');
  }
 }else{
  if(p.runtime==='stopped'&&!isExpectedStop(p))failures.push(`${monitorMethodLabel(p)}显示服务意外停止或停止尚未核实`);
  if(p.runtime==='unknown'||p.runtimeCheckStatus==='unknown')failures.push(`${monitorMethodLabel(p)}结果待核对`);
  if(p.runtime==='running'&&p.desired==='stopped')failures.push('实际运行与上次核实的停止基线不符');
 }
 if(p.components.length)failures.push('服务器文件存在未完成变更');
 const target=monitorTarget(p,method),operation=record('检查 '+p.name,'check',p.id,'success',failures.length?'检查完成，发现：'+failures.join('；'):`${monitorMethodLabel(p)}检查完成；未触发自动修复。`,{steps:[{title:'执行 '+target,status:'success'}]});
 if(failures.length){const channels=p.monitor?.inherit!==false?S.settings.channels:p.monitor?.channels||[];channels.forEach(channel=>S.notifications.unshift({id:uid('ntf'),time:now(),project:p.id,channel:({http:'HTTP',telegram:'Telegram',email:'邮件'}[channel]||channel)+' · 演示',status:'success',text:failures.join('；')+'。只通知，不自动修复。'}));}
 persist();render();toast(failures.length?'检查已完成，异常已记入演示通知。':'检查已完成；恢复正常不另发恢复通知。');return operation;
}

registerPrototypeHandlers(prototypeActions,['monitortab','projectmonitorsettings','projectcheck','checkall','resumemonitor'],function(event,target,data,action){
 if(action==='resumemonitor'){const p=pr(data.id);if(!p||p.life!=='installed'){toast('尚未重新部署，定时巡检保持暂停。','error');return;}p.monitorPaused=false;persist();render();toast('此项目的定时巡检已手动恢复（仅演示）。');return;}
 if(action==='monitortab'){ui.monitorTab=data.id;render();return;}
 if(action==='projectmonitorsettings'){navigate('project',data.id);ui.tab='monitor';render();return;}
 if(action==='projectcheck'){const p=pr(data.id);if(p)runProjectCheck(p);return;}
 S.projects.filter(p=>p.life==='installed'&&!p.monitorPaused).forEach(runProjectCheck);
});

function httpMonitorUrlError(value){
 if(!value)return '请选择 HTTP 检查时填写检查地址。';
 try{const url=new URL(value);if(!['http:','https:'].includes(url.protocol))return 'HTTP 检查地址只支持 http 或 https。';if(!url.hostname)return '请填写完整的 HTTP 检查地址。';}
 catch{return '请填写完整的 HTTP 检查地址。';}
 return '';
}

registerPrototypeHandlers(prototypeForms,['projectmonitor'],function(event,form,fd,get,has,all){
 const p=pr(form.dataset.id),hours=Number(get('mon-hours')),method=get('mon-method'),allowed=new Set(monitorMethodOptions(p).map(option=>option[0]));
 if(!Number.isInteger(hours)||hours<1||hours>8760){toast('检查间隔应为 1–8760 小时。','error');return;}
 if(!allowed.has(method)){toast('请选择当前项目支持的检查方式。','error');return;}
 const http=get('mon-http');if(method==='http'){const error=httpMonitorUrlError(http);if(error){toast(error,'error');return;}}
 p.monitor={hours,method,http,inherit:has('mon-inherit'),channels:all('mon-channel')};persist();render();toast('已保存演示巡检设置，没有注册真实计划。');
});
