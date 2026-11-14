# 安全与数据

安全维护针对最新发布版，版本见 [CHANGELOG](CHANGELOG.md)。发现漏洞时请使用仓库 [Security Advisories](https://github.com/sinnohzeng/jianbiantouxiang/security/advisories) 的私密报告入口；不要在公开 Issue 中提交敏感复现数据或凭据。

## 网页

头像在浏览器中合成和导出，应用不上传用户输入的文字与图形。配置和历史保存在 localStorage；上传图形、字体字节仅在当前会话注册。清除浏览器数据可能丢失存档。

默认字体来自本站；其他字体、目录和 emoji 可能请求 Google Fonts、fontsource 或 jsDelivr。字体名预览请求包含目录显示名，正文字体请求不携带用户文字的 text 参数。站点加速和安全服务可能使用必要 Cookie。

SVG 上传经过白名单重建，图片与会话资源有尺寸及数量上限；浏览器初始解码的峰值仍由浏览器管理。保持浏览器更新，不把应用校验当作所有恶意文件都无风险的保证。

## CLI / MCP

CLI 在本机处理文件；远程 MCP 将请求交给部署方服务器。服务限制输入、队列与渲染时间，使用隔离的 Chromium context；公网部署须保留沙箱、认证与网关资源限制。具体参数见[自动化指南](docs/automation.md)。

服务自身不记录文字、Logo 字节或 token，运营方仍须核查反向代理、日志和平台数据保留设置。报告问题前应去除凭据和客户私有素材。
