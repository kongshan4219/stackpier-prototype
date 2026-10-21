'use strict';

function projectPlanDetails(items){return `<dl class="project-plan-details">${items.map(([label,value])=>`<dt>${h(label)}</dt><dd>${value}</dd>`).join('')}</dl>`;}
function projectPlanDigest(value){return `<code>${h(value||'历史参照缺少摘要')}</code>`;}
function projectAppliedPlan(p){
 const snapshot=p.appliedSnapshot,cfg=snapshot?.cfg,frp=p.frpApplied,server=sr(p.server);
 if(!cfg&&!frp)return notice('尚无已应用配置参照','历史记录未保存固定部署信息，不能用项目草稿或公共最新版本代替。','warning');
 const templateId=snapshot?.templateId||frp?.templateId||p.template;
 const revision=snapshot?.templateRevision||frp?.configurationRevision;
 const items=[
  ['部署配置',h(snapshot?.templateName||tpl(templateId)?.name||'历史配置')+' · C'+h(revision||'—')],
  ['服务器',h((server?.name||p.serverName||'历史服务器')+' · '+(server?.host||'地址未知')+':'+(server?.port||'—'))]
 ];
 if(projectIsFrp(p)){
  if(!frp)return projectPlanDetails(items)+notice('历史 FRP 参照不完整','未保存的字段保持未知。');
  const role=frp.role==='server'?'FRPS':frp.role==='visitor'?'FRPC VISITOR':'FRPC',node=frp.node||{},files=frp.files||{};
  items.push(['FRP 服务',h(role+' · '+(frp.version||'版本未记录')+' · '+(frp.unit||files.unitPath?.split('/').at(-1)||'unit 未记录'))],
   ['项目身份',`<code>${h(p.id)}</code>`],['独占目录',`<code>${h(files.tomlPath?.slice(0,files.tomlPath.lastIndexOf('/'))||'未记录')}</code>`],
   ['程序固定版本',h(frp.program?.filename||frp.program?.name||'历史程序信息未记录')+projectPlanDigest(frp.program?.sha256)],
   ['控制端点',h((node.ip||node.bind_addr||'未记录')+':'+(node.bind_port||'—'))],
   ['管理接口',frp.adminPort?h('127.0.0.1:'+frp.adminPort+'，仅经目标 SSH 读取'):'历史参照未记录'],
   ['允许映射端口',frp.allowedPortStart?h(frp.allowedPortStart+'–'+frp.allowedPortEnd):'历史参照未记录'],
   ['成功条件','核实官方程序版本、文件摘要、有效 JSON 配置、unit 与真实 FRP 管理状态；部署服务不代表映射通路已可用。']);
  return projectPlanDetails(items);
 }
 const directory=cfg.dataDir?.replace(/\/data\/?$/,'')||`/srv/stackpier-demo/${p.name}`;
 if(p.type==='compose'){
  const compose=snapshot.compose;
  items.push(['运行方式','Docker Compose'],['项目范围',`<code>${h(compose?.projectName||p.name)}</code>`],
   ['独占目录',`<code>${h(directory)}</code>`],['固定配置摘要',projectPlanDigest(compose?.sha256||projectTextSHA(cfg.source))],
   ['成功条件','全部服务容器运行并满足各自健康检查；Docker 实际发布地址、端口与目标符合固定快照；镜像与交付文件一致。发布核验不代表应用协议或业务通路已验证。']);
  const services=compose?.services;
  const table=services?`<div class="table-wrap"><table aria-label="Compose 固定服务"><thead><tr><th>服务</th><th>固定镜像</th><th>端口</th><th>环境变量名称</th><th>健康检查</th></tr></thead><tbody>${services.map(service=>`<tr><td>${h(service.name)}</td><td><code>${h(service.image)}</code></td><td>${h((service.ports||[]).join('、')||'—')}</td><td>${h((service.environment||[]).join('、')||'—')}</td><td>${service.healthcheck?'已配置':'未配置'}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted">历史参照未保存固定服务摘要。</p>';
  const files=(snapshot.files||[]).length?`<section><h3>固定文件</h3><ul>${snapshot.files.map(file=>`<li><code>${h(file.targetPath)}</code> · ${h(file.binary?.size||'大小未记录')} ${projectPlanDigest(file.binary?.sha256)}</li>`).join('')}</ul></section>`:'';
  const resources=[...(compose?.volumes||[]).map(item=>({...item,kind:'命名卷'})),...(compose?.networks||[]).map(item=>({...item,kind:'网络'}))];
  return projectPlanDetails(items)+table+configurationMappingSummary(cfg.pathMappings||[],true)+files+(resources.length?`<section><h3>卷与网络范围</h3><ul>${resources.map(item=>`<li>${item.kind} <code>${h(item.resource||item.name)}</code> · ${item.external?'外部，保留':'项目独占'}</li>`).join('')}</ul></section>`:'');
 }
 const files=projectFixedFiles(p);
 items.push(['服务',h(p.name+'.service')],['独占目录',`<code>${h(directory)}</code>`],
  ['程序固定版本',h(files[0].name)+projectPlanDigest(files[0].sha256)],
  ['配置固定版本',h(files[1].name)+projectPlanDigest(files[1].sha256)],
  ['成功条件',h(`文件摘要一致、unit 校验通过、服务运行且主进程的 HTTP 127.0.0.1:${cfg.port}/health 返回 200。`)]);
 return projectPlanDetails(items);
}
