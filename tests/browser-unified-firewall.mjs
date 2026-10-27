// 使用真实输入事件；仅通过原型审阅场景加载虚构数据，不连接真实服务器。
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STACKPIER_PREVIEW_URL;
const out=process.env.STACKPIER_SCREENSHOTS;
assert.ok(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname),'仅允许回环原型服务');
assert.ok(out?.startsWith('/srv/cache/stackpier-tmp/'),'截图与报告必须使用任务缓存目录');
await mkdir(out,{recursive:true});
const checks=[],errors=[];
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
function check(name,value){assert.ok(value,name);checks.push(name);console.log('[pass] '+name);}
async function click(page,action,data={},scope=''){
 const selector=scope+' [data-action="'+action+'"]'+Object.entries(data).map(([key,value])=>'[data-'+key+'="'+value+'"]').join('');
 await page.locator(selector.trim()).first().click();
}
async function close(page){if(await page.locator('#modal').evaluate(el=>el.open))await page.keyboard.press('Escape');}
async function scene(page,id){await close(page);await click(page,'scenes');await click(page,'loadscene',{id},'#modal');}
async function layout(page,label){
 check(label+'页面不横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(await page.locator('#modal').evaluate(el=>el.open))check(label+'弹窗可见且无横向溢出',await page.locator('#modal').evaluate(el=>{
  const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&r.top>=-1&&r.bottom<=innerHeight+1&&el.scrollWidth<=el.clientWidth+1;
 }));
}
async function shot(page,name){
 if(await page.locator('#toasts .toast').count())await page.locator('#toasts .toast').last().waitFor({state:'hidden'});
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:!await page.locator('#modal').evaluate(el=>el.open)});
}
async function submit(page){await page.locator('#modal button[type="submit"]').click();}
try{
 for(const width of [1440,390,320]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
  await page.goto(base+'/#firewall');await page.waitForFunction(()=>prototypeLoading.ready);
  await scene(page,'firewall-ready');
  check(width+'唯一管理方式且无后端选择',await page.locator('.firewall-state-card').innerText().then(text=>text.includes('firewalld')&&!text.includes('nftables'))&&await page.getByLabel('防火墙后端').count()===0);
  check(width+'已接入开放创建',await page.locator('#main [data-action="firewalledit"]').first().isEnabled());
  check(width+'策略筛选文字有足够空间',(await page.locator('#main [data-filter="fwPolicy"]').boundingBox()).width>=120);
  await layout(page,width+'已接入');await shot(page,'firewall-ready-'+width);

  check(width+'主页面不提供服务启停或切换',await page.locator('#main [data-action="fw-service"]').count()===0);
  const disclosure=page.locator('#main details').filter({has:page.locator('summary').filter({hasText:'检查详情'})});
  check(width+'检查详情默认折叠',!(await disclosure.evaluate(el=>el.open)));
  await disclosure.locator('summary').click();
  check(width+'详情保留底层接口',await disclosure.innerText().then(text=>text.includes('nftables')));
  await disclosure.locator('summary').click();
  await scene(page,'firewall-migrate');
  check(width+'服务冲突无自动迁移入口',await page.locator('#main [data-action="fw-setup"]').count()===0&&await page.locator('#main [data-action="firewalledit"]').first().isDisabled());
  await scene(page,'firewall-multi-zone');await click(page,'firewalledit',{},'#main');
  check(width+'多Zone必须明确选择',await page.locator('#fw-zone').inputValue()==='');
  await page.locator('#fw-zone').selectOption('internal');
  check(width+'可以选择内网作用范围',await page.locator('#fw-zone').inputValue()==='internal');
  await page.locator('#fw-port').fill('18444');await page.locator('[name="network-ack"]').check();await submit(page);
  check(width+'单条预览展示固定Zone',await page.locator('#modal').innerText().then(text=>text.includes('internal')));
  await page.locator('[name="fw-confirm"]').check();await submit(page);await click(page,'finishdemo',{},'#modal');await close(page);
  await click(page,'fw-import',{},'#main');await page.locator('#fw-import-zone').selectOption('internal');
  await page.locator('#fw-import-json').fill(JSON.stringify({format:'stackpier-port-rules',version:1,rules:[{protocol:'tcp',port:'18445',family:'ipv4',source:'0.0.0.0/0',action:'allow',description:'虚构内网端口'}]}));await submit(page);
  check(width+'批量预览展示固定Zone',await page.locator('#modal').innerText().then(text=>text.includes('internal')));await close(page);
  await click(page,'fw-export',{},'#main');
  check(width+'跨Zone导出明确阻止',await page.locator('#toasts').innerText().then(text=>text.includes('一个明确 Zone')));
  await page.getByLabel('选择端口 18444',{exact:true}).check();
  const downloaded=page.waitForEvent('download');await click(page,'fw-export',{},'#main');
  const download=await downloaded,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);
  const exported=JSON.parse(Buffer.concat(chunks).toString());
  check(width+'单Zone导出保留选定规则',exported.rules.length===1&&exported.rules[0].port==='18444');

  await scene(page,'firewall-blocked');
  check(width+'无恢复条件禁止迁移',await page.locator('#main [data-action="fw-setup"]').count()===0&&await page.locator('#main [data-action="firewalledit"]').first().isDisabled());
  await layout(page,width+'接入受阻');await shot(page,'firewall-blocked-'+width);

  await scene(page,'firewall-unknown');
  check(width+'断连保留原操作',await page.evaluate(()=>S.operations[0].status==='unknown'&&!!firewallHost(ui.server).operationId));
  const operation=await page.evaluate(()=>S.operations[0].id);
  await click(page,'fw-setup-inspect',{},'#modal');
  check(width+'证据不足不能转成功',await page.evaluate(()=>S.operations[0].status==='unknown'));
  await layout(page,width+'未知操作');await shot(page,'firewall-unknown-'+width);
  await click(page,'fw-setup-recover',{},'#modal');await page.locator('[name="fw-recover-ack"]').check();await submit(page);
  check(width+'沿原操作恢复',await page.evaluate(id=>S.operations[0].id===id&&S.operations[0].protectionReleased&&firewallHost(ui.server).manager==='UFW',operation));

  await scene(page,'firewall-recheck');await click(page,'fw-setup-inspect',{},'#modal');
  check(width+'取得证据后核对原操作成功',await page.evaluate(()=>S.operations[0].status==='success'&&firewallHost(ui.server).state==='ready'));
  await scene(page,'firewall-failed');
  check(width+'失败有恢复结果',await page.evaluate(()=>S.operations[0].status==='failed'&&S.operations[0].protectionReleased&&firewallHost(ui.server).manager==='UFW'));
  await scene(page,'firewall-read-error');
  const captured=await page.evaluate(()=>firewallHost(ui.server).captured);
  await click(page,'fw-refresh',{},'#main');
  check(width+'读取失败保留采集时间且禁止写入',captured===await page.evaluate(()=>firewallHost(ui.server).captured)&&await page.locator('#main [data-action="firewalledit"]').first().isDisabled());
  const stateText=await page.locator('.firewall-state-card').innerText();
  check(width+'只读检查失败区别于操作结果未知',stateText.includes('检查未完成')&&!stateText.includes('结果待核对')&&stateText.includes('重新检查'));
  check(width+'主机服务不展示整机盘点门槛',!stateText.includes('/var/spool/cron/crontabs'));
  await layout(page,width+'读取失败');await shot(page,'firewall-inventory-'+width);await context.close();
 }
 {
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();await page.goto(base);await scene(page,'firewall-legacy-receipt');
  await page.locator('#modal summary').filter({hasText:'固定接入计划与保留范围'}).click();const text=await page.locator('#modal').innerText();
  check('旧历史计划按原记录显示策略',text.includes('历史计划未记录分阶段诊断')&&text.includes('DROP（原计划）'));
  check('旧历史回执不要求重新生成预览',!text.includes('缺少新版阶段证据'));
  const id=await page.evaluate(()=>S.operations[0].id),count=await page.evaluate(()=>S.operations.length);await click(page,'fw-setup-recover',{id},'#modal');await page.locator('[name="fw-recover-ack"]').check();await submit(page);
  check('旧历史恢复沿原操作且不新增操作',await page.evaluate(({id,count})=>S.operations[0].id===id&&S.operations[0].status==='rolled-back'&&S.operations.length===count,{id,count}));
  await shot(page,'firewall-legacy-receipt');await context.close();
 }
 check('无浏览器脚本或资源错误',errors.length===0);
 await writeFile(path.join(out,'report.json'),JSON.stringify({checks,errors},null,2)+'\n');
 console.log('PASS '+checks.length+' checks');
}finally{await browser.close();}
