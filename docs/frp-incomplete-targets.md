# FRP 部分应用后的固定目标恢复

基于 main 合并提交 `1192dd10312c3eda00c9823ea2fdc57c2c5194eb` 修复，保留文件联动、Cloudflare 多账号、统一项目生命周期和交互修复。使用独立修复分支及新草稿 PR，不修改已合并的 PR #4。仅浏览器模拟。

## 实际复现

在该 main 的独立静态副本中，用 Chromium 上传两份 96 B 虚构 ELF 文件头，通过非空、格式、x86_64、SHA-256 和固定文件修订检查；另建 QA 服务快照，不替换原 0 B 资产，不执行二进制。

新连接首次模拟部分应用的结果：FRPC A 和共享 FRPS 分项成功，visitor 明确未写入，连接没有成功 appliedConfiguration。编辑并保存 FRPC B 后，A 的占用从 1 变为 0，下一次计划只处理 B。此缺陷已由浏览器复现，不再仅是源码推断。

[部分应用前态](screenshots/frp-incomplete-before-partial.png) · [错误放行改绑](screenshots/frp-incomplete-before-rebind.png)。

## 实现机制与恢复

| 规则 | 实现 |
| --- | --- |
| 固定目标证据 | 每个 operationId 对应一个追加式尝试：连接、修订、服务、角色、服务器身份、路径、输入正文与逐项核对。确认写入、明确未写入、可能写入、结果未知分别保存。 |
| 未解决占用 | 当前绑定、成功应用绑定及所有未解决目标共同决定 FRPC / visitor 占用；受理即保留。选择、保存、预览、应用、解除、删除和服务卸载复用约束。共享 FRPS 合法共享。 |
| 恢复入口 | 连接和原操作列出固定旧主机 / 服务 / 路径。未知操作先核对执行已结束，仍不视为已清理；再重试同目标配置或确认清理所有固定旧目标。 |
| 清理边界 | 仅清空本连接客户端 / visitor TOML 的映射块；不卸载服务、删除 unit、公共程序或共享 FRPS。FRPS 仅读取核对，不回滚认证。其他项目占用相同路径时阻止清理。 |
| 多次失败 | 不以新操作覆盖旧尝试；只有同一归属、相同服务 / 主机身份 / 路径且完整核对的后续证据才能解决旧目标。旧路径仍未处理时不显示整体配置一致。 |
| 幂等 | 受理冲突不新增操作；尝试以 operationId 去重，核对追加事实，解决以目标键和后续操作关联。已解决未知操作的迟到回调忽略，原失败历史保留但退出待处理。 |
| 共享批量目标 | 共享认证计划按实际连接归属保留每个客户端 / visitor 的证据。一个连接恢复不能清空另一连接的配置；原批量操作列出剩余连接恢复入口。 |

分项读取成功仅更新对应路径的模拟读取事实，不改连接整体已应用参照或服务运行状态。清理历史路径也不会把当前服务的 unit / 程序路径改回旧版本。部署、运行、隧道可达和业务健康仍分别表达。

## 数据迁移

不提升全站存储版本，不清空 localStorage。幂等增量读取旧 FRP 操作固定输入、逐项结果和 frpWritePending；保留原操作正文。旧版已经改绑 B 的记录仍找回 A 的原目标并保留占用，不改用户当前 B 草稿。

缺目标身份 / 路径的记录标为待核实；只有旧 resolved 布尔值或缺少原执行结束证据时，不猜测已经清理。仅剩 frpWritePending 且原操作丢失的服务保留一份稳定待核实记录。连接对象丢失但固定目标完整时，可以从原操作清理，不复活连接。

新建连接不会在刷新时从单个服务快照拼成成功应用参照。资源台账不重复导入它导出的兼容副本；仍接纳遗漏资源和归属冲突。服务器、其他项目 / 连接、公共文件 / 配置、DNS、Cloudflare、防火墙和操作证据保持。

## 回归结果

