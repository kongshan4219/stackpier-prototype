# Cloudflare 原型验证

所有结果来自浏览器模拟，不能视为真实 Cloudflare 授权、DNS 修改或公网传播验证。

## 可重复验证

```sh
node --test --test-isolation=none tests/*.test.mjs
python3 -m http.server 4311 --bind 127.0.0.1
CHROMIUM=/usr/bin/chromium python3 tests/browser-cloudflare.py
```

语法检查使用 `node --check` 覆盖 `assets/` 下的全部 JavaScript。原型是经典脚本静态项目，没有 TypeScript 类型检查或打包构建任务；发布包核对静态入口、脚本、CSS 与推送源码一致。

## 通过

- 全量自动化 144 项通过，其中新增 15 项账号隔离、权限、凭据保护、迁移及操作回归。
- 61 个 JavaScript 文件语法检查通过。
- Cloudflare Chromium 53 项实际点击、输入、选择、取消和刷新检查通过；覆盖桌面与 320 / 390 / 820px 窄屏。
- 原有文件联动 Chromium 回归 63 项、FRP 回归 68 项通过，页面脚本异常为零。

| 范围 | 证据 |
| --- | --- |
| 多账号、Zone 筛选与共享用途 | 保留原四条记录，增加第二账号只读示例；按稳定身份筛选 |
| 两个入口统一 | DNS 和设置打开同一列表；保留未保存通知表单 |
| 凭据保护 | 任意输入清空且不进入持久化、历史或意见导出；固定值也不持久化 |
| 接入与更新 | 检查后确认、重复 Account 引导、更新失败保留、不同账号拒绝改挂 |
| 授权范围 | 只读拒绝写入、失效和 DNS 权限不足显示缓存、范围缩小保留记录 |
| 提交 | 摘要包含身份与项目影响；已有记录禁止变更账号 / Zone |
| 异步与核对 | 切换账号后回调不写错对象，未知结果阻止移除，核对不重放 |
| 中断与迟到 | 刷新保留固定身份转未知，旧操作不能覆盖后续确认记录 |
| 原有 DNS 语义 | A / AAAA / CNAME / TXT、TTL、代理、共享影响与确认删除 |
| 迁移与空状态 | 旧 version 不匹配不重置，重复迁移幂等，清空与移除不重新填满 |
| 响应式 | 窄屏管理弹窗可滚动，DNS 表横向滑动查看所有列 |

## 失败与未测

最终检查无失败项。开发中发现并修正“只读账号筛选下新增自动选择另一可写账号”的问题；当前明确阻止当前范围没有可写 Zone 的新增。

未测真实 Cloudflare API、真实账号 / Token、远端 DNS 与全球传播；这些均不在本轮实现范围。受限环境不通过生产 URL 进行远端浏览器验收，发布结果另以同一 Site 的部署状态核对。

## 关键截图

- [多账号 DNS 列表](screenshots/dns-accounts-desktop.png)
- [统一管理 · 桌面](screenshots/cloudflare-manager-desktop.png)
- [范围缩小后的缓存](screenshots/dns-scope-cache-desktop.png)
- [未知结果只读核对](screenshots/dns-unknown-reconcile-desktop.png)
- [统一管理 · 窄屏](screenshots/cloudflare-manager-mobile.png)
- [逐 Zone 权限核对 · 窄屏](screenshots/cloudflare-permissions-mobile.png)
