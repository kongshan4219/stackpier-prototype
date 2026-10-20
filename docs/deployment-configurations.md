# 公共部署配置

配置编辑按正式 Web UI 的 `webui/src/pages/ConfigurationEditor.tsx` 对齐。保存生成公共配置新修订，已有项目和操作保留固定快照；首次部署选择配置，见[部署配置选择流程](deployment-config-selection.md)。

## 表单与布局

新建和编辑共用 680px 弹窗，字段顺序、必填、禁用、数值范围和窄屏布局以正式编辑器为准。开头是“配置名称”和“配置类型”；编辑已有配置时类型不可更改，并显示当前 C 修订。

| 类型 | 编辑内容 |
| --- | --- |
| systemd | 程序固定版本、配置固定版本、1024–65535 健康检查端口；程序通过 STACKPIER_CONFIG 读取配置，并提供回环 /health。 |
| Compose | Compose YAML 正文、显式变量 JSON、附加文件；同名上传替换当前草稿中的附件，支持移除。 |
| FRP | x86_64 程序固定版本、服务角色、认证 Token、控制地址 / 端口、回环管理端口、允许映射端口范围。已有配置的角色不可更换。 |

不再在公共配置编辑器提供任意 systemd 正文、架构规则、目标绝对路径、FRP 生成模板、运行用户或预先选择连接。新 systemd 配置在部署预览时按服务名生成模拟独占落点。FRPC / visitor 初始为未绑定的 `127.0.0.1:9`，连接与 TCP / STCP 映射在 FRP 页面管理。

## 保存与草稿

- 取消或返回部署不保存；同一页面会话内按配置 ID / 新建类型保留草稿，切换新建类型可恢复各自输入。
- 刷新后读取已保存配置，不恢复未保存正文、变量或附件。返回部署上下文只记录类型、配置 ID、服务器 ID 和服务名。
- Token 从不回填，不进入编辑缓存；离开编辑器或更换类型 / 角色即清空。仍只接受 `EXAMPLE_` / `DEMO_` 开头的虚构值；留空保留已保存凭据。
- 保存失败保留输入；读取时的配置修订与当前修订不一致时拒绝覆盖。保存不会建立项目、自动采用更新或启动部署。
- 浏览器存储配额不足或不可用时拒绝保存，保留原配置与草稿，移除附件后可重试。
- 上传中禁用保存；晚到的文件读取结果不会覆盖已关闭或已切换类型的编辑器，读取期间填写的正文保持。

## 附件与校验

Compose 附件独立于公共文件库，路径固定为 `files/文件名`，正文通过 `./files/文件名` 只读挂载。文件名使用英文、数字或 `._-`，不超过 100 字符；单文件 1 B–1 MiB，总量 2 MiB，最多 32 个。原型保存附件字节用于模拟固定快照，不执行传输。

变量须为最多 64 项的 JSON 字符串对象；名称不超过 64 字符，值不超过 8192 UTF-8 字节且不含 NUL。原型不实现正式后端的 Compose YAML 白名单解析、变量展开或真实资源检查。

FRP 校验私网 / 回环控制地址、管理与控制端口冲突、最多 256 个映射端口及保留端口排除。Token 只用于虚构浏览器状态；原型不提供真实数据库凭据保护，也不验证程序来源或可执行性。

## 历史数据

打开编辑器不迁移或重写已保存配置、项目草稿、已应用参照和读取记录。原任意正文 / 文件映射保留在历史修订；明确保存后生成新结构的公共修订。历史 Compose 绝对路径映射在编辑器提示重新上传所需附件，不默默带入新修订。

公共文件仍按稳定 ID 和内容修订选择，不跟随最新文件。原型可查看配置历史与文件反向引用；这不表示正式应用已有公共历史恢复功能。项目采用与应用是独立操作，见[资产版本联动](asset-linkage.md)。

## 组件与验证

`assets/features/deployments/` 中的 `editor-state.js` 管理内存草稿，`editor-view.js` 渲染表单，`editor-files.js` 读取附件，`editor-save.js` 校验保存，`editor-plan.js` 转换新的模拟预览；`frp-services.js` 提供 FRP 字段与校验。入口仅装配。

组件回归入口为 `tests/configuration-editor.test.mjs` 与 README 的全量测试。浏览器入口 `tests/browser-configuration-editor.mjs` 需要 `STACKPIER_PREVIEW_URL`、`STACKPIER_ACTUAL_URL`、`STACKPIER_SCREENSHOTS`，并通过 `STACKPIER_PLAYWRIGHT_MODULE` / `CHROMIUM` 指定已有依赖。实际构建使用虚构 API 替身，原型使用隔离浏览器状态；不连接真实实例、数据库或服务器。

2026-10-21 对照主仓库 `cf5ab00` 的本次 Web UI 构建，通过 233 项组件测试与 296 项 Chromium 检查（配置编辑 67、项目配置 65、资产联动 57、操作上下文 54、服务生命周期 53）。配置编辑覆盖 1440px / 390px 的字段顺序、必填 / 只读、数值范围、弹窗尺寸、附件替换、错误保留、存储失败、修订冲突、Token 清空、刷新与保存返回。80 个 JavaScript 文件语法及 91 项入口资源检查通过。

| 原型截图 | 桌面 | 手机 |
| --- | --- | --- |
| systemd | [1440px](screenshots/configuration-editor/prototype-systemd-1440.png) | [390px](screenshots/configuration-editor/prototype-systemd-390.png) |
| Compose | [1440px](screenshots/configuration-editor/prototype-compose-1440.png) | [390px](screenshots/configuration-editor/prototype-compose-390.png) |
| FRP | [1440px](screenshots/configuration-editor/prototype-frp-1440.png) | [390px](screenshots/configuration-editor/prototype-frp-390.png) |

实际构建的 systemd 对照：[桌面](screenshots/configuration-editor/actual-systemd-1440.png)、[手机](screenshots/configuration-editor/actual-systemd-390.png)。FRP 提示保留“仅接受虚构 Token”的原型限制，不声称具备真实私有数据库。以上为本地自验证，用户视觉验收与发布待完成。
