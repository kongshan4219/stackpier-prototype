import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';

const source='services:\n  app:\n    image: example/app:demo\n';
function createTemplate(p,files=['catalog-service'],paths=['/srv/example/bin/catalog']){
 p.click('templateedit');p.submit('templateedit',{'tpl-name':'映射配置','tpl-type':'compose','tpl-source':source,'tpl-map-file':files,'tpl-map-path':paths});
 return JSON.parse(p.run('JSON.stringify(S.templates.find(template=>template.name==="映射配置"))'));
}
function error(p){return p.document.getElementById('modal-error').textContent;}

test('正文和映射分为两个区域，逻辑文件下的架构变体统一选择并固定修订',()=>{
 const p=prototype();p.click('templateedit');p.click('template-map-add');const html=p.html('modal');
 assert.match(html,/附带文件映射/);assert.match(html,/部署正文/);assert.match(html,/catalog-service · x86_64 \/ aarch64/);assert.match(html,/架构选择规则/);assert.match(html,/查看文件/);assert.match(html,/移除引用/);
 const template=createTemplate(p);assert.equal(template.fileMappings[0].groupId,'asset-bin1');assert.deepEqual(template.fileMappings[0].pins,[{fileId:'bin1',revision:1},{fileId:'bin2',revision:1}]);
});
test('多项映射保存稳定 ID 和固定修订，移除引用不删除公共文件',()=>{
 const p=prototype(),template=createTemplate(p,['catalog-service','catalog-config.yaml',''],['/srv/app/bin/api','/srv/app/app.conf','']);
 assert.equal(template.fileMappings.length,2);p.click('templateedit',{id:template.id});assert.equal(p.document.getElementById('tpl-map-file-0').value,'asset-bin1');assert.equal(p.document.getElementById('tpl-map-path-1').value,'/srv/app/app.conf');
 const files=p.run('S.programs.length');p.click('template-map-remove',{index:1});assert.equal(p.run('ui.modal.fileMappings.length'),1);assert.equal(p.run('S.programs.length'),files);
});
test('空映射允许保存，半行、未知文件、重复目标和超过上限拒绝保存',()=>{
 assert.deepEqual(createTemplate(prototype(),[],[]).fileMappings,[]);
 const cases=[[['catalog-service'],[''],/绝对路径|同时选择/],[[''],['/srv/app/file'],/同时选择/],[['missing'],['/srv/app/file'],/不存在或不可部署/],[['catalog-service','catalog-service'],['/srv/app/file','/srv/app/file'],/重复/],[Array(21).fill('catalog-service'),Array.from({length:21},(_,i)=>'/srv/app/'+i),/最多 20/]];
 for(const [files,paths,message] of cases){const p=prototype(),before=p.run('S.templates.length');p.click('templateedit');p.submit('templateedit',{'tpl-name':'invalid','tpl-type':'compose','tpl-source':source,'tpl-map-file':files,'tpl-map-path':paths});assert.match(error(p),message);assert.equal(p.run('S.templates.length'),before);}
});
test('规范绝对路径、重复主部署路径、缺失文件和占位都阻止执行',()=>{
 for(const path of ['relative/file','/','/srv/app/','/srv//app/file','/srv/../app/file','/srv/./file','/srv/app\nfile','/'+'a'.repeat(4096)]){const p=prototype();assert.ok(p.run(`targetFilePathError(${JSON.stringify(path)})`));}
 const p=prototype();p.run('pr("p2").cfg.fileMappings=[pinMapping({file:"catalog-config.yaml",targetPath:"/srv/stackpier-demo/media-web/compose.yaml"})];');assert.match(p.run('deploymentLocation(pr("p2")).errors.join()'),/路径冲突/);assert.equal(p.run('startOperation(pr("p2"),"apply",{},"success",{hold:true})'),null);
 p.run('frpEnsure();');assert.equal(p.run('deploymentFiles().some(file=>file.name==="frps")'),false);
 assert.throws(()=>p.run('validateMappings([pinMapping({file:"frps",targetPath:"/srv/app/frps"})])'),/占位/);
 assert.throws(()=>p.run('validateMappings([{file:"missing",targetPath:"/srv/app/file",pins:[{fileId:"missing",revision:1}]}])'),/不存在/);
});
test('x86_64 和 aarch64 选择对应固定修订；缺架构阻塞而不使用其他变体',()=>{
 const p=prototype();p.run('const mapping=tpl("t1").fileMappings[0];');assert.equal(p.run('pinnedMappingFile(mapping,sr("s2")).id'),'bin1');assert.equal(p.run('pinnedMappingFile(mapping,sr("s3")).id'),'bin2');
 p.run('pr("p2").server="s3";sr("s3").state="online";pr("p2").cfg.fileMappings=[{...mapping,pins:[{fileId:"bin1",revision:1}],targetPath:"/srv/app/catalog"}];');assert.match(p.run('deploymentLocation(pr("p2")).errors.join()'),/缺少匹配架构 aarch64/);
 p.run('pr("p2").cfg.fileMappings=[pinMapping({file:"catalog-config.yaml",targetPath:"/srv/app/config"})];');assert.equal(p.run('deploymentLocation(pr("p2")).files[0].binary.arch'),'any');
});
test('通用文件不能作为 systemd 主程序，架构限定规则不跨服务器匹配',()=>{
 const p=prototype();p.run('pr("p1").cfg.programRef=pinMapping({file:"catalog-config.yaml"});');assert.equal(p.run('projectProgramFile(pr("p1"))'),null);
 p.run('const rule={...tpl("t1").fileMappings[0],architectureRule:"x86_64"};');assert.equal(p.run('pinnedMappingFile(rule,sr("s3"))'),null);assert.equal(p.run('pinnedMappingFile(rule,sr("s2")).id'),'bin1');
});
test('预览与公共配置保存不改变项目，确认采用只改变当前项目草稿',()=>{
 const p=prototype(),template=createTemplate(p);p.click('newproject',{template:template.id});p.submit('newproject',{'np-template':template.id,'np-name':'mapped-project','np-server':'s1'});assert.equal(p.run('S.projects.some(project=>project.name==="mapped-project")'),false);p.click('deployment-preview-execute');const id=p.run('S.operations[0].project');p.run('finishOperation(S.operations[0],"success");');
 const applied=p.run(`JSON.stringify(pr(${JSON.stringify(id)}).appliedSnapshot)`),read=p.run(`JSON.stringify(pr(${JSON.stringify(id)}).serverReadSnapshot)`);
 p.click('templateedit',{id:template.id});p.submit('templateedit',{'tpl-name':'映射配置','tpl-type':'compose','tpl-source':source,'tpl-map-file':['catalog-service'],'tpl-map-path':['/opt/mapped/catalog']});
 p.click('adopttemplate',{id});assert.equal(p.run(`pr(${JSON.stringify(id)}).cfg.fileMappings[0].targetPath`),'/srv/example/bin/catalog');p.click('asset-update-adopt',{id});assert.equal(p.run(`pr(${JSON.stringify(id)}).cfg.fileMappings[0].targetPath`),'/opt/mapped/catalog');assert.equal(p.run(`JSON.stringify(pr(${JSON.stringify(id)}).appliedSnapshot)`),applied);assert.equal(p.run(`JSON.stringify(pr(${JSON.stringify(id)}).serverReadSnapshot)`),read);
});
