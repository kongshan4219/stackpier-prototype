"""真实 Chromium 输入、点击与历史回归；全部为虚构 QA 数据，只有本地静态请求。"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4312')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS','docs/screenshots'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
def ck(label,value):
 assert value,label
 checks.append(label)
 print('PASS '+label,flush=True)
def ev(p,expression):return p.evaluate(expression)
def click(p,action,where='',**data):
 if action=='navigate' and ev(p,'innerWidth<=820&&!ui.nav'):p.locator('[data-action=navtoggle]').click()
 selector='[data-action="'+action+'"]'+''.join('[data-'+key+'="'+str(value)+'"]' for key,value in data.items())
 p.locator((where+' ' if where else '')+selector).first.click()
def submit(p):p.locator('#modal button[type=submit]').click()
def close(p):click(p,'closemodal',where='#modal')
def fresh(b,width=1440,saved=None):
 c=b.new_context(viewport={'width':width,'height':1000},device_scale_factor=1);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url))
 if saved:c.add_init_script('localStorage.setItem("stackpier.prototype.review.v1",'+json.dumps(saved)+')')
 p.goto(BASE);p.wait_for_function('()=>prototypeLoading.ready');return c,p
def shot(p,name):p.screenshot(path=str(OUT/name),full_page='mobile' not in name)
def new(p,name='qa-temp-service',template='t1',server='s4'):
 click(p,'newproject');p.locator('#np-template').select_option(template);p.locator('#np-server').select_option(server);p.locator('#np-name').fill(name)
def preview(p):
 submit(p);p.get_by_role('heading',name='确认模拟部署落点',exact=True).wait_for()
 if ev(p,'ui.modal.draft.template')=='t1':
  name=ev(p,'ui.modal.draft.name');click(p,'deployment-adapt',where='#modal');port=18000+sum(ord(x) for x in name);p.locator('#adapt-body').fill(p.locator('#adapt-body').input_value().replace('catalog-api',name).replace(':8080',':'+str(port)));p.locator('#adapt-port').fill(str(port))
  for field in p.locator('[id^=adapt-path-]').all():field.fill(field.input_value().replace('catalog-api',name))
  submit(p)

def finish(p):click(p,'finishdemo',where='#modal')
def qa(p):
 ev(p,"""S.frp.nodes=[];for(const s of S.servers){s.state='online';s.checked=now();}for(const f of [...S.programs.filter(f=>f.id.startsWith('frp-bin-'))]){const id='qa-'+f.id,x={...clone(f),id,groupId:'qa-'+f.groupId,kind:'elf',bytes:64,size:'64 B QA 模拟元数据',placeholder:false,revision:2,identity:'QA_METADATA_'+id,provenance:'模拟二进制元数据'};x.revisions=[{...clone(x),revisions:undefined}];S.programs.push(x);}for(const role of Object.keys(frpRoles)){const t=tpl('frp-template-'+role);t.programRef={groupId:'qa-asset-frp-bin-'+frpProgramName(role),architectureRule:'auto',pins:S.programs.filter(f=>f.id.startsWith('qa-frp-bin-'+frpProgramName(role))).map(f=>({fileId:f.id,revision:2}))};}for(const p of S.projects.filter(p=>p.frpService)){p.frpApplied.programRef=clone(frpProgramRef(p.frpService.role));p.frpDraft=clone(p.frpApplied);p.cfg.frpSnapshot=clone(p.frpApplied);p.applied.frpSnapshot=clone(p.frpApplied);}persist();render();""")
def deploy(p,name,role,server,target=None,node=None):
 new(p,name,'frp-template-'+role,server)
 if role=='server':p.locator('#np-frp-bind').fill('127.0.0.1');p.locator('#np-frp-port').fill('7700')
 if role=='client':p.locator('#np-frp-server-service').select_option(target)
 if role=='visitor':p.locator('#np-frp-connection').select_option(node)
 preview(p);ck('统一部署 '+role+' 预览无阻塞',ev(p,'deploymentLocation(ui.modal.draft).errors.length')==0);click(p,'deployment-preview-execute',where='#modal');ck('统一部署 '+role+' 进行中没有服务实体',not ev(p,'S.projects.some(p=>p.name==='+json.dumps(name)+')'));finish(p);ck('统一部署 '+role+' 成功后恰好一个服务',ev(p,'S.projects.filter(p=>p.name==='+json.dumps(name)+').length')==1);close(p);return ev(p,'S.projects.find(p=>p.name==='+json.dumps(name)+').id')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 c,p=fresh(b);click(p,'navigate',page='projects');count=ev(p,'S.projects.length')
 ck('项目仅含已部署服务，清理证据可见',not ev(p,'S.projects.some(p=>p.life==="draft"||p.life==="uninstalled"||p.frpInstallation?.role==="client")') and '历史归属待核对' in p.locator('#main').inner_text())
 shot(p,'service-projects-desktop.png')
 historical=ev(p,'S.failedProjects.find(f=>f.migrationProject==="p8").id');click(p,'projectstab',id='failures');click(p,'failedcleanup',id=historical);ck('历史卸载归属未知阻止清理','历史资源归属待核对' in p.locator('#modal').inner_text());click(p,'history-cleanup-review',where='#modal',id=historical);p.locator('[name=history-identity]').check();p.locator('[name=history-owned]').check();submit(p);ck('历史归属核对返回独立清理确认，未复活项目',ev(p,'ui.modal.kind==="failedcleanup"&&!pr("p8")'));close(p);click(p,'projectstab',id='list')
 p.locator('[data-filter=server]').select_option('s4');click(p,'newproject');ck('继承服务器筛选',p.locator('#np-server').input_value()=='s4');p.locator('#np-name').fill('qa-temp-service');preview(p);ck('预览没有项目或名称预占',ev(p,'S.projects.length')==count);shot(p,'service-deployment-preview-desktop.png');close(p);click(p,'newproject');ck('关闭重开保留非敏感输入',p.locator('#np-name').input_value()=='qa-temp-service');preview(p);click(p,'deployment-preview-back',where='#modal');ck('返回修改保留目标名称',p.locator('#np-name').input_value()=='qa-temp-service' and p.locator('#np-server').input_value()=='s4');preview(p);click(p,'deployment-preview-execute',where='#modal');op=ev(p,'S.operations[0].id');ck('确认执行只创建操作记录',ev(p,'S.projects.length')==count and ev(p,'S.operations[0].status')=='running');finish(p);ck('成功才创建一次',ev(p,'S.projects.length')==count+1);ev(p,'finishOperation(S.operations[0],"success")');ck('重复完成不重复创建',ev(p,'S.projects.length')==count+1);close(p)
 for outcome in ['failed','partial','unknown']:
  new(p,'qa-'+outcome);preview(p);p.locator('#deploy-outcome').select_option(outcome);click(p,'deployment-preview-execute',where='#modal');finish(p);ck(outcome+' 部署只保留失败证据',ev(p,'S.operations[0].status')==outcome and not ev(p,'S.projects.some(p=>p.name==='+json.dumps('qa-'+outcome)+')') and ev(p,'S.failedProjects.some(f=>f.deployment.project.name==='+json.dumps('qa-'+outcome)+')'));close(p)
 click(p,'navigate',page='projects');shot(p,'service-pending-operations-desktop.png')
 # 专属清理与恢复，使用已知不共享 report-worker 目录。
 ev(p,"sr('s2').state='online';sr('s2').checked=now();persist()");click(p,'project',id='p7');click(p,'projectmore',id='p7');click(p,'projectop',where='#modal',id='p7',kind='uninstall');ck('卸载确认完整范围及数据删除',all(x in p.locator('#modal').inner_text() for x in ['专属数据将被删除','report-worker/data','独立部署目录','公共文件和配置始终保留']));shot(p,'service-cleanup-confirm-desktop.png');p.locator('[name=cleanup-data-confirm]').check();p.locator('#uninstall-name').fill('report-worker');p.locator('#outcome').select_option('partial');submit(p);finish(p);ck('部分清理保留项目与残留',ev(p,'!!pr("p7")&&pr("p7").cleanup.status==="partial"'));shot(p,'service-cleanup-partial-desktop.png');close(p);click(p,'projectop',id='p7',kind='uninstall');ck('恢复只清理未完成项','此前已清理' in p.locator('#modal').inner_text());p.locator('[name=cleanup-data-confirm]').check();p.locator('#uninstall-name').fill('report-worker');submit(p);finish(p);ck('全部核对后移除项目实体',not ev(p,'!!pr("p7")'));close(p)
 # 0 B 禁止，不提供开关。
 new(p,'qa-placeholder','frp-template-server','s4');p.locator('#np-frp-port').fill('7700');preview(p);ck('FRP 0 B 占位阻断',p.locator('[data-action=deployment-preview-execute]').is_disabled() and '0 B' in p.locator('#modal').inner_text());close(p)
 # QA 元数据仅存在这个独立浏览器，原附件四占位保留。
 qa(p);frps=deploy(p,'qa-frps','server','s4');frpc=deploy(p,'qa-frpc','client','s1',target=frps)
 click(p,'navigate',page='frp');ck('FRP 位于配置，无生命周期按钮','CONFIGURATION / FRP' in p.locator('#main').inner_text() and p.locator('#main [data-action=frp-batch],#main [data-action=frp-install],#main [data-action=frp-install-remove]').count()==0);click(p,'frp-nodeedit');p.locator('#fn-provider').select_option(frpc);p.locator('#fn-server').select_option(frps);p.locator('[name=fn-default]').uncheck();before=ev(p,'S.projects.length');submit(p);node=ev(p,'FRP.node');ck('新连接不创建项目，稳定绑定服务',ev(p,'S.projects.length')==before and ev(p,'frpNode(FRP.node).serviceBindings.client')==frpc);click(p,'frp-proxyedit',node=node);p.locator('#fp-name').fill('qa-stcp');p.locator('#fp-type').select_option('stcp');p.locator('#fp-localport').fill('3307');p.locator('#fp-vport').fill('13307');submit(p);ck('新增 STCP 不隐式部署 visitor',ev(p,'S.projects.length')==before and '尚无可用 visitor' in p.locator('#main').inner_text());click(p,'frp-configapply',node=node);ck('缺 visitor 明确阻塞',p.locator('#modal button[type=submit]').is_disabled() and 'visitor' in p.locator('#modal').inner_text());close(p)
 visitor=deploy(p,'qa-visitor','visitor','s4',node=node);click(p,'navigate',page='frp');click(p,'frp-home');click(p,'frp-node',id=node);click(p,'frp-nodeedit',id=node);p.locator('#fn-visitor').select_option(visitor);submit(p);ck('visitor 同 FRPS 主机，引用 frpc',ev(p,'pr('+json.dumps(visitor)+').server===pr('+json.dumps(frps)+').server&&pr('+json.dumps(visitor)+').cfg.program==="frpc"'))
 click(p,'frp-configapply',node=node);ck('应用确认包含固定服务与配置文件','写入' in p.locator('#modal').inner_text() and 'qa-frpc' in p.locator('#modal').inner_text());shot(p,'service-frp-apply-desktop.png');p.locator('[name=fc-confirm]').check();p.locator('[name=fc-hold]').check();submit(p);finish(p);ck('配置成功核对更新参照',ev(p,'frpNode('+json.dumps(node)+').appliedConfiguration.revision===frpNode('+json.dumps(node)+').revision'));close(p)
 before_applied=ev(p,'JSON.stringify(frpNode('+json.dumps(node)+').appliedConfiguration)');click(p,'frp-proxyedit',node=node,index=0);p.locator('#fp-name').fill('qa-stcp-edited');submit(p);ck('保存映射不改变已应用参照',ev(p,'JSON.stringify(frpNode('+json.dumps(node)+').appliedConfiguration)')==before_applied);click(p,'frp-configapply',node=node);p.locator('[name=fc-confirm]').check();p.locator('#outcome').select_option('failed');submit(p);finish(p);ck('配置失败保留旧参照',ev(p,'JSON.stringify(frpNode('+json.dumps(node)+').appliedConfiguration)')==before_applied);close(p)
 click(p,'frp-proxyremove',node=node,index=0);click(p,'frp-removesave',where='#modal',node=node,index=0);ck('删除映射不卸载服务',ev(p,'!!pr('+json.dumps(visitor)+')'));click(p,'frp-configapply',node=node);ck('删除最后 STCP 预览清空配置且保留服务','清空 visitor 映射配置' in p.locator('#modal').inner_text());close(p)
 shot(p,'service-frp-connections-desktop.png');click(p,'navigate',page='projects');extra=deploy(p,'qa-unbound-frpc','client','s4',target=frps);click(p,'project',id=extra);click(p,'projectmore',id=extra);click(p,'projectop',where='#modal',id=extra,kind='uninstall');ck('FRP 完全清理独立配置目录并保留共享程序','/srv/services/frp/projects/qa-unbound-frpc' in p.locator('#modal').inner_text() and '共享 FRP 程序，始终保留' in p.locator('#modal').inner_text());p.locator('[name=cleanup-data-confirm]').check();p.locator('#uninstall-name').fill('qa-unbound-frpc');submit(p);finish(p);ck('未绑定 FRPC 完全清理只移除此服务，共享 FRPS 和 visitor 保留',ev(p,'!pr('+json.dumps(extra)+')&&!!pr('+json.dumps(frps)+')&&!!pr('+json.dumps(visitor)+')'));close(p);click(p,'navigate',page='frp');click(p,'frp-home');click(p,'frp-node',id=node);click(p,'navigate',page='dns');p.go_back();ck('Back 恢复 FRP 对象与标签',ev(p,'ui.page==="frp"&&FRP.node==='+json.dumps(node)));p.go_forward();ck('Forward 恢复 DNS',ev(p,'ui.page')=='dns');p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('刷新不丢服务、账号与历史',ev(p,'!!pr('+json.dumps(frpc)+')&&S.cloudflare.connections.length>0&&S.operations.length>1'))
 # 窄屏：真实输入、预览、返回、焦点与布局。
 mc,m=fresh(b,390);click(m,'navigate',page='projects');new(m,'qa-mobile');preview(m);ck('窄屏预览 / 返回 / 适配按钮可用',m.locator('[data-action=deployment-preview-back]').is_visible() and m.locator('[data-action=deployment-adapt]').is_visible());shot(m,'service-project-preview-mobile.png');click(m,'deployment-preview-back',where='#modal');ck('窄屏返回保留输入',m.locator('#np-name').input_value()=='qa-mobile');close(m);click(m,'navigate',page='frp');click(m,'frp-node',id='n3');shot(m,'service-frp-mobile.png');ck('窄屏 FRP 页面没有横向溢出',ev(m,'document.documentElement.scrollWidth<=innerWidth'));m.reload();m.wait_for_function('()=>prototypeLoading.ready');ck('窄屏刷新恢复连接',ev(m,'ui.page==="frp"&&FRP.node==="n3"'))
 ck('原始四个 0 B 文件保持占位',ev(p,'S.programs.filter(f=>f.id.startsWith("frp-bin-")).every(f=>f.bytes===0&&f.placeholder)'));ck('无页面脚本错误',not errors);ck('全过程仅请求本地静态资源',all(url.startswith(BASE) or url.startswith('data:') for url in requests));b.close()
print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},ensure_ascii=False,indent=2))
