# CLI 与 MCP

用两行文字和 PNG/SVG Logo 生成方形头像。CLI 与 MCP 复用网页的渐变、文字绘制和编码模块，运行时需要 Node.js 24+ 与 Chromium。远程服务需自行部署，当前没有项目提供的公共 MCP 地址。

## 第一次出图

在仓库根目录执行：

```bash
npm ci
npx playwright install --with-deps chromium
npm run build:service
node service/cli.mjs render --logo service/examples/logo.svg --line1 "产品研发" --line2 "Product Studio" --out avatar.png
```

图片写入 `avatar.png`，stdout 返回 JSON 元数据，诊断写入 stderr。已有输出文件会报错，不覆盖文件或符号链接。重复运行时请换输出名。

```bash
node service/cli.mjs options
node service/cli.mjs validate --line1 "产品研发" --line2 "Product Studio"
node service/cli.mjs batch --config service/examples/batch.json --out-dir ./avatars
```

`options` 列出配色和质感；`validate` 做 Logo 处理和真实字体排版，不渲染背景；`batch` 逐项生成，部分失败返回报告和非零退出码，保留成功文件。单张父目录须已存在，批量目录会自动创建。

## 请求参数

可将以下内容保存为 `request.json`，用 `render --config request.json --out avatar.png` 调用。显式 CLI 参数优先于 JSON，JSON 优先于默认值。

```json
{
  "schemaVersion": 1,
  "line1": "产品研发",
  "line2": "Product Studio",
  "size": 1024,
  "palette": "steel-slate",
  "style": "mesh",
  "safeShape": "circle",
  "padding": 0.03,
  "format": "png"
}
```

| 参数 | 默认值与范围 |
| --- | --- |
| line1 / line2 | 空字符串；每行最多 80 个 UTF-16 单位，单行文本 |
| size | 1024；128–2048 整数 |
| palette / style | steel-slate / mesh；配色查 options，质感另有 flow、silk、grain |
| seed | gradient-avatar-v1；最多 128 字符 |
| font / secondaryFont | serif / sans；随包 Noto Serif SC / Noto Sans SC 700 |
| safeShape / padding | circle / 0.03；也可 square，边距 0.02–0.25 |
| logoScale | 0.38；范围 0.2–0.55，始终等比 |
| optical | true；关闭后使用几何基线 |
| format | png；也可 jpg、webp，扩展名须匹配 |
| strict | true；缺字、越界或渲染退化时报错。CLI 用 --allow-fallback 放宽 |

文字与 Logo 至少提供一项。未知字段会报错。输入是独立 v1 契约，不接受网页整份 AvatarConfig。CLI 参数名使用短横线，例如 `--safe-shape`、`--logo-scale`、`--secondary-font`；关闭光学校正用 `--no-optical`。

两行默认使用共享的轻投影。最终文字深浅由背景采样选择；网页则保留用户选择的文字色。`validate` 的颜色是配色推荐值，最终颜色以 render 为准。

### Logo 和品牌预设

本地 CLI 可用 `--logo logo.svg`。JSON/MCP 传文件字节的纯 base64，不带 data URL 前缀：

```json
{
  "logo": {
    "mimeType": "image/svg+xml",
    "data": "替换为文件字节的base64",
    "background": "auto",
    "color": "auto",
    "preservePadding": false
  }
}
```

`background: auto` 仅对完全不透明、近灰度且边框一致近白/近黑的图移除背景，其余保留并告警。`transparent` 保留背景；显式 `white` / `black` 会同时移除图形内部同色部分，使用前应确认适合剪影。`color: auto` 转为文字同色，`original` 保留原色。`preservePadding: true` 保留源画布留白。

`preset` 与 `logo` 互斥，支持 `harmay-wordmark-white`、`dongli-symbol-white`、`dongli-lockup-full-white`、`dongli-wordmark-bilingual-inline-white`，CLI 使用 `--preset`。白色客户预设要求深色背景；使用范围见[素材说明](assets.md)。

### 输出与限制

结果包含图片 MIME/字节数、字体、各行边界与基线、Logo 边界、安全区、overflow、warnings、renderMode、光学位移和 fillScale。坐标单位为输出像素。`displayChecks` 给出 24/32/48/64 px 下字形高度；48 px 不足 6 px 会提示小字。背景采样对比度 `sampledMinContrast` 不是逐像素可读性或 WCAG 认证。

