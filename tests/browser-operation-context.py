"""真实 Chromium 输入/导航；所有状态均在隔离的虚构 QA 浏览器中。"""
import json,os
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4311')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS','docs/screenshots'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[];requests=[]
def ck(name,condition):
    assert condition,name
    checks.append(name);print('[pass] '+name,flush=True)
def ev(p,source):return p.evaluate(source)
def click(p,action,where='',**data):
    if action=='navigate' and ev(p,'innerWidth<=820&&!ui.nav'):p.locator('[data-action=navtoggle]').click()
    selector='[data-action="'+action+'"]'+''.join('[data-'+k+'="'+str(v)+'"]' for k,v in data.items())
    try:p.locator((where+' ' if where else '')+selector).first.click()
    except Exception:
        print('FAILED ACTION',action,ev(p,'ui.modal?.kind'),p.locator('#modal').inner_text(),flush=True);raise
def submit(p):p.locator('#modal button[type=submit]').click()
def close(p):click(p,'closemodal',where='#modal')
def shot(p,name):p.screenshot(path=str(OUT/name))
def fresh(b,width=1440):
    c=b.new_context(viewport={'width':width,'height':1000 if width>820 else 844});p=c.new_page();p.set_default_timeout(6000);p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));p.goto(BASE);p.wait_for_function('()=>prototypeLoading.ready');return c,p

