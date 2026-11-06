> 2026-11-06 更新：布局已按 specs/v8.1-avatar-layout 实施圆裁与紧凑图文优化；下文的测试数和 Docker 镜像为 11-04 历史记录。本轮测试与持久交付见 docs/audits/2026-11-06-avatar-layout.md。旧镜像未包含本轮改动，MCP 部署仍暂停。用户已授权通过 GitHub 更新静态站点，提交状态以最终交付记录为准。

# CLI / MCP 首版交接（2026-11-04）

## 已实现

- 版本准备为 8.1.0；`src/automation/` 独立自动化配置与渲染入口，`service/` CLI + 官方 SDK MCP。
- 单张/批量、双行自动字号与主次层级、Logo 黑白/透明适配、真实字形边界与安全区、实际渐变背景抽样对比度、缺字/小字/极端比例告警。
- 限制 SVG/PNG 字节、复杂度与像素；SVG 不进入页面 DOM，拒绝路径/URL输入与外部资源；每调用隔离浏览器 context，只加载随包静态资源与字体。
- HTTP 版本化输入、无会话 Streamable HTTP、Bearer/显式匿名模式、Host/Origin 校验与配额。stdio 同用渲染核心。图片以 MCP image content 返回原始字节，无公开下载存储。
- 默认网页行为保留；新增依赖不进入网页主 bundle。使用及部署说明在 `docs/automation.md`，决策在 `docs/adr/0003-automation-browser-service.md`。

## 验证证据

- `npm run lint`、`npm run format:check`、`npm run typecheck`、`npm test`、`npm run build` 均通过。804 条单元测试；JSON 报告 `/tmp/gradient-avatar-unit.json`。
- `npm run test:service`：3 项通过。
- `npm run test:service:integration`：6 项通过，官方 SDK 1.32.2 HTTP 与 stdio 客户端、图片结果、部分失败、私网请求 canary 未命中、PNG 尺寸炸弹、队列/超时与 CLI 防覆盖。日志 `/tmp/avatar-integration-final.log`。
- 单独对 HTTP 的 `MCP-Protocol-Version: 2025-11-25` 协商断言通过，日志 `/tmp/avatar-protocol-version-test.log`。未实测桌面 GUI 客户端，不承诺 OAuth-only 客户端直接兼容。
- 网页 46 项 Playwright E2E 全部通过，日志 `/tmp/avatar-e2e.log`。使用原用例与项目配置，仅以 `/workspace/scratch/avatar-e2e.config.mts` 覆盖本机 Chromium 路径、2 workers 和测试输出目录。
- 实际浏览器：`/usr/bin/chromium`，155.0.8059.79；Node 24.22.1。当前宿主 Chromium 沙箱不能启动，受控本地测试设置 `AVATAR_CHROMIUM_SANDBOX=0`；生产代码默认开启沙箱。
- 十二组实际图片已目视检查，目录 `/workspace/scratch/gradient-avatar-review/`；包含 `contact-sheet.png`、`review.html`、各张原图及 `metadata.json`。长标题副标题缩小会返回小字告警；宽高 Logo 会返回极端比例告警。

## 尚待上线处理

用户允许在已授权、已核实目标上部署；当前没有可确认的持久容器运行目标、云部署身份或现成服务认证配置。已核实的阿里云 ESA Pages 仅托管现有静态站；没有改它的构建、路由、权限或域名。没有新建生产凭据，没有发布公共匿名服务。

Dockerfile 默认非 root、安装 Chromium 和 sandbox 组件、开启浏览器沙箱。最终镜像 `gradient-avatar:8.1.0` 构建成功（镜像 ID `sha256:f5c378fa94aeb4251951b9197f9ca8e23d17f1ba0e7a6326b3e6b95dd1ee664b`）。以 `--network none --read-only --tmpfs /tmp:rw,nosuid,nodev,size=256m --memory=1g --pids-limit=128 --cap-drop=ALL --security-opt=no-new-privileges` 运行受控样例，关闭浏览器沙箱后成功输出 256×256 PNG，119605 字节、WebGL2、无告警/溢出。日志 `/tmp/avatar-container-offline-final.log`。

保留默认沙箱的测试失败：宿主拒绝 Chromium 创建命名空间（`Failed to move to new namespace ... Operation not permitted`），日志 `/tmp/avatar-container-sandbox-final.log`。未扩大容器权限来绕过，未对外提供服务。宿主必须支持 Chromium 沙箱才能接收公网不可信输入，不能把离线测试的关闭沙箱设置直接用于上线。最终构建日志 `/tmp/gradient-avatar-docker-build-final.log`。

多轮 Docker vfs 构建一度耗尽 32 GiB 临时磁盘，已清除本轮生成的旧镜像和可重建缓存并减少 Dockerfile 的重复整层复制；源码、报告和样张保留。

## 代码保存

改动在 `/workspace/jianbiantouxiang` 工作区。根据本仓对子智能体的约定，未执行任何 Git 操作；尚未 commit、push、打 tag 或开 PR。主会话请审查后按仓库规定提交功能分支，不能直接 push main（会触发网页上线）。

下一步：选择能运行 Node/Chromium 且支持沙箱的已有容器目标，配置 HTTPS/域名和已有认证或 OAuth 网关，设置平台级资源、出口与速率限制，实际调用远程 render 后再发布地址。
