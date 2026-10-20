# 资产、配置与项目版本联动

本轮实现仅覆盖现有交互原型与浏览器模拟数据，不连接真实服务器、SSH、Docker 或部署后端，不推进正式应用业务实现。

## 数据关系

| 对象 | 固定关系 / 内容 |
| --- | --- |
| 文件实体 | `id`（fileId）、groupId、最新 revision、历史 revisions；小文本预览/元数据 |
| 公共配置 | `id`（templateId）、rev、历史 revisions、固定文件 pins / Compose 附件；旧修订保留目标路径 |
| 项目草稿 | `id`（projectId）、template、cfg.templateRev、draftRev、固定映射 pins |
| 已应用快照 | appliedSnapshot：templateId、templateRevision、cfg、实际匹配 files、应用时间 |
| 服务器读取快照 | serverReadSnapshot：独立内容与上次成功读取时间；失败保留原值 |
| 文件核对观测 | fileCheck：固定参照身份、尝试时间、三类文件摘要状态与历史观测；只读核对不改动其他快照 |
| 配置编辑缓存 | configurationDrafts：按配置 ID / 新建类型在页面内存保留；刷新后读取保存版本 |

文件替换或公共配置保存不写入项目 cfg、已应用快照或读取快照。采用只更新指定项目 cfg 和 D 修订。应用确认固定输入，成功后更新该项目应用参照及模拟读取结果；失败/部分完成沿用现有操作事实规则。

新编辑器生成的配置按明确保存的文件版本采用；更换文件版本先在公共配置选择并保存新修订。历史任意正文 / 映射仍保留原来的独立项目草稿行为。

项目配置页以正式界面为准，展示固定部署信息与受管文件摘要核对；失败保留历史观测。公共配置、采用差异与项目草稿移到“更多 → 项目草稿与更新”独立弹窗，读取快照仍与草稿分开保存。当前页面和验证见[项目文件与巡检](project-files-and-checks.md)。

## 迁移与空状态

保留原 localStorage key 与 version 1，以 assetSchema 标记关系模型迁移。旧名称映射一次性转成稳定 ID 和修订引用，不重置用户正文、项目草稿、反馈或 FRP 状态。

历史交付记录优先于当前公共资产；旧身份不同于公共最新身份时保留独立历史修订（负数为迁移历史标识，不冒充原系统真实修订号）。没有历史交付证据的映射标记元数据未知，不用公共最新内容冒充服务器旧结果。没有真实内容的旧样例不伪造 SHA-256 或文本。已清空数组不重新填充示例；FRP 公共占位资产改为一次性种子，避免浏览文件页重新加入。

清理整个站点的 localStorage 仍等于首次访问，恢复初始虚构数据；这与保存空数组不同。明确“重置演示”可恢复样例。

## 验证方法

组件与模型回归：

```sh
node --test --experimental-test-isolation=none tests/*.test.mjs
```

原型是经典 JavaScript 静态项目，没有 TypeScript 类型检查或打包构建任务。语法校验使用 `node --check`；发布包由推送的 Site 源提交中的静态目录生成，并核对入口/CSS/脚本路径与源文件一致。

真实浏览器回归需要 Python Playwright 和 Chromium，先启动 README 中的 localhost 静态服务：

```sh
CHROMIUM=/usr/bin/chromium python3 tests/browser-asset-linkage.py
```

脚本通过点击、输入、文件选择和刷新验证双向跳转、会话草稿保留、刷新恢复保存版本、固定引用校验、架构匹配/阻塞、替换、采用、单独应用、改名、读取失败、旧存储迁移、空列表及桌面/移动端布局。旧格式/异常资产仅用浏览器状态注入，正常流程不跳过按钮确认。

配置编辑、附件限制及三类字段的当前对照验证见[公共部署配置](deployment-configurations.md)。

关键截图：

- [文件详情和反向引用](screenshots/asset-detail-desktop.png)
- [应用落点确认](screenshots/apply-preview-desktop.png)
- [ARM 部署预览](screenshots/deployment-preview-arm-desktop.png)
- [缺架构阻塞](screenshots/deployment-blocked-desktop.png)
- [摘要核对失败保留历史观测](screenshots/project-configuration/read-failed-mobile.png)
- [移动端详情与长路径](screenshots/asset-detail-mobile.png)

自动化与浏览器验证只证明原型模拟行为，不代表真实部署成功或用户验收。
