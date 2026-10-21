# 公共部署配置

Compose 与 FRP 配置编辑按正式 Web UI 的 `webui/src/pages/ConfigurationEditor.tsx` 对齐；systemd 按本轮确认的新设计提供服务正文与路径映射，正式能力待后续实现。保存生成公共配置新修订，已有项目和操作保留固定快照；首次部署选择配置，见[部署配置选择流程](deployment-config-selection.md)。

## 表单与布局

新建和编辑共用 680px 弹窗，Compose / FRP 字段与正式编辑器对照；systemd 字段按下表的新设计验证。开头是“配置名称”和“配置类型”；编辑已有配置时类型不可更改，并显示当前 C 修订。

| 类型 | 编辑内容 |
| --- | --- |
| systemd | 必填服务文件正文、文件／目录映射；每行类型、本机绝对路径、远程绝对路径。默认核验服务运行状态，业务健康检查以后单独配置。 |
| Compose | Compose YAML 正文、显式变量 JSON、文件／目录映射；每行类型、本机绝对路径、远程绝对路径，支持添加与移除。 |
| FRP | x86_64 程序固定版本、服务角色、认证 Token、控制地址 / 端口、回环管理端口、允许映射端口范围。已有配置的角色不可更换。 |

systemd 正文保留注释、空白与换行，不做变量替换；用户在正文中填写程序与配置路径。unit 落点由部署服务名确定，预览显示原文与固定映射。表单不再选择程序固定版本、配置固定版本或健康检查端口。Compose / FRP 继续沿用各自字段。FRPC / visitor 初始为未绑定的 `127.0.0.1:9`，连接与 TCP / STCP 映射在 FRP 页面管理。

## 保存与草稿

- 取消或返回部署不保存；同一页面会话内按配置 ID / 新建类型保留草稿，切换新建类型可恢复各自输入。
- 刷新后读取已保存配置，不恢复未保存正文、变量或附件。返回部署上下文只记录类型、配置 ID、服务器 ID 和服务名。
- Token 从不回填，不进入编辑缓存；离开编辑器或更换类型 / 角色即清空。仍只接受 `EXAMPLE_` / `DEMO_` 开头的虚构值；留空保留已保存凭据。
- 保存失败保留输入；读取时的配置修订与当前修订不一致时拒绝覆盖。保存不会建立项目、自动采用更新或启动部署。
- 浏览器存储配额不足或不可用时拒绝保存，保留原配置与草稿，移除附件后可重试。
- 路径映射只保存表单值；原型不检查本机来源是否存在，也不读取来源内容。

## 映射与校验

本机指运行管理端的机器，文件映射两端填写完整文件名；目录映射同步内容，两端有无末尾 `/` 行为相同。路径须为规范绝对路径，远程目标不得重复、互相包含或覆盖系统运行 / 栈桥受管目录。Compose 使用远程绝对路径只读挂载；systemd 正文直接引用远程目标。Compose 正式能力及 systemd 新设计在部署预览固定内容，先 rsync 完全同步目录并删除目标目录内多余内容，文件只覆盖对应目标文件，同步成功后启动；卸载保留映射目标。systemd 无附带文件时可不添加映射，默认只核验服务运行状态，业务健康显示未配置。原型仅保存虚构路径并模拟流程，不读取本机文件或执行 rsync，也不解析或执行 systemd 指令。正式快照最多 32 行、32 MiB／1024 个条目。

变量须为最多 64 项的 JSON 字符串对象；名称不超过 64 字符，值不超过 8192 UTF-8 字节且不含 NUL。原型不实现正式后端的 Compose YAML 白名单解析、变量展开或真实资源检查。

FRP 校验私网 / 回环控制地址、管理与控制端口冲突、最多 256 个映射端口及保留端口排除。Token 只用于虚构浏览器状态；原型不提供真实数据库凭据保护，也不验证程序来源或可执行性。

## 历史数据

打开编辑器不迁移或重写已保存配置、项目草稿、已应用参照和读取记录。原任意正文 / 文件映射保留在历史修订；已有正文原样带入编辑区。固定程序模式没有正文时保留空的必填编辑区，并提示重新填写正文和映射，不用资产 ID 猜测管理端路径。明确保存后生成 `editorSchema=2` 的新 systemd 公共修订。历史公共资产映射不自动转成管理端路径；新的 `pathMappings` 与旧模型分开保存。旧项目不自动采用；新正文模式的项目更新后续设计，不套用原固定程序 / JSON 配置流程。新预览为目录固定 `deleteExtraneous: true`；历史项目 / 操作缺少此标记时仍展示不删除规则，不回写历史快照。已有旧版附件继续保留内容与移除操作，不再提供新上传。

公共文件仍按稳定 ID 和内容修订选择，不跟随最新文件。原型可查看配置历史与文件反向引用；这不表示正式应用已有公共历史恢复功能。项目采用与应用是独立操作，见[资产版本联动](asset-linkage.md)。

## 组件与验证

