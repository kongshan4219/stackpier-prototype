# 清理与 FRP：五项修复及回归证据

2026-10-05。基于 PR #4 实际分支 `feature/service-project-lifecycle` 的 `a6d2694b118a3a55bd356c1aebd2f33d36e83f17`；起始工作区干净，main 为 c200c3d，未回退、未覆盖文件联动或 Cloudflare 多账号。主仓库不变，PR 保持草稿、不合并。

## 五项结果与复验

| 问题 | 修复 / 复验步骤 |
| --- | --- |
| 1 清理成功仍待处理 | 已修复。虚构 Compose 项目部署选部分失败 → 清理残留 → 成功；原失败状态与历史保留，resolved / resolution 指向完成操作，cleanupOf / resolves 形成稳定链，待处理退出。另测部分卸载 → 继续清理 → 全部成功；移除项目并解决原卸载，重复点击 / 回调 / 刷新不重复。 |
| 2 FRP 字面量 false | 已修复。打开新增连接，默认目标说明不再将布尔值当作 hint；HTML 与浏览器检查没有 false / undefined / null 残留，默认勾选与指定 / all 语义保持。 |
| 3 清理漏后续文件 | 已修复。部署 QA 服务 → 项目独立草稿新增 `/etc/qa-stackpier/old.conf` → 应用 → 替换为 new.conf → 应用 → 卸载。两条目录外路径都在确认清单；部分 / 未知交付标可能存在，旧路径未清理前仍追踪。归属台账保存来源操作与逐项结果；确认期间范围变化转未知，不能按过期清单移除项目。共享 / 外部保留，未知归属、其他引用及保护资源所在递归目录阻断。 |
| 4 visitor 覆盖 | 已修复，采用独占方案。占用选项禁选并显示连接；表单保存、执行预览、完成核对、跨参考清单与旧数据检查同一约束。旧重复绑定保留全部映射与服务，显著提示并阻止应用；共享 FRPS 仍合法且去重。 |
| 5 改绑旧映射残留 | 已修复，采用明确两步解除。已应用连接先确认解除旧客户端 / visitor 配置，FRPS 保留且只核对；成功后可保存新绑定，再单独确认应用。确认展示旧映射、旧服务、固定文件与重载；失败 / 部分 / 未知、旧角色离线或身份变化均保留原应用绑定和占用。旧服务与其他合法连接不卸载 / 不修改。 |

保持项目仅成功部署实例、临时表单无实体、完全卸载后移除实体、失败 / 未知可恢复、FRP 仅配置管理；保存不自动应用，进程运行不代表隧道或业务可达。

## 资源与迁移

- `resourceLedger` 按稳定项目 ID、类型 / 路径记录 present / possible / absent、来源操作、清理操作；新修订追加，不能用新配置覆盖遗留旧资源。部分写入无分项证据只标可能存在；完整应用 / 读取参照仍保留此前版本。显式逐项证据可确认已交付分项。
- 优先恢复已有 ownedResources、已应用参照和固定历史操作输入，不读取当前未保存草稿猜测旧交付。缺历史范围、归属矛盾阻止“完整清理”；共享程序、公共文件 / 配置、网络条目及外部资源不归入删除。
- 清理迁移必须有稳定关联、原主机参照、完整目标与成功分项；证据不全继续待处理。原状态不改成成功，仅追加已解决事实。成功清理还与历史交付范围核对，避免旧过期清单被误认完整。
- 旧版项目已移除但遗漏目录外交付时，建立一次 `migration-review` 与失败清理证据，保留旧卸载历史、已有成功分项及漏项；不复活项目。继续清理完整成功后解决原失败，重复迁移不会重复建记录。
- FRP 旧应用绑定优先使用成功操作固定 bindings，否则仅从已保存稳定 serviceIds 的唯一角色恢复；缺证据标待核对。当前编辑绑定与应用绑定分别保存，解除成功保存 bindingHistory。visitor 占用包含旧应用绑定，未知不释放。
- 不修改全站 localStorage 版本、不清空存储、不重新灌入主动清空的数据。幂等单测比较重复刷新后的完整状态；浏览器实测冲突、解除失败、漏项清理、刷新恢复。服务器、公共文件、配置、DNS、防火墙、Cloudflare、其他服务和用户映射编辑保留。

## 实际检查

