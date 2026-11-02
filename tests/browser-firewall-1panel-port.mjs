import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright-core');
const base=process.env.STACKPIER_PREVIEW_URL,output=process.env.STACKPIER_SCREENSHOTS;
assert.ok(base&&new URL(base).hostname==='127.0.0.1');assert.ok(output?.startsWith('/srv/cache/stackpier-tmp/'));
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
const checks=[],errors=[];
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS '+name)};
const button=(p,name)=>p.getByRole('button',{name:new RegExp(name.split('').join('\\s*'))}).first();
async function select(p,label,text){await p.getByRole('combobox',{name:label,exact:true}).click();await p.locator('.ant-select-dropdown:visible').getByText(text,{exact:true}).click()}
async function tab(p,name){await p.getByRole('tab',{name,exact:true}).click()}
async function confirm(p){await p.getByRole('dialog').last().getByRole('button',{name:'确认（模拟）'}).click();await p.waitForTimeout(800)}
try{
 const p=await browser.newPage({viewport:{width:1440,height:1100}});p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:'))errors.push('unexpected request '+r.url())});
 await p.goto(base+'/?firewall=1panel#firewall');await p.locator('.fw-port').waitFor();
 check('四页导航',await p.locator('.fw-port [role=tab]').count()===4);
 await button(p.locator('.fw-port'),'创建').click();await p.getByLabel('目标端口（可输入多项）').fill('65536');await p.getByRole('button',{name:'提交（模拟）'}).last().click();check('非法端口拒绝',await p.getByRole('alert').filter({hasText:'端口须为'}).isVisible());
 await p.getByLabel('目标端口（可输入多项）').fill('18081');await p.getByRole('button',{name:'提交（模拟）'}).last().click();check('确认固定目标',await p.getByRole('dialog').last().innerText().then(t=>t.includes('192.0.2.10')));await button(p.getByRole('dialog').last(),'取消').click();check('取消没有添加规则',await p.locator('.fw-port').innerText().then(t=>!t.includes('18081')));
 await p.getByRole('button',{name:'提交（模拟）'}).last().click();await confirm(p);check('创建回显',await p.locator('.fw-port').innerText().then(t=>t.includes('18081')));
 await button(p.locator('.fw-port'),'导入').click();await p.getByLabel('JSON',{exact:true}).fill('{}');check('导入格式拒绝',await p.getByRole('alert').filter({hasText:'JSON 数组'}).isVisible());await p.getByLabel('JSON',{exact:true}).fill('[{"protocol":"tcp","destinationPort":"18082","action":"accept"}]');await p.getByRole('dialog').getByRole('button',{name:'提交（模拟）'}).click();await confirm(p);check('导入创建',await p.locator('.fw-port').innerText().then(t=>t.includes('18082')));
 const download=p.waitForEvent('download');await button(p.locator('.fw-port'),'导出').click();check('导出 JSON 下载',(await download).suggestedFilename()==='system-rules.json');
 await select(p,'目标服务器','演示主机 B · 192.0.2.11');check('切服务器不串规则',await p.locator('.fw-port').innerText().then(t=>!t.includes('18081')&&t.includes('ufw')));await select(p,'目标服务器','演示主机 A · 192.0.2.10');check('原服务器状态保留',await p.locator('.fw-port').innerText().then(t=>t.includes('18081')));
 await tab(p,'Docker 端口防护');check('Docker 容器分组',await p.locator('.fw-docker-grid .ant-card').count()===2);await button(p.locator('.fw-docker-grid .ant-card').first(),'详情').click();await button(p.locator('.ant-drawer:visible .ant-card').first(),'设置').click();check('Docker 策略编辑',await p.getByLabel('防护模式').isVisible());await p.keyboard.press('Escape');await p.keyboard.press('Escape');
 await tab(p,'端口转发');await button(p.locator('.fw-port'),'创建').click();await p.getByLabel('源端口',{exact:true}).fill('18083');await p.getByLabel('目标端口',{exact:true}).fill('8083');await p.getByRole('button',{name:'提交（模拟）'}).last().click();await confirm(p);check('转发空目标为回环',await p.locator('.fw-port').innerText().then(t=>t.includes('127.0.0.1')&&t.includes('18083')));
 await tab(p,'设置');await select(p,'system 后端','nftables');await confirm(p);await tab(p,'系统防火墙');check('直接后端绑定入口',await button(p.locator('.fw-port'),'解绑').isVisible());
 await tab(p,'端口转发');await button(p.locator('.fw-port'),'重置').click();check('重置默认备份',await p.getByRole('checkbox',{name:'重置前备份'}).isChecked());await confirm(p);check('重置清空本子系统',await p.locator('.fw-port').innerText().then(t=>!t.includes('18083')));await button(p.locator('.fw-port'),'初始化').click();await p.getByLabel('从备份初始化').click();await p.locator('.ant-select-dropdown:visible .ant-select-item-option').last().click();await confirm(p);check('从备份恢复模拟规则',await p.locator('.fw-port').innerText().then(t=>t.includes('18083')));
 await tab(p,'设置');await p.getByRole('switch',{name:'IPv6 支持'}).click();await confirm(p);check('IPv6 设置模拟更新',await p.getByRole('switch',{name:'IPv6 支持'}).getAttribute('aria-checked')==='false');await tab(p,'系统防火墙');
 await p.getByText('原型审阅工具 · 不进入正式界面',{exact:true}).click();await select(p,'下次模拟结果','部分成功');await button(p.locator('.fw-port'),'导入').click();await p.getByLabel('JSON',{exact:true}).fill('[{"protocol":"tcp","destinationPort":"18085","action":"accept"},{"protocol":"tcp","destinationPort":"18086","action":"accept"}]');await p.getByRole('dialog').getByRole('button',{name:'提交（模拟）'}).click();await confirm(p);check('批次部分成功不冒充全成功',await p.locator('.fw-port').innerText().then(t=>t.includes('18085')&&!t.includes('18086')));
await select(p,'审阅场景','读取失败');check('读取失败禁止写入',await button(p.locator('.fw-port'),'创建').isDisabled());await select(p,'审阅场景','正常');await select(p,'下次模拟结果','响应丢失 / 结果未知');await button(p.locator('.fw-port'),'创建').click();await p.getByLabel('目标端口（可输入多项）').fill('18084');await p.getByRole('button',{name:'提交（模拟）'}).last().click();await confirm(p);check('未知结果阻止新写入',await button(p.locator('.fw-port'),'创建').isDisabled());await p.getByText(/模拟任务记录 ·/).click();check('沿原操作核对',await p.getByRole('button',{name:'核对原操作'}).isVisible());
 await p.getByRole('button',{name:'适配裁决记录'}).click();check('六项裁决记录',await p.locator('.ant-drawer:visible .ant-card').count()===6);await p.keyboard.press('Escape');
 for(const width of [1440,390,320]){
  await p.setViewportSize({width,height:1100});
  for(const name of ['系统防火墙','Docker 端口防护','端口转发','设置']){await tab(p,name);check(`${width} ${name} 无页面横向溢出`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${output}/${width}-${['系统防火墙','Docker 端口防护','端口转发','设置'].indexOf(name)}.png`,fullPage:true})}
 }
 await p.reload();await p.locator('.fw-port').waitFor();await p.setViewportSize({width:390,height:844});await button(p,'浅色').click();check('深色主题',await p.locator('html').getAttribute('data-theme')==='dark');await button(p.locator('.fw-port'),'创建').click();await p.getByLabel('来源 IP / CIDR（可输入多项）').fill('192.0.2.7');await p.getByLabel('来源 IP / CIDR（可输入多项）').press('Enter');check('回车添加来源行',await p.getByLabel('规则条目1',{exact:true}).count()===1);await p.waitForFunction(()=>{const e=document.querySelector('.ant-drawer-content-wrapper');if(!e)return false;const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1});check('窄屏抽屉在视口内',await p.locator('.ant-drawer-content-wrapper:visible').last().evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1}));await p.screenshot({path:output+'/390-dark-editor.png'});await p.keyboard.press('Escape');await p.locator('.ant-drawer-content-wrapper').last().waitFor({state:'hidden'});check('Escape 关闭抽屉',await p.locator('.ant-drawer-content-wrapper:visible').count()===0);
 check('无页面错误或外部请求',errors.length===0);
 await writeFile(output+'/report.json',JSON.stringify({checks,errors},null,2));
}finally{await browser.close()}
