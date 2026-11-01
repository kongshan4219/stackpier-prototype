# Ant Design 原型验证

日期：2026-11-01。状态：**原型自验证完成，用户已确认采用为迁移基线；正式前端结果由主仓库单独记录。**

## 环境与隔离

基线阶段主仓库从 `146b138`、原型从 `e4f583d` 开始；分别使用 `codex/antd-prototype-redesign` 本地分支。检查了主仓库、其他 worktree、原型子模块与既有实例；保留主仓库未跟踪 `.aws` 和既有设计系统服务器元数据，没有访问凭据或停止他人的实例。

Linux，Node 22.23.2，Chrome for Testing 151.0.7922.34，playwright-core 1.58.2。Ant Design 6.6.8 + React / React DOM 19.3.0 + Vite 8.3.2 完成 npm 安装和构建，与建立原型时的正式前端 React / Vite 版本一致。仅验证本原型构建的兼容性；正式工程的类型检查、完整依赖树与运行回归由主仓库单独执行和记录。

所有测试使用独立浏览器上下文和虚构数据。服务仅监听 `127.0.0.1:4327`，构建包、依赖和完整运行证据位于任务缓存 `/srv/cache/stackpier-tmp/antd-prototype-redesign/`。源码中的关键截图与结构化报告见下方链接。本轮没有连接生产 API、SSH、Cloudflare 或真实数据库。

## 已执行

| 检查 | 结果与范围 |
| --- | --- |
| npm 精确依赖 / Vite 构建 | 通过。runtime.js 约 1.07 MB、gzip 约 336 KB；用于本地原型，不宣称为生产性能优化方案。 |
| 原模拟逻辑测试 | **247 / 247 通过**。VM harness 不加载生成的 React bundle，视觉与集成由下面的浏览器检查补充。 |
| 页面矩阵 | **92 项通过**：11 个导航页面、项目详情 5 个标签页、7 类弹窗，分别检查 light / dark × 1440 / 390px。页面没有整页横向溢出，浏览器无 pageerror。见 [report.json](ant-design-evidence/report.json)。 |
| 核心交互 | **32 项通过**：4 种显示组合下，服务器接入、Select 值与返回修改、缺少确认时阻止保存、单次提交、删除取消 / 确认、Escape、加载 / 空 / 失败恢复、浏览器返回、资产抽屉、FRP 标签 / 映射保存、直接校验弹窗。见 [interactions.json](ant-design-evidence/interactions.json)。 |
| 扩展详情 / 表单 | **90 项通过**：服务器详情 / 状态 / 环境 / 受阻删除，项目草稿 / 更多 / 卸载，操作详情，文件上传，防火墙导入，Cloudflare 五类管理弹窗，三种配置编辑器，FRP 连接 / 设置 / 映射；另检查登录错误 / 成功及手机导航 Escape。见 [details.json](ant-design-evidence/details.json)。此组主要验证渲染和布局，不代表每种表单已提交所有分支。 |
| 对比度与短屏键盘 | **30 个配色对通过**，另 **2 个主题的 390×640 弹窗检查通过**：连续 Tab 留在对话框、Escape 关闭、页脚按钮在视口内。执行减少动态效果偏好。见 [accessibility.json](ant-design-evidence/accessibility.json)。 |
| 文件与入口完整性 | 85 项构建入口资源存在，82 个原型 JavaScript 文件语法检查通过，62 个本轮相关文档本地链接存在，git diff --check 通过。 |
| 人工截图复核 | 已检查深色手机总览、深色桌面 FRP、浅色服务器接入、深色手机 Compose 编辑和浅色桌面卸载确认；修复卡片正文丢失、图标填充、特殊 FRP 导航和 Tab 边界问题后复验。 |

对比度检查计算 Token 前景 / 背景并混合 alpha：正文、链接、状态文字和白色主按钮文字 ≥4.5:1，控件边界 / 焦点 ≥3:1。正文最小值 5.19:1，边界最小值 3.95:1。这是所列配色对的结果，**不是对所有像素、叠层与控件状态的完整 WCAG 合规认证**；禁用内容与装饰线不计入普通正文标准。

