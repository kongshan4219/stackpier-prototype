"""Chromium 真实操作。上传的是合成 ELF 文件头测试素材，从不运行附件或测试二进制。"""
import json,os,struct,tomllib
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4311')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS','docs/screenshots'));OUT.mkdir(parents=True,exist_ok=True)
checks=[];errors=[]
def check(name,result):
    assert result,name
    checks.append(name)
    print("[pass] "+name,flush=True)
def click(p,a,where='',**data):
    selector='[data-action="'+a+'"]'+''.join('[data-'+k+'="'+str(v)+'"]' for k,v in data.items())
    p.locator((where+' ' if where else '')+selector).first.click()
def ev(p,code):return p.evaluate(code)
def shot(p,name):p.screenshot(path=str(OUT/name))
def close(p):click(p,'closemodal',where='#modal')
def submit(p):p.locator('#modal button[type=submit]').click()
def finish(p):click(p,'finishdemo',where='#modal');close(p)
def elf(arch,tag):
    b=bytearray(128);b[:7]=b'\x7fELF\x02\x01\x01';struct.pack_into('<HHI',b,16,2,62 if arch=='x86_64' else 183,1);struct.pack_into('<H',b,52,64);b[64:64+len(tag)]=tag.encode();return bytes(b)
qa_files={}
def upload(p,id,arch,tag):
    # 新建独立 QA 逻辑文件，不替换附件的 0 B 占位。
    click(p,'navigate',page='programs');p.locator('[data-action=programupload]:not([data-id])').first.click()
    logical='qa-frps.elf' if id.startswith('frp-bin-frps') else 'qa-frpc.elf'
    p.locator('#bin-file').set_input_files({'name':logical,'mimeType':'application/octet-stream','buffer':elf(arch,tag)})
    p.wait_for_function('()=>ui.modal?.analysis&&!ui.modal?.busy');submit(p);submit(p);p.wait_for_function('()=>ui.modal===null')
    qa_files[id]=p.evaluate('(v)=>S.programs.find(f=>f.filename===v.name&&f.arch===v.arch).id',{'name':logical,'arch':arch})
    check('新增独立 QA 程序资产 '+tag,qa_files[id]!=id)
    p.evaluate("""()=>{for(const role of Object.keys(frpRoles)){const name=role==='server'?'qa-frps.elf':'qa-frpc.elf',files=S.programs.filter(f=>f.filename===name);if(files.length){const t=tpl('frp-template-'+role);t.programRef={groupId:files[0].groupId,architectureRule:'auto',pins:files.map(f=>({fileId:f.id,revision:f.revision}))};}}markAssetUpdates();persist();}""")
def adopt(p,id):
    if not p.locator('[data-action=frp-update][data-id="'+id+'"]').count():
        click(p,'navigate',page='projects');click(p,'project',id=id)
    click(p,'frp-update',id=id);click(p,'frp-adopt',where='#modal')
