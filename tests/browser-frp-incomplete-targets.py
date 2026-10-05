"""固定原目标恢复的 Chromium 实测；有效文件头分析夹具，不运行二进制或远端命令。"""
import os,json,re,struct
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
BASE=os.environ.get('STACKPIER_PREVIEW_URL','http://127.0.0.1:4315')
OUT=Path(os.environ.get('STACKPIER_SCREENSHOTS',ROOT/'docs/screenshots/frp-incomplete-targets'));OUT.mkdir(parents=True,exist_ok=True)
SCRIPT=re.search(r'export const qaServicesScript = `(.*?)`;',(ROOT/'tests/frp-evidence-fixtures.mjs').read_text(),re.S)[1]
checks=[];errors=[];requests=[]
def ck(name,condition):
 assert condition,name
 checks.append(name);print('PASS '+name,flush=True)
def ev(p,script):return p.evaluate(script)
def click(p,a,**data):
 if a=='navigate' and ev(p,'innerWidth<=820&&!ui.nav'):p.locator('[data-action=navtoggle]').click()
 p.locator('[data-action="'+a+'"]'+''.join('[data-'+k+'="'+str(v)+'"]' for k,v in data.items())).filter(visible=True).first.click()
def close(p):click(p,'closemodal')
def submit(p):p.locator('#modal button[type=submit]').click()
def shot(p,name):p.screenshot(path=str(OUT/name),full_page=False)
def fresh(b,width=1440):
 c=b.new_context(viewport={'width':width,'height':1000});p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.on('request',lambda r:requests.append(r.url));p.goto(BASE);p.wait_for_function('()=>prototypeLoading.ready');return c,p
def qa(p):
 before=ev(p,'JSON.stringify(S.programs.filter(f=>f.id.startsWith("frp-bin-")))');click(p,'navigate',page='programs')
 for name,stamp in [('frpc',91),('frps',92)]:
  x=bytearray(96);x[:7]=bytes([127,69,76,70,2,1,1]);struct.pack_into('<HHI',x,16,2,62,1);struct.pack_into('<H',x,52,64);x[95]=stamp
  click(p,'programupload');p.locator('#bin-file').set_input_files({'name':'qa-evidence-'+name,'mimeType':'application/octet-stream','buffer':bytes(x)});p.locator('#program-upload-save').click();p.locator('#bin-filename').fill('qa-evidence-'+name);submit(p)
 ck('上传真实非空 ELF 文件头，格式、架构、摘要校验通过',ev(p,'S.programs.filter(f=>f.filename.startsWith("qa-evidence-")).every(f=>f.bytes===96&&f.kind==="elf"&&f.arch==="x86_64"&&f.sha256.length===64)'))
 ev(p,SCRIPT);ck('独立 QA 固定程序修订有效，原 0 B 资产保持不变',ev(p,'JSON.stringify(S.programs.filter(f=>f.id.startsWith("frp-bin-")))')==before and ev(p,'frpConfigurationPlan(qaNode).errors.length===0'))
 click(p,'navigate',page='frp');click(p,'frp-node',id='qa-evidence-node')
def execute(p,outcome='success',detach=False):
 click(p,'frp-binding-detach' if detach else 'frp-configapply',node='qa-evidence-node');p.locator('[name=fc-confirm]').check();p.locator('[name=fc-hold]').check();p.locator('#outcome').select_option(outcome);submit(p);oid=ev(p,'S.operations[0].id');click(p,'finishdemo');close(p);return oid
def ended(p,oid):
 click(p,'opdetail',id=oid);click(p,'verifyop',id=oid);p.locator('#verify-result').select_option('ended-unknown');p.locator('[name=verify-evidence]').check();submit(p);close(p)
