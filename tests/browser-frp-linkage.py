"""配置 FRP 的当前浏览器回归；QA 程序仅虚构元数据，原 0 B 占位不变。"""
import json,os,tomllib
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4312')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS','docs/screenshots'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(label,value):
 assert value,label
 checks.append(label);print('PASS '+label,flush=True)
def ev(p,s):return p.evaluate(s)
def click(p,a,where='',**data):
 p.locator((where+' ' if where else '')+'[data-action="'+a+'"]'+''.join('[data-'+k+'="'+str(v)+'"]' for k,v in data.items())).first.click()
def close(p):click(p,'closemodal',where='#modal')
def submit(p):p.locator('#modal button[type=submit]').click()
def apply(p,node,outcome):
 click(p,'frp-configapply',node=node);p.locator('[name=fc-confirm]').check();p.locator('[name=fc-hold]').check();p.locator('#outcome').select_option(outcome);submit(p);click(p,'finishdemo',where='#modal')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);c=b.new_context(viewport={'width':1440,'height':1000});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/#frp');p.wait_for_function('()=>prototypeLoading.ready')
 check('配置分组及附件 / 产品扩展说明','CONFIGURATION / FRP' in p.locator('#main').inner_text() and '多客户端为栈桥扩展' in p.locator('#main').inner_text())
 click(p,'navigate',page='programs');p.locator('[data-filter=q]').fill('frpc');click(p,'asset-file',id='frp-bin-frpc');check('公共 FRPC 有配置和已应用反向引用','最新配置引用 · 2' in p.locator('#asset-details').inner_text() and 'R-1' in p.locator('#asset-details').inner_text());p.screenshot(path=str(OUT/'service-frp-asset-links-desktop.png'))
 click(p,'asset-template',where='#asset-details',id='frp-template-client');check('引用程序资产与生成文件分开','程序资产 1 · 生成 TOML 与 unit' in p.locator('#asset-details').inner_text());click(p,'frp-locate',where='#asset-details',node='n1',role='client');check('稳定 ID 定位连接',ev(p,'FRP.node')=='n1');click(p,'frp-return');check('返回文件保留筛选',p.locator('[data-filter=q]').input_value()=='frpc');click(p,'asset-close',where='#asset-details')
 click(p,'navigate',page='frp');click(p,'frp-reference-load');click(p,'frp-reference-confirmload',where='#modal');check('附件四节点六 TCP 两 STCP',ev(p,'S.frp.nodes.length===4&&S.frp.nodes.flatMap(n=>n.proxies).filter(p=>p.type==="tcp").length===6&&S.frp.nodes.flatMap(n=>n.proxies).filter(p=>p.type==="stcp").length===2'));check('默认两目标，显式 false 可选，all 四目标',ev(p,'frpSelectTargets("client").length===2&&frpSelectTargets("client","all").length===4&&frpSelectTargets("client","specified","ref-n1").length===1'));check('载入附件不创建服务',not ev(p,'S.projects.some(p=>p.frpRef?.node?.startsWith("ref-"))'));click(p,'frp-profile-toggle')
 # 单独 QA 元数据：不替换原文件，不声称程序已验证。
 ev(p,"""for(const s of S.servers){s.state='online';s.checked=now();}for(const f of [...S.programs.filter(f=>f.id.startsWith('frp-bin-'))]){const x={...clone(f),id:'qa-'+f.id,groupId:'qa-'+f.groupId,kind:'elf',bytes:64,size:'64 B QA 元数据',placeholder:false,revision:2,identity:'QA_METADATA_'+f.id,provenance:'模拟二进制元数据'};x.revisions=[{...clone(x),revisions:undefined}];S.programs.push(x);}for(const role of Object.keys(frpRoles)){tpl('frp-template-'+role).programRef={groupId:'qa-asset-frp-bin-'+frpProgramName(role),architectureRule:'auto',pins:S.programs.filter(f=>f.id.startsWith('qa-frp-bin-'+frpProgramName(role))).map(f=>({fileId:f.id,revision:2}))};}for(const p of S.projects.filter(p=>p.frpService)){p.frpApplied.programRef=clone(frpProgramRef(p.frpService.role));p.frpDraft=clone(p.frpApplied);p.cfg.frpSnapshot=clone(p.frpApplied);p.applied.frpSnapshot=clone(p.frpApplied);}persist();render();""")
 click(p,'frp-node',id='n3');old=ev(p,'JSON.stringify(frpNode("n3").appliedConfiguration)');apply(p,'n3','partial');check('部分失败逐服务显示完整结果',ev(p,'S.operations[0].results.length===3&&S.operations[0].results.some(r=>r.status==="failed")'));check('部分失败保留完整旧参照',ev(p,'JSON.stringify(frpNode("n3").appliedConfiguration)')==old);close(p)
 apply(p,'n3','unknown');check('未知结果保持目标与旧参照',ev(p,'JSON.stringify(frpNode("n3").appliedConfiguration)')==old and ev(p,'S.operations[0].input.serviceIds.includes("frp-installed-s2-server")'));click(p,'verifyop',where='#modal',id=ev(p,'S.operations[0].id'));p.locator('#verify-result').select_option('success');p.locator('[name=verify-evidence]').check();submit(p);check('明确核对原配置操作后才更新参照',ev(p,'frpNode("n3").configurationResult==="success"'));close(p)
 click(p,'frp-proxyedit',node='n3',index=0);p.locator('#fp-name').fill('qa-non-sensitive-draft');close(p);click(p,'frp-proxyedit',node='n3',index=0);check('取消复开保留映射编辑',p.locator('#fp-name').input_value()=='qa-non-sensitive-draft');close(p)
 # 共享认证需各连接明确采用，执行 FRPS 只一次。
 ev(p,'S.frp.token="DEMO_QA_SHARED_AUTH";S.frp.settingsRev++;persist();');p.get_by_text('服务绑定、配置修订和影响范围',exact=True).click();click(p,'frp-public-adopt',node='n3');click(p,'frp-public-adopt-confirm',where='#modal',node='n3');click(p,'frp-configapply',node='n3');check('其他连接未采用认证阻断',p.locator('#modal button[type=submit]').is_disabled() and '共享 FRPS 认证' in p.locator('#modal').inner_text());close(p);click(p,'frp-home');click(p,'frp-node',id='n1');p.get_by_text('服务绑定、配置修订和影响范围',exact=True).click();click(p,'frp-public-adopt',node='n1');click(p,'frp-public-adopt-confirm',where='#modal',node='n1');click(p,'frp-home');click(p,'frp-node',id='n3');click(p,'frp-configapply',node='n3');check('共享 FRPS 去重两个客户端分别执行',ev(p,'ui.modal.plan.items.filter(x=>x.role==="server").length===1&&ui.modal.plan.items.filter(x=>x.role==="client").length===2'));p.screenshot(path=str(OUT/'service-frp-shared-plan-desktop.png'));p.locator('[name=fc-confirm]').check();p.locator('[name=fc-hold]').check();submit(p);click(p,'finishdemo',where='#modal');check('共享应用明确更新两条连接参照',ev(p,'frpNode("n1").appliedConfiguration.settings.token==="DEMO_QA_SHARED_AUTH"&&frpNode("n3").appliedConfiguration.settings.token==="DEMO_QA_SHARED_AUTH"'));close(p)
 click(p,'navigate',page='projects');click(p,'project',id='frp-n3-client');click(p,'tab',id='config');click(p,'frp-read',id='frp-n3-client');last=ev(p,'JSON.stringify(pr("frp-n3-client").frpReadSnapshot)');click(p,'frp-read',id='frp-n3-client',fail='true');check('读取失败保留上次内容时间',ev(p,'JSON.stringify(pr("frp-n3-client").frpReadSnapshot)')==last and '旧结果' in p.locator('#main').inner_text());click(p,'frp-locate',node='n3',project='frp-n3-client');click(p,'frp-return');check('项目来源返回恢复配置标签',ev(p,'ui.page==="project"&&ui.project==="frp-n3-client"&&ui.tab==="config"'))
 credential='DEMO_QA_quote" slash\\ newline\n'
 p.evaluate('(t)=>{frpNode("n3").sourceSettings.token=t;frpNode("n3").proxies.find(x=>x.type==="stcp").secret_key=t;}',credential)
 for role in ['client','server','visitor']:
  parsed=tomllib.loads(p.evaluate('(r)=>frpFiles(frpNode("n3"),r).toml',role));check('独立 TOML 解析及转义 '+role,parsed['auth']['token']==credential)
 check('原始占位程序不变',ev(p,'S.programs.filter(f=>f.id.startsWith("frp-bin-")).every(f=>f.placeholder&&f.bytes===0)'));p.reload();p.wait_for_function('()=>prototypeLoading.ready');check('刷新保留共享服务与历史',ev(p,'!!pr("frp-installed-s2-server")&&S.operations.some(o=>o.kind==="frp-config")'));check('无脚本异常',not errors);b.close()
print(json.dumps({'passed':len(checks),'checks':checks,'page_errors':errors},ensure_ascii=False,indent=2))