def dns_form(p,existing=None):
    click(p,'navigate',page='dns');click(p,'dnsedit',**({'id':existing} if existing else {}))
    p.locator('#dns-name').fill('qa-return');p.locator('#dns-content').fill('192.0.2.123');p.locator('#dns-ttl').fill('600');p.locator('[name=dns-proxy]').check();p.locator('[name=network-ack]').check();submit(p)

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    c,p=fresh(b)
    # 1. Context inheritance and preview snapshots, all requires an explicit selection.
    click(p,'navigate',page='projects');p.locator('[data-filter=server]').select_option('s4');click(p,'newproject')
    ck('项目继承备用节点',p.locator('#np-server').input_value()=='s4');p.locator('#np-name').fill('qa-adapt');submit(p)
    ck('项目预览目标固定',ev(p,'ui.modal.draft.server')=='s4' and '备用实验节点' in p.locator('#modal').inner_text())
    ck('正文可展开查看',p.locator('#modal summary').filter(has_text='实际交付正文').count()==1)
    p.locator('#modal summary').filter(has_text='实际交付正文').click();ck('原样正文包含旧路径', '/catalog-api/' in p.locator('#modal').inner_text())
    public_before=ev(p,'JSON.stringify(S.templates)');click(p,'deployment-adapt',where='#modal')
    body='[Unit]\nDescription=QA adapted service\n[Service]\nWorkingDirectory=/srv/qa-adapt\nExecStart=/srv/qa-adapt/catalog-service --config /srv/qa-adapt/app.conf\n'
    p.locator('#adapt-body').fill(body);p.locator('#adapt-port').fill('9443');p.locator('#adapt-path-0').fill('/srv/qa-adapt/catalog-service');p.locator('#adapt-path-1').fill('/srv/qa-adapt/app.conf');submit(p)
    ck('副本保留服务器和项目名',ev(p,'ui.modal.draft.server==="s4"&&ui.modal.draft.name==="qa-adapt"'))
    ck('副本不改公共配置',ev(p,'JSON.stringify(S.templates)')==public_before)
    ck('副本保留正文首尾换行',ev(p,'ui.modal.draft.cfg.source')==body)
    shot(p,'operation-project-preview-desktop.png');click(p,'deployment-preview-back',where='#modal');submit(p)
    ck('返回重新预览保留副本',ev(p,'ui.modal.draft.cfg.source')==body)
    click(p,'deployment-preview-execute',where='#modal');ck('执行记录固定备用节点',ev(p,'S.operations[0].input.serverTarget.id')=='s4')
    click(p,'finishdemo',where='#modal');ck('应用参照是实际确认副本',ev(p,'pr(S.operations[0].project).applied.source')==body);close(p)
    click(p,'navigate',page='projects');p.locator('[data-filter=server]').select_option('all');click(p,'newproject');ck('全部项目视图必须选择服务器',p.locator('#np-server').input_value()=='');ck('通用选项移除 FRP',p.locator('#np-template option[value^="frp-template-"]').count()==0)
    p.locator('#np-server').select_option('s4');click(p,'project-frp-entry',where='#modal');ck('FRP 专用入口携带目标',ev(p,'ui.modal.kind')=='frp-batch' and p.locator('#fb-server').input_value()=='s4');close(p)
    # 2. Firewall target, copy, immutable identity and complete confirmation.
    click(p,'navigate',page='firewall');p.locator('[data-filter=server]').select_option('s4');click(p,'firewalledit');ck('防火墙继承备用节点',p.locator('#fw-server').input_value()=='s4')
    p.locator('#fw-direction').select_option('out');p.locator('#fw-port').fill('8443');p.locator('#fw-address').fill('192.0.2.7/32');p.locator('#fw-scope').select_option('container');p.locator('[name=network-ack]').check();submit(p)
    text=p.locator('#modal').inner_text();ck('防火墙完整确认摘要',all(t in text for t in ['备用实验节点','出站','TCP','8443','192.0.2.7/32','容器发布端口','允许','关联项目']))
    shot(p,'operation-firewall-confirm-desktop.png');click(p,'firewall-back-edit',where='#modal');ck('防火墙返回修改恢复地址',p.locator('#fw-address').input_value()=='192.0.2.7/32');p.locator('[name=network-ack]').check();submit(p)
    ev(p,"ui.server='s1'");p.locator('[name=fw-confirm]').check();submit(p);fw=ev(p,'S.operations[0].input.record.id');ck('异步记录服务器固定',ev(p,'S.operations[0].input.record.server')=='s4');click(p,'finishdemo',where='#modal');close(p)
    p.locator('[data-filter=server]').select_option('s4');click(p,'firewalledit',id=fw);ck('编辑服务器只读',p.locator('#fw-server').is_disabled());close(p)
    old=ev(p,'JSON.stringify(S.firewalls.find(r=>r.id==='+json.dumps(fw)+'))');click(p,'firewallcopy',id=fw);ck('复制要求明确选择新目标',p.locator('#fw-server').input_value()=='');p.locator('#fw-server').select_option('s2');p.locator('[name=network-ack]').check();submit(p);new=ev(p,'ui.modal.record.id');ck('复制生成新规则 ID',new!=fw);p.locator('[name=fw-confirm]').check();submit(p);click(p,'finishdemo',where='#modal');close(p)
    ck('复制后原规则不变',ev(p,'JSON.stringify(S.firewalls.find(r=>r.id==='+json.dumps(fw)+'))')==old)
    p.locator('[data-filter=server]').select_option('s4');click(p,'firewalldelete',id=fw);ck('删除摘要仍区分完整规则',all(t in p.locator('#modal').inner_text() for t in ['出站','192.0.2.7/32','容器发布端口']));close(p);ck('取消删除不执行',ev(p,'S.firewalls.some(r=>r.id==='+json.dumps(fw)+')'))
    p.locator('[data-filter=server]').select_option('all');click(p,'firewalledit');ck('全部防火墙视图无默认目标',p.locator('#fw-server').input_value()=='');close(p)
    p.locator('[data-filter=server]').select_option('s3');click(p,'firewalledit');ck('待核对节点选择保持且解释阻塞',p.locator('#fw-server').input_value()=='s3' and '待核对' in p.locator('#modal').inner_text());p.locator('#fw-port').fill('9000');p.locator('#fw-address').fill('192.0.2.0/24');p.locator('[name=network-ack]').check();submit(p);ck('待核对防火墙不能进入确认',ev(p,'ui.modal.kind')=='firewalledit');close(p)
    click(p,'navigate',page='projects');p.locator('[data-filter=server]').select_option('s3');click(p,'newproject');p.locator('#np-name').fill('qa-arm-blocked');submit(p);ck('ARM 项目保持目标并阻止继续',ev(p,'ui.modal.draft.server')=='s3' and p.locator('[data-action=deployment-preview-execute]').is_disabled() and '待核对' in p.locator('#modal').inner_text());close(p)
    # 3. FRP identities and 0 B blocking, no placeholder replacement.
    click(p,'navigate',page='projects');click(p,'project',id='frp-installed-s1-client');ck('FRPC 安装角色不显示连接草稿', '不适用 · 独立安装角色' in p.locator('#main').inner_text() and '当前项目草稿' not in p.locator('#main').inner_text());click(p,'frp-locate',where='#main',project='frp-installed-s1-client');ck('FRPC 定位服务器角色管理',ev(p,'ui.modal.kind==="frp-role-manage"&&ui.modal.server==="s1"'));shot(p,'operation-frp-role-desktop.png');close(p)
    click(p,'navigate',page='projects');click(p,'project',id='frp-installed-s2-server');click(p,'frp-locate',where='#main',project='frp-installed-s2-server');ck('共享 FRPS 定位服务器角色',ev(p,'ui.modal.role==="server"&&ui.modal.server==="s2"'));close(p)
    click(p,'navigate',page='projects');click(p,'project',id='frp-n1-client');click(p,'frp-locate',where='#main',project='frp-n1-client');ck('连接服务定位原连接',ev(p,'FRP.node==="n1"&&FRP.role==="client"'))
    click(p,'navigate',page='projects');click(p,'project',id='frp-n3-visitor');click(p,'frp-locate',where='#main',project='frp-n3-visitor');ck('visitor 定位 STCP 角色',ev(p,'FRP.node==="n3"&&FRP.role==="visitor"'))
    click(p,'frp-op',node='n3',role='visitor',op='deploy');ck('0 B 程序阻止应用',p.locator('#modal button[type=submit]').is_disabled() and '0 B' in p.locator('#modal').inner_text());ck('架构预览与主机一致','x86_64' in p.locator('#modal').inner_text());close(p)
    ck('共享 FRPS 按实际角色去重',ev(p,'frpUniqueItems(S.frp.nodes.map(n=>({node:n.id,role:"server"}))).length')==2)
    click(p,'frp-tab',id='connections');click(p,'frp-node',id='n4');click(p,'frp-proxyremove',node='n4',index=0);click(p,'frp-removesave',where='#modal',node='n4',index=0);click(p,'frp-update',id='frp-n4-client');click(p,'frp-adopt',where='#modal');click(p,'frp-op',node='n4',role='client',op='deploy');ck('最后 STCP 删除展示 visitor 清理', '本次确认将移除 visitor' in p.locator('#modal').inner_text());ck('未确认清理不修改已应用 visitor',ev(p,'pr("frp-n4-visitor").life')=='installed');close(p)
    ck('待核对 FRP 明确解释主机阻塞',ev(p,'frpLandingBody(frpNode("n4"),"client").includes("待核对")'))
    ck('原始四个占位仍 0 B',ev(p,'S.programs.filter(f=>f.id.startsWith("frp-bin-")).every(f=>f.bytes===0&&f.placeholder)'))
    # 4. DNS return/summary/diff/unknown and independent Cloudflare status.
    dns_form(p,'dns1');text=p.locator('#modal').inner_text();ck('DNS 完整确认和前后差异',all(t in text for t in ['目标账号','Zone','记录类型','记录名称','记录内容','TTL','代理状态','关联项目影响']) and p.locator('#modal del').count()>0)
    shot(p,'operation-dns-confirm-desktop.png');click(p,'dns-back-edit',where='#modal');ck('DNS 返回保留所有输入',p.locator('#dns-name').input_value()=='qa-return' and p.locator('#dns-content').input_value()=='192.0.2.123' and p.locator('#dns-ttl').input_value()=='600' and p.locator('[name=dns-proxy]').is_checked());zone=p.locator('#dns-zone').input_value();close(p);click(p,'dnsedit',id='dns1');ck('DNS 关闭重开保留 Zone 和草稿',p.locator('#dns-zone').input_value()==zone and p.locator('#dns-name').input_value()=='qa-return');p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('刷新恢复 DNS 任务草稿',ev(p,'ui.modal.kind')=='dnsedit' and p.locator('#dns-name').input_value()=='qa-return')
    p.locator('#outcome').select_option('unknown');p.locator('[name=network-ack]').check();submit(p);p.locator('[name=dns-confirm]').check();(p.locator('[name=shared-ack]').check() if p.locator('[name=shared-ack]').count() else None);submit(p);click(p,'finishdemo',where='#modal');op=ev(p,'S.operations[0].id');ck('DNS 未知保留原账号目标',ev(p,'S.operations[0].status')=='unknown' and ev(p,'S.operations[0].input.record.id')=='dns1');click(p,'verifyop',where='#modal',id=op);p.locator('#verify-result').select_option('success');p.locator('[name=verify-evidence]').check();submit(p);ck('DNS 读取核对完成原操作',ev(p,'S.operations.find(o=>o.id==='+json.dumps(op)+').status')=='success');close(p)
    ev(p,"sr('s1').state='offline';persist()");click(p,'dnsedit',id='dns2');p.locator('#dns-content').fill('192.0.2.101');p.locator('[name=network-ack]').check();submit(p);p.locator('[name=dns-confirm]').check();submit(p);click(p,'finishdemo',where='#modal');ck('DNS 不被关联服务器离线阻塞',ev(p,'S.operations[0].status')=='success');ck('提供商确认不等于公网传播', '未验证' in p.locator('#modal').inner_text());close(p)
    # 5. CF returns with nonsecret name and empty token, failed checks preserve connection.
    click(p,'cfaccount');click(p,'cfconnect',where='#modal');p.locator('#cf-name').fill('QA 自定义账号');p.locator('#cf-profile').select_option('network');click(p,'cfdemofill',where='#modal');submit(p);p.get_by_role('heading',name='核对账号和授权域名',exact=True).wait_for();ck('网络检查失败明确显示','检查未通过' in p.locator('#modal').inner_text());click(p,'cf-back-edit',where='#modal');ck('账号返回保留名称和状态，不回填 Token',p.locator('#cf-name').input_value()=='QA 自定义账号' and p.locator('#cf-profile').input_value()=='network' and p.locator('#cf-token').input_value()=='');shot(p,'operation-cloudflare-back-desktop.png');p.locator('#cf-token').fill('QA_FORBIDDEN_TOKEN_123');submit(p);ck('任意输入凭据不持久化', 'QA_FORBIDDEN_TOKEN_123' not in ev(p,'localStorage.getItem(STORE)'));close(p);click(p,'cfaccount');click(p,'cfconnect',where='#modal');ck('账号反复打开保留非敏感草稿',p.locator('#cf-name').input_value()=='QA 自定义账号' and p.locator('#cf-token').input_value()=='');close(p)
    # 6. Real Back, Forward, refresh; stable details and allowlisted URL.
    click(p,'navigate',page='frp');click(p,'frp-tab',id='connections');click(p,'frp-node',id='n3');click(p,'navigate',page='dns');p.go_back();ck('Back 恢复 FRP 连接和标签',ev(p,'ui.page==="frp"&&FRP.node==="n3"&&FRP.tab==="node"'));p.go_forward();ck('Forward 恢复 DNS',ev(p,'ui.page')=='dns');p.locator('[data-filter=cfAccount]').select_option('cf-account-readonly');selected_url=p.url;p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('刷新恢复账号和页面筛选',ev(p,'ui.cfAccount')=='cf-account-readonly' and p.url==selected_url)
    ck('路由无敏感数据',all(t not in p.url for t in ['EXAMPLE_','DEMO_','Token','auth.token','ExecStart']))
    p.goto(BASE+'/#frp?tab=files&node=deleted&token=QA_REMOVE');p.wait_for_function('()=>prototypeLoading.ready');ck('失效 URL 安全返回且清除非白名单参数','关联失效' in p.locator('#main').inner_text() and 'QA_REMOVE' not in p.url)
    # narrow screen: actual interactive form, confirmation, back and keyboard focus.
    m,q=fresh(b,390);dns_form(q,'dns1');ck('窄屏确认与返回按钮可用',q.locator('[data-action=dns-back-edit]').is_visible() and q.locator('#modal button[type=submit]').is_visible());shot(q,'operation-dns-confirm-mobile.png');click(q,'dns-back-edit',where='#modal');ck('窄屏返回保留输入',q.locator('#dns-name').input_value()=='qa-return');close(q);ck('关闭后焦点返回原编辑按钮',ev(q,'document.activeElement?.dataset.action')=='dnsedit');ck('窄屏无页面横向溢出',ev(q,'document.documentElement.scrollWidth<=innerWidth'))
    click(q,'dnsedit',id='dns1');click(q,'interaction-discard',where='#modal');ck('放弃编辑有独立确认',ev(q,'ui.modal.kind')=='interaction-discard');click(q,'interaction-discard-confirm',where='#modal');click(q,'dnsedit',id='dns1');ck('明确放弃清除草稿，原记录不变',q.locator('#dns-name').input_value()!='qa-return');close(q)
    ck('浏览器未产生脚本错误',not errors);ck('只读取本地静态资源',all(url.startswith(BASE) for url in requests));m.close();c.close();b.close()
print(json.dumps({'passed':len(checks),'checks':checks,'errors':errors,'untested':['真实服务器/真实 FRP 可执行程序/真实 DNS 传播','原始 0 B 占位的成功部署（保持阻断）']},ensure_ascii=False,indent=2))
