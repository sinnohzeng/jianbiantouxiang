# 渐变头像

用两行文字和一个 Logo 制作渐变头像。可自动排版、调整配色，导出 JPG、PNG 或 WebP；也可通过 CLI 或 MCP 批量生成。

**[在线制作](https://jianbiantouxiang.com)** · [使用指南](docs/usage.md) · [CLI / MCP](docs/automation.md) · [开发指南](docs/contributing.md)

## 开始使用

1. 输入第一行和第二行文字，按需选择或上传 Logo。
2. 选择配色与质感。想调整构图，用「变换底纹」；想换颜色，用「随机配色」。
3. 点击「导出」下载。尺寸、格式和复制图片在导出选项中设置。

文字默认带轻投影，主行用宋体、副行用黑体。字号与图文位置自动适配圆形头像；细调入口在文字和图标旁，字体与效果收在「字体与样式」。

[查看配色与质感样张](docs/samples.md)

## 本地运行

需要 Node.js 24 或更高版本。

```bash
git clone https://github.com/sinnohzeng/jianbiantouxiang.git
cd jianbiantouxiang
npm ci
npm run dev
```

打开 <http://localhost:5173>。构建、测试和发布见[开发指南](docs/contributing.md)。

CLI 与 MCP 使用本地 Node + Chromium 渲染；[自动化指南](docs/automation.md)提供安装、单张、批量及客户端配置。远程 MCP 需自行部署，本项目目前提供的是源码与运行方式。

## 数据与素材

网页在浏览器中合成头像，配置和最近历史保存在本机。上传文件仅当前会话可用；刷新后需要重新上传。默认字体随站点提供，其他字体和 emoji 可能请求外部服务。远程 MCP 的输入由部署方服务器处理，详见[安全与数据说明](SECURITY.md)。

代码采用 [MIT 许可](LICENSE)。第三方字体、图标和品牌素材各有权利约束，来源与许可见[素材说明](docs/assets.md)；公开可下载不等于获得商标使用或再分发许可。

维护文档、实现说明及历史证据见[文档目录](docs/index.md)。

## English

Create a gradient avatar from two text lines and an optional logo. [Try the editor](https://jianbiantouxiang.com), or use the repository's [CLI and MCP tools](docs/automation.md). Node.js 24+ is required for local development. Code is MIT-licensed; third-party fonts and brand assets retain their own licenses and rights.