def rebind(p):
 click(p,'frp-nodeedit',id='qa-evidence-node');p.locator('#fn-provider').select_option('qa-evidence-client-b');p.locator('#fn-visitor').select_option('qa-evidence-visitor-b');submit(p)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);c,p=fresh(b);qa(p)
 before=ev(p,'[S.projects.length,S.operations.length]');click(p,'frp-configapply',node='qa-evidence-node');close(p);ck('预览取消不创建操作或项目',ev(p,'[S.projects.length,S.operations.length]')==before)
 original=execute(p,'partial');ck('首次部分写入未创建成功 appliedConfiguration',ev(p,'!qaNode.appliedConfiguration&&S.operations.find(o=>o.id==='+json.dumps(original)+').results[0].writeEvidence==="written"'))
 ck('原目标证据显示，客户端占用保持','旧目标未解决' in p.locator('#main').inner_text() and ev(p,'frpUnresolvedTargets(qaNode.id).some(t=>t.projectId===qaBindings.clienta)'))
 shot(p,'partial-targets-desktop.png');rebind(p);ck('保存改绑被阻止并保留填写','须先明确解除旧配置' in p.locator('#modal').inner_text() and p.locator('#fn-provider').input_value()=='qa-evidence-client-b');shot(p,'rebind-blocked-desktop.png');close(p)
 click(p,'frp-home');click(p,'frp-nodeedit');ck('新连接选择器禁选原客户端和 visitor',p.locator('#fn-provider option[value="qa-evidence-client-a"]').is_disabled() and p.locator('#fn-visitor option[value="qa-evidence-visitor-a"]').is_disabled());close(p);click(p,'frp-node',id='qa-evidence-node')
 click(p,'frp-connection-delete',node='qa-evidence-node');ck('删除提供恢复入口，没有绕过按钮',p.locator('#modal [data-action=frp-connection-delete-confirm]').count()==0 and p.locator('#modal [data-action=frp-binding-detach]').count()==1);close(p)
 p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('刷新仍占用 A 且保留失败证据',ev(p,'frpReservationOwners("client","qa-evidence-client-a","other").length===1&&!frpConfigurationMatches(frpNode("qa-evidence-node"))'))
 failed=execute(p,'partial',True);ck('部分清理仍保留待处理及占用',ev(p,'frpUnresolvedTargets("qa-evidence-node").length>0&&projectPendingOperations().some(o=>o.id==='+json.dumps(original)+')'));shot(p,'cleanup-partial-desktop.png')
 unknown=execute(p,'unknown',True);click(p,'frp-binding-detach',node='qa-evidence-node');ck('未知清理必须先确认原执行已结束',p.locator('#modal button[type=submit]').is_disabled() and '可能继续写入' in p.locator('#modal').inner_text());close(p);ended(p,unknown)
 ck('核对结束不伪造已清理，仍保留占用',ev(p,'frpUnresolvedTargets("qa-evidence-node").length>0&&S.operations.find(o=>o.id==='+json.dumps(unknown)+').status==="unknown"'))
 server=ev(p,'JSON.stringify(pr("qa-evidence-server-a").frpApplied)');other=ev(p,'JSON.stringify(S.frp.nodes.filter(n=>n.id!=="qa-evidence-node"))');complete=execute(p,'success',True)
 ck('全部清理后原失败退出待处理，历史保留',ev(p,'frpUnresolvedTargets("qa-evidence-node").length===0&&S.operations.find(o=>o.id==='+json.dumps(original)+').status==="partial"&&S.operations.find(o=>o.id==='+json.dumps(original)+').resolved&&!projectPendingOperations().some(o=>o.input?.nodeId==="qa-evidence-node")'))
 ck('清理不卸载服务，不修改共享 FRPS 或其他连接',ev(p,'JSON.stringify(pr("qa-evidence-server-a").frpApplied)')==server and ev(p,'JSON.stringify(S.frp.nodes.filter(n=>n.id!=="qa-evidence-node"))')==other and ev(p,'S.projects.filter(p=>p.id.startsWith("qa-evidence-")).length===5'))
 ev(p,'var callbackCount=S.operations.length,attemptCount=S.frpConfigurationAttempts.length;finishOperation(S.operations.find(o=>o.id==='+json.dumps(complete)+'),"success");');ck('重复完成回调不重复记录',ev(p,'callbackCount===S.operations.length&&attemptCount===S.frpConfigurationAttempts.length'))
 rebind(p);ck('清理后改绑 B 成功且 A 释放',ev(p,'frpNode("qa-evidence-node").serviceBindings.client==="qa-evidence-client-b"&&frpReservationOwners("client","qa-evidence-client-a","other").length===0'))
 execute(p);ck('B 独立应用后无遗留待处理',ev(p,'frpConfigurationMatches(frpNode("qa-evidence-node"))&&!projectPendingOperations().some(o=>o.input?.nodeId==="qa-evidence-node")'));shot(p,'recovered-rebound-desktop.png')
 execute(p,'success',True);execute(p,'partial');ck('解除后再次部分应用仍阻止改绑',ev(p,'frpNeedsDetach(frpNode("qa-evidence-node"))&&frpUnresolvedTargets("qa-evidence-node").length>0'));shot(p,'partial-after-detach.png');c.close()
 c,p=fresh(b,390);qa(p);unknown=execute(p,'unknown');ck('首次未知保留全部可能写入目标',ev(p,'frpUnresolvedTargets(qaNode.id).length===3&&!qaNode.appliedConfiguration'));shot(p,'unknown-targets-mobile.png');rebind(p);ck('窄屏返回修改非敏感选择保留',p.locator('#fn-provider').input_value()=='qa-evidence-client-b' and '须先明确解除旧配置' in p.locator('#modal').inner_text());shot(p,'rebind-blocked-mobile.png');close(p)
 ended(p,unknown);execute(p,'success',True);ck('窄屏核对后清理可完成',ev(p,'frpUnresolvedTargets("qa-evidence-node").length===0'));p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('刷新不会复活已解决记录',ev(p,'!projectPendingOperations().some(o=>o.input?.nodeId==="qa-evidence-node")'));shot(p,'resolved-mobile.png');c.close()
 # 旧存储直接复现旧版本已释放占用的状态，真实刷新触发迁移。
 c,p=fresh(b);qa(p);oid=execute(p,'partial');ev(p,'delete S.frpConfigurationAttempts;delete S.frpEvidenceSchema;qaNode.serviceBindings.client=qaBindings.clientb;qaNode.revision++;persist();');p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('旧数据迁移找回 A 占用而不改 B 编辑',ev(p,'frpReservationOwners("client","qa-evidence-client-a","other").length===1&&frpNode("qa-evidence-node").serviceBindings.client==="qa-evidence-client-b"'));click(p,'frp-configapply',node='qa-evidence-node');ck('旧数据不允许仅向 B 写入',p.locator('#modal button[type=submit]').is_disabled() and '旧目标不同' in p.locator('#modal').inner_text());close(p);execute(p,'success',True);execute(p);ck('迁移后的原 A 清理及 B 应用链路通过',ev(p,'frpConfigurationMatches(frpNode("qa-evidence-node"))&&S.operations.find(o=>o.id==='+json.dumps(oid)+').resolved'));saved=ev(p,'JSON.parse(JSON.stringify(S))');p.reload();p.wait_for_function('()=>prototypeLoading.ready');ck('重复迁移不丢编辑或改变状态',ev(p,'JSON.parse(JSON.stringify(S))')==saved);shot(p,'legacy-migration-recovered.png');c.close()
 # 共享认证计划先写入主连接 visitor，再在后续目标失败；逐连接恢复不清空别人映射。
 c,p=fresh(b);qa(p);ev(p,"""S.servers.push({...clone(sr('s2')),id:'qa-other-client',host:'192.0.2.233'});pr(qaBindings.clientb).server='qa-other-client';pr(qaBindings.clientb).frpApplied.host='qa-other-client';var other=clone(qaNode);other.id='qa-other-node';other.provider='qa-other-client';other.proxies=[];other.serviceBindings={client:qaBindings.clientb,server:qaBindings.servera,visitor:qaBindings.visitorb};S.frp.nodes.push(other);qaNode.sourceSettings.token=other.sourceSettings.token='DEMO_QA_NEW_AUTH';persist();render();""")
 oid=execute(p,'partial');ck('共享 FRPS 仅一次，visitor 确认写入后仍占用',ev(p,'S.operations.find(o=>o.id==='+json.dumps(oid)+').input.items.filter(x=>x.role==="server").length===1&&frpUnresolvedTargets(qaNode.id).some(t=>t.role==="visitor"&&t.writeEvidence==="written")&&frpReservationOwners("visitor",qaBindings.visitora,"other").length===1'))
 untouched=ev(p,'JSON.stringify(pr(qaBindings.clientb).frpApplied)');execute(p,'success',True);ck('主连接恢复不清空另一个客户端，原批量操作仍待处理',ev(p,'JSON.stringify(pr(qaBindings.clientb).frpApplied)')==untouched and ev(p,'!S.operations.find(o=>o.id==='+json.dumps(oid)+').resolved'))
 click(p,'navigate',page='operations');click(p,'opdetail',id=oid);ck('原操作继续提供剩余连接恢复入口','qa-evidence-client-b' in p.locator('#modal').inner_text() and p.locator('#modal [data-action=frp-binding-detach][data-node=qa-other-node]').count()>0);close(p)
 click(p,'navigate',page='frp');click(p,'frp-home');click(p,'frp-node',id='qa-other-node');click(p,'frp-binding-detach',node='qa-other-node');p.locator('[name=fc-confirm]').check();p.locator('[name=fc-hold]').check();submit(p);click(p,'finishdemo');close(p);ck('剩余连接逐一恢复后原批量失败已解决',ev(p,'S.operations.find(o=>o.id==='+json.dumps(oid)+').resolved&&!frpUnresolvedTargets().some(t=>t.nodeId.startsWith("qa-"))'));shot(p,'shared-frps-visitor-recovered.png');c.close();b.close()
ck('浏览器无页面异常',not errors);ck('只访问本地原型，无远端调用',all(url.startswith(BASE) for url in requests))
(OUT/'browser-results.json').write_text(json.dumps({'passed':len(checks),'checks':checks,'pageErrors':errors,'base':BASE,'fixture':'上传 96 B ELF 分析夹具 + 独立服务快照，仅模拟，不执行二进制'},ensure_ascii=False,indent=2))
