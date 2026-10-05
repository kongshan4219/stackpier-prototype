"""真实 Chromium 操作回归；仅 localhost 和浏览器内模拟，不访问远端节点。"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4311')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS','docs/screenshots'))
OUT.mkdir(parents=True,exist_ok=True)
errors=[]
checks=[]

def check(label,condition):
    assert condition,label
    checks.append(label)

def click(browser_page,action,where='',**data):
    selector='[data-action="'+action+'"]'+''.join('[data-'+key+'="'+str(value)+'"]' for key,value in data.items())
    browser_page.locator((where+' ' if where else '')+selector).first.click()

def fresh(browser,width=1440):
    context=browser.new_context(viewport={'width':width,'height':1000},device_scale_factor=1)
    page=context.new_page()
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE)
    page.wait_for_function('()=>prototypeLoading.ready')
    return context,page

def value(page,expression):return page.evaluate(expression)
def snapshot(page,id='p1'):return value(page,f'JSON.stringify([pr("{id}").appliedSnapshot,pr("{id}").serverReadSnapshot])')
def editor(page):click(page,'navigate',page='templates');click(page,'templateedit',id='t1')
def finish(page):click(page,'finishdemo',where='#modal');click(page,'closemodal',where='#modal')
def shot(page,name):page.screenshot(path=str(OUT/name),full_page=name.startswith('project-read'))

with sync_playwright() as playwright:
    browser=playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage'])
    context,page=fresh(browser)
    click(page,'navigate',page='programs')
    page.locator('[data-filter=q]').fill('catalog-config')
    click(page,'asset-file',where='#main',id='file1')
    check('文本只读预览与独立反向引用',page.locator('#asset-details').get_by_text('文本内容 · 只读').count()==1 and '项目已应用版本仍在使用' in page.locator('#asset-details').inner_text())
    shot(page,'asset-detail-desktop.png')
    click(page,'asset-template',where='#asset-details',id='t1')
    check('文件到配置只读详情', '部署配置 · 只读详情' in page.locator('#asset-details').inner_text())
    click(page,'asset-back',where='#asset-details')
    click(page,'asset-project',where='#asset-details',id='p1')
    check('文件到项目配置并保留来源',page.locator('h1').inner_text()=='catalog-api' and page.locator('[data-action=asset-return]').count()==1)
    click(page,'asset-return')
    click(page,'asset-close',where='#asset-details')
    check('返回后保留文件筛选',page.locator('[data-filter=q]').input_value()=='catalog-config')
    editor(page)
    draft='\n# 未保存正文，保留首尾空白\n[Service]\nExecStart=/srv/draft/app\n\n'
    page.locator('#tpl-source').fill(draft)
    path='/srv/stackpier-demo/catalog-api/custom-app.conf'
    page.locator('#tpl-map-path-1').fill(path)
    for _ in range(2):
        click(page,'mapping-view',where='#modal',index=1)
        page.keyboard.press('Escape')
        check('重复打开/关闭详情保留草稿',page.locator('#tpl-source').input_value()==draft and page.locator('#tpl-map-path-1').input_value()==path)
    page.locator('#tpl-map-file-1').select_option('__upload__')
    page.locator('#bin-file').set_input_files({'name':'extra-config.yaml','mimeType':'text/yaml','buffer':b'feature: enabled\n'})
    page.locator('#program-upload-save').wait_for(state='visible')
    page.wait_for_function('()=>!!ui.modal.analysis && !ui.modal.busy')
    page.locator('#program-upload-save').click()
    page.locator('#modal button[type=submit]').click()
    check('选择器内实际上传返回原编辑器且正文/映射保留',page.locator('#tpl-source').input_value()==draft and page.locator('#tpl-map-path-1').input_value()==path)
    click(page,'template-map-add',where='#modal')
    uploaded=value(page,'assetGroups().find(group=>group.name==="extra-config.yaml").id')
    page.locator('#tpl-map-file-2').select_option(uploaded)
    page.locator('#tpl-map-path-2').fill('/srv/stackpier-demo/catalog-api/extra.yaml')
    check('上传文件在选择器可选',value(page,'ui.modal.fileMappings[2].pins.length')==1)
    click(page,'mapping-upload',where='#modal');click(page,'closemodal',where='#modal')
    check('上传取消返回且不丢其他映射',page.locator('#tpl-source').input_value()==draft and page.locator('#tpl-map-path-2').input_value().endswith('/extra.yaml'))
    click(page,'closemodal',where='#modal');click(page,'templateedit',id='t1')
    check('取消后再次打开恢复未保存正文',page.locator('#tpl-source').input_value()==draft)
    page.reload();editor(page)
    check('刷新恢复配置未保存草稿',page.locator('#tpl-source').input_value()==draft)
    for target,message in [('relative/file','绝对路径'),('/srv/stackpier-demo/catalog-api/catalog-service','重复')]:
        page.locator('#tpl-map-path-1').fill(target);page.locator('#modal button[type=submit]').click()
        check('保存校验 '+message,message in page.locator('#modal-error').inner_text())
    page.locator('#tpl-map-path-1').fill(path)
    placeholder=value(page,'assetGroups().find(group=>group.name==="frps").id')
    page.locator('#tpl-map-file-1').select_option(placeholder);page.locator('#modal button[type=submit]').click()
    check('0 B 占位不能保存为可部署映射','0 B 占位' in page.locator('#modal-error').inner_text())
    # 模拟缺失公共记录，仍通过实际提交校验，不能自动选择其他文件。
    page.locator('#tpl-map-file-1').select_option('asset-file1')
    page.evaluate('S.programs=S.programs.filter(file=>file.id!=="file1")')
    page.locator('#modal button[type=submit]').click()
    check('缺失引用阻止保存','不存在' in page.locator('#modal-error').inner_text())
    context.close()

    context,page=fresh(browser)
    old=snapshot(page);other=snapshot(page,'p7');old_other=value(page,'JSON.stringify(pr("p7").cfg)')
    click(page,'navigate',page='programs');click(page,'asset-file',where='#main',id='file1')
    click(page,'asset-replace',where='#asset-details',id='file1')
    check('替换前展示影响配置和项目','catalog-api' in page.locator('#modal').inner_text() and 'Go 应用' in page.locator('#modal').inner_text())
    page.locator('#bin-file').set_input_files({'name':'catalog-settings-v2.yaml','mimeType':'text/yaml','buffer':b'listen: ":8080"\nlog_level: debug\nmode: demo\n'})
    page.wait_for_function('()=>!!ui.modal.analysis && !ui.modal.busy');page.locator('#program-upload-save').click();page.locator('#modal button[type=submit]').click()
    check('实际替换保留已应用及读取快照',snapshot(page)==old and snapshot(page,'p7')==other)
    check('文件替换不追随公共映射',value(page,'tpl("t1").fileMappings[1].pins[0].revision')==1)
    editor(page);body=page.locator('#tpl-source').input_value();page.locator('#tpl-source').fill(body+'\n# 公共配置新修订\n');page.locator('#modal button[type=submit]').click()
    check('保存公共配置不更新项目快照',snapshot(page)==old and value(page,'tpl("t1").rev')==2 and value(page,'tpl("t1").fileMappings[1].pins[0].revision')==1)
    click(page,'project',id='p1') if page.locator('[data-action=project][data-id=p1]').count() else click(page,'navigate',page='projects')
    if page.locator('h1').inner_text()!='catalog-api':click(page,'project',id='p1')
    click(page,'tab',id='config');click(page,'asset-update',id='p1')
    check('差异查看尚未采用',value(page,'pr("p1").cfg.fileMappings[1].pins[0].revision')==1)
    click(page,'closemodal',where='#modal');click(page,'asset-update',id='p1');click(page,'asset-update-adopt',where='#modal',id='p1')
    check('采用只更新当前草稿',snapshot(page)==old and value(page,'pr("p1").cfg.fileMappings[1].pins[0].revision')==2 and value(page,'JSON.stringify(pr("p7").cfg)')==old_other)
    click(page,'projectop',id='p1',kind='apply')
    check('应用单独确认含项目和映射落点','catalog-api' in page.locator('#modal').inner_text() and '部署落点预览' in page.locator('#modal').inner_text() and snapshot(page)==old)
    shot(page,'apply-preview-desktop.png')
    page.locator('#modal button[type=submit]').click();finish(page)
    check('确认执行后仅当前项目应用新版本',value(page,'pr("p1").appliedSnapshot.files[1].binary.revision')==2 and snapshot(page,'p7')==other)
    read=value(page,'JSON.stringify(pr("p1").serverReadSnapshot)')
    click(page,'asset-read-fail',id='p1')
    check('读取失败保留成功内容和时间',value(page,'JSON.stringify(pr("p1").serverReadSnapshot)')==read and '读取失败 · 旧结果' in page.locator('#main').inner_text())
    shot(page,'project-read-stale-desktop.png')
    click(page,'asset-file',where='#main',id='file1')
    page.locator('#asset-revision').select_option('1')
    check('旧修订仍有应用项目引用','catalog-config.yaml' in page.locator('#asset-details').inner_text() and 'report-worker' in page.locator('#asset-details').inner_text())
    click(page,'asset-close',where='#asset-details')
    click(page,'navigate',page='programs');click(page,'asset-file',where='#main',id='file1');click(page,'asset-rename',where='#asset-details',id='file1')
    page.locator('#asset-name').fill('renamed-catalog.yaml');page.locator('#modal button[type=submit]').click()
    check('实际改名不破坏引用',value(page,'assetReferences("file1").configurations.length')==1 and value(page,'deploymentLocation(pr("p1")).files[1].binary.id')=='file1')
    click(page,'asset-close',where='#asset-details');page.reload()
    check('刷新恢复文件历史和项目独立状态',value(page,'assetById("file1").name')=='renamed-catalog.yaml' and value(page,'assetById("file1").revision')==2 and value(page,'pr("p7").appliedSnapshot.files[1].binary.revision')==1)
    context.close()

    context,page=fresh(browser)
    click(page,'navigate',page='servers');click(page,'servercheck',id='s3')
    page.locator('#check-result').select_option('online');page.locator('#modal button[type=submit]').click();click(page,'closemodal',where='#modal') if page.locator('#modal[open]').count() else None
    for server,architecture,name in [('s4','x86_64','preview-x86'),('s3','aarch64','preview-arm')]:
        click(page,'newproject',template='t1') if page.locator('[data-action=newproject][data-template=t1]').count() else click(page,'navigate',page='templates')
        if not page.locator('#modal[open]').count():click(page,'newproject',template='t1')
        page.locator('#np-template').select_option('t1');page.locator('#np-server').select_option(server);page.locator('#np-name').fill(name);page.locator('#modal button[type=submit]').click()
        check('实际部署预览匹配 '+architecture,architecture in page.locator('#modal').inner_text() and value(page,'deploymentLocation(ui.modal.draft).files[0].binary.arch')==architecture)
        check('预览不会创建项目',not value(page,f'S.projects.some(project=>project.name==="{name}")'))
        if architecture=='aarch64':shot(page,'deployment-preview-arm-desktop.png')
        click(page,'deployment-preview-back',where='#modal');check('预览返回保留项目名',page.locator('#np-name').input_value()==name);click(page,'closemodal',where='#modal')
    editor(page);page.locator('#tpl-map-rule-0').select_option('x86_64');page.locator('#modal button[type=submit]').click()
    click(page,'newproject',template='t1');page.locator('#np-server').select_option('s3');page.locator('#np-name').fill('missing-architecture');page.locator('#modal button[type=submit]').click()
    check('实际缺架构阻塞继续',page.locator('[data-action=deployment-preview-execute]').is_disabled() and '缺少匹配架构 aarch64' in page.locator('#modal').inner_text())
    shot(page,'deployment-blocked-desktop.png');context.close()

    for width in [1440,1024,768,390,320]:
        context,page=fresh(browser,width)
        for name in ['programs','templates','projects']:
            if width<=768:click(page,'navtoggle')
            click(page,'navigate',page=name)
            check(f'{width}px {name} 无页面水平溢出',value(page,'document.documentElement.scrollWidth<=innerWidth'))
        # 移动端从卡片打开抽屉，长路径应在抽屉内换行而非撑宽。
        if width<=768:click(page,'navtoggle')
        click(page,'navigate',page='programs');click(page,'asset-file',where='#main',id='file1')
        page.evaluate('tpl("t1").fileMappings[1].targetPath="/srv/"+"long-directory/".repeat(50)+"app.conf";renderAssetDrawer()')
        check(f'{width}px 长路径抽屉可用',value(page,'assetDialog.scrollWidth<=assetDialog.clientWidth+2'))
        if width==390:
            page.locator('#asset-details .asset-reference').first.scroll_into_view_if_needed()
            shot(page,'asset-detail-mobile.png')
        page.keyboard.press('Escape')
        check(f'{width}px Escape 关闭抽屉',not page.locator('#asset-details').evaluate('(element)=>element.open'))
        context.close()

    context,page=fresh(browser)
    # 旧 localStorage 格式由真实浏览器刷新迁移；仅注入旧格式，交互测试不绕过按钮。
    page.evaluate('delete S.assetSchema;delete S.publicAssetsSeeded;tpl("t1").tpl="[Service]\\n# user body";pr("p1").cfg.source="[Service]\\n# user draft";for(const file of S.programs){delete file.groupId;delete file.revisions;delete file.revision;}persist()')
    page.reload();check('真实浏览器旧存储迁移保留编辑',value(page,'tpl("t1").tpl').endswith('# user body') and value(page,'pr("p1").cfg.source').endswith('# user draft'))
    page.evaluate('S.programs=[];S.templates=[];persist()');page.reload();click(page,'navigate',page='programs')
    check('清空资产刷新不重新填充',value(page,'S.programs.length')==0 and '尚无文件' in page.locator('#main').inner_text())
    click(page,'navigate',page='templates');check('清空配置刷新不重新填充',value(page,'S.templates.length')==0)
    check('全程无 JavaScript 页面异常',not errors)
    context.close();browser.close()

print(json.dumps({'checks':len(checks),'passed':checks,'page_errors':errors,'screenshots':sorted(file.name for file in OUT.glob('*.png'))},ensure_ascii=False,indent=2))
