# FRP 附件行为对照与验证

依据用户提供的 `frp-sanitized.zip` 静态检查 config.json、frp_config.py、frpc.sh、frps.sh、README.md、REVIEW_NOTES.md、六个 templates 与二十个 generated 文件。未运行附件脚本、二进制、SSH、SCP、systemctl、端口探测或服务器上传。原文历史验证不作为本次执行成功证据。

## 原始规则与栈桥表现

| 附件事实 | 当前原型 |
| --- | --- |
| 一个本地 FRPC 提供端，多远端 FRPS | 附件参考清单保持此模型；默认多客户端清单明确标为产品扩展，显式切换并保留编辑。 |
| `client_enabled` 只控制默认目标 | 默认客户端选 true；all 包含 false；显式 false 可操作；服务端默认全部。 |
| http / https 是映射名称，type=tcp | 表单、预览保持 TCP；以 remotePort 暴露 FRPS 端口。 |
| STCP 无 remote_port | provider 与 visitor 从同一映射生成名称和密钥；visitor 在 FRPS 主机回环监听，程序是 frpc。 |
| 全局 token，独立 STCP secret | 表单引用全局 token；概览遮挡；独立版本采用 / 应用时检查两端一致，不维护第二份编辑密钥。 |
| 四个 bin 程序为 0 B | 不可部署、不可通过演示勾选绕过；上传只做文件头 / 摘要分析，不验证真实运行。 |
| IP 命名的生成文件与安装 unit | 同时显示原始命名和当前实际命名，路径、ExecStart、依赖匹配。 |
| 旧脚本远端串、路径、转义与批量缺陷 | 仅静态参考；预览落点闭合，可靠转义，按主机监听冲突，逐目标保留结果，清理另行确认。 |

参考节点与映射完全使用 config.json 的地址和端口：

| FRPS | 默认客户端目标 | TCP 映射 | STCP / visitor |
| --- | --- | --- | --- |
| 192.0.2.10 | false | http 127.0.0.1:80 → 18080；https 127.0.0.1:443 → 18443 | 无 |
| 198.51.100.20 | true | 同上 | 无 |
| 203.0.113.30 | false | 同上 | example-database：127.0.0.1:3306；visitor 127.0.0.1:13307 |
| 192.0.2.40 | true | 无 | example-database：127.0.0.1:3306；visitor 127.0.0.1:13307 |

均采用 bindAddr=0.0.0.0、bindPort=7000、ssh_user=example-admin、auth.method=token。节点 03 / 04 的示例 STCP 密钥分别来自对应映射，visitor 的 serverName 和 secretKey 不另行维护。附件没有提供本地提供端身份或远端实测架构；参考主机架构为明确的试用值，不能当作真实观测。

原始生成路径为 generated/frpc、generated/frps、generated/frpc-visitor 下的 `<IP>.toml` 与 `<IP>.service`。客户端和 FRPS 分别在各自机器安装 `<IP>.service`，visitor 安装 `<IP>-visitor.service`。运行根目录示例 `/srv/services/frp`，架构源文件可带 -arm64，安装程序固定为 bin/frpc 或 bin/frps。root 用户和硬编码目录不推广为所有项目要求。

托管连接的客户端 / visitor unit 按角色＋连接 ID，FRPS 按服务器 ID；其实际生成与安装路径以预览为准。历史角色＋IP 模式保留原身份，目录或 unit 身份变更会阻止普通应用，避免隐式迁移留下旧服务。

## 版本与异常边界

公共程序与角色配置、角色项目草稿、完整应用参照、成功读取快照分开保存。文件替换或公共保存不会改写其他层。采用指定角色后再确认应用；共享服务端资源去重，其他连接不随某个项目采用而改变。实际已应用程序使用计数按匹配架构和固定修订，不能把草稿中的其他架构候选计作已交付。

TCP 按 FRPS 的公网通配监听计算冲突，不因控制 bindAddr 为单个地址而漏检。控制、TCP 与 visitor 同机端口交叉检查，地址规范化后比较；跨服务器同端口、相同本地目标允许。IPv6 `::` 保守考虑双栈，可能与同端口 IPv4 冲突，不假定双栈隔离。

停止、移除 unit 和清理生成文件是不同动作。未部署 visitor 的 TCP-only 节点不生成 visitor；已有 visitor 在最后 STCP 删除后保留到确认清理。生成文件记录不会被生成动作顺带删除；卸载保留生成记录，visitor 清理确认则列出具体生成 / 安装文件，不宽泛清空目录。已删除节点的历史生成记录可以追溯；“生成文件记录与残留清理”按具体记录确认，不停止服务或移除安装 unit，不宣称生成会自动清空残留。

## 实际验证

自动化命令：`node --test --test-isolation=none tests/*.test.mjs`。新增附件测试覆盖逐字段数据、默认 / all / 指定目标、十份 TOML 与十份 unit 的静态文本对照、类型和端口校验、地址规范化、回环限制、架构 / 无效资产、实际引用、独立采用 / 应用、配对版本、共享去重、部分失败、visitor 清理、生命周期及刷新保留。

浏览器命令：`python3 tests/browser-frp-linkage.py`、`python3 tests/browser-asset-linkage.py`，先按 README 启动 localhost 静态服务。使用 Chromium 的实际点击、输入、文件选择、确认、取消、Escape 与刷新。上传素材仅为合成 ELF 文件头，不是 FRP 程序，未执行素材。TOML 转义以独立 Python tomllib 解析生成字符串验证；不运行压缩包生成器。

通过、失败、未测范围见[验收证据](frp-validation.md)。截图为本次相同静态源的本地浏览器操作，不能代替线上访问复测或真实部署验收。
