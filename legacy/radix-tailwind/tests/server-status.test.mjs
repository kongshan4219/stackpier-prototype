import test from 'node:test';
import assert from 'node:assert/strict';
import { prototype } from './prototype-harness.mjs';

test('服务器页定时保留信息，离页和隐藏标签后停止', () => {
 const app=prototype();
 app.run("ui.auth=false;navigate('servers');S.servers[0].checked='2020-01-01';S.servers[0].state='unknown';");
 const original=app.run('JSON.stringify([S.servers[0].os,S.servers[0].arch,S.servers[0].fp])');
 assert.notEqual(app.run('serverStatusTimer'),null);
 app.flushTimers();
 assert.notEqual(app.run('S.servers[0].checked'),'2020-01-01');
 assert.equal(app.run('S.servers[0].state'),'unknown');
 assert.equal(app.run('JSON.stringify([S.servers[0].os,S.servers[0].arch,S.servers[0].fp])'),original);
 app.run("navigate('projects');S.servers[0].checked='2020-01-01';");
 assert.equal(app.run('serverStatusTimer'),null);
 app.flushTimers();
 assert.equal(app.run('S.servers[0].checked'),'2020-01-01');
 app.run("navigate('servers');document.hidden=true;syncServerStatusTimer();");
 assert.equal(app.run('serverStatusTimer'),null);
 app.run('document.hidden=false;syncServerStatusTimer();');
 assert.notEqual(app.run('serverStatusTimer'),null);
});
