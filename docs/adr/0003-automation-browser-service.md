# ADR-0003：共享浏览器渲染的 CLI 与 MCP

- 状态：已采纳
- 日期：2026-11-04

## 决策

自动化使用独立 renderer HTML 和离屏导出模块。Node 负责 CLI、官方 SDK 协议、输入配额、局部静态资源服务和 Chromium 生命周期。网页工作台不作为自动化接口，不读取 localStorage 或测试 probe；同一 renderer 由 CLI、stdio、远程 Streamable HTTP 共用。

自动化入口有独立 v1 schema 与 Logo/双行文字布局，不直接公开会随网页演进的 AvatarConfig。已有网页渲染和默认参数保留；自动化的 Logo 裁边、底色推断与字色适配是显式的自动化默认档。

## 理由

现有 shader 需要 WebGL2、字体与 Canvas。另写 Node 原生渲染器会产生两套效果和布局；驱动 UI 控件会耦合交互、PWA 与本机存档。独立入口可以复用 shader、绘图和编码并禁止外部网络，字体随构建包固定。

## 代价与边界

- 服务需要独立 Node/Chromium 容器，静态 ESA Pages 不承担浏览器进程。
- 第一版只提供随包字体、有限大小的 PNG/SVG 与固定两行排版；复杂 SVG 先转 PNG，SVG 文字先转轮廓。
- Chromium 默认启用沙箱，公网部署必须验证宿主支持；本地受控测试的关闭沙箱选项不构成生产部署方案。
- 首版官方 SDK 1.x 协议兼容通过 SDK Client 验证，HTTP 认证为显式 Bearer 或运营方明确启用的匿名模式；OAuth-only 客户端须配网关。
- 不持久保存上传/输出，不提供公开下载 URL；MCP 返回原始图片 content，CLI 原子创建本地文件。
- 公开规模化服务需要平台级限流、CPU/内存约束和成本上限，进程内限额不能代替基础设施隔离。
