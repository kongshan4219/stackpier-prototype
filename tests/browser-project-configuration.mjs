// 仅访问回环静态站点；正常流程使用真实点击，异常场景通过原型试用入口注入。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STACKPIER_PREVIEW_URL||'http://127.0.0.1:4311';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'仅允许回环原型服务');
const out=process.env.STACKPIER_SCREENSHOTS;
assert.ok(out,'须显式指定截图与报告目录');
await mkdir(out,{recursive:true});
const checks=[],errors=[];
const browser=await chromium.launch({...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--no-sandbox']});
function check(name,value){assert.ok(value,name);checks.push(name);}
async function click(page,action,data={},scope=''){
 const selector=scope+' [data-action="'+action+'"]'+Object.entries(data).map(([key,value])=>'[data-'+key+'="'+value+'"]').join('');
 await page.locator(selector.trim()).first().click();
}
async function layout(page,label){
 check(label+'无页面横向溢出',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
}
async function ready(page){await page.waitForFunction(()=>prototypeLoading.ready);}
async function shot(page,name){
 if(await page.locator('#toasts .toast').count())await page.locator('#toasts .toast').last().waitFor({state:'hidden'});
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(response.status()+' '+response.url());});
  await page.goto(base+'/#project?project=p1&tab=config');await ready(page);
  await page.waitForFunction(()=>projectTextDigests.has(pr('p1').appliedSnapshot.cfg.source));
  check(width+'固定信息卡片',await page.getByRole('heading',{name:'已应用配置与文件',exact:true}).count()===1);
  check(width+'首次核对为空',await page.getByText('尚未核对受管文件。',{exact:true}).isVisible());
  check(width+'配置页移出正文和草稿',await page.locator('#main pre').count()===0);
  await layout(page,width+'初始页');await shot(page,'systemd-empty-'+width);
  const unchanged=await page.evaluate(()=>JSON.stringify([pr('p1').cfg,pr('p1').appliedSnapshot,pr('p1').serverReadSnapshot,S.operations,pr('p1').runtime]));
  await click(page,'checkprojectfiles',{id:'p1'});
  await page.waitForFunction(()=>pr('p1').fileCheck?.files.length===3&&!projectFileReads.has('p1'));
  check(width+'核对三种文件',await page.locator('.file-observation').count()===3);
  check(width+'缺少历史摘要保持未知',await page.evaluate(()=>pr('p1').fileCheck.files.find(f=>f.kind==='program').state==='unknown'));
  check(width+'配置和 unit 摘要一致',await page.evaluate(()=>pr('p1').fileCheck.files.filter(f=>f.kind!=='program').every(f=>f.state==='same')));
  check(width+'核对无部署副作用',unchanged===await page.evaluate(()=>JSON.stringify([pr('p1').cfg,pr('p1').appliedSnapshot,pr('p1').serverReadSnapshot,S.operations,pr('p1').runtime])));
  await layout(page,width+'核对后');await shot(page,'systemd-checked-'+width);
  await click(page,'projectmore',{id:'p1'});await click(page,'projectdraft',{id:'p1'},'#modal');
  check(width+'草稿在独立弹窗',await page.getByRole('heading',{name:'项目草稿与更新 · catalog-api',exact:true}).isVisible());
  await shot(page,'project-draft-'+width);
  await page.keyboard.press('Escape');
  check(width+'Escape 返回项目',await page.locator('#modal').evaluate(el=>!el.open));
  check(width+'焦点返回更多',await page.locator('[data-action="projectmore"]').evaluate(el=>el===document.activeElement));
  await click(page,'projectmore',{id:'p1'});await click(page,'projectdraft',{id:'p1'},'#modal');
  await click(page,'asset-update',{id:'p1'},'#modal');
  check(width+'保留差异查看入口',await page.getByRole('heading',{name:'查看可用更新 · catalog-api',exact:true}).isVisible());
  await page.keyboard.press('Escape');
  for(const state of ['changed','missing','unknown']){
   await click(page,'scenes');await click(page,'loadscene',{id:'files-'+state},'#modal');
   await page.waitForFunction(expected=>pr('p1').fileCheck?.files.find(f=>f.kind==='config')?.state===expected&&!projectFileReads.has('p1'),state);
   await layout(page,width+' '+state);
   if(state==='unknown'){
    check(width+'失败保留历史',await page.getByText('历史观测 · 已过期',{exact:true}).count()>=1);
    await shot(page,'systemd-read-failed-'+width);
    const saved=await page.evaluate(()=>JSON.stringify(pr('p1').fileCheck));
    await page.reload();await ready(page);
    check(width+'刷新保留核对结果',saved===await page.evaluate(()=>JSON.stringify(pr('p1').fileCheck)));
   }
   checks.push(width+' '+state+'真实场景按钮');
  }
  for(const [id,type] of [['p2','compose'],['frp-n1-client','frp']]){
   if(width<820)await click(page,'navtoggle');
   await click(page,'navigate',{page:'projects'},'.sidebar-navigation');await click(page,'project',{id},'#main');await click(page,'tab',{id:'config'});
   check(width+' '+type+'固定信息卡片',await page.getByRole('heading',{name:'已应用配置与文件',exact:true}).count()===1);
   check(width+' '+type+'无 systemd 核对控件',await page.locator('[data-action="checkprojectfiles"]').count()===0);
   if(type==='compose'){
    check(width+' Compose 固定旧端口',await page.getByRole('table',{name:'Compose 固定服务'}).getByText('8090:80',{exact:true}).count()===1);
    check(width+' Compose 不显示草稿端口',!(await page.locator('#main').innerText()).includes('8091:80'));
   }
   await layout(page,width+' '+type);await shot(page,type+'-'+width);
   await click(page,'projectmore',{id});await click(page,'projectdraft',{id},'#modal');
   check(width+' '+type+'草稿弹窗',await page.locator('#dialog-title').innerText()!==null);
   if(type==='frp'){
    await click(page,'frp-read',{id},'#modal');await click(page,'frp-read',{id,fail:'true'},'#modal');
    check(width+' FRP 旧读取入口可用',(await page.locator('#modal').innerText()).includes('旧结果'));
   }
   await page.keyboard.press('Escape');
  }
  await context.close();
 }
 check('浏览器无脚本及静态资源错误',errors.length===0);
 await writeFile(path.join(out,'browser-results.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
 console.log(JSON.stringify({passed:checks.length,errors,screenshots:out}));
}finally{await browser.close();}