def apply(p,node,role,cleanup=False):
    if p.locator('[data-action=frp-op][data-node="'+node+'"][data-role="'+role+'"][data-op=deploy]').count():click(p,'frp-op',node=node,role=role,op='deploy')
    else:click(p,'frp-project-apply',id='frp-'+node+'-'+role)
    p.locator('[name=fo-identity]').check();p.locator('[name=fo-impact]').check();p.locator('[name=fo-hold]').check()
    if cleanup:p.locator('[name=fo-cleanup]').check()
    submit(p);check('应用操作实际受理 '+node+'/'+role,ev(p,'S.operations[0].status')=='running');finish(p)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    context=browser.new_context(viewport={'width':1440,'height':1000});p=context.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/#frp');p.wait_for_function('()=>prototypeLoading.ready')
    check('默认多客户端扩展说明','当前多客户端机器是栈桥产品扩展' in p.locator('#main').inner_text())
    click(p,'navigate',page='programs');p.locator('[data-filter=q]').fill('frpc');click(p,'asset-file',id='frp-bin-frpc')
    check('公共 FRPC 反向配置引用', '最新配置引用 · 2' in p.locator('#asset-details').inner_text())
    check('历史已应用版本追溯', 'R-1' in p.locator('#asset-details').inner_text())
    shot(p,'frp-asset-references-desktop.png');click(p,'asset-template',where='#asset-details',id='frp-template-client')
    check('FRP 配置区分程序资产和生成文件','程序资产 1 · 生成 TOML 与 unit' in p.locator('#asset-details').inner_text())
    click(p,'frp-locate',where='#asset-details',node='n1',role='client')
    check('配置定位对应 FRP 角色',ev(p,'FRP.node')=='n1' and ev(p,'FRP.role')=='client')
    click(p,'frp-return');check('返回保留文件筛选',p.locator('[data-filter=q]').input_value()=='frpc');click(p,'asset-close',where='#asset-details')
    click(p,'navigate',page='frp');click(p,'frp-nodeedit',id='n2');p.locator('[name=fn-default]').uncheck();close(p);click(p,'frp-nodeedit',id='n2')
    check('连接未保存复开不丢编辑',not p.locator('[name=fn-default]').is_checked());p.reload();p.wait_for_function('()=>prototypeLoading.ready');close(p) if p.locator('#modal[open]').count() else None;click(p,'navigate',page='frp');click(p,'frp-nodeedit',id='n2');check('连接未保存刷新仍保留编辑',not p.locator('[name=fn-default]').is_checked());close(p)
    click(p,'frp-reference-load');click(p,'frp-reference-confirmload',where='#modal')
    check('附件四节点六 TCP 两 STCP',ev(p,'S.frp.nodes.length')==4 and ev(p,'S.frp.nodes.flatMap(n=>n.proxies).filter(x=>x.type==="tcp").length')==6 and ev(p,'S.frp.nodes.flatMap(n=>n.proxies).filter(x=>x.type==="stcp").length')==2)
    check('附件默认客户端目标两项',ev(p,'frpSelectTargets("client").length')==2);check('参考不覆盖工作清单',ev(p,'S.frpProfiles.workspace.nodes.length')==4)
    shot(p,'frp-attachment-reference-desktop.png')
    click(p,'frp-targets');p.locator('#targets-role').select_option('client');p.locator('#targets-scope').select_option('default');p.locator('#targets-op').select_option('deploy');click(p,'frp-target-preview',where='#modal')
    check('默认客户端预览只选两项',ev(p,'ui.modal.items.length')==2)
    check('0 B 阻塞提交',p.locator('#modal button[type=submit]').is_disabled());check('原始路径与托管路径说明','附件原始命名与栈桥托管命名' in p.locator('#modal').inner_text());shot(p,'frp-placeholder-blocked-desktop.png');close(p)
    click(p,'frp-targets');p.locator('#targets-scope').select_option('specified');p.locator('#targets-node').select_option('ref-n1');p.locator('#targets-op').select_option('generate');click(p,'frp-target-preview',where='#modal')
    check('显式指定 false 节点也可生成',ev(p,'!!S.frpGenerated["frp-ref-n1-client"]'))
    check('生成不更新应用与运行',ev(p,'pr("frp-ref-n1-client").frpApplied===undefined&&pr("frp-ref-n1-client").runtime==="na"'))
    click(p,'frp-tab',id='review');click(p,'frp-generated-files');click(p,'frp-generated-remove',where='#modal',id='frp-ref-n1-client');click(p,'frp-generated-confirm',where='#modal')
    check('独立清理生成记录不改变服务',ev(p,'S.frpGenerated["frp-ref-n1-client"]===undefined&&pr("frp-ref-n1-client").runtime==="na"'))
    click(p,'frp-tab',id='connections')
    click(p,'frp-targets');p.locator('#targets-scope').select_option('all');p.locator('#targets-op').select_option('deploy');click(p,'frp-target-preview',where='#modal');check('客户端 all 包括 false',ev(p,'ui.modal.items.length')==4);close(p)
    click(p,'frp-targets');p.locator('#targets-role').select_option('server');p.locator('#targets-op').select_option('deploy');click(p,'frp-target-preview',where='#modal');check('服务端默认全部',ev(p,'ui.modal.items.length')==4);close(p)
    click(p,'frp-node',id='ref-n3');click(p,'frp-proxyedit',node='ref-n3',index=2);p.locator('#fp-vaddr').fill('0.0.0.0');submit(p)
    check('visitor 非回环实际表单拒绝','visitor 必须监听回环地址' in p.locator('#modal-error').inner_text());close(p)
    # 表单的无效编辑仍保留，取消后不改公共源。
    check('取消错误编辑不改公共源',ev(p,'frpNode("ref-n3").proxies[2].visitor_bind_addr')=='127.0.0.1')
    click(p,'frp-proxyedit',node='ref-n3',index=2);check('STCP 未保存错误编辑保留',p.locator('#fp-vaddr').input_value()=='0.0.0.0');close(p)
    before=ev(p,'JSON.stringify(S.projects.filter(p=>p.frpApplied).map(p=>p.frpApplied))')
    for id,arch,tag in [('frp-bin-frpc','x86_64','frpc-x86'),('frp-bin-frpc-arm64','aarch64','frpc-arm'),('frp-bin-frps','x86_64','frps-x86'),('frp-bin-frps-arm64','aarch64','frps-arm')]:upload(p,id,arch,tag)
    check('新增 QA 资产不篡改任何已有应用',ev(p,'JSON.stringify(S.projects.filter(p=>p.frpApplied).map(p=>p.frpApplied))')==before)
    check('原始四个占位保持 0 B',ev(p,'S.programs.filter(f=>f.id.startsWith("frp-bin-")).every(f=>f.bytes===0&&f.placeholder)'))
    # 只为本测试的虚构目标提供地址；通过真实界面注入模拟检查事实。
    ev(p,"sr('frp-source').host='192.0.2.230';sr('frp-source').user='qa'")
    click(p,'navigate',page='servers')
    for host in ev(p,'S.servers.map(s=>s.id)'):
        click(p,'servercheck',id=host);p.locator('#check-result').select_option('online');submit(p)
    check('虚构目标模拟检查记录时间',ev(p,'S.servers.every(s=>s.state==="online"&&s.checked)'))
    click(p,'navigate',page='frp');click(p,'frp-tab',id='connections');click(p,'frp-node',id='ref-n4')
    for role in ['client','server','visitor']:adopt(p,'frp-ref-n4-'+role)
    check('ARM 服务器实际选 ARM 程序',ev(p,'frpResolveProgram(pr("frp-ref-n4-server").frpDraft.programRef,"frp-host-ref-n4").file.arch')=='aarch64')
    # 仅为异常状态注入缺架构 / 失效引用；阻塞判断与按钮仍通过真实界面操作。
    click(p,'frp-tab',id='files');click(p,'frp-role',id='server')
    p.evaluate('sr("frp-host-ref-n4").arch="riscv64"')
    click(p,'frp-op',node='ref-n4',role='server',op='deploy')
    check('缺少匹配架构在浏览器阻止继续',p.locator('#modal button[type=submit]').is_disabled() and '缺少匹配架构 riscv64' in p.locator('#modal').inner_text());close(p)
    p.evaluate('sr("frp-host-ref-n4").arch="aarch64";window._testRefs=clone(pr("frp-ref-n4-server").frpDraft.programRef);pr("frp-ref-n4-server").frpDraft.programRef.pins=[{fileId:"missing-fixture",revision:2}]')
    click(p,'frp-op',node='ref-n4',role='server',op='deploy')
    check('失效固定引用在浏览器阻止继续',p.locator('#modal button[type=submit]').is_disabled() and '引用文件或固定修订失效' in p.locator('#modal').inner_text());close(p)
    p.evaluate('pr("frp-ref-n4-server").frpDraft.programRef=window._testRefs;delete window._testRefs');click(p,'frp-tab',id='node')
    click(p,'frp-group',node='ref-n4');check('三角色落点预览可提交',not p.locator('#modal button[type=submit]').is_disabled());shot(p,'frp-three-role-preview-desktop.png')
    p.locator('[name=fo-identity]').check();p.locator('[name=fo-impact]').check();p.locator('[name=fo-hold]').check();submit(p);finish(p)
    check('明确执行后更新三角色应用',ev(p,'["server","client","visitor"].every(r=>pr("frp-ref-n4-"+r).life==="installed")'))
    saved=ev(p,'JSON.stringify([pr("frp-ref-n4-client").frpApplied,pr("frp-ref-n4-client").frpReadSnapshot])');draft=ev(p,'JSON.stringify(pr("frp-ref-n4-client").frpDraft)')
    click(p,'frp-tab',id='review');click(p,'frp-template',id='frpc.toml.tpl');source=p.locator('#ft-source').input_value()+'\n# browser public revision';p.locator('#ft-source').fill(source)
    # 从专用编辑器打开同一公共文件抽屉，底层 DOM 不被替换。
    click(p,'asset-file',id=qa_files['frp-bin-frpc'],where='#modal');click(p,'asset-close',where='#asset-details')
    check('查看文件关闭后保留模板未保存正文',p.locator('#ft-source').input_value()==source)
    close(p);click(p,'frp-template',id='frpc.toml.tpl');check('模板取消重复打开保留正文',p.locator('#ft-source').input_value()==source);submit(p)
    check('保存模板不改当前草稿',ev(p,'JSON.stringify(pr("frp-ref-n4-client").frpDraft)')==draft)
    check('公共保存仅更新提示',ev(p,'pr("frp-ref-n4-client").frpAvailableUpdate'))
    before_other=ev(p,'JSON.stringify(pr("frp-ref-n4-visitor").frpDraft)');adopt(p,'frp-ref-n4-client')
    check('采用更新仅修改指定草稿',ev(p,'JSON.stringify(pr("frp-ref-n4-visitor").frpDraft)')==before_other)
    check('采用不改应用或读取',ev(p,'JSON.stringify([pr("frp-ref-n4-client").frpApplied,pr("frp-ref-n4-client").frpReadSnapshot])')==saved)
    apply(p,'ref-n4','client');check('单独应用之后才有新正文','# browser public revision' in ev(p,'pr("frp-ref-n4-client").frpApplied.files.toml'))
    if ev(p,'ui.page')!='project' or ev(p,'ui.project')!='frp-ref-n4-client':
        click(p,'navigate',page='projects');click(p,'project',id='frp-ref-n4-client')
    click(p,'frp-read',id='frp-ref-n4-client');old_read=ev(p,'JSON.stringify(pr("frp-ref-n4-client").frpReadSnapshot)');click(p,'frp-read',id='frp-ref-n4-client',fail='true')
    check('失败保留成功读取内容时间',ev(p,'JSON.stringify(pr("frp-ref-n4-client").frpReadSnapshot)')==old_read and '上次成功结果（旧）' in p.locator('#main').inner_text());shot(p,'frp-project-snapshots-desktop.png')
    click(p,'asset-template',id='frp-template-client');click(p,'asset-edit-template',where='#asset-details',id='frp-template-client');check('公共配置编辑进入对应角色槽',ev(p,'ui.modal.id')=='frpc.toml.tpl');close(p)
    click(p,'frp-locate',node='ref-n4',role='client');click(p,'frp-role',id='visitor');click(p,'frp-tab',id='node');click(p,'frp-proxyremove',node='ref-n4',index=0);click(p,'frp-removesave',where='#modal',node='ref-n4',index=0)
    check('删除最后 STCP 不立即卸载 visitor',ev(p,'pr("frp-ref-n4-visitor").life')=='installed')
    adopt(p,'frp-ref-n4-client');click(p,'frp-op',node='ref-n4',role='client',op='deploy')
    check('清理预览有配置 unit 生成文件范围','本次确认将移除 visitor' in p.locator('#modal').inner_text() and p.locator('[name=fo-cleanup]').count()==1);shot(p,'frp-visitor-cleanup-desktop.png');close(p)
    apply(p,'ref-n4','client',cleanup=True);check('确认部署才移除 visitor',ev(p,'pr("frp-ref-n4-visitor").life')=='uninstalled')
    # 在实际生成内容上用独立 TOML 解析器验证转义；只注入演示字符串，未执行附件代码。
    credential='DEMO_quote" backslash\\ newline\n control\t'
    p.evaluate('(token)=>{S.frp.token=token;frpNode("ref-n3").proxies[2].secret_key=token;}',credential)
    for role in ['client','server','visitor']:
        text=p.evaluate('(r)=>frpFiles(frpNode("ref-n3"),r).toml',role);parsed=tomllib.loads(text);check('可靠 TOML 转义 '+role,parsed['auth']['token']==credential)
    p.reload();p.wait_for_function('()=>prototypeLoading.ready');close(p) if p.locator('#modal[open]').count() else None;click(p,'navigate',page='frp');click(p,'frp-tab',id='connections');click(p,'frp-profile-toggle');check('刷新和返回保留原工作连接',ev(p,'S.frp.nodes[0].id')=='n1')
    # 公共设置恢复，当前清单与参考清单是独立模拟场景。
    for node in ['n1','n2','n3','n4']:adopt(p,'frp-'+node+'-client')
    click(p,'navigate',page='frp');click(p,'frp-tab',id='connections');click(p,'frp-targets');p.locator('#targets-scope').select_option('all');p.locator('#targets-op').select_option('deploy');click(p,'frp-target-preview',where='#modal');p.locator('#outcome').select_option('partial');p.locator('[name=fo-identity]').check();p.locator('[name=fo-impact]').check();p.locator('[name=fo-hold]').check();submit(p);finish(p)
    check('批量部分失败逐目标含后续成功',ev(p,'S.operations[0].frpResults.length')==4 and ev(p,'S.operations[0].frpResults.at(-1).status')=='success');click(p,'navigate',page='operations');click(p,'opdetail',id=ev(p,'S.operations[0].id'));shot(p,'frp-batch-partial-desktop.png');close(p)
    context.close()
    for width in [320,390,820,1440]:
        ctx=browser.new_context(viewport={'width':width,'height':900});p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'/#frp');p.wait_for_function('()=>prototypeLoading.ready')
        click(p,'frp-node',id='n3');click(p,'frp-tab',id='files');click(p,'asset-file',id='frp-bin-frpc-arm64')
        check(str(width)+'px 抽屉无页面水平溢出',ev(p,'document.documentElement.scrollWidth<=window.innerWidth'))
        check(str(width)+'px 文件抽屉无内部水平溢出',p.locator('#asset-details').evaluate('(e)=>e.scrollWidth<=e.clientWidth'))
        p.keyboard.press('Escape');check(str(width)+'px Escape 返回角色预览',not p.locator('#asset-details').evaluate('(e)=>e.open'))
        if width==390:click(p,'frp-role',id='visitor');click(p,'asset-template',id='frp-template-visitor');shot(p,'frp-config-detail-mobile.png');p.keyboard.press('Escape')
        click(p,'frp-role',id='visitor');click(p,'frp-op',node='n3',role='visitor',op='deploy');check(str(width)+'px 部署弹窗可取消',p.locator('#modal').evaluate('(e)=>e.open'));close(p);ctx.close()
    check('全程无页面 JavaScript 异常',not errors);browser.close()
print(json.dumps({'checks':len(checks),'passed':checks,'page_errors':errors},ensure_ascii=False,indent=2))
