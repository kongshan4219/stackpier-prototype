'use strict';

const scenes=[
 {id:'saved',title:'保存了配置，但还没有应用',desc:'新端口留在草稿，远端旧端口并不因此异常。'},
 {id:'stop-failed',title:'你要求停止，但停止失败',desc:'命令报错后仍核对实际状态，未停止就记录失败。'},
 {id:'update-partial',title:'更新部分完成后失败',desc:'保留已交付内容，不假装全部旧版或自动回退。'},
 {id:'deploy-failed',title:'新项目部署失败',desc:'失败项目进入失败记录，可清理服务器残留。'},
 {id:'deploy-partial',title:'首次部署部分完成',desc:'项目不加入列表，已写入的文件与数据在失败记录中处理。'},
 {id:'deploy-unknown',title:'新项目部署结果未知',desc:'归入失败记录；核对原操作结束后再清理残留。'},
 {id:'ssh-unknown',title:'SSH 断线，结果待核对',desc:'已有观测保留；先核对原操作，不盲目重放。'},
 {id:'uninstall-dns',title:'服务卸载了，DNS 没删成功',desc:'项目已卸载，关联清理部分失败，定时巡检已暂停。'},
 {id:'redeploy',title:'卸载后复用保留数据',desc:'明确核对数据来源，重新部署后巡检仍待手工恢复。'},
 {id:'host-changed',title:'主机身份发生变化',desc:'不自动信任新主机，不把编辑地址当成跨机迁移。'},
 {id:'access',title:'首次设置与登录',desc:'体验现有原型的访问流程，不使用真实认证。'},
 {id:'empty',title:'空实例，从头开始',desc:'从接入服务器、建立配置到部署新项目连续体验。'}
];