- Logo 上限 512 KiB。PNG 最长边 4096、总像素不超过 1600 万，拒绝 APNG；压缩元数据剥离并告警。
- SVG 最多 2000 元素、32 层、50:1 长宽比；要求轮廓和有效尺寸。白名单拒绝外链、脚本、实体、image/use/text、复杂样式和滤镜等。最终栅格化最长边 1024。
- 批量 JSON 为 `{ "items": [...] }`，最多 8 项，总面积 8×1024²。单图限 8 MiB，MCP 批量图片累计限 8 MiB。成功图片按成功项顺序返回，逐项报告保留原 index。
- 请求不抓取远程 Logo，也不接受 MCP 本地路径。缺字、极端比例和不确定背景通过错误或告警明确返回。

布局方法见[排版参考](layout.md)。固定浏览器和环境下可复现，不同 GPU/浏览器版本不保证图片字节相同。

## 接入 MCP

本地 stdio 配置示意，替换绝对路径：

```json
{
  "mcpServers": {
    "gradient-avatar": {
      "command": "node",
      "args": ["/absolute/path/jianbiantouxiang/service/cli.mjs", "mcp"]
    }
  }
}
```

直接运行 node，避免 npm banner 混入协议输出。工具为 `list_avatar_options`、`validate_avatar`、`render_avatar`、`render_avatar_batch`。原图在 image content 的 base64 字节中，结构化字段提供元数据；服务不保存下载文件。

使用官方 SDK 1.32.2，最高协商协议为 2025-11-25。集成测试覆盖同版本官方 Node Client 的 stdio 和 Streamable HTTP；桌面 GUI 客户端仍需各自验证。HTTP 客户端须支持自定义 Bearer header；OAuth-only 客户端需要另接授权网关。

## 运行 HTTP 服务

```bash
node service/cli.mjs serve
```

默认地址为 `http://127.0.0.1:3000/mcp`，POST 接收 MCP；GET/DELETE 返回 405。`/healthz` 只检查进程存活，上线验收必须实际调用 render。

| 环境变量 | 用途 |
| --- | --- |
| AVATAR_HOST / AVATAR_PORT | 默认 127.0.0.1 / 3000 |
| AVATAR_PUBLIC_URL | 远程服务的完整 HTTPS /mcp 地址，同时用于 Host/Origin 校验 |
| AVATAR_TOKEN | 既有 Bearer token，至少 32 字符；非 loopback 默认必需，由平台密钥管理注入 |
| AVATAR_PUBLIC=1 | 显式匿名服务，须同时设置 HTTPS public URL，运营方承担限流及费用管理 |
| AVATAR_CHROMIUM_PATH | 可选系统 Chromium 路径，否则使用 Playwright 版本 |
| AVATAR_CHROMIUM_SANDBOX=0 | 仅受控离线测试使用；公网运行保留默认沙箱 |

反代应保留匹配 PUBLIC_URL 的 Host，提供 HTTPS、来源限流与费用上限；服务不依据任意 X-Forwarded-* 放宽校验。请求体限 6 MiB、读取限时 10 秒；进程最多 32 连接、4 个处理中请求、每分钟 60 请求。渲染队列最多 4 项，每个隔离 context 限时 30 秒，不含启动和排队。批次最长约 8×30 秒，反代超时应匹配。

每次渲染使用独立 context，禁用下载与 service worker，仅可加载本地构建资源。服务不记录 Logo、文字或 token；部署方也应关闭代理请求体日志。

容器构建：

```bash
docker build -f service/Dockerfile -t gradient-avatar:local .
```

镜像为 Node 24 + Debian Chromium，非 root 运行。部署目标必须支持 Chromium 沙箱，限制 CPU、内存、PID 和网络出口，提供可写临时目录。ESA Pages 托管网页静态文件，MCP 应使用独立容器目标。远程部署不属于当前静态站发布流程。

## 验证

```bash
npm run ci
node service/review.mjs /tmp/gradient-avatar-review
```

review 脚本生成实际图片、元数据及拼图。检查原图、1:1 小图和目标客户端，尤其是宽字标和细衬线。集成测试覆盖编码、Logo 输入安全、批量部分失败、文件防覆盖、队列超时及两种 MCP 传输。
