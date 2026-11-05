'use strict';
registerPrototypeHandlers(prototypeModals,['frp-invalid-link','frp-role-manage'],m=>{layout('FRP 关联待核对','稳定服务 / 连接引用失效，不能按名称替代。',notice('未找到有效连接','项目服务仍在项目页管理；纯程序准备已转为安装元数据。','warning'),btn('返回来源','closemodal')+btn('FRP 连接清单','frp-home'));});
