'use strict';
function frpImpactTable(role){return `<div class="table-wrap"><table><thead><tr><th>受影响连接</th><th>角色 / 安装主机</th><th>保存后的处理</th></tr></thead><tbody>${frpAffectedRoles(role).map(({node,role,project})=>`<tr><td>${h(node.ip)}</td><td>${h(frpRoles[role])}<p class="cell-sub">${h(sname(frpHost(node,role)))}</p></td><td>${project?.frpApplied?'保留草稿和已应用参照；明确采用后再应用':'提示可用更新，需采用到指定草稿'}</td></tr>`).join('')}</tbody></table></div>`;}
function frpSyncConnectionServerFields(){}
