# 项目服务与配置 FRP：本轮验收

基于原型 main `c200c3d13ceef25d5f7ef8778725ddb63bd58152`，未回退旧审查 SHA。主仓库原型指针未用来覆盖当前文件联动或 Cloudflare 多账号。起始工作区干净，无开放 PR；本轮仅原型、必要文档与测试。

## 实现及实际复验

| 验收项 | 状态 / 复验方式 |
| --- | --- |
| 1 临时部署取消不建项目 | 完成。填写、适配、预览、返回 / 关闭 / 重开，数量不变、输入保持；不预占名称。 |
| 2 执行只有操作，成功才建一个项目 | 完成。确认期间检查项目数量，步骤完成后 +1，重复完成仍 +1；操作资源保护重复提交。 |
| 3 失败 / 部分 / 未知可查恢复 | 完成。三种结果仅操作和失败证据；保留固定服务器、配置、日志、残留；未知先核对，或单独确认清理。 |
| 4 停止 / 异常仍保留 | 完成。已部署服务停止、部分运行与服务器离线后保留实例，进程不代表隧道 / 业务健康。 |
| 5 完全卸载范围与实体删除 | 完成。确认列出 unit / 容器、文件、独立目录、登记专属卷 / 数据；全部成功核对才移除实体和解除引用。 |
| 6 清理失败和共享保护 | 完成。部分清理保留实例、逐项残留，继续仅未完成项；未知先核对。其他项目路径、共享 FRPS、共享程序、卷、公共文件 / 配置和网络条目受到保护。 |
| 7 FRP 只在配置 | 完成。配置 / FRP 导航、面包屑和首页，没有程序安装、上传、角色部署、卸载按钮；旧标签回连接清单。 |
| 8 三角色统一部署并选择服务 | 完成。独立 QA FRPS、FRPC、visitor 从项目实际表单部署；连接选择稳定 ID、服务器和可用状态。0 B 无法执行。 |
| 9 映射不建立 / 卸载服务 | 完成。连接 / 映射增删前后服务数不变；最后 STCP 的应用预览清空映射但保留 visitor 服务。 |
| 10 保存不改变应用参照 | 完成。保存映射 / 公共模板保持参照；指定采用只变草稿，应用失败 / 部分 / 未知保留旧完整参照；明确核对才更新。 |
| 11 共享 FRPS / visitor | 完成。共享执行计划 FRPS 一次、客户端分别处理。认证变更需相关连接明确采用；visitor 同 FRPS 主机、frpc、回环、配对密钥；缺服务阻断。 |
| 12 两页一致且无含糊状态 | 完成。项目和 FRP 引用同一个服务运行事实；仅程序准备转元数据，不显示项目或连接运行；列表不使用“不适用”。 |
| 13 刷新 / 路由 / 幂等迁移 | 完成。Back / Forward、刷新恢复位置；旧未部署独有配置保留证据，旧保留数据卸载转待处理清理并经归属核对再清理；迁移不复活对象、不重置其他数据。 |

以上均为浏览器 / localStorage 模拟验证，不是实际服务器部署或清理。

## 命令与结果

- `node --test --test-isolation=none tests/*.test.mjs`：157 通过，0 失败 / 跳过。新增生命周期、完整清理、共享引用、幂等迁移和统一 FRP 服务回归；保留附件静态字段 / 十份 TOML 和 unit 对照、网络权限 / 身份 / 异步隔离、资产修订测试。
- `node --check`：入口 66 个 JavaScript 全部通过；76 个本地 CSS / JS 引用存在且不重复。Python 浏览器脚本语法检查通过，`git diff --check` 通过。
- 静态构建：本项目没有 npm、TypeScript 或 bundler 任务；实际复制 index.html + assets 为发布包并逐资源字节核对，未用“构建成功”代替交互验收。
- Chromium 实际浏览器：生命周期 `browser-service-lifecycle.py` 53；FRP `browser-frp-linkage.py` 24；文件联动 63；Cloudflare 54；操作上下文 55。共 249 检查点通过，0 页面异常。
- 桌面 1440px、窄屏 390px 的项目输入、预览、返回修改、FRP 与刷新；既有账号回归额外覆盖 320 / 390 / 820 / 1440px。公开站点的远端浏览器交互复测未作为本地通过项。

本轮先用新测试复现旧项目实体 / FRP 部署逻辑，再修改实现。被最新产品规则移除的专用安装、角色部署、卸载保留数据等测试已改为统一服务生命周期 / 配置应用测试，未用跳过伪装通过。现有 DNS、防火墙、Cloudflare 和文件主要回归仍实际执行。

QA 使用独立虚构程序元数据；没有替换四个原始 0 B 文件，不称其为已验证二进制。附件脚本、真实 Token、服务器及 API 未运行 / 使用。引号、反斜杠与换行通过浏览器生成并经 Python tomllib 独立解析。

## 关键截图

- [服务项目列表与待处理记录](screenshots/service-projects-desktop.png)
- [临时部署 / 固定落点 / 项目副本](screenshots/service-deployment-preview-desktop.png)
- [失败和未知部署操作](screenshots/service-pending-operations-desktop.png)
- [完全清理确认](screenshots/service-cleanup-confirm-desktop.png)及[部分清理残留](screenshots/service-cleanup-partial-desktop.png)
- [FRP 连接与映射](screenshots/service-frp-connections-desktop.png)及[配置应用确认](screenshots/service-frp-apply-desktop.png)
- [公共程序反向引用](screenshots/service-frp-asset-links-desktop.png)及[共享认证去重计划](screenshots/service-frp-shared-plan-desktop.png)
- [390px 项目预览](screenshots/service-project-preview-mobile.png)及[390px FRP](screenshots/service-frp-mobile.png)

截图为本地同一源码、虚构 QA 操作，不是远端服务证据。

## 未测和范围边界

没有剩余已复现的本地验收失败。真实 SSH、systemctl、Docker、FRP verify / 程序运行、数据删除、隧道可达、业务健康、真实 DNS 传播均未测、未执行。0 B 成功部署保持禁止。

资源清理只处理已登记且归属明确的项目资源；不会理解任意脚本 / Compose 外部挂载或猜测历史资源。历史归属无法可靠核对时继续阻塞；核对 UI 只是注入模拟证据。真实资源发现、真实恢复和后台契约不属于本轮。

公开发布必须复用 Site `appgprj_6ac293e53e348191a7b50433d8cd19e9`，保持公开设置；实际源码 SHA、草稿 PR、版本 / 部署状态以交付说明及 PR 发布记录为准。未合并 PR、未关闭 Issue、未修改主仓库。
