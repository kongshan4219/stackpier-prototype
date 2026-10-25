'use strict';

// 端口预览固定管理配置与各条规则的 Zone；采集时间和展示文案不作为配置漂移。
function firewallPortConfiguration(id){
 const host=firewallHost(id);if(!host)return null;
 return clone({state:host.state,manager:host.manager,backend:host.backend,serviceManager:host.serviceManager,configuration:host.configuration,revision:host.revision,defaultPolicy:host.defaultPolicy,zones:host.zones,blockers:host.blockers});
}
function firewallPortBinding(id,records){
 const error=firewallWriteError(id);if(error)throw Error(error);
 const zones={};for(const rule of records){const zone=firewallChosenZone(id,firewallRuleZone(rule));if(!zone)throw Error('规则未绑定已核实的 Zone，不能生成预览。');zones[rule.id]=zone;}
 return {server:serverOperationSnapshot(id),configuration:firewallPortConfiguration(id),zones};
}
function firewallPortBindingError(binding,records){
 if(!binding?.server||!binding.configuration||!binding.zones)return '缺少固定管理配置与 Zone 快照，请重新预览；历史操作保留只读。';
 const id=binding.server.id;
 if(serverSnapshotError(binding.server))return '服务器身份或连接状态已变化，请重新核对。';
 if(JSON.stringify(firewallPortConfiguration(id))!==JSON.stringify(binding.configuration))return '防火墙管理配置或 Zone 在预览后变化，不能执行旧意图。';
 if(binding.configuration.state!=='ready'||binding.configuration.manager!=='firewalld'||binding.configuration.backend!=='nftables'||binding.configuration.configuration!=='consistent')return '固定观测不满足统一防火墙写入条件。';
 if(!records.length||records.some(rule=>rule.server!==id||!binding.zones[rule.id]||rule.zone&&rule.zone!==binding.zones[rule.id]||!binding.configuration.zones.some(zone=>zone.name===binding.zones[rule.id])))return '固定规则与 Zone 归属不一致，请重新预览。';
 return '';
}
function firewallPortOperationError(input){
 if(input?.netType!=='firewall'||input.action==='setup')return '';
 return firewallPortBindingError(input.binding,input.action==='port-batch'?input.records||[]:input.record?[input.record]:[]);
}
function firewallBoundZone(rule,binding){return binding?.zones?.[rule.id]||rule.zone||'历史范围待核对';}
function firewallExportSelection(rows){
 if(!rows.length)throw Error('没有可导出的端口规则。');
 const zones=new Set(rows.map(rule=>firewallChosenZone(rule.server,firewallRuleZone(rule))));
 if(zones.size!==1||zones.has(''))throw Error('导出仅支持一个明确 Zone；当前包含多个或未知作用范围，请只勾选同一 Zone 的规则后导出。');
 return {zone:[...zones][0],file:{format:'stackpier-port-rules',version:1,rules:rows.map(firewallTransferRule)}};
}
