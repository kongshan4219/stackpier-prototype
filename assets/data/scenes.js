'use strict';

const scenes=[
 {id:'normal-backup',title:'服务运行，同时进行备份',desc:'运行状态保持可见；备份作为另一条操作继续。'},
 {id:'saved',title:'保存了配置，但还没有应用',desc:'新端口留在草稿，远端旧端口并不因此异常。'},
 {id:'stop-failed',title:'你要求停止，但停止失败',desc:'查看真实仍运行与停止目标如何同时显示。'},
 {id:'temporary-stop',title:'为备份临时停止服务',desc:'临时停服不改变长期运行目标，可查看安全收尾。'},
 {id:'update-partial',title:'更新部分完成后失败',desc:'保留已交付内容，不假装全部旧版或自动回退。'},
 {id:'deploy-partial',title:'首次部署没有完成',desc:'已经写入部分文件，但核心交付并未完成。'},
 {id:'ssh-unknown',title:'SSH 断线，结果待核对',desc:'已有观测保留；先核对原操作，不盲目重放。'},
 {id:'uninstall-dns',title:'服务卸载了，DNS 没删成功',desc:'项目已卸载，关联清理部分失败，计划已暂停。'},
 {id:'restore-start',title:'数据恢复了，但启动失败',desc:'数据恢复和启动分别记录，后续只处理启动。'},
 {id:'backup-conflict',title:'备份期间提交冲突更新',desc:'更新影响共享 MySQL，被拒绝、不排队、不取消备份。'},
 {id:'redeploy',title:'卸载后复用保留数据',desc:'明确核对数据来源，重新部署后计划仍待手工恢复。'},
 {id:'schedule-skip',title:'计划重叠或错过',desc:'上次未结束就跳过；错过不补跑，不偷跑前置清理。'},
 {id:'replica-init',title:'初始化一个新只读副本',desc:'主库只检查，已有业务数据目标拒绝，新空库才允许。'},
 {id:'host-changed',title:'主机身份发生变化',desc:'不自动信任新主机，不把编辑地址当成跨机迁移。'},
 {id:'access',title:'首次设置与登录',desc:'体验现有原型的访问流程，不使用真实认证。'},
 {id:'empty',title:'空实例，从头开始',desc:'从接入服务器、建立配置到部署新项目连续体验。'}
];
