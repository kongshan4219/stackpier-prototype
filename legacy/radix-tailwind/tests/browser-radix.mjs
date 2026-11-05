import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.STACKPIER_PREVIEW_URL||'http://127.0.0.1:4339';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=process.env.STACKPIER_SCREENSHOTS;assert.ok(output);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
const checks=[],errors=[];
function check(label,value){assert.ok(value,label);checks.push(label)}
async function layout(page,label){check(label+' / no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
async function shot(page,name){await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});}
async function action(page,name,data={},scope='') {await page.locator(`${scope} [data-action="${name}"]${Object.entries(data).map(([k,v])=>`[data-${k}="${v}"]`).join('')}`.trim()).first().click();}
async function ready(page){await page.waitForFunction(()=>prototypeLoading.ready&&window.RadixPrototype?.ready);}
try {
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?1000:844},locale:'zh-CN',timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push(m.text())});
  await page.goto(base+'/#projects');await ready(page);
  check(width+' / real Radix runtime',await page.evaluate(()=>!window.AntPrototype&&document.querySelectorAll('[class*="ant-"]').length===0));
  check(width+' / records visible in first screen',await page.locator('.project-record').first().evaluate(el=>el.getBoundingClientRect().top<innerHeight-100));
  await page.locator('#global-search').fill('catalog');check(width+' / search',await page.locator('.project-record').count()===1);
  await page.locator('#global-search').fill('nothing-matches');check(width+' / filtered empty',await page.getByRole('heading',{name:'没有符合条件的项目'}).isVisible());
  await page.getByRole('button',{name:'清除筛选',exact:true}).click();
  await page.getByRole('radio',{name:'卡片',exact:true}).click();check(width+' / card view',await page.locator('.project-cards').count()===1);
  await page.getByRole('radio',{name:'列表',exact:true}).click();
  await page.locator('.pending-trigger').click();check(width+' / recovery evidence retained',await page.locator('.pending-content').isVisible());await page.locator('.pending-trigger').click();
  await action(page,'newproject');check(width+' / Radix modal',await page.getByRole('dialog').count()===1);
  await shot(page,`deploy-type-${width}`);
  for(let i=0;i<12;i++)await page.keyboard.press('Tab');check(width+' / trapped focus',await page.evaluate(()=>!!document.activeElement.closest('[role="dialog"]')));
  await page.keyboard.press('Escape');check(width+' / restored focus',await page.locator('[data-action="newproject"]').evaluate(el=>el===document.activeElement));
  await action(page,'newproject');await action(page,'deployment-type',{type:'systemd'},'#modal');
  check(width+' / native required fields',await page.locator('#np-name').getAttribute('required')!==null);
  await page.locator('#np-name').fill('radix-demo');await page.locator('#np-server').selectOption('s2');
  const template=await page.locator('#np-template option').evaluateAll(options=>options.find(o=>o.value)?.value);await page.locator('#np-template').selectOption(template);
  await page.getByRole('button',{name:'检查并预览',exact:true}).click();check(width+' / deployment preview preserves name',await page.locator('#modal').innerText().then(s=>s.includes('radix-demo')));
  await page.keyboard.press('Escape');if(await page.locator('#modal').evaluate(el=>el.open))await page.locator('#modal [data-action="closemodal"]').first().click();
  await page.goto(base+'/#project?project=p1&tab=config');await ready(page);
  await action(page,'checkprojectfiles',{id:'p1'});await page.waitForFunction(()=>pr('p1').fileCheck?.files.length===3&&!projectFileReads.has('p1'));
  check(width+' / managed files',await page.locator('.file-observation').count()===3);
  await action(page,'projectmore',{id:'p1'});await action(page,'projectdraft',{id:'p1'},'#modal');check(width+' / independent draft',await page.locator('#modal').innerText().then(s=>s.includes('项目草稿与更新')));await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'日志',exact:true}).click();check(width+' / detail tab route',page.url().includes('tab=logs'));await page.goBack();check(width+' / browser back',await page.getByRole('tab',{name:'配置',exact:true}).getAttribute('data-state')==='active');
  for(const theme of ['light','dark']){
   if(theme==='dark')await page.getByRole('button',{name:'切换主题'}).click();
   check(width+' / '+theme+' theme',await page.locator('html').getAttribute('data-theme')===theme);
   for(const route of ['overview','servers','projects','templates','programs','frp','monitor','firewall','dns','operations','settings','project?project=p1&tab=overview','projects?section=failures']){
    await page.goto(base+'/#'+route);await ready(page);await layout(page,`${width} / ${theme} / ${route}`);
    check(`${width} / ${theme} / ${route} content`,await page.locator('#main').innerText().then(s=>s.trim().length>20));
    await shot(page,`${route.replace(/[^a-z0-9]+/g,'-')}-${width}-${theme}`);
   }
  }
  await page.goto(base+'/#projects');await ready(page);
  for(const state of ['加载中','空状态','读取失败']){
   await page.getByRole('button',{name:'原型工具'}).click();await page.getByRole('menuitemradio',{name:state,exact:true}).click();check(width+' / '+state,await page.locator('.review-state').isVisible());await page.locator('.review-state button').click();
  }
  if(width===390){await page.getByRole('button',{name:'打开导航'}).click();check('mobile / navigation dialog',await page.locator('.navigation-drawer').isVisible());await page.locator('.navigation-drawer [data-page="servers"]').click();check('mobile / close after navigation',await page.locator('.navigation-drawer').count()===0);check('mobile / navigation route',page.url().endsWith('#servers'));}
  await page.goto(base+'/?firewall=1panel#firewall');await ready(page);await page.locator('.fw-port').waitFor();
  await page.getByRole('button',{name:'创建',exact:true}).first().click();await page.getByLabel('来源 IP / CIDR（可输入多项）').fill('192.0.2.7');
  await page.getByLabel('来源 IP / CIDR（可输入多项）').press('Enter');check(width+' / rule multi-input',await page.getByLabel('规则条目1',{exact:true}).count()===1);
  await layout(page,width+' / firewall editor');await shot(page,`firewall-editor-${width}`);await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'设置',exact:true}).click();await page.getByRole('switch',{name:'IPv6 支持',exact:true}).click();check(width+' / setting confirmation',await page.getByRole('dialog').isVisible());await page.keyboard.press('Escape');
  await context.close();
 }
 // Check both sides of the navigation breakpoint and the smallest supported width.
 const responsive=await browser.newContext({locale:'zh-CN'}),page=await responsive.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [320,768,820,821,1024]){
  await page.setViewportSize({width,height:900});
  for(const route of ['overview','servers','projects','templates','programs','frp','monitor','firewall','dns','operations','settings','project?project=p1&tab=overview','projects?section=failures']){
   await page.goto(base+'/#'+route);await ready(page);await layout(page,`${width} / responsive / ${route}`);
  }
 }
 await responsive.close();
 check('no browser errors',errors.length===0);
 await writeFile(path.join(output,'results.json'),JSON.stringify({checks:checks.length,passed:checks,errors},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}));
}finally{await writeFile(path.join(output,'partial-results.json'),JSON.stringify({checks,errors},null,2));await browser.close()}