`assets/features/deployments/` 中的 `editor-state.js` 管理内存草稿，`editor-view.js` 渲染表单，`editor-files.js` 管理映射行与旧附件，`editor-save.js` 校验保存，`editor-plan.js` 固定新的模拟预览正文与映射；`frp-services.js` 提供 FRP 字段与校验。入口仅装配。

组件回归入口为 `tests/configuration-editor.test.mjs` 与 README 的全量测试。浏览器入口 `tests/browser-configuration-editor.mjs` 需要 `STACKPIER_PREVIEW_URL`、`STACKPIER_ACTUAL_URL`、`STACKPIER_SCREENSHOTS`，并通过 `STACKPIER_PLAYWRIGHT_MODULE` / `CHROMIUM` 指定已有依赖。该对照入口仅对 Compose / FRP 检查正式字段；systemd 独立入口 `tests/browser-systemd-configuration.mjs` 只需原型 URL 和截图目录，验证新设计。实际构建使用虚构 API 替身，原型使用隔离浏览器状态；不连接真实实例、数据库或服务器。

2026-10-21 对照主仓库 `cf5ab00` 的本次 Web UI 构建，通过 233 项组件测试与 296 项 Chromium 检查（配置编辑 67、项目配置 65、资产联动 57、操作上下文 54、服务生命周期 53）。配置编辑覆盖 1440px / 390px 的字段顺序、必填 / 只读、数值范围、弹窗尺寸、附件替换、错误保留、存储失败、修订冲突、Token 清空、刷新与保存返回。80 个 JavaScript 文件语法及 91 项入口资源检查通过。

| 原型截图 | 桌面 | 手机 |
| --- | --- | --- |
| systemd | [1440px](screenshots/configuration-editor/prototype-systemd-1440.png) | [390px](screenshots/configuration-editor/prototype-systemd-390.png) |
| Compose | [1440px](screenshots/configuration-editor/prototype-compose-1440.png) | [390px](screenshots/configuration-editor/prototype-compose-390.png) |
| FRP | [1440px](screenshots/configuration-editor/prototype-frp-1440.png) | [390px](screenshots/configuration-editor/prototype-frp-390.png) |

实际构建的 systemd 对照：[桌面](screenshots/configuration-editor/actual-systemd-1440.png)、[手机](screenshots/configuration-editor/actual-systemd-390.png)。FRP 提示保留“仅接受虚构 Token”的原型限制，不声称具备真实私有数据库。以上为本地自验证，用户视觉验收与发布待完成。

## 文件／目录映射迭代

本次改为三列映射表单并同步正式前后端。234 项原型组件检查通过；与本次正式构建对照的 73 项浏览器检查通过，覆盖 1440 / 390px、映射添加与移除、文件后缀错误、目录路径归一、完全同步提示与固定预览、存储失败和保存返回。旧附件的字节保存检查只用于历史数据，不表示仍提供上传入口。

映射截图：[正式桌面](screenshots/configuration-editor/actual-mappings-1440.png)、[正式手机](screenshots/configuration-editor/actual-mappings-390.png)、[原型桌面](screenshots/configuration-editor/prototype-mappings-1440.png)、[原型手机](screenshots/configuration-editor/prototype-mappings-390.png)。上述旧编辑器截图仍归属所注明的旧版本。新映射尚未发布，用户体验验收待完成。

## systemd 正文与映射迭代

本轮仅设计与原型：新增和编辑使用正文、文件／目录映射，保存只生成公共修订；模拟部署预览固定正文与映射，目录显示完全同步与删除规则。成功按 systemd 运行状态设计，业务健康检查以后配置。配置页展示新模式的固定正文、unit 和映射元数据；没有读取来源内容时不提供映射内容核对结论。正式实现、用户交互验收与发布分别待后续完成。

本轮本地通过 243 项组件测试、89 项 Chromium 桌面 / 手机交互检查，以及 80 个 JavaScript 文件语法与 91 项入口资源检查。覆盖正文空值和前导换行保真、路径校验与跨项目冲突、取消 / 类型切换草稿、存储失败重试、旧修订保留、保存返回、固定预览、运行状态与业务健康区分、失败清理保留外部映射。仅归属于此原型，不代表正式执行或用户验收。

| 本轮截图 | 1440px 桌面 | 390px 手机 |
| --- | --- | --- |
| 新增 systemd | [编辑器](screenshots/systemd-configuration/prototype-systemd-unit-1440.png) | [编辑器](screenshots/systemd-configuration/prototype-systemd-unit-390.png) |
| 文件与目录映射 | [映射](screenshots/systemd-configuration/prototype-systemd-unit-mappings-1440.png) | [映射](screenshots/systemd-configuration/prototype-systemd-unit-mappings-390.png) |
| 固定部署预览 | [预览](screenshots/systemd-configuration/prototype-systemd-unit-preview-1440.png) | [预览](screenshots/systemd-configuration/prototype-systemd-unit-preview-390.png) |
