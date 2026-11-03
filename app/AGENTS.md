# 重设计原型规则

适用于 `app/`。先读 [README](README.md)；功能依据见主仓库 `designs/stackpier-redesign/capability-map.md`。

- 视觉值只写在 `ds/tokens.css`；组件和页面引用语义 Token，不写原始色值。新增通用模式先加到 `ds/` 并在 `pages/design-system.tsx` 预览。
- 浮层、菜单、选择器、标签页使用 Radix Primitives；不引入 Ant、Tailwind 或 CDN。
- 页面只表达正式应用已有或已确认的能力；未实现能力不出现，原型控制（模拟结果、场景）需明确标注。数据均为虚构，地址用 RFC 5737 与 `example.test`。
- 状态文字与 tone 映射集中在 `lib.ts`；结果未知必须引导核对，不提供直接重试。
- 改动后运行 `npm run build:app`（含类型检查）与 `tests/app-browser.mjs`，检查截图的深浅主题、390 / 320px、键盘与焦点返回。
