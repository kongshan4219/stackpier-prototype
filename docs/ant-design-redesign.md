# Ant Design 原型改造（待用户确认）

本轮仅调整浏览器模拟原型。用户确认后才能迁移正式 React 前端；本地预览与截图不代表正式产品验收，也未推送或发布。

## 设计来源与边界

使用主仓库现有的[应用设计系统](../../designs/ant-design-system/project/README.md)，遵循其 Token、品牌、组件和维护说明，不复制或改写独立系统。产品名保留「栈桥 · StackPier」，保留原产品标记及信息架构。依赖采用 npm 正式包 Ant Design **6.6.8**、Icons **6.1.0**、React / React DOM **19.3.0**；Vite **8.3.2** 与现有正式前端版本一致。精确版本及传递依赖见锁文件。

[正式能力与原型模拟的区别](../../docs/prototype.md#正式能力与原型模拟的区别)仍有效：服务器密码、分组、删除、环境补齐，通用文件替换、全局 FRP 模板，Telegram / 邮件、场景注入和虚构磁盘指标不得随视觉迁移进入正式产品。全部现有模拟数据、草稿、确认、恢复、历史路由和资产引用逻辑保留。

## 页面与交互清单

以下页面均接入统一外壳、深浅主题、公共控件、空态和窄屏布局。表中正式文件仅为下一阶段的盘点，没有修改。

| 原型页面 | 本轮覆盖 | 后续正式入口（webui/src/pages） |
| --- | --- | --- |
| 总览 | 四项事实摘要、待处理、近期记录、服务器列表 | Overview.tsx |
| 服务器 | 搜索筛选、连接详情、接入多步表单、状态检查、受阻删除 | Servers.tsx、SSHCredentials.tsx |
| 项目 | 列表 / 卡片、失败记录、部署选择 | Projects.tsx、DeploymentSelection.tsx |
| 项目详情 | 概览 / 配置 / 巡检 / 日志 / 操作记录；启停与卸载确认、草稿与文件摘要 | Projects.tsx、ProjectFiles.tsx、ProjectUpdate.tsx |
| 部署配置 | 列表与引用，systemd / Compose / FRP 编辑，固定资产和只读抽屉 | Configurations.tsx、ConfigurationEditor.tsx、ComposeMappings.tsx |
| FRP | 连接清单、映射、配置差异，绑定与角色，草稿校验 / 应用 | FRP.tsx、DeployFRP.tsx |
| 文件 | 版本列表、上传、命名与详情抽屉 | Assets.tsx |
| 巡检与通知 | 方法、周期、观测、日志、未知与禁用状态 | Monitoring.tsx、MonitoringShared.tsx、MonitoringHistory.tsx、NotificationSettings.tsx |
| 主机防火墙 | 搜索、规则表格、编辑 / 删除 / 导入 / 批量确认 | Firewall.tsx、FirewallPorts.tsx、PortRuleEditor.tsx、FirewallInspection.tsx、FirewallOperations.tsx |
| DNS | Zone 筛选、记录、固定目标确认、连接管理和权限提示 | DNS.tsx、DNSEditor.tsx、DNSConnections.tsx、DNSOperations.tsx |
| 操作记录 | 结果筛选、证据详情、核对与恢复 | Operations.tsx |
| 设置 | 通知、连接、实例信息 | Settings.tsx |
| 实例访问 | 登录 / 初始化 / 受限 / 设置成功、输入错误 | App.tsx（pages 目录之外） |

公共状态：顶栏「页面状态」可切换加载、空状态和读取失败；恢复按钮回到原页面。此功能仅用于审阅，不模拟真实请求或替换原页面的业务错误路径。已有失败场景仍在「试用场景」内。状态同时显示文字与图标，危险操作保留固定目标、影响说明与单独确认。

注册表包含 47 类公共弹窗、32 类公共表单；另有 FRP 独立处理器（连接、映射、模板、公共设置、固定程序）。公共 Modal / Drawer 覆盖所有使用 `layout` / `renderAssetDrawer` 的入口，包括直接触发的 FRP 校验。完整入口可在浏览器调用 `StackPierUI.inventory()` 查看。未逐一实测的罕见分支见[验证报告](ant-design-validation.md)，不以统一渲染覆盖代替业务验收。

## 统一实现与必要产品适配

- `src/antd/theme.js` 直接 import 主仓库 tokens.json，经 ConfigProvider 使用。颜色按 light / dark 取值；spacing / radius / size 去掉 px；字体族及九种文字样式映射 fontFamily / fontFamilyCode、fontSize / lineHeight / Heading1–5；动效根据系统偏好关闭。没有第二份基础 Token 文件。
- `convert.jsx` 将原型既有渲染结果接入真实 Ant Button、Input / TextArea、Select、Checkbox、Radio、Table、Tag、Alert、Empty、Card、Tabs、Form。`index.jsx` 提供 Modal、Drawer、Message、Spin 和 ConfigProvider。图标统一为 Ant Design Icons。
- 这是原型的兼容桥：既有页面仍维护虚构业务与 HTML 结构，React 负责公共组件；不将该转换器、原型业务脚本或设计系统预览 bundle 用于生产。正式迁移应直接编写 React 产品组件，并复用本轮确认的主题适配。
- Select 保留不可见的原生值镜像，供现有 FormData、草稿和专有事件使用；可见控件使用独立 ID、可访问名称和对应 label。原生 dialog 保留上层隔离与关闭生命周期，内部使用 Ant Modal / Drawer。公共提交转交原有事件通道，避免再写一套业务分支。
- `product.css` 是唯一公共布局适配层：232px 侧栏、24px 页标题、32px 桌面页边距 / 16px 窄屏页边距。手机操作换行，表格自身滚动，弹窗正文滚动且页脚独立，原型审阅栏实际高度决定导航偏移。原业务布局 CSS 放入低优先级 layer，其颜色在构建时转为语义变量，不能在单页新增另一套颜色。
- 原有原型文案维持在其功能组件；本轮新增审阅文案集中在 `src/antd/copy.js`。正式迁移仍须遵循正式文案集中管理结构。

### 对比度适配

独立系统验证报告指出默认品牌色、弱文字、边框与焦点的限制。本产品在 theme.js 明确覆盖，未静默回写独立系统：浅色主操作 / 链接 #0958d9；深色主操作 #1668dc、链接 #69b1ff；弱正文提高到 secondary；placeholder 为 #666 / #a6a6a6；控件边框 #808080；焦点与链接同色。成功、警告、错误和信息色分别提供更易读的深浅值。Tabs 的选中与 hover 使用链接 Token，避免将深色填充按钮色直接用于小字号文本。

结构分隔线仍取 colorBorderSecondary，不要求装饰线达到控件边界的对比度。禁用状态继承 Ant Design 的禁用表达，不宣称其文本达到普通正文标准。校验结果与限制单独记录。

## 维护入口

运行方式见 [README](../legacy/radix-tailwind/README.md)。更新设计系统后重新构建，检查 theme.js 的映射与本产品覆盖；升级依赖必须同步锁文件与浏览器回归。原型确认前，现有正式界面视觉基线仍有效，不把本稿当作已批准的正式实现。

普通 Button 的 hover / active 文字复用已加强的 colorLinkHover / colorLinkActive，修复深色默认悬停文字对比度不足；与正式 React 主题同步，不回写独立设计系统。
