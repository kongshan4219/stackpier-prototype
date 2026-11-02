# 1Panel 来源

官方仓库 https://github.com/1Panel-dev/1Panel ，tag v2.4.0，commit `04099ae2a26953aa8fffef3d8a1def590ebf33e4`。许可见 [GPL v3 原文](LICENSE)。版权归上游原作者，保留原文件已有声明。

`src/antd/firewall-port/validation.ts` 原样复制 `frontend/src/views/host/firewall/utils/validation.ts`，无改动。其他本目录原型组件根据同版本 `frontend/src/views/host/firewall/` 的页面、字段和调用链迁移至 React/Ant Design，使用虚构数据替换 API。差异：StackPier 外壳与服务器选择；审阅场景、待决差异面板；没有真实命令、持久化或恢复证明。不得将浏览器模拟当成正式移植完成。
