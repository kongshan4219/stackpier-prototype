// 当前 Web UI 构建使用虚构 API 替身；原型使用隔离浏览器状态。交互均通过真实输入事件。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STACKPIER_PREVIEW_URL,actual=process.env.STACKPIER_ACTUAL_URL,out=process.env.STACKPIER_SCREENSHOTS;
assert.ok(base&&actual&&out,'显式指定原型、本次实际构建与证据目录');
for(const url of [base,actual])assert.ok(['127.0.0.1','localhost'].includes(new URL(url).hostname));
await mkdir(out,{recursive:true});
const checks=[],errors=[],source='services:\n  web:\n    image: example.test/web:fixture\n';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);};
async function boot(page,hash='#templates'){await page.goto(base+'/'+hash);await page.waitForFunction(()=>prototypeLoading.ready);}
async function action(page,name,data={}){await page.locator('[data-action="'+name+'"]'+Object.entries(data).map(([key,value])=>'[data-'+key+'="'+value+'"]').join('')).first().click();}
async function capture(page,name){await page.screenshot({path:path.join(out,name+'.png')});}
async function fields(page){return page.locator('dialog[open]').evaluate(dialog=>[...dialog.querySelectorAll('input,select,textarea')].map(el=>({
 label:(el.labels?.[0]?.querySelector('span')||el.labels?.[0])?.textContent.trim(),tag:el.tagName,type:el.type,required:el.required,disabled:el.disabled,readOnly:!!el.readOnly,min:el.getAttribute('min'),max:el.getAttribute('max'),rows:el.tagName==='TEXTAREA'?el.rows:null,
})));}
async function fitting(page,label){check(label+'无横向溢出',await page.locator('dialog[open]').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1));}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},locale:'zh-CN'});
  const page=await context.newPage(),reference=await context.newPage();
  for(const item of [page,reference])item.on('pageerror',error=>errors.push(error.message));
  await reference.route('**/api/**',route=>{
   const name=new URL(route.request().url()).pathname.split('/').at(-1);
   return route.fulfill({json:name==='assets'?[{id:'qa-program',name:'fixture-program',kind:'program',arch:'x86_64',sha256:'a'.repeat(64)},{id:'qa-config',name:'fixture-config.json',kind:'config',sha256:'b'.repeat(64)}]:[]});
  });
  // systemd 已进入正文与路径映射设计阶段，独立浏览器回归不再与旧正式编辑器对照。
  for(const type of ['compose','frp']){
   await reference.goto(actual+'/deployment-configurations?edit=new&type='+type);
   await reference.getByRole('heading',{name:'新增部署配置',exact:true}).waitFor();
   await boot(page,'#templates?dialog=templateedit&type='+type);
   assert.deepEqual(await fields(page),await fields(reference),width+' '+type+'字段与实际界面一致');checks.push(width+' '+type+'字段顺序、必填、只读和数值范围一致');
   check(width+' '+type+'弹窗宽度一致',Math.abs((await page.locator('#modal').boundingBox()).width-(await reference.getByRole('dialog').boundingBox()).width)<2);
   if(type==='compose')check(width+' Compose 删除规则提示一致',await page.getByText('会删除远程映射目录内多余文件和子目录',{exact:false}).isVisible()&&await reference.getByText('会删除远程映射目录内多余文件和子目录',{exact:false}).isVisible());
   await fitting(page,width+' '+type);
   await capture(reference,'actual-'+type+'-'+width);await capture(page,'prototype-'+type+'-'+width);
   await page.keyboard.press('Escape');check(width+' '+type+' Escape 关闭',await page.locator('#modal').evaluate(el=>!el.open));
  }
  await boot(page);
  await action(page,'templateedit',{id:'t5'});await page.getByLabel('Compose YAML 正文').fill(source);
  await page.getByLabel('显式变量（JSON）').fill('{"MODE":3}');await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' 变量错误留在编辑器',await page.getByRole('alert').innerText().then(text=>text.includes('字符串')));
  await page.getByLabel('显式变量（JSON）').fill('{"MODE":"demo"}');
  await page.getByRole('button',{name:'添加映射',exact:true}).click();
  await page.getByLabel('映射 1 本机绝对路径',{exact:true}).fill('/srv/source.conf');
  await page.getByLabel('映射 1 远程绝对路径',{exact:true}).fill('/srv/output.conf/');
  await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' 文件映射拒绝目录后缀',(await page.getByRole('alert').innerText()).includes('绝对路径'));
  await page.getByLabel('映射 1 远程绝对路径',{exact:true}).fill('/srv/output.conf');
  await page.getByRole('button',{name:'添加映射',exact:true}).click();
  await page.getByLabel('映射 2 类型',{exact:true}).selectOption('directory');
  await page.getByLabel('映射 2 本机绝对路径',{exact:true}).fill('/srv/input-dir/');
  await page.getByLabel('映射 2 远程绝对路径',{exact:true}).fill('/srv/output-dir/');
  check(width+' 两行映射按选择保留',await page.evaluate(()=>ui.modal.editor.mappings.length===2));
  await fitting(page,width+' 映射编辑');await capture(page,'prototype-mappings-'+width);
  const savedBeforeFailure=await page.evaluate(()=>JSON.stringify([S.templates,S.projects]));
  // 仅注入存储失败，仍通过真实保存按钮验证失败与重试。
  await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};});
  await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' 存储失败明确报错',(await page.getByRole('alert').innerText()).includes('本次未保存'));
  check(width+' 存储失败不改变配置和项目',await page.evaluate(()=>JSON.stringify([S.templates,S.projects]))===savedBeforeFailure);
  check(width+' 存储失败保留正文与映射',await page.getByLabel('Compose YAML 正文').inputValue()===source&&await page.evaluate(()=>ui.modal.editor.mappings.length===2));
  await page.evaluate(()=>{Storage.prototype.setItem=window.qaSetItem;delete window.qaSetItem;});
  await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  await action(page,'newproject',{template:'t5'});await page.getByLabel('目标服务器').selectOption('s4');await page.getByLabel('服务名称').fill('qa-compose');
  await page.getByRole('button',{name:'前往部署配置管理',exact:true}).click();
  await page.getByLabel('Compose YAML 正文').fill(source+'# draft\n');
  await page.getByRole('button',{name:'返回部署（不保存）',exact:true}).click();
  check(width+' 返回部署保留目标与名称',await page.getByLabel('服务名称').inputValue()==='qa-compose'&&await page.getByLabel('目标服务器').inputValue()==='s4');
  await page.getByRole('button',{name:'前往部署配置管理',exact:true}).click();
  check(width+' 返回编辑保留 Compose 草稿',(await page.getByLabel('Compose YAML 正文').inputValue()).endsWith('# draft\n'));
  await page.getByRole('button',{name:'保存并返回部署',exact:true}).click();
  check(width+' 保存后返回且仍需预览',await page.getByRole('button',{name:'检查并预览',exact:true}).isVisible());
  await page.getByRole('button',{name:'检查并预览',exact:true}).click();
  check(width+' 固定预览显示目录完全同步',(await page.locator('#modal').innerText()).includes('完全同步，删除多余条目'));
  await capture(page,'prototype-mirror-preview-'+width);
  await page.keyboard.press('Escape');await boot(page,'#templates?dialog=templateedit&type=frp');
  await page.getByLabel('认证 Token',{exact:true}).fill('DEMO_UNSAVED_BROWSER_TOKEN');
  await page.getByLabel('FRP 服务角色').selectOption('client');
  check(width+' 换角色清空 Token',await page.getByLabel('认证 Token',{exact:true}).inputValue()==='');
  check(width+' FRPC 地址与端口只读',await page.getByLabel('FRPC 初始未连接地址').evaluate(el=>el.readOnly)&&await page.getByLabel('FRP 控制端口',{exact:true}).inputValue()==='9');
  await page.getByLabel('配置名称',{exact:true}).fill('QA FRP browser');await page.getByLabel('FRP 程序固定版本').selectOption('bin1@1');
  await page.getByLabel('认证 Token',{exact:true}).fill('DEMO_BROWSER_TOKEN_FIXED');
  await page.getByLabel('允许映射端口起点').fill('27101');
  await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  check(width+' 保留端口冲突拒绝保存',(await page.getByRole('alert').innerText()).includes('保留端口'));
  await capture(page,'frp-error-'+width);
  await page.getByLabel('允许映射端口起点').fill('27110');await page.getByRole('button',{name:'保存部署配置',exact:true}).click();
  const id=await page.evaluate(()=>S.templates.find(t=>t.name==='QA FRP browser').id);await action(page,'templateedit',{id});
  check(width+' 保存后角色不可改且 Token 不回填',await page.getByLabel('FRP 服务角色').isDisabled()&&await page.getByLabel('认证 Token',{exact:true}).inputValue()==='');
  await page.keyboard.press('Escape');
  check(width+' 焦点返回原编辑按钮',await page.locator('[data-action="templateedit"][data-id="'+id+'"]').evaluate(el=>el===document.activeElement));
  check(width+' 未保存 Token 不进入存储',!(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).includes('DEMO_UNSAVED_BROWSER_TOKEN'));
  await context.close();
 }
 check('浏览器无脚本错误',errors.length===0);
 await writeFile(path.join(out,'browser-results.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
 console.log(JSON.stringify({passed:checks.length,errors}));
}finally{await browser.close();}
