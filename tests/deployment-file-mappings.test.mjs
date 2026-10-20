import assert from 'node:assert/strict';
import test from 'node:test';
import {prototype} from './prototype-harness.mjs';

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
