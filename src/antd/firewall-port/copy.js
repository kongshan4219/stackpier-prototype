// 上游字段与流程的中文审阅文案；模拟和待决提示为 StackPier 适配。
export const c={
 confirmProvider:"输入后端名称确认重置",
 reviewTools:'原型审阅工具 · 不进入正式界面',unavailable:'不可用',read:'已读取',disabled:'未启用',publicScope:'Zone · public',basicScope:'1PANEL_BASIC_BEFORE / 1PANEL_BASIC / 1PANEL_BASIC_AFTER',verify:'核对原操作',verifyResult:' · 模拟核对：未确认成功，未重发',custom:'自定义',panel:'面板',
 add:'添加',ruleItem:'规则条目',selectAll:'全选',effective:'已匹配发布路径',ineffective:'未生效 / 孤立策略',orphanHint:'此端点不再匹配容器发布路径；保留策略供查看或删除。',mixedFamily:'混合地址族仅允许全部拒绝；按来源限制请分开设置。',
 title:'防火墙',intro:'管理系统入站规则、Docker 发布端口与端口转发。',source:'1Panel v2.4.0 · 04099ae2',simulation:'浏览器交互原型 · 所有服务器和结果均为虚构，不执行系统命令',
 server:'目标服务器',scenario:'审阅场景',outcome:'下次模拟结果',review:'适配裁决记录',legacy:'查看当前 StackPier 原型',create:'创建',edit:'编辑',remove:'删除',batch:'批量删除',import:'导入',export:'导出',refresh:'刷新',reset:'重置',initialize:'初始化',bind:'绑定',unbind:'解绑',repair:'修复',start:'启动',stop:'停止',restart:'重启',cancel:'取消',submit:'提交（模拟）',confirm:'确认（模拟）',close:'关闭',search:'搜索端口、IP 或描述',all:'全部',protocol:'协议',sourceIP:'来源 IP',port:'目标端口',action:'策略',description:'描述',priority:'位置 / 优先级',family:'地址族',operations:'操作',raw:'原始规则',detail:'详情',protected:'受保护规则',opaque:'无法完整解析',whitelist:'端口白名单',settings:'设置',noRules:'暂无匹配规则',accept:'允许',drop:'拒绝',reject:'拒绝并响应',running:'运行中',stopped:'已停止',bound:'已绑定',unbound:'未绑定',backup:'重置前备份',restore:'从备份初始化',backupNone:'不加载备份',task:'模拟任务记录',back:'返回修改',taskDetail:'操作详情',pending:'D1–D6 已裁决；完整原型已确认',
 tabs:[['system','系统防火墙'],['docker','Docker 端口防护'],['forwarding','端口转发'],['settings','设置']],
 scenes:[['normal','正常'],['empty','空数据'],['read-failed','读取失败'],['ipv6-failed','IPv6 不可用'],['uninstalled','未安装'],['stopped','已停止 / 未绑定'],['conflict','后端冲突'],['readonly','无写入权限']],
 outcomes:[['success','成功'],['failed','命令失败'],['partial','部分成功'],['unknown','响应丢失 / 结果未知']],
 sceneText:{'empty':'本场景无规则，不代表实际主机没有过滤。','read-failed':'读取失败：保留上次数据；不能把失败当空规则。','ipv6-failed':'IPv6 命令族不可用；IPv4 观察仍可查看。','uninstalled':'所选后端未安装。请核对目标工具；原型不安装软件。','stopped':'服务停止或基础链未绑定，规则尚未生效。','conflict':'默认探测发现 firewalld 与 UFW 同时安装，按 1Panel 报错；请先处理工具冲突。','readonly':'当前用户没有节点管理权限，仅可查看。'},
 statusHint:'服务型后端管理启停；iptables / nftables 管理基础链。状态为模拟观察。',
 fields:{sourceAddress:'来源 IP / CIDR（可输入多项）',destinationPort:'目标端口（可输入多项）',protocol:'协议',action:'策略',description:'描述',priority:'优先级 / 插入位置',family:'地址族',port:'源端口',targetIP:'目标 IP（留空为回环地址）',targetPort:'目标端口',interface:'入站网卡',mode:'防护模式',sources:'来源 IP / CIDR',type:'白名单类型'},
 modes:[['deny_sources','拒绝指定来源'],['allow_sources','仅允许指定来源'],['deny_all','全部拒绝']],
 errors:{port:'端口须为 1–65535 或有效范围。',address:'请输入有效 IP 或 CIDR，且与地址族一致。',required:'请填写至少一个来源或端口。',limit:'组合展开不能超过 500 条。',single:'编辑只接受单条原子规则。',json:'文件必须是 JSON 数组，且字段有效。',size:'文件超过当前模块导入限制。',duplicate:'存在重复规则，请核对后再提交。',protected:'受保护的规则不能删除或更改规则内容。',stale:'目标已切换或观察已变化，请重新打开。',priority:'firewalld 优先级须在 -32768 到 32767；位置须为正整数。'},
 importHelp:'选择 JSON 文件后核对条目；系统规则 64 MiB，Docker / 转发 256 KiB、500 条。使用 1Panel 规则格式，不支持旧 stackpier-port-rules 格式。',
 confirmHelp:'请核对目标服务器与操作内容。此处仅为浏览器模拟，不执行真实命令。',
 resetHelp:'按 1Panel 对应后端和子系统清理规则并停止服务／解绑。默认先备份，也可仅重置；联动遵循上游条件。本次仅模拟。',
 dockerRestart:'同时重启 Docker（有流量影响）',ipv6:'IPv6 支持',ping:'禁止 Ping',backend:'后端',backendHint:'选择不等于安装或自动迁移；四类后端的管理范围不同。',portWhitelistHint:'上游含面板端口与 SSH 端口；StackPier 的远端 SSH 路径及控制端端口映射待决定。',
 result:{queued:'已受理，等待模拟完成',success:'模拟完成；不代表真实规则已生效',failed:'模拟命令失败；保留错误与原目标',partial:'模拟部分成功；逐项结果保留，不报告整批成功',unknown:'响应丢失，结果未知；不得按新操作重发'},
 decisions:[
 ['D1 · 管理器识别（已确认）','上游按工具存在和优先级探测，允许显式选择；firewalld / UFW 同装报错。','已确认跟随 1Panel：新实现使用其探测顺序与显式选择；不沿用旧实际入站识别策略。'],
 ['D2 · 作用范围（已确认）','上游 firewalld 固定 public；iptables / nftables 使用 BASIC 三链。','已确认跟随 1Panel：firewalld 固定 public，不保留多 Zone 扩展；移植自有链及初始化行为。'],
 ['D3 · 写入保护（已确认）','上游任务、进程互斥、局部补偿、备份。','已确认完全跟随 1Panel，不叠加旧固定预览、120 秒独立恢复、新 SSH 确认及额外防误封门槛；保留上游校验和受保护规则。'],
 ['D4 · 导入与批量（已确认）','上游规则数组，系统文件 64 MiB，原子展开 500；批次可能部分成功。','已确认完全跟随 1Panel：采用各模块 JSON 数组、限额和部分成功语义，不兼容旧 stackpier-port-rules 导入格式。'],
 ['D5 · 重置与联动（已确认）','完全跟随 1Panel 的清理范围、默认备份、确认流程及处理顺序。','Docker 重启与 Fail2Ban 恢复遵循上游条件；禁 Ping 保留运行时和持久化语义。原型仅模拟。'],
 ['D6 · 历史操作（已确认）','新操作完全跟随 1Panel；旧记录仅保留查询及原始状态。','不再续执行或恢复旧操作，不自动删除；后续由用户手动清理。']]
};

export const serverNames={alpha:'演示主机 A · 192.0.2.10',beta:'演示主机 B · 192.0.2.11'};