| 验收 | 结果与范围 |
| --- | --- |
| 首次部分应用 A 已写入，改绑 / 复用 A 被阻止 | 通过：自动化、桌面 Chromium 保存与选择器实测。 |
| 首次未知、解除后再次部分应用 | 通过：自动化、桌面与窄屏；旧参照与占用保持。 |
| 多次失败、清理部分 / 未知、完整恢复 | 通过：固定原目标核对、清理重试、失败历史退出待处理；不会按未知结果盲目重提。 |
| 清理后改绑 B、B 单独应用 | 通过：原目标已清理、占用释放、无遗留待处理；服务项目仍存在。 |
| visitor 与共享 FRPS | 通过：visitor 确认写入后保留占用，FRPS 去重，逐连接恢复不清空他人配置。 |
| 刷新、重复提交 / 回调、迁移 | 通过：自动化覆盖重复回调含已解决未知迟到回调；浏览器覆盖刷新、返回修改、旧版已改绑及重复迁移。 |
| 部署、卸载、待处理、FRP 表单 | 通过：既有六组浏览器回归及全量自动化。 |

本地全量 `node --test --test-isolation=none tests/*.test.mjs`：209 项通过，0 失败 / 跳过；新增专项 22 项。Chromium 七组共 323 检查点：本次专项 38、原资产 63、Cloudflare 54、FRP 24、上下文 55、生命周期 53、清理修复 36，均通过且无页面异常。

72 个 JavaScript 语法检查、7 个 Python 浏览器脚本语法、82 个入口资源、git diff --check 及静态包逐文件字节检查通过。原型无 package.json、TypeScript 或编译构建；构建为 index.html + assets 的完整静态包。没有 GitHub CI 运行记录时不宣称 CI 通过。

[机器可读验证](verification/frp-incomplete-results.json) · [专项浏览器检查点](screenshots/frp-incomplete-targets/browser-results.json)。

## 关键截图与复验

| 截图 | 内容 |
| --- | --- |
| [固定旧目标](screenshots/frp-incomplete-targets/partial-targets-desktop.png) | A 的确认写入事实及恢复入口。 |
| [禁止改绑](screenshots/frp-incomplete-targets/rebind-blocked-desktop.png) | 保留未提交 B 选择并解释阻塞。 |
| [清理部分失败](screenshots/frp-incomplete-targets/cleanup-partial-desktop.png) | 尚未完成项、原路径和占用保持。 |
| [B 独立应用](screenshots/frp-incomplete-targets/recovered-rebound-desktop.png) | 完整清理后改绑并单独应用。 |
| [解除后再次部分应用](screenshots/frp-incomplete-targets/partial-after-detach.png) | 不以 detached 标记绕过新证据。 |
| [未知目标 / 窄屏](screenshots/frp-incomplete-targets/unknown-targets-mobile.png) | 可能写入目标仍可定位恢复。 |
| [改绑表单 / 窄屏](screenshots/frp-incomplete-targets/rebind-blocked-mobile.png) | 输入保留、说明及确认按钮可用。 |
| [清理已解决 / 窄屏](screenshots/frp-incomplete-targets/resolved-mobile.png) | 刷新不复活待处理项。 |
| [旧数据恢复](screenshots/frp-incomplete-targets/legacy-migration-recovered.png) | 找回旧 A，保留 B 草稿并完成独立应用。 |
| [共享 FRPS / visitor](screenshots/frp-incomplete-targets/shared-frps-visitor-recovered.png) | 原批量失败逐连接恢复后已解决。 |

本地启动静态服务，设置 STACKPIER_PREVIEW_URL 后运行 tests/browser-frp-incomplete-targets.py。脚本使用新浏览器上下文、上传 ELF 分析夹具并建立独立 QA 服务；填写、确认、故障、清理和改绑使用真实 DOM 输入 / 点击。旧状态通过隔离存储注入后真实刷新迁移，不改用户数据。

发布只使用现有公开 Site `appgprj_6ac293e53e348191a7b50433d8cd19e9`。实际发布版本、源 SHA、远端 HEAD、部署状态与公网复验结果记录在新 PR 的发布段；本地构建或 PR 提交不代表上线。

未测：真实 FRP / SSH / 服务器部署和清理、Safari / Firefox、跨浏览器同时写同一 localStorage。ELF 夹具仅满足原型文件格式分析，不是 FRP 可执行程序或运行验证。原目标证据不足的历史记录保守阻断，需人工核实；不支持 visitor 多连接共享聚合。公网访问若被环境代理拒绝，如实记录线上交互未验证。
