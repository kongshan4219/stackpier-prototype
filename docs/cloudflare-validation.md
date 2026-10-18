# Cloudflare 原型验证

所有结果来自浏览器模拟，不能视为真实 Cloudflare 授权、DNS 修改或公网传播验证。

## 可重复验证

```sh
node --test --experimental-test-isolation=none tests/*.test.mjs
python3 -m http.server 4311 --bind 127.0.0.1
CHROMIUM=/usr/bin/chromium python3 tests/browser-cloudflare.py
```

语法检查使用 `node --check` 覆盖 `assets/` 下的全部 JavaScript。原型是经典脚本静态项目，没有 TypeScript 类型检查或打包构建任务；发布包核对静态入口、脚本、CSS 与推送源码一致。

## 当前验证（2026-10-18）

- Node.js 22 全量自动化 210 项通过，覆盖旧用途迁移、无项目 DNS 增删改与项目卸载保持 DNS。
- 72 个 JavaScript 文件通过 `node --check` 语法检查。
- Cloudflare 浏览器 55 项检查通过，覆盖桌面与 320 / 390 / 820px 窄屏、连接弹窗和无项目 CRUD。
- 操作上下文浏览器 55 项检查通过，覆盖固定目标、返回修改、取消、历史与焦点恢复。
- 浏览器使用本地静态页面和系统 Chrome，实际输入与点击；页面脚本异常为零。本次未发布 Site。

| 范围 | 证据 |
| --- | --- |
| 多账号与 Zone 筛选 | 保留原四条记录，增加第二账号只读示例；按稳定身份筛选 |
| 两个入口统一 | DNS 和设置打开同一列表；保留未保存通知表单 |
| 凭据保护 | 任意输入清空且不进入持久化、历史或意见导出；固定值也不持久化 |
| 接入与更新 | 检查后确认、重复 Account 引导、更新失败保留、不同账号拒绝改挂 |
| 授权范围 | 只读拒绝写入、失效和 DNS 权限不足显示缓存、范围缩小保留记录 |
| 提交 | 摘要只包含固定身份与记录差异；无项目时也可新增、编辑、删除；已有记录禁止变更账号 / Zone |
| 异步与核对 | 切换账号后回调不写错对象，未知结果阻止移除，核对不重放 |
| 中断与迟到 | 刷新保留固定身份转未知，旧操作不能覆盖后续确认记录 |
| 原有 DNS 语义 | A / AAAA / CNAME / TXT、TTL、代理与确认删除 |
| 迁移与空状态 | 清除当前记录与草稿的旧项目字段，保留原始历史；重复迁移幂等，清空与移除不重新填满 |
| 响应式 | 窄屏管理弹窗可滚动，DNS 表横向滑动查看所有列 |

## 失败与未测

最终检查无失败项。开发中发现并修正“只读账号筛选下新增自动选择另一可写账号”的问题；当前明确阻止当前范围没有可写 Zone 的新增。

未测真实 Cloudflare API、真实账号 / Token、远端 DNS 与全球传播；这些均不在本轮实现范围。受限环境不通过生产 URL 进行远端浏览器验收，发布结果另以同一 Site 的部署状态核对。

## 当前截图

- [独立 DNS 列表](screenshots/dns-independent-desktop.png)
- [连接管理弹窗 · 桌面](screenshots/dns-independent-manager-desktop.png)
- [连接管理弹窗 · 窄屏](screenshots/dns-independent-manager-mobile.png)

## 历史验证与截图

首次 Cloudflare 原型交付的 144 项组件测试、61 个脚本语法检查、53 项 Cloudflare 浏览器检查、63 项文件联动及 68 项 FRP 浏览器检查属于当时版本。下列截图保留历史意义，不作为本次移除项目关联的界面证据。

- [多账号 DNS 列表](screenshots/dns-accounts-desktop.png)
- [统一管理 · 桌面](screenshots/cloudflare-manager-desktop.png)
- [范围缩小后的缓存](screenshots/dns-scope-cache-desktop.png)
- [未知结果只读核对](screenshots/dns-unknown-reconcile-desktop.png)
- [统一管理 · 窄屏](screenshots/cloudflare-manager-mobile.png)
- [逐 Zone 权限核对 · 窄屏](screenshots/cloudflare-permissions-mobile.png)
