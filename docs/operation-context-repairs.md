# 操作上下文、返回修改与路由验收

最新产品规则已将角色服务部署并入项目，FRP 只管理配置；本文保留前轮修复背景，当前流程与证据以[生命周期验收](service-lifecycle-validation.md)为准。

本轮从 `62924ca5ba5ae09e581260b88980514ba80cc081` 起修复，保留 Cloudflare 多账号、公共文件联动及 FRP 三角色实现。未改主仓库落后的子模块指针。范围为前端与 localStorage 模拟；不执行真实服务器、Docker、SSH、防火墙或 Cloudflare 请求。

## 行为与实现

- `core/targets.js` 为项目、FRP、主机防火墙提供同一前置检查；离线、待核对、身份不匹配、无权限、检查失败均阻止执行。模拟服务器检查可明确更新状态与时间。DNS 只检查账号 / Zone 权限。
- 项目与防火墙新增继承单服务器筛选，全部视图使用空目标。已有防火墙的服务器不可编辑，提交和结果处理都拒绝变更归属；复制生成新 ID，删除独立确认，解除用途不删除共享规则。
- FRPC 程序安装、共享 FRPS、连接服务、visitor 分别按稳定 ID 定位。程序角色不显示连接草稿或运行状态；旧误生成草稿保留在历史字段，不覆盖应用参照。失效连接不冒充项目被删除。
- 通用部署选项排除 FRP（含旧自定义配置），提供携带服务器的专用入口。原有历史 frpc-edge / 7400 项目保留。
- DNS 与防火墙先展示完整确认摘要；编辑突出差异，删除展示全部属性。账号 / Zone / 凭据修订和服务器目标固定；确认后变化会阻止覆盖或保留未知，不重提。
- “返回修改”恢复草稿，“放弃编辑”单独确认。关闭保留非敏感草稿，账号只持久化名称、Account 选择和演示授权选项，Token 从不回填或持久化。旧 DNS 草稿遇到凭据变化，需点击“重新核对当前目标与凭据修订”。
- 部署预览展示实际正文和全部落点，区分显示名称、unit 名、正文路径及映射路径。“复制为此项目配置”只编辑项目副本，保留服务器与项目名；正文原样交付，不做字符串替换。已登记的同机端口和文件落点冲突阻断，不推断任意脚本语义。
- 安装角色应用固定采用后的程序 / 配置草稿，不自动跟随公共最新；保存、采用、模拟应用仍为三个独立动作。
- `core/routes.js` 用 hash 路由记录页面、项目 / 公共资产详情、FRP 连接与角色、主要标签及稳定筛选。Back、Forward、刷新恢复位置；无效对象提供提示与安全返回。URL 仅含白名单 ID 和标签，不包含正文、Token 或密钥；重复渲染不重复添加历史。
- `interaction-drafts.js` 仅增量增加草稿字段，不更换存储 key、不提升全局版本、不重新填充主动清空的列表。FRPC 旧错误连接草稿归档后迁移幂等。
- 未变化的应用参照 / 公共正文可展开，默认突出落点、变化、阻塞及下一步。服务运行、隧道可达、应用健康、公网传播继续分别表达。

## 复现与复验

所有操作使用隔离浏览器和专门的虚构 QA 数据，不读取用户浏览器数据。初始七项复现测试在修复前全部失败；其后新增身份、权限、路由、迁移、竞争和副本测试。

