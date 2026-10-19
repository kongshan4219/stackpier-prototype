# 凭据正文输入

正式管理端已决定将 SSH、Cloudflare、FRP、STCP、Webhook URL 和 Bearer Token 全部保存到 SQLite，不使用常驻 credentials 目录。

原型的 FRP 公共 Token、STCP 配对密钥与通知 URL / Token 字段使用密码输入，不回填已有内容；编辑时留空保留，填写新值替换。FRP / STCP / Bearer 只接受 EXAMPLE_ 或 DEMO_ 开头的虚构值，通知 URL 只接受 example.test 及其子域。

原型仍为浏览器 localStorage 模拟，不发送通知、不连接节点，不证明正式后端保存、迁移或脱敏通过。正式应用的通知格式选择、不可变凭据版本和停机导入以主仓库的凭据存储规范为准。
