# Radix 原型验证

2026-11-03，针对[本地重做稿](radix-redesign.md)。源码与本报告同一提交，主仓库 `docs/prototype.md` 记录固定指针。未推送、未发布，正式 Web 未修改。

## 实际结果

| 检查 | 结果 | 主要覆盖 |
| --- | --- | --- |
| 组件与模拟模型 | 287 / 287 通过 | 资产修订、项目草稿、固定目标、路由、迁移、恢复、防火墙输入校验 |
| browser-radix.mjs | 219 项通过 | 13 个页面/详情入口，1440 / 390 深浅主题，320 / 768 / 820 / 821 / 1024 布局，项目筛选/视图、恢复证据、部署预览、Tabs/返回、空/加载/失败、键盘与导航 |
| browser-radix-forms.mjs | 65 项通过 | 七类编辑弹窗的视口、正文滚动与可见操作栏，Compose 校验与原文保存，资产逐级详情/返回，快速 Escape 与焦点恢复，登录和长名称 |
| browser-firewall-1panel-port.mjs | 41 项通过 | 四模块、增改取消、JSON 导入/导出、服务器隔离、Docker 策略、转发、重置备份、未知/部分结果、320 / 390 / 1440、深色与键盘 |
| browser-project-configuration.mjs | 65 项通过 | 固定部署信息、受管文件摘要、失败保留成功快照、独立草稿、Compose / FRP、桌面/手机 |
| browser-systemd-configuration.mjs | 89 项通过 | 服务正文、文件与目录映射、错误校验、原样保存、取消/刷新、旧配置转换、保存返回部署与固定预览 |

五组浏览器脚本共 479 项断言，均无捕获到的页面错误。使用本机 Chromium 与 playwright-core 1.58.2，独立浏览器上下文、虚构样例及回环 HTTP；没有真实 API 或服务器操作。浏览器实际检查了浅深主题、配置编辑、部署选择、项目/服务器/FRP、资产抽屉与窄屏；不以构建成功代替视觉检查。

构建直接读取设计系统 Token、公共 React 组件和样式；bundle 输入无 Ant Design，页面不再含 Ant 转换层。设计系统 `artifact.mjs check` 为 0 problems。总览用量条的单一 blue9 色阶通过 dataviz 明暗背景检查，并保留可见百分比、键盘提示与强制色模式。

构建哈希、各组断言及检查数量保存在[证据清单](screenshots/radix-redesign/results.json)。完整临时日志及截图保留于 `/srv/cache/stackpier-tmp/radix-prototype-20261103/evidence/`。

## 复现

从原型目录按 [README](../README.md#预览与验证) 构建并启动本地预览，然后执行：

```sh
node --test --experimental-test-isolation=none tests/*.test.mjs

STACKPIER_PLAYWRIGHT_MODULE=/srv/cache/stackpier-tmp/radix-prototype-20261103/node_modules/playwright-core/index.mjs \
STACKPIER_PREVIEW_URL=http://127.0.0.1:4339 \
CHROMIUM=/home/kongshan/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome \
STACKPIER_SCREENSHOTS=/srv/cache/stackpier-tmp/radix-prototype-20261103/evidence/radix \
node tests/browser-radix.mjs
```

其他四组将脚本文件替换为上表名称，并为各组使用独立的证据目录。依赖与浏览器路径按本机实际安装调整；预览地址必须为本机回环，不能指向真实实例。

## 关键截图

- [项目桌面](screenshots/radix-redesign/projects-desktop.png) · [项目手机](screenshots/radix-redesign/projects-mobile.png)
- [项目详情深色](screenshots/radix-redesign/project-dark.png) · [部署配置列表](screenshots/radix-redesign/templates-desktop.png)
- [systemd 编辑桌面](screenshots/radix-redesign/systemd-desktop.png) · [systemd 编辑手机](screenshots/radix-redesign/systemd-mobile.png)

## 验证边界

未实测 Safari / Firefox、屏幕阅读器或真实触屏设备；构建目标设置不能代替这些测试。没有运行正式 Web 的测试或原型与正式界面像素对比，因为用户明确要求正式界面先不动；旧 `browser-configuration-editor.mjs` 的 Ant 同版对照不适用于本稿。原型中非工作台/项目框架/防火墙的复杂业务视图仍由已转义领域 HTML 和原生表单组成，接入边界见重做说明。

以上结果只证明本地浏览器模拟与布局自测通过，不代表真实执行、用户视觉确认、正式迁移或公开发布。
