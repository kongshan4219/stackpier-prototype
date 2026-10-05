# FRP 原型验收证据

验证对象为本次提交的浏览器前端与 localStorage 模拟。附件只静态读取，四个 0 B 程序不执行；附件 README 的历史验证不计入本次结果。行为对照见[附件规则](frp-reference-behavior.md)，使用方法见[原型 README](../README.md)。

## 通过

| 检查 | 实际结果 |
| --- | --- |
| 仓库已有与新增自动化测试 | `node --test --test-isolation=none tests/*.test.mjs`：129 项通过，0 失败；包括 15 项附件专项测试。 |
| JavaScript 语法与入口 | 58 个本地脚本 `node --check` 通过；入口资源均存在、按顺序加载，无重复依赖。 |
| 附件静态内容 | config.json 四节点逐字段一致；10 份生成 TOML 与 10 份 unit 逐文本对照通过；静态 TOML 独立解析通过。 |
| FRP 浏览器实测 | Chromium，68 个检查点通过，0 页面 JavaScript 异常；实际输入、文件选择、点击、取消、采用、确认应用、读取失败、清理、Escape 与刷新。 |
| 既有文件联动浏览器回归 | Chromium，63 个检查点通过，0 页面 JavaScript 异常；文件 / 配置 / 项目跳转、编辑内上传、路径校验与版本联动保持。 |
| 响应式 | 320、390、820、1440px：文件抽屉无页面或内部水平溢出；Escape 回到角色预览，部署弹窗可取消。 |
| 静态发布包 | 没有 npm、TypeScript 或打包构建任务；发布使用同一入口和 assets，逐文件对照源码、检查 hosting 身份与静态归档。 |

FRP 浏览器检查涵盖：附件与工作清单切换保留编辑；默认 / all / 指定 false 目标；0 B 阻塞；上传四个合成 ELF 文件头后 x86_64 / aarch64 匹配；缺架构、失效固定引用阻塞；STCP 非回环表单拒绝；跨模块定位与来源返回；连接 / 模板未保存编辑和刷新保留；公共保存只提示更新、采用仅改指定草稿、应用单独确认；读取失败保留时间；三角色预览；批量中间失败仍显示后续成功；最后 STCP 删除后的 visitor 清理确认；独立生成记录清理。

TOML 引号、反斜杠、换行和制表符以独立 Python tomllib 解析浏览器实际生成结果验证。缺架构和失效引用的浏览器异常路径使用明确的状态故障注入，其余主要流程通过界面完成。上传素材只有合成 ELF 头，未验证或运行 FRP 程序。

自动化另覆盖布尔值拒绝、端口上下界 / 小数、重复规范化 IPv6、控制 / 公网 TCP / visitor 监听冲突、同主机及跨主机关系、相同本地目标允许、STCP 配对版本、全局 token 分叉阻塞、共享 FRPS 去重、实际已应用架构引用、部分 / 未知 / 迟到结果、卸载保留生成文件、旧编辑迁移与主动清空资产 / 配置 / 连接。

## 关键截图

- [公共 FRPC 反向引用与历史版本](screenshots/frp-asset-references-desktop.png)
- [附件四节点参考清单](screenshots/frp-attachment-reference-desktop.png)
- [0 B 程序阻止部署](screenshots/frp-placeholder-blocked-desktop.png)
- [三角色部署落点预览](screenshots/frp-three-role-preview-desktop.png)
- [项目已应用 / 读取 / 公共来源与草稿](screenshots/frp-project-snapshots-desktop.png)
- [visitor 清理确认范围](screenshots/frp-visitor-cleanup-desktop.png)
- [批量部分失败及后续结果](screenshots/frp-batch-partial-desktop.png)
- [390px 配置详情抽屉](screenshots/frp-config-detail-mobile.png)

截图由测试脚本保存，代表本地同一静态源码上的模拟操作，不是远端服务器证据。

## 失败与未测

上述本地验收没有剩余失败。真实 FRP verify、程序执行、SSH / SCP / systemctl、端口探测、服务器上传、实际延迟、日志与业务连通均未测且未执行；本轮只实现浏览器模拟。

主仓库正式应用代码未修改，不推进后端契约、数据库或真实部署实现。目录 / unit / 主机身份的真实迁移未实现，普通应用仍明确阻止隐式迁移。

公开发布以现有 Site 的部署状态为证据；本环境出站代理不允许该公开域名，线上浏览器复测未进行。发布结果、源码 SHA 与草稿 PR 链接在 PR 及交付说明中报告，不用本地截图宣称线上交互已复测。
