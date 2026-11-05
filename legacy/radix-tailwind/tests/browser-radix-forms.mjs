import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.STACKPIER_PREVIEW_URL,out=process.env.STACKPIER_SCREENSHOTS;
assert.ok(base&&['127.0.0.1','localhost'].includes(new URL(base).hostname)&&out);
await mkdir(out,{recursive:true});
const checks=[],errors=[];let lastPage;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
const check=(label,ok)=>{assert.ok(ok,label);checks.push(label)};
async function ready(page,hash){await page.goto(base+'/'+hash);await page.waitForFunction(()=>prototypeLoading.ready);}
async function action(page,name,scope='#main'){await page.locator(scope+' [data-action="'+name+'"]').first().click();}
async function modalLayout(page,label){
 const rects=await page.locator('#modal [role=dialog]').evaluate(el=>{
  const bounds=el.getBoundingClientRect(),footer=el.querySelector('.dialog-footer').getBoundingClientRect(),body=el.querySelector('.dialog-body');
  return {fits:bounds.left>=-1&&bounds.right<=innerWidth+1&&bounds.top>=0&&bounds.bottom<=innerHeight+1,footer:footer.bottom<=innerHeight&&footer.top>=bounds.top,scroll:getComputedStyle(body).overflowY==='auto'};
 });
 check(label+' / modal in viewport',rects.fits);check(label+' / footer visible',rects.footer);check(label+' / body owns scrolling',rects.scroll);
}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},locale:'zh-CN'});
  const page=await context.newPage();lastPage=page;page.on('pageerror',e=>errors.push(e.message));
  for(const [route,entry]of [['servers','serveredit'],['programs','programupload'],['dns','dnsedit'],['firewall','firewalledit']]){
   await ready(page,'#'+route);if(route==='firewall')await page.locator('[data-filter=server]').selectOption('s1');await action(page,entry);await modalLayout(page,width+' / '+entry);await page.keyboard.press('Escape');
  }
  for(const type of ['systemd','compose','frp']){
   await ready(page,'#templates?dialog=templateedit&type='+type);await modalLayout(page,width+' / '+type);
   await page.screenshot({path:out+'/'+type+'-editor-'+width+'.png'});
   await page.keyboard.press('Escape');
  }
  await ready(page,'#templates?dialog=templateedit&type=compose');
  await page.getByLabel('配置名称',{exact:true}).fill('radix compose '+width);
  const source='services:\n  web:\n    image: example.test/web:fixture\n';
  await page.getByLabel('Compose YAML 正文').fill(source);await page.getByLabel('显式变量（JSON）').fill('{"MODE":3}');
  await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' / invalid variables preserved',await page.getByRole('alert').innerText().then(t=>t.includes('字符串')));
  check(width+' / source preserved',await page.getByLabel('Compose YAML 正文').inputValue()===source);
  await page.getByLabel('显式变量（JSON）').fill('{"MODE":"demo"}');await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' / compose saved',await page.evaluate(n=>S.templates.some(t=>t.name===n&&t.variables==='{"MODE":"demo"}'),'radix compose '+width));
  await ready(page,'#templates');await action(page,'asset-template');check(width+' / asset drawer',await page.locator('#asset-details [role=dialog]').isVisible());
  if(await page.locator('#asset-details [data-action="asset-file"]').count()){
   await action(page,'asset-file','#asset-details');check(width+' / nested asset history',await page.locator('#asset-details [data-action="asset-back"]').isVisible());
   await action(page,'asset-back','#asset-details');check(width+' / asset back',await page.locator('#asset-details').innerText().then(t=>t.includes('部署配置')));
  }
  await page.keyboard.press('Escape');check(width+' / asset close',await page.locator('#asset-details').evaluate(el=>!el.open));
  if(width===390){
   await page.getByRole('button',{name:'打开导航'}).click();await page.locator('.navigation-drawer [data-page="servers"]').click();await page.waitForFunction(()=>document.querySelector('.page-heading h1')===document.activeElement);
   check('mobile / title receives navigation focus',await page.locator('.page-heading h1').evaluate(el=>el===document.activeElement));
   await page.getByRole('button',{name:'打开导航'}).click();await page.keyboard.press('Escape');await page.locator('.navigation-drawer').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.mobile-nav-trigger')===document.activeElement);check('mobile / Escape restores navigation trigger',await page.getByRole('button',{name:'打开导航'}).evaluate(el=>el===document.activeElement));
  }
  await page.evaluate(()=>StackPierUI.action('logout'));check(width+' / login',await page.getByRole('heading',{name:'欢迎回到栈桥'}).isVisible());
  await action(page,'fillpassword');await page.getByRole('button',{name:'登录',exact:true}).click();check(width+' / demo login',await page.locator('.page-heading h1').innerText()==='工作空间');
  await page.evaluate(()=>{S.projects[0].name='long-project-name-with-many-words-and-中文混合字符-0123456789';navigate('projects')});
  check(width+' / long name layout',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await context.close();
 }
 check('no browser errors',errors.length===0);await writeFile(out+'/results.json',JSON.stringify({passed:checks.length,checks,errors},null,2));console.log(JSON.stringify({passed:checks.length,errors}));
}finally{if(lastPage&&!lastPage.isClosed()){console.log(await lastPage.evaluate(()=>({dialogs:[...document.querySelectorAll('[role=dialog]')].map(e=>e.className),focus:document.activeElement?.tagName,body:document.body.style.pointerEvents,nav:document.querySelector('.mobile-nav-trigger')?.getAttribute('aria-expanded')})));await lastPage.screenshot({path:out+'/last-state.png'})}await writeFile(out+'/partial-results.json',JSON.stringify({checks,errors},null,2));await browser.close()}