- 自动化：`node --test --test-isolation=none tests/*.test.mjs`，187 项通过，0 失败 / 跳过。其中新增 30 项回归；最初七个缺陷复现测试在审查基线全部失败，修复后通过。未删旧测试或跳过失败。
- 浏览器：真实 Chromium 1440px / 390px，六组脚本共 285 检查点通过，0 页面脚本异常：专项 36、生命周期 53、FRP 24、文件联动 63、Cloudflare 54、操作上下文 55。取消、返回、重复提交 / 回调、刷新、部分失败重试、新旧绑定与占用均实际操作；新资源草稿和旧数据缺陷通过隔离 QA 夹具注入，再点击真实确认 / 执行 / 清理。
- `node --check`：69 个入口 JavaScript；79 个本地 CSS / JS 引用存在且无重复。全部 Python 浏览器脚本语法检查及 `git diff --check` 通过。
- 静态发布包 index.html + assets 与源码逐文件字节一致。本仓库没有 npm / TypeScript / bundler 任务；静态检查及打包不代替交互验证。
- 全部结果为本地原型模拟。未调用真实 SSH、部署、systemctl、Cloudflare 或防火墙；QA 程序为单独虚构元数据，原始四个 0 B 占位完全保留且不可部署。GitHub CI 未执行，不声称 CI 通过。

复验命令：

```sh
node --test --test-isolation=none tests/*.test.mjs
STACKPIER_PREVIEW_URL=http://127.0.0.1:4313 python tests/browser-cleanup-frp-repairs.py
```

其余 `tests/browser-*.py` 同用 STACKPIER_PREVIEW_URL；截图可用 STACKPIER_SCREENSHOTS 指定目录。启动静态服务后运行，不连接真实服务器。

## 修复前后截图

截图使用隔离虚构 QA 状态；修复前来自 a6d2694 独立静态副本，当前分支没有回退。

| 问题 | 前 | 后 |
| --- | --- | --- |
| 待处理计数 | [清理后仍收录](screenshots/cleanup-frp-repairs/repair-resolved-pending-before.png) | [原记录已退出](screenshots/cleanup-frp-repairs/repair-resolved-pending-after.png) |
| 字面量 false | [错误说明](screenshots/cleanup-frp-repairs/repair-frp-dialog-before.png) | [默认目标说明](screenshots/cleanup-frp-repairs/repair-frp-dialog-after.png) |
| 资源遗漏 | [未列后续映射](screenshots/cleanup-frp-repairs/repair-resource-list-before.png) | [新旧目录外文件](screenshots/cleanup-frp-repairs/repair-resource-list-after.png) |
| visitor 冲突 | [允许继续](screenshots/cleanup-frp-repairs/repair-visitor-conflict-before.png) | [占用阻断](screenshots/cleanup-frp-repairs/repair-visitor-conflict-desktop.png) |
| 改绑 | [计划遗漏旧客户端](screenshots/cleanup-frp-repairs/repair-rebinding-plan-before.png) | [先解除旧映射](screenshots/cleanup-frp-repairs/repair-detach-confirm-desktop.png) |

另见[解除部分失败](screenshots/cleanup-frp-repairs/repair-detach-partial-desktop.png)、[改绑独立应用](screenshots/cleanup-frp-repairs/repair-frp-rebound-desktop.png)、[旧清理漏项恢复](screenshots/cleanup-frp-repairs/repair-legacy-gap-desktop.png)、[窄屏连接表单](screenshots/cleanup-frp-repairs/repair-frp-dialog-mobile.png)、[窄屏解除确认](screenshots/cleanup-frp-repairs/repair-detach-mobile.png)。取消后焦点返回触发按钮，无横向溢出。

## 发布与未测边界

交付提交及远端 HEAD 以 PR #4 最新提交为准；发布版本、Sites 原生源码 SHA 与状态记录在 PR。现有 Site 为 appgprj_6ac293e53e348191a7b50433d8cd19e9，访问设置保持 public，不创建替代站点。

公开地址：https://stackpier-prototype.kongruby4.chatgpt.site/ 。本会话出站代理访问返回 CONNECT 403；线上交互未验证，不能用 Sites 部署成功替代公网浏览器实测。

没有真实服务器 / FRP 二进制、生产数据、真实密钥、隧道或公网传播验证。任意脚本 / Compose 资源归属不自动解析；缺范围 / 身份 / 独占证据保守阻断，不能通过“演示成功”补造归属。visitor 共享聚合刻意不支持；一个服务一条连接。未知应用后是否曾部分落盘无法从旧完整快照猜测，须明确核对原操作。未测跨浏览器同时写入同一 localStorage、Safari / Firefox；不存在真实后端并发语义。