## 关键截图

| 视图 | 截图 |
| --- | --- |
| 浅色桌面总览 | [1440px 总览](ant-design-evidence/light-1440-overview.png) |
| 深色桌面总览 | [1440px 总览](ant-design-evidence/dark-1440-overview.png) |
| 浅色手机项目 | [390px 项目](ant-design-evidence/light-390-projects.png) |
| 深色手机服务器 | [390px 服务器](ant-design-evidence/dark-390-servers.png) |
| 危险操作确认 | [桌面卸载](ant-design-evidence/light-1440-projectop-detail.png) |
| 长表单与固定操作区 | [手机 Compose 编辑](ant-design-evidence/dark-390-templateedit-compose.png) |

## 复验入口

先按 [README](../README.md) 构建并启动静态服务。四个浏览器脚本分别为 `scripts/check-antd.cjs`、`interactions-antd.cjs`、`details-antd.cjs`、`accessibility-antd.cjs`。运行时提供 `STACKPIER_PROTOTYPE_DEPS`（含 node_modules 的独立缓存目录）、`CHROMIUM_PATH`（已安装浏览器可执行文件），可用 `STACKPIER_PROTOTYPE_URL` 覆盖默认 4327 地址。报告写入依赖缓存目录下的 `evidence/`；脚本不会写生产数据。

模拟单元测试：`node --test --experimental-test-isolation=none tests/*.test.mjs`。

## 未执行与后续门槛

- Safari / Firefox、真实手机、屏幕阅读器、系统高对比度模式、200% 缩放和触屏软键盘未验证；当前仅能断言所列 Chromium 视口结果。
- 47 类注册弹窗及 FRP 扩展已统一渲染，但没有逐个提交所有失败 / 并发 / 迁移组合。原有 247 项逻辑测试继续覆盖模拟合同；罕见恢复分支不能据此宣称已完成浏览器验收。
- 主题切换后的所有编辑器光标位置、输入法组合输入、深层叠放抽屉和上传大文件未做专项回归。现有生命周期、值镜像与草稿策略保留，正式迁移需有相应真实组件测试。
- 正式 React、后端 API、权限、持久化、真实错误恢复、正式深链及浏览器返回均不由原型脚本验证。正式迁移在主仓库单独记录，不复用这些截图当作正式结果。
- 本轮只创建本地提交；未推送、合并、部署或发布。当前 worktree 和本任务预览服务为待用户审阅而保留。

## 正式迁移时的同步修正

2026-11-01 同步普通按钮 hover / active 文字到加强后的链接色，修复深色默认悬停对比度不足；不改变原型业务模型或独立设计系统 Token。另建隔离预览复验：247 项组件测试通过，34 项对比度 / 键盘检查通过，其中两种主题的普通按钮悬停文字均达到 4.5:1。报告见[同步复验](ant-design-evidence/formal-sync-accessibility.json)。该结果仅属于原型，正式前端证据由主仓库单独记录。

## 防火墙分支整合验证（2026-11-01）

整合 `5ae64d0` 与 `af2aeac`：保留实际管理器、Zone 边界及历史恢复演示；Ant Design Card 适配保留原卡片类名、可访问区域名称和正文后的表格 / 分页。浏览器脚本改为操作真实 Ant Select。

- 282 项组件测试通过；npm 构建通过。
- 92 项全页 / 弹窗检查通过，浅色 / 深色、1440px / 390px 无脚本错误或页面横向溢出。
- 防火墙 85 项浏览器检查通过，包含 1440px / 390px / 320px、Zone、导入导出、冲突、未知操作及历史恢复。
- 34 项对比度与键盘检查通过（文字门槛 4.5，边框 / 焦点门槛 3）。
- 本次使用 Linux、系统 Chrome、回环静态服务及虚构场景；未验证真实资源和其他浏览器。正式结果由主仓库记录。
