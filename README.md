# 栈桥交互原型

入口为 [index.html](index.html)。数据和操作均为浏览器内模拟，演示状态保存在当前站点的 localStorage，不连接真实服务器。

原型用于讨论产品需求和交互。页面中的模拟功能不自动成为正式应用的功能范围或实现方案，正式前后端按本轮确认的需求设计。

## 组件目录

| 路径 | 职责 |
| --- | --- |
| `assets/components/` | 工作台外壳、图标、公共控件和弹窗容器。 |
| `assets/features/` | 各功能页面、弹窗、按钮及表单处理。 |
| `assets/features/assets/` | 稳定 ID / 修订关系、迁移、文件与配置详情抽屉、落点预览和单项目采用。 |
| `assets/features/programs.js`、`assets/features/programs/` | 通用文件列表、内容分析、上传和命名确认；可识别的 ELF 文件额外记录架构。 |
| `assets/features/deployments.js`、`assets/features/deployments/` | 部署配置列表、编辑及文件到目标路径的映射。 |
| `assets/features/projects/` | 项目列表、详情、部署、失败记录、残留清理及服务器文件观测。 |
| `assets/features/frp/` | FRP 参考模板、虚构样例、模型、文件生成、页面、弹窗和模拟操作。 |
| `assets/features/operations/` | 操作记录界面、模拟执行与结果处理。 |
| `assets/features/network/` | Cloudflare 账号、逐 Zone DNS 权限、防火墙及网络模拟操作。 |
| `assets/core/` | 状态持久化、工具、导航、交互注册表、事件分发和加载失败提示。 |
| `assets/data/` | 虚构初始数据与试用场景。 |
| `assets/styles/` | 设计变量、公共样式和响应式规则；FRP 专用样式位于对应功能目录。 |
| `assets/boot.js` | 全部组件就绪后的初始化入口。 |
| `tests/` | 浏览器接口的内存替身与组件交互测试。 |

## 交互说明

- [界面规则](docs/interface-guidelines.md)：文字层级、公共组件、响应式与键盘操作。
- [文件](docs/files.md)：任意类型文件的上传、架构识别、命名、去重与替换规则。
- [资产版本联动](docs/asset-linkage.md)：文件修订、项目草稿、已应用/读取快照、迁移及关键截图。
- [部署配置](docs/deployment-configurations.md)：配置正文、文件映射及项目采用规则。
- [部署项目](docs/project-deployment.md)：部署入口、失败记录、残留清理和同机项目名唯一性。
- [项目文件与巡检](docs/project-files-and-checks.md)：服务器实际文件读取、检查方式和已移除范围。
- [Cloudflare 账号与 DNS](docs/cloudflare-accounts.md)：统一账号管理、逐 Zone 权限、固定身份提交与旧数据迁移；[验证与截图](docs/cloudflare-validation.md)。
- [FRP 连接与部署](docs/frp-connections.md)：三角色流程、公共资产引用、独立采用 / 应用；[附件行为对照](docs/frp-reference-behavior.md)与[验收证据](docs/frp-validation.md)。

## 维护方法

`index.html` 直接列出本地 CSS 和原生 JavaScript，按依赖顺序加载，不需要安装依赖或构建。

修改功能时，在对应组件中维护渲染和交互。公共弹窗容器负责打开、关闭、焦点和布局；功能通过 `registerPrototypeHandlers` 注册处理逻辑。新增组件同步维护入口加载顺序，避免聚合成单个大文件。

## 预览与验证

在本目录启动仅监听回环地址的静态服务：

```sh
python3 -m http.server 4311 --bind 127.0.0.1
```

浏览器访问 `http://127.0.0.1:4311/`，结束后停止自己启动的服务。

运行组件测试：

```sh
node --test --test-isolation=none tests/*.test.mjs
```

页面或交互修改还需在浏览器检查相关流程、布局、焦点和弹窗。测试结果只代表原型模拟，不代表正式应用实现或用户验收。
