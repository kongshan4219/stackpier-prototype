# 栈桥原型 · 精密控制台

2026-11-03 按用户选定的视觉方向 A「精密控制台」重做的设计系统与交互原型。依据为主仓库 [功能映射](../../designs/stackpier-redesign/capability-map.md)，不沿用旧原型的页面结构或模拟能力。旧原型（`../index.html`、`../assets/`、`../src/radix/`）保留为历史参照。

**全部数据为虚构，所有操作只在浏览器内存中模拟，不连接任何服务器。** 页面右上角「原型模拟」菜单可切换示例数据 / 空实例 / 读取失败 / 慢速读取，并重置数据；部署、FRP 预览中的「原型控制」用于选择模拟结果。

## 技术选型

React 19 + [Radix Primitives](https://www.radix-ui.com/primitives)（无样式，负责焦点、键盘、Portal 与 ARIA）+ 语义 CSS Token + TypeScript，由 esbuild 打包。不使用 Tailwind、Ant Design 或 CDN。理由：Token 与组件样式一一对应、易于审阅；Radix 提供可靠的无障碍行为，视觉完全由本系统决定。

## 目录

| 路径 | 职责 |
| --- | --- |
| `ds/tokens.css` | 唯一的设计 Token：颜色（浅 / 深）、字体、间距、尺寸、圆角、动效。 |
| `ds/components.css` | 组件与基础样式，只引用 Token。 |
| `ds/*.tsx` | 组件 API：Button、Status、Badge、Field、Input、Select、Checkbox、Switch、ChoiceGroup、Segmented、Panel、KeyValue、Facts、Callout、Empty、Loading、Code、Diff、Steps、Consequences、Dialog、ConfirmDialog、Menu、Tooltip、Tabs、Toast。 |
| `shell.tsx`、`shell.css` | 导航（工作空间 / 部署资源 / 网络 / 运行）、顶栏、窄屏抽屉、主题、原型场景菜单。 |
| `data/` | 领域类型、虚构数据与模拟 store（操作计时结束、核对未知结果）。 |
| `pages/` | 各页面；`design-system.tsx` 是组件实时预览（路由 `#/design-system`）。 |

## 构建与预览

依赖与产物放在仓库外：

```sh
D=/srv/cache/stackpier-tmp/<task>/deps; O=/srv/cache/stackpier-tmp/<task>/app-out
mkdir -p $D && cp package.json package-lock.json $D/ && (cd $D && npm ci)
STACKPIER_PROTOTYPE_DEPS=$D STACKPIER_PROTOTYPE_OUTPUT=$O npm run build:app   # 先做 TypeScript 检查
python3 -m http.server <port> --bind 127.0.0.1 -d $O
STACKPIER_PROTOTYPE_DEPS=$D STACKPIER_APP_URL=http://127.0.0.1:<port>/ node tests/app-browser.mjs
```

## 设计规则

- 对象身份（名称 + `user@host:port` / 路径 / 修订）始终可见，标识用等宽字体。
- 状态统一使用 `Status`：颜色 + 形状 + 文字；结果未知为菱形。领域状态到 tone 的映射集中在 `lib.ts`。
- 有后果的操作：表单 → 预览（目标、快照、差异、`Consequences`）→ 单独确认；危险操作用 `danger`，不可逆的需输入名称。
- 需要核对的结果留在页面（`Callout`），Toast 只做短暂确认。结果未知时阻止相关写操作，引导「核对原操作」。
- 每个读取经 `LoadGate`：读取中、失败可重试、空状态都有明确文字与下一步。
- 窄屏（≤760px）：抽屉导航，控件至少 40px，弹窗全屏、底部操作固定；宽表在自身容器内横向滚动。

## 覆盖与缺口

已覆盖（均为模拟）：总览；项目列表、部署失败记录（残留清理，记录保留）与详情六个分类（概览、配置草稿与差异、巡检、日志、操作记录、文件核对）；启停、受控更新、完整卸载（Compose 列出容器、命名卷与归属阻止规则）；四步部署（类型 → 三项输入 → 预览 → 执行，含成功 / 失败 / 结果未知）；服务器接入（指纹信任）、详情与凭据更换；部署配置三种类型的编辑、校验与放弃确认；文件上传与版本；FRP 连接、映射添加 / 解除与探测；DNS 连接、Zone、分页、记录增改删与差异；防火墙系统规则（批量删除、1Panel 格式导入导出）、Docker、端口转发（IPv6 风险提示）、设置、重置与旧记录只读入口；巡检、异常历史、通知投递（按 ID 查询、结果未知提示）与 Webhook 渠道；操作记录与核对；设置。

仍为简化：防火墙白名单与逐条编辑、DNS 服务端分页只在本地模拟、受控更新只演示程序版本替换。
