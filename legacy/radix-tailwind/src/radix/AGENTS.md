# Radix 原型界面

适用于本目录。先读[原型 README](../../README.md)及[设计与接入](../../../../docs/radix-redesign.md)。

- 颜色与基础控件读取主仓库设计系统的 Token、ui.jsx 和 styles.css；不引入 Ant、HTML→组件转换器、CDN 或按 RGB 推断语义的构建逻辑。
- shell / projects 管理 React 工作台与项目页面；controls 只为防火墙审阅页组合所需控件。新增中文文案放 copy.js 或所属领域已有文案源。
- fragments 仅显示已有模拟渲染器输出的已转义内容。它不是富文本入口，不接收用户提供的原始 HTML，也不改写表单字段。
- 领域状态、目标固定、校验与恢复行为仍由 assets/ 下模型和注册表维护；通过 radix-bridge 接入，不在 React 组件复制业务判断。
- 浮层只由 Radix Dialog 管理，不叠加原生 dialog。业务浮层在各自宿主内渲染，保留表单及草稿查询；独立 React 防火墙浮层使用 Portal。
- 修改公共界面运行浏览器回归，尤其检查正文滚动、底部动作可见、Escape、焦点恢复、390px、深浅主题及草稿不丢失。入口见[验证报告](../../../../docs/radix-validation.md)。
- 本原型不连接真实服务；正式 Web 和公开站点的迁移、合并、发布另按当前任务授权处理。
