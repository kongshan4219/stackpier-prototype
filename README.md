# 栈桥交互原型

当前入口是 [app/](app/README.md)，采用精密控制台 Radix Primitives + CSS Token。全部数据为虚构，操作只在浏览器内模拟，不连接真实服务器。

| 目录 | 职责 |
| --- | --- |
| `app/` | 当前原型与设计系统源码 |
| `scripts/build-app.mjs` | 当前构建与类型检查 |
| `tests/` | 当前原型浏览器回归 |
| [legacy/radix-tailwind/](legacy/radix-tailwind/README.md) | 旧原型、模拟模型、历史检查脚本与独立依赖 |
| `docs/` | 历史功能说明、验收与截图；保留证据身份 |

在本目录运行 `npm run build`（`build:app` 为兼容别名），按 [app 构建说明](app/README.md#构建与预览)设置独立依赖与输出目录。

旧版使用 `npm run build:legacy`；`STACKPIER_PROTOTYPE_DEPS` 必须指向使用 `legacy/radix-tailwind/package.json` 与锁文件安装的独立依赖目录，不与当前依赖混用。`npm test` 保留旧模拟单元回归入口，等价于 `npm run test:legacy`；当前原型浏览器检查仍使用 `tests/app-browser.mjs`。
