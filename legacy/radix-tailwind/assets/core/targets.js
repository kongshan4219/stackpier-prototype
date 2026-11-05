'use strict';

// 所有主机操作共用观察事实；勾选身份确认不能覆盖离线或待核对状态。
function serverOperationError(id){
 const server=sr(id);
 if(!server)return '目标服务器不存在；请明确选择目标。';
 if(server.state!=='online')return sname(id)+'：'+({unknown:'待核对',offline:'离线',changed:'主机身份不匹配',denied:'权限不足',failed:'检查失败'}[server.state]||'连接 / 授权未核对')+'，请在服务器详情执行模拟检查；不会自动切换服务器。';
 if(server.permission===false||server.authorized===false||server.checkFailed)return sname(id)+'：权限不足或检查失败，不能执行主机操作。';
 return '';
}
function serverOperationSnapshot(id){const s=sr(id);return s?{id:s.id,name:s.name,host:s.host,user:s.user,arch:s.arch,fp:s.fp,port:s.port,state:s.state,checked:s.checked||null}:null;}
function selectedServer(explicit){return explicit!==undefined&&explicit!==null?explicit:ui.server!=='all'?ui.server:'';}

function serverSnapshotError(target){if(!target)return '固定服务器参照缺失';const err=serverOperationError(target.id);if(err)return err;const s=sr(target.id);if(['host','user','arch',...['fp','port'].filter(key=>Object.hasOwn(target,key))].some(key=>s[key]!==target[key]))return '服务器身份或架构在确认后发生变化，请重新核对原目标';return '';}
