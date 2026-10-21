// systemd 正文与路径映射的原型设计回归；所有表单操作使用真实浏览器输入事件。
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.STACKPIER_PLAYWRIGHT_MODULE||'playwright');
const base=process.env.STACKPIER_PREVIEW_URL,out=process.env.STACKPIER_SCREENSHOTS;
assert.ok(base&&out,'显式指定原型地址与证据目录');
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'仅使用本机隔离原型');
await mkdir(out,{recursive:true});
const checks=[],errors=[];
const source='\n\n[Unit]\nDescription=QA fixture service\nAfter=network.target\n\n[Service]\nType=simple\nExecStart=/srv/qa-fixture/program --config /srv/qa-fixture/settings.conf\nRestart=on-failure\n\n[Install]\nWantedBy=multi-user.target\n';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM,args:['--no-sandbox']});
const check=(name,result)=>{assert.ok(result,name);checks.push(name);};
async function boot(page,hash='#templates'){await page.goto(base+'/'+hash);await page.waitForFunction(()=>prototypeLoading.ready);}
async function action(page,name,data={}){await page.locator('[data-action="'+name+'"]'+Object.entries(data).map(([key,value])=>'[data-'+key+'="'+value+'"]').join('')).first().click();}
async function capture(page,name){await page.screenshot({path:path.join(out,name+'.png')});}
async function fitting(page,label){check(label+'无横向溢出',await page.locator('dialog[open]').evaluate(el=>el.scrollWidth<=el.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1));}
async function savedState(page){return page.evaluate(()=>JSON.stringify([S.templates,S.projects,S.operations]));}
async function projectSnapshots(page){return page.evaluate(()=>JSON.stringify(S.projects.map(p=>[p.id,p.cfg,p.applied,p.appliedSnapshot,p.serverReadSnapshot])));}
async function save(page){await page.getByRole('button',{name:'保存部署配置',exact:true}).click();}
async function mapping(page,index,kind,localPath,remotePath){
 await page.getByLabel('映射 '+index+' 类型',{exact:true}).selectOption(kind);
 await page.getByLabel('映射 '+index+' 本机绝对路径',{exact:true}).fill(localPath);
 await page.getByLabel('映射 '+index+' 远程绝对路径',{exact:true}).fill(remotePath);
}
try{
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===1440?960:844},locale:'zh-CN'});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await boot(page,'#templates?dialog=templateedit&type=systemd');
  const initialState=await savedState(page);
  check(width+' 新建提供必填服务文件正文',await page.getByLabel('服务文件正文',{exact:true}).evaluate(el=>el.tagName==='TEXTAREA'&&el.required));
  check(width+' 新建不再选择固定程序配置或健康端口',await page.locator('#tpl-program,#tpl-config,#tpl-port').count()===0);
  check(width+' 新建不增加 Compose 变量字段',await page.locator('#tpl-variables').count()===0);
  check(width+' 显示 systemd 运行状态与独立健康检查边界',(await page.locator('#modal').innerText()).includes('运行状态')&&(await page.locator('#modal').innerText()).includes('后续单独配置'));
  await fitting(page,width+' systemd 初始编辑器');await capture(page,'prototype-systemd-unit-'+width);
  await page.getByLabel('配置名称',{exact:true}).fill('QA systemd browser '+width);
  await save(page);
  check(width+' 空正文由浏览器必填阻止保存',await page.getByLabel('服务文件正文',{exact:true}).evaluate(el=>el.validity.valueMissing)&&await savedState(page)===initialState);
  await page.getByLabel('服务文件正文',{exact:true}).fill('   ');await save(page);
  check(width+' 空白正文明确报错',(await page.getByRole('alert').innerText()).includes('服务文件正文'));
  await page.getByLabel('服务文件正文',{exact:true}).fill(source);
  await page.getByRole('button',{name:'添加映射',exact:true}).click();
  await mapping(page,1,'file','/srv/qa-input/settings.conf','/srv/qa-fixture/settings.conf/');await save(page);
  check(width+' 文件映射拒绝目录后缀',(await page.getByRole('alert').innerText()).includes('绝对路径'));
  check(width+' 映射错误保留正文',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source);
  await page.getByLabel('映射 1 本机绝对路径',{exact:true}).fill('relative.conf');await save(page);
  check(width+' 相对来源路径被浏览器拒绝',await page.getByLabel('映射 1 本机绝对路径',{exact:true}).evaluate(el=>el.validity.patternMismatch));
  await mapping(page,1,'file','/srv/qa-input/settings.conf','/srv/qa-fixture/settings.conf');
  await page.getByRole('button',{name:'添加映射',exact:true}).click();
  await mapping(page,2,'directory','/srv/qa-input/assets/','/srv/qa-fixture/settings.conf/nested/');await save(page);
  check(width+' 重叠远程路径拒绝保存',(await page.getByRole('alert').innerText()).includes('不能重复或相互包含'));
  await capture(page,'prototype-systemd-unit-mapping-error-'+width);
  await page.getByLabel('映射 2 远程绝对路径',{exact:true}).fill('/proc/qa-fixture/');await save(page);
  check(width+' 受保护远程目录拒绝保存',(await page.getByRole('alert').innerText()).includes('系统运行目录'));
  await page.getByLabel('映射 2 远程绝对路径',{exact:true}).fill('/srv/qa-fixture/assets/');
  await page.getByRole('button',{name:'添加映射',exact:true}).click();
  check(width+' 可添加第三条映射',await page.getByRole('group',{name:'映射 3',exact:true}).count()===1);
  await action(page,'configuration-mapping-remove',{index:2});
  check(width+' 移除指定映射保留其余输入',await page.getByRole('group',{name:'映射 3',exact:true}).count()===0&&await page.getByLabel('映射 2 远程绝对路径',{exact:true}).inputValue()==='/srv/qa-fixture/assets/');
  check(width+' 显示与 Compose 一致的完全同步规则',(await page.locator('#modal').innerText()).includes('会删除远程映射目录内多余文件和子目录'));
  await fitting(page,width+' systemd 两行映射');await capture(page,'prototype-systemd-unit-mappings-'+width);
  await page.getByLabel('配置类型',{exact:true}).selectOption('compose');
  await page.getByLabel('Compose YAML 正文',{exact:true}).fill('services:\n  qa:\n    image: example.test/qa:fixture\n');
  await page.getByLabel('配置类型',{exact:true}).selectOption('systemd');
  check(width+' 切换类型恢复 systemd 正文与映射',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source&&await page.getByLabel('映射 1 远程绝对路径',{exact:true}).inputValue()==='/srv/qa-fixture/settings.conf');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  check(width+' 取消不保存配置或创建项目',await savedState(page)===initialState);
  await action(page,'templateedit');
  check(width+' 重开新建保留同会话 systemd 草稿',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source&&await page.getByRole('group',{name:'映射 2',exact:true}).count()===1);
  const beforeFailure=await savedState(page);
  // 仅注入浏览器存储故障；保存与重试仍通过按钮触发。
  await page.evaluate(()=>{window.qaSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};});
  await save(page);
  check(width+' 存储失败明确拒绝保存',(await page.getByRole('alert').innerText()).includes('本次未保存'));
  check(width+' 存储失败不改变配置项目操作',await savedState(page)===beforeFailure);
  check(width+' 存储失败保留正文与映射',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source&&await page.getByRole('group',{name:'映射 2',exact:true}).count()===1);
  await page.evaluate(()=>{Storage.prototype.setItem=window.qaSetItem;delete window.qaSetItem;});
  await save(page);
  const id=await page.evaluate(name=>S.templates.find(t=>t.name===name).id,'QA systemd browser '+width);
  const record=await page.evaluate(id=>structuredClone(tpl(id)),id);
  check(width+' 保存新正文结构与规范化目录路径',record.editorSchema===2&&record.tpl===source&&record.pathMappings[1].localPath==='/srv/qa-input/assets'&&record.pathMappings[1].remotePath==='/srv/qa-fixture/assets');
  check(width+' 新配置不保留旧端口和固定资产引用',record.port===null&&record.programRef===null&&record.configRef===null&&record.fileMappings.length===0);
  await action(page,'templateedit',{id});
  check(width+' 已保存配置类型不可更改',await page.getByLabel('配置类型',{exact:true}).isDisabled());
  await page.getByLabel('服务文件正文',{exact:true}).fill(source+'# unsaved refresh\n');await page.reload();await page.waitForFunction(()=>prototypeLoading.ready);
  check(width+' 刷新恢复已保存正文与映射',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source&&await page.getByLabel('映射 2 远程绝对路径',{exact:true}).inputValue()==='/srv/qa-fixture/assets');
  await page.keyboard.press('Escape');
  check(width+' Escape 关闭 systemd 编辑器',await page.locator('#modal').evaluate(el=>!el.open));

  const old=await page.evaluate(()=>structuredClone(tpl('t1'))),projectsBefore=await projectSnapshots(page);
  await action(page,'templateedit',{id:'t1'});
  check(width+' 旧配置打开保留原正文',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===old.tpl);
  await page.getByLabel('服务文件正文',{exact:true}).fill(source+'# converted legacy fixture\n');
  await page.getByRole('button',{name:'取消',exact:true}).click();
  check(width+' 旧配置取消不转换保存结构',await page.evaluate(before=>JSON.stringify(tpl('t1'))===before,JSON.stringify(old)));
  await action(page,'templateedit',{id:'t1'});await save(page);
  check(width+' 旧配置明确保存生成新修订',await page.evaluate(rev=>tpl('t1').editorSchema===2&&tpl('t1').rev===rev+1,old.rev));
  check(width+' 旧公共配置保存不改变项目正文与固定快照',await projectSnapshots(page)===projectsBefore);
  check(width+' 旧公共配置历史修订保留原内容',await page.evaluate(old=>tpl('t1').revisions.some(r=>r.rev===old.rev&&r.tpl===old.tpl&&r.port===old.port),old));

  await action(page,'newproject',{template:id});
  await page.getByLabel('目标服务器',{exact:true}).selectOption('s4');await page.getByLabel('服务名称',{exact:true}).fill('qa-systemd-'+width);
  await page.getByRole('button',{name:'前往部署配置管理',exact:true}).click();
  await page.getByLabel('服务文件正文',{exact:true}).fill(source+'# returned draft\n');
  await page.getByRole('button',{name:'返回部署（不保存）',exact:true}).click();
  check(width+' 返回部署保留服务器名称与配置',await page.getByLabel('目标服务器',{exact:true}).inputValue()==='s4'&&await page.getByLabel('服务名称',{exact:true}).inputValue()==='qa-systemd-'+width&&await page.getByLabel('部署配置',{exact:true}).inputValue()===id);
  await page.getByRole('button',{name:'检查并预览',exact:true}).click();
  check(width+' 未保存草稿不进入固定预览',await page.evaluate(expected=>ui.modal.draft.cfg.source===expected,source));
  await page.getByRole('button',{name:'前往部署配置管理',exact:true}).click();
  check(width+' 预览返回编辑恢复未保存草稿',await page.getByLabel('服务文件正文',{exact:true}).inputValue()===source+'# returned draft\n');
  await page.getByRole('button',{name:'保存并返回部署',exact:true}).click();
  check(width+' 保存返回部署仍须明确预览',await page.getByRole('button',{name:'检查并预览',exact:true}).isVisible());
  const projectCount=await page.evaluate(()=>S.projects.length),operationCount=await page.evaluate(()=>S.operations.length);
  await page.getByRole('button',{name:'检查并预览',exact:true}).click();
  const fixed=await page.evaluate(()=>structuredClone(ui.modal.draft.cfg)),previewText=await page.locator('#modal').innerText();
  check(width+' 预览固定已保存正文修订与映射',fixed.systemdMode==='unit'&&fixed.source===source+'# returned draft\n'&&fixed.templateRev===record.rev+1&&fixed.pathMappings.length===2&&fixed.pathMappings[1].deleteExtraneous===true);
  check(width+' 预览正文不可编辑',await page.locator('#modal textarea').count()===0);
  check(width+' 预览呈现服务文件落点',previewText.includes('qa-systemd-'+width+'.service'));
  check(width+' 预览采用 systemd 状态核验',previewText.includes('运行状态')&&previewText.includes('后续单独配置')&&!previewText.includes('/health'));
  check(width+' 预览呈现固定映射及目录删除规则',previewText.includes('/srv/qa-fixture/settings.conf')&&previewText.includes('/srv/qa-fixture/assets')&&previewText.includes('完全同步，删除多余条目'));
  check(width+' 合法输入允许模拟部署',await page.getByRole('button',{name:'执行模拟部署',exact:true}).isEnabled());
  await fitting(page,width+' systemd 固定预览');await capture(page,'prototype-systemd-unit-preview-'+width);
  await page.keyboard.press('Escape');
  check(width+' 取消预览不建立项目或操作',await page.evaluate(counts=>S.projects.length===counts.projects&&S.operations.length===counts.operations,{projects:projectCount,operations:operationCount}));
  await context.close();
 }
 check('浏览器无脚本错误',errors.length===0);
 await writeFile(path.join(out,'browser-systemd-results.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
 console.log(JSON.stringify({passed:checks.length,errors}));
}finally{await browser.close();}