| 用户问题 | 状态 | 复验步骤与预期 |
| --- | --- | --- |
| 1. 新增丢服务器上下文 | 已修复 | 项目 / 防火墙筛选备用节点→新增→预览→确认；表单、记录、结果均固定 s4。全部视图要求选择；ARM 目标保持选择并阻断。 |
| 2. 编辑防火墙换机 | 已修复 | 编辑服务器禁用；伪造归属被拒绝。复制选择另一服务器后得到新 ID，原规则不变；取消删除无执行。 |
| 3. FRP 入口与身份错误 | 已修复 | 安装 FRPC / 共享 FRPS→服务器角色管理；连接 / visitor→对应连接角色。通用部署使用专用入口；0 B 与缺架构阻断。 |
| 4. DNS / 账号不能返回修改 | 已修复 | 填写→确认 / 检查→返回修改；名称、内容、TTL、代理、Zone / 授权选项保留，Token 空白；关闭和刷新可恢复。 |
| 5. 网络确认摘要不足 | 已修复 | DNS / 防火墙编辑和删除查看账号、Zone 或服务器及全部属性；编辑显示前后差异；未知操作只核对原目标。 |
| 6. 新项目无法适配正文 | 已修复 | 展开原样正文→复制为项目配置→改正文、声明端口和映射→重新预览→部署；应用内容与确认副本一致，公共配置不变。 |
| 7. Back / Forward 离开原型 | 已修复 | FRP n3→DNS→Back→Forward→刷新；恢复连接、标签和账号筛选；无效 URL 安全返回，敏感参数不保留。 |
| 8. 主机检查规则不一致 | 已修复 | 待核对 ARM 的项目、FRP、防火墙不能直接执行成功；关联主机离线不阻断有权限的 DNS。 |
| 9. 默认重复信息过多 | 已修复 | 正文预览、已应用参照和公共正文按需展开；明确保存、采用、应用区别，不自动部署。 |
| 10. 旧状态 / 刷新 | 未复现重置；回归通过 | 重复加载与迁移保留项目、文件、配置、FRP、账号、记录、历史及编辑；清空不重新填充。刷新中断转未知并保留原操作。 |
| 11. 桌面 / 窄屏与焦点 | 已通过复验 | 1440 与 390 px 实际输入、确认、返回修改、关闭后焦点、放弃编辑；既有回归补测 320 / 768 / 1024 px。 |

## 测试证据

执行命令：

```sh
node --test --test-isolation=none tests/*.test.mjs
python3 tests/browser-operation-context.py
python3 tests/browser-frp-linkage.py
python3 tests/browser-cloudflare.py
python3 tests/browser-asset-linkage.py
```

浏览器为 Chromium / Playwright，使用真实点击、选择、输入、Back、Forward、刷新；网络只读取 localhost 静态资源。全量 Node 测试 162 项通过；浏览器操作修复 64 项、FRP 70 项、Cloudflare 54 项、文件联动 63 项全部通过，0 页面脚本异常；66 个脚本 `node --check` 通过。

仓库为静态 HTML / CSS / 经典 JavaScript，没有 TypeScript、npm 构建命令或类型检查配置。发布构建复制 `index.html` 和 `assets/` 至 Site `dist/`，检查脚本 / 样式引用存在、脚本顺序、CSP、归档文件和源码字节一致。

FRP 成功、部分失败、共享 FRPS 去重、版本隔离与 visitor 清理由 Node 模拟测试覆盖；测试使用另建的 `qa-frp-bin-*` 资产，不修改原始四个 0 B 文件。浏览器使用真实上传的独立合成 QA ELF 文件头素材，覆盖三角色模拟应用、部分失败、visitor 清理、身份、落点、架构、0 B 阻断与去重；文件从未执行，未声称原占位程序成功部署。

未测 / 无法覆盖：真实服务器与可执行 FRP、真实防火墙、真实 Cloudflare API、公网传播、生产凭据；0 B 占位的成功部署保持不可测试状态。没有未修复的已报告交互项。

关键截图（全部虚构 QA 数据）：

- [项目副本落点](screenshots/operation-project-preview-desktop.png)
- [防火墙完整确认](screenshots/operation-firewall-confirm-desktop.png)
- [FRPC 服务器角色管理](screenshots/operation-frp-role-desktop.png)
- [DNS 前后差异](screenshots/operation-dns-confirm-desktop.png)
- [账号返回修改与空 Token](screenshots/operation-cloudflare-back-desktop.png)
- [390 px DNS 确认与返回修改](screenshots/operation-dns-confirm-mobile.png)
- [独立 QA 资产三角色预览](screenshots/operation-frp-qa-preview-desktop.png)
- [QA 批量部分失败与后续成功](screenshots/operation-frp-qa-batch-desktop.png)
- [QA visitor 清理范围确认](screenshots/operation-frp-qa-cleanup-desktop.png)

发布目标固定为现有 `appgprj_6ac293e53e348191a7b50433d8cd19e9`，访问设置保持公开；发布结果及源码 SHA 以草稿 PR 与最终交付为准。
