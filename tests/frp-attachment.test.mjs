import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {prototype} from './prototype-harness.mjs';
import {referencePrototype,simulatePrograms} from './frp-fixtures.mjs';
const json=(p,code)=>JSON.parse(p.run('JSON.stringify('+code+')'));
const conditions={identity:true,impact:true,hold:true};
function attachment(){const p=prototype(undefined,{hash:'#frp'});p.click('frp-reference-load');p.click('frp-reference-confirmload');return p;}

test('附件四节点、八映射、两默认目标，与静态 config.json 逐字段一致；工作编辑保留',()=>{
 const p=prototype(undefined,{hash:'#frp'});p.run('frpNode("n1").proxies[0].name="user-edited";frpNode("n1").revision++;persist();');
 const before=p.run('JSON.stringify(S.frp)');p.click('frp-reference-load');assert.equal(p.run('S.frp.nodes[0].proxies[0].name'),'user-edited');p.click('frp-reference-confirmload');
 const source=JSON.parse(readFileSync(new URL('./fixtures/frp-reference/config.json',import.meta.url)));
 const expected=source.servers;const actual=json(p,'S.frp.nodes').map(({id,revision,provider,arch,...node})=>node);assert.deepEqual(actual,expected);
 assert.equal(p.run('frpSelectTargets("client").map(n=>n.ip).join(",")'),'198.51.100.20,192.0.2.40');
 assert.equal(p.run('frpSelectTargets("client","all").length'),4);assert.equal(p.run('frpSelectTargets("server").length'),4);
 assert.equal(p.run('frpSelectTargets("client","specified","ref-n1")[0].client_enabled'),false);
 assert.equal(p.run('frpValidate().length'),0);
 const reloaded=prototype(p.saved(),{hash:'#frp'});reloaded.click('frp-profile-toggle');assert.equal(reloaded.run('JSON.stringify(S.frpProfiles.workspace)'),before);assert.equal(reloaded.run('frpNode("n1").proxies[0].name'),'user-edited');
});

test('10 份 TOML 与 10 份 unit 对照附件生成文件；安装 unit 和依赖一致',()=>{
 const p=attachment();for(const n of json(p,'S.frp.nodes'))for(const role of ['client','server',...(n.proxies.some(x=>x.type==='stcp')?['visitor']:[])]){
  const f=json(p,`frpFiles(frpNode(${JSON.stringify(n.id)}),${JSON.stringify(role)})`),prefix={client:'frpc',server:'frps',visitor:'frpc-visitor'}[role];
  assert.equal(f.toml,readFileSync(new URL(`./fixtures/frp-reference/generated/${prefix}/${n.ip}.toml`,import.meta.url),'utf8'));
  assert.equal(f.unit,readFileSync(new URL(`./fixtures/frp-reference/generated/${prefix}/${n.ip}.service`,import.meta.url),'utf8'));
  assert.equal(f.generatedUnit,`generated/${prefix}/${n.ip}.service`);
  assert.equal(f.unitPath,`/etc/systemd/system/${n.ip}${role==='visitor'?'-visitor':''}.service`);
  assert.ok(f.unit.includes('ExecStart='+f.binaryPath+' -c '+f.tomlPath));
  if(role==='visitor'){assert.equal(f.binaryPath,'/srv/services/frp/bin/frpc');assert.ok(f.unit.includes('After=network-online.target '+n.ip+'.service'));}
 }
});

test('严格校验布尔值、非空鉴权、整数端口和规范化重复节点',()=>{
 for(const [mutation,pattern] of [
  ['frpNode("ref-n1").client_enabled="false"','必须为布尔值'],['S.frp.token=true','token 不能为空'],
  ['frpNode("ref-n1").bind_port=true','1–65535'],['frpNode("ref-n1").proxies[0].remote_port=65536','1–65535'],
  ['frpNode("ref-n1").proxies[0].local_port=1.5','1–65535'],['frpNode("ref-n3").proxies[2].secret_key=1','密钥不能为空'],
  ['frpNode("ref-n3").proxies[2].visitor_bind_addr="0.0.0.0"','回环'],
  ['frpNode("ref-n2").ip=frpNode("ref-n1").ip','已存在连接'],
  ['frpNode("ref-n1").proxies[1].name="http"','代理名称不合法或重复'],
 ]){const p=attachment();p.run(mutation);assert.match(p.run('frpValidate().join("；")'),new RegExp(pattern));}
 const p=attachment();assert.equal(p.run('frpNormalizeIP("2001:0db8:0000:0:0:0:0:1")'),'2001:db8::1');
 p.run('frpNode("ref-n1").ip="2001:db8::1";frpNode("ref-n2").ip="2001:0db8:0:0:0:0:0:1";');assert.match(p.run('frpValidate().join("；")'),/已存在连接/);
});

test('按实际监听主机与地址冲突；跨服务器同端口及本地目标复用允许',()=>{
 const p=attachment();assert.equal(p.run('frpValidate().length'),0);
 p.run('frpNode("ref-n1").bind_addr="127.0.0.1";frpNode("ref-n1").bind_port=18080;');assert.match(p.run('frpValidate().join("；")'),/控制监听.*TCP.*冲突/);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"::",port:7000},{host:"a",addr:"0.0.0.0",port:7000})'),true);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"127.0.0.1",port:7000},{host:"b",addr:"127.0.0.1",port:7000})'),false);
 assert.equal(p.run('frpListenerOverlap({host:"a",addr:"127.0.0.1",port:7000},{host:"a",addr:"127.0.0.2",port:7000})'),false);
 p.run('frpNode("ref-n1").bind_port=7000;frpNode("ref-n1").proxies[1].local_port=80;');assert.equal(p.run('frpValidate().length'),0);
});

test('STCP provider / visitor 始终引用同一名称和密钥，TCP-only 不生成 visitor',()=>{
 const p=attachment();p.run('frpNode("ref-n3").proxies[2].secret_key="DEMO_CHANGED_PAIR";');
 assert.match(p.run('frpFiles(frpNode("ref-n3"),"client").toml'),/secretKey = "DEMO_CHANGED_PAIR"/);
 assert.match(p.run('frpFiles(frpNode("ref-n3"),"visitor").toml'),/serverName = "example-database"[\s\S]*secretKey = "DEMO_CHANGED_PAIR"/);
 assert.doesNotMatch(p.run('frpFiles(frpNode("ref-n3"),"visitor").toml'),/remotePort/);
 assert.equal(p.run('frpConfigurationPlan(frpNode("ref-n1")).items.some(x=>x.role==="visitor")'),false);
});
