import assert from 'node:assert/strict';
import test from 'node:test';
import { prototype } from './prototype-harness.mjs';

function installed(roles = ['server']) {
  const p = prototype(undefined, { hash: '#frp' });
  p.run(`const items=${JSON.stringify(roles.map(role => ({ node: 'n4', role })))};const frpInitial=frpRun(items,'deploy',{binary:true,identity:true,impact:true,hold:true});frpFinish(frpInitial,'success');`);
  return p;
}

test('模板认证占位不可删、硬编码或重复，未知及错角色占位拒绝', () => {
  const p = prototype(undefined, { hash: '#frp' });
  const original = p.run('delete frpNode("n4").sourceSettings;S.frp.templates["frpc.toml.tpl"]');
  const invalid = [
    original.replace('auth.token = "${auth_token}"\n', ''),
    original.replace('${auth_token}', 'DEMO_NODE_TOKEN'),
    original + '\nauth.token = "DEMO_SECOND_TOKEN"\n',
    original + '\n[auth]\ntoken = "DEMO_SECOND_TOKEN"\n',
    original + '\nauth . "token" = "DEMO_SECOND_TOKEN"\n',
    original + '\n["auth"]\ntoken = "DEMO_SECOND_TOKEN"\n',
    original + '\n${arbitrary_command}\n',
    original + '\n${visitors}\n',
    original.replace('serverAddr = "${server_ip}"', '# ${server_ip}\nserverAddr = "192.0.2.123"'),
  ];
  for (const source of invalid) {
    p.click('frp-template', { id: 'frpc.toml.tpl' });
    p.submit('frp-template', { 'ft-source': source });
    assert.equal(p.document.getElementById('modal-error').hidden, false);
    assert.equal(p.run('delete frpNode("n4").sourceSettings;S.frp.templates["frpc.toml.tpl"]'), original);
  }
});

test('固定占位支持参考包两种写法及字面美元，不读取环境或执行表达式', () => {
  const p = prototype(undefined, { hash: '#frp' });
  p.run('delete frpNode("n4").sourceSettings;S.frp.templates["frpc.toml.tpl"]=S.frp.templates["frpc.toml.tpl"].replace(/\\$\\{([a-z_]+)\\}/g,"$$$1")+"\\n# $$literal\\n";');
  assert.equal(p.run('frpValidate().length'), 0);
  assert.match(p.run('frpFiles(frpNode("n4"),"client").toml'), /# \$literal/);
  assert.throws(() => p.run('frpSubstitute("${process.env.SECRET}",{})'));
});
