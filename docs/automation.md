# CLI、批量头像与 MCP

网页与自动化均以圆裁可用性为默认优化目标。自动化入口是一套适合方形团队头像的独立 v1 配置，复用相同的 shader、合成与编码模块，不需要访问线上网页。源码在 `src/automation/` 与 `service/`，MIT；随渲染包分发的 Noto Sans SC 700 字体为 OFL-1.1，许可证随构建输出在 `dist-service/FONT-LICENSE.txt`。

## 安装与第一次出图

需要 Node 24+。仓库还没有发布 npm 包，先克隆仓库运行：

```bash
npm ci
npx playwright install --with-deps chromium
npm run build:service
node service/cli.mjs render --logo service/examples/logo.svg --line1 "产品研发" --line2 "Product Studio" --out avatar.png
node service/cli.mjs options
node service/cli.mjs batch --config service/examples/batch.json --out-dir ./avatars
```

可以用 `npm run avatar -- render ...` 启动 CLI。stdout 是 JSON 元数据，诊断走 stderr；stdio MCP 要直接运行 `node service/cli.mjs mcp`，不要经过 npm 的脚本 banner。

支持 `render`、`validate`、`batch`、`options`、`mcp`、`serve`。`render` 的顺序是默认值 → `--config request.json` → 显式命令行参数。`--logo file.svg` 只在本地 CLI 读取文件，MCP 永远不接受文件路径。输出扩展名必须与格式相同；默认 PNG，JPG 用 `--format jpg --out avatar.jpg`。文件采用独占、原子创建，已有文件和符号链接都不覆盖。父目录由调用方提供；批量的 `--out-dir` 会自动创建，结果固定命名 `001.png` 等。部分失败返回逐项报告和非零退出码，成功文件保留。

`validate` 加载字体并完成 Logo 处理与真实文字量测，返回排版信息，不渲染渐变。因此此时颜色是配色推荐值、`sampledMinContrast: null`、`renderMode: not-rendered`；最终颜色与对比度以 render 为准。

## v1 输入

```json
{
  "schemaVersion": 1,
  "line1": "产品研发",
  "line2": "Product Studio",
  "size": 1024,
  "padding": 0.06,
  "safeShape": "circle",
  "logoScale": 0.38,
  "palette": "steel-slate",
  "style": "mesh",
  "seed": "team-design-2026",
  "format": "png",
  "strict": true,
  "logo": {
    "mimeType": "image/svg+xml",
    "data": "这里替换为文件字节的纯 base64，不带 data: 前缀",
    "background": "auto",
    "color": "auto"
  }
}
```

`logo` 可省略，两行也可单独省略，但必须有可见文字或 Logo。每行最多 80 个 UTF-16 code units，不接受换行和控制字符。未知字段、非法尺寸、未知配色报错。自动化接口不直接接收网页 `AvatarConfig`，也不读取网页存档；后续契约变化以 `schemaVersion` 显式处理。

| 参数 | 默认与边界 |
| --- | --- |
| size | 1024；128–2048 整数，方形 |
| padding | 每边 6%；范围 2%–25%，圆形模式下同时为径向留白 |
| safeShape | circle / square，默认 circle；输出仍是方形图片，圆裁安全形状可配置。CLI 为 --safe-shape |
| logoScale | 有文字时目标 Logo 高度为安全框的 38%；范围 20%–55%，宽度另有限制，始终等比 |
| style | mesh / flow / silk / grain |
| palette | 默认 steel-slate 深色白字；37 套内置配色之一，通过 options / list_avatar_options 获取 |
| seed | 固定字符串，最多 128 字；显式换 seed 得到另一版构图 |
| format | png / jpg / webp |
| strict | 默认 true；渲染退化、缺字或越过安全区即失败。false 可接受近似渲染/字体回退并返回告警 |

Logo 在上，文字两行作为一个紧凑组，整个图文栈居中。无 Logo 时两行以相同字号共同适配，文字组本身居中。有 Logo 时主行目标上限为边长 60%，副行不超过主行的 80%；真实字体量测后按宽高与圆弧约束缩放，不再用固定小字号限制短标题。圆形安全区逐个校验图文包围框，不把整张画布缩成内接正方形。6% 为本产品默认留白，不是飞书官方规范。

`displayChecks` 返回 24、32、48、64 px 下各行的墨迹高度；48 px 时任一行不足 6 px 发出 `text-small-at-48px:shorten-text-or-remove-second-line`，这是产品评估阈值而非可读性认证。长文本保持单行并明确告警，不以无限缩小冒充可读。需要方形布局可显式设 `safeShape: square`。

文字与单色 Logo 的深浅取自最终渐变底图的抽样对比度，采样更好的黑/白方案生效。`sampledMinContrast` 是内容矩形内的采样指标，**不是逐像素可读性或 WCAG 合规保证**；低于 4.5 返回告警，可换配色/种子。`logo.color: original` 保留图形色彩，不保证原色 Logo 的对比度。

提供随包 Noto Sans SC 700 与 Noto Serif SC 600（包含拉丁与大量中日韩字符）。按字体包 Unicode 范围检测缺字，严格模式拒绝；远程字体、本地字体上传及表情目录未开放；品牌预设限明确列出的东黎三款。系统回退字体在不同机器可能不同。相同输入在固定浏览器和渲染环境中可复现；不同 GPU/浏览器版本不承诺字节相同。

## Logo 处理

- PNG / SVG 只接受最多 512 KiB 的字节。透明图保持原有 alpha，裁掉几乎透明的空边，默认转成与文字相同的单色；`color: original` 保留原色。
- `background: auto` 只有在整张图不透明、近乎灰度、且完整边框一致近白/近黑时才移除背景。其余不透明情况不猜，保留并返回 `opaque-logo-background-preserved` 告警。
- `background: transparent` 禁止移除背景；`white` / `black` 为调用方明确指定的底色。这两种操作会将同色内部区域一并当作背景，适合单色剪影；多色或含底板的品牌图请用 transparent + original。
- PNG 最大 4096×4096 且不超过 1600 万像素；拒绝 APNG 和损坏块；压缩文字/ICC 元数据直接剥离，不解压，建议从绘图工具导出静态 PNG。
- SVG 必须是带有效 viewBox 或数值尺寸的轮廓图。最多 2000 个元素、32 层嵌套、50:1 长宽比；禁止实体/DTD、脚本、事件、外部引用、image、use、text、复杂样式表、动画、filter、mask 等。文字转轮廓，复杂滤镜先转 PNG。白名单重建后以 Blob 图片解码，绝不注入页面 DOM。SVG 先栅格化到最长边 1024；最终头像 2048 时 Logo 可能放大。

元数据包含 `safeShape`、`safeCircle`、`displayChecks`、`safeArea`、`logoBounds`、`textBounds`、逐行 `bounds`/baseline/fontSize、实际墨色、warnings、overflow、renderMode、输出字节数与 MIME。所有坐标单位为最终图片像素。非常宽或高的 Logo 会有比例告警，程序不会把它拉伸成方形。

## 批量

JSON 为 `{ "items": [请求1, 请求2] }`，最多 8 项，总面积最多 8×1024² 像素。每项可带自己的 base64 Logo。CLI 写文件；MCP 返回成功图片和带原始 index 的逐项报告。MCP 图片顺序对应成功项，不对应全部输入项。单张压缩后限 8 MiB，MCP 一批累计原始图片字节限 8 MiB；过大时改 JPG 或降低尺寸。

## MCP 客户端

服务用官方 `@modelcontextprotocol/sdk` **1.32.2**，其最高协议版本为 **2025-11-25**，支持 SDK 自带的旧版本协商。已经用同版本官方 Node Client 实际测试 HTTP 与 stdio 的 initialize、tools/list、tools/call、图片、结构化结果和错误。没有逐一验收桌面 GUI 客户端；不承诺所有客户端兼容。

工具共四个：

- `list_avatar_options`：配色和质感目录。
- `validate_avatar`：Logo 处理、字体量测和布局校验。
- `render_avatar`：原始尺寸图片 content block + 结构化元数据。
- `render_avatar_batch`：批量图片 + 逐项结果。

原图就是 image content 的 base64 字节；客户端可以直接解码保存，服务不额外保留下载文件，不提供永久 URL。客户端若只展示缩略图，应使用工具结果中的原始 content 保存，而不是截图。个别客户端限制图片或消息大小，建议 512 px 或 JPG。

本地 stdio 配置示意（替换绝对路径）：

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

远程使用 Streamable HTTP，URL 为 `https://你自己的域名/mcp`；请求带 `Authorization: Bearer <运营方配置的 token>`。不同客户端的远程 URL/headers 配置格式不同，请按该客户端说明配置。首版**没有 OAuth 授权服务器、动态注册或旧式 SSE endpoint**。只允许 OAuth 登录且不支持自定义 Bearer header 的客户端，需要另接标准 OAuth 网关，不能仅靠粘贴这个 URL 使用。

在本仓库安装依赖后，也可以用官方 Node Client 调用远程地址并保存原图。把服务地址与已有 token 通过环境变量注入；以下示例不生成或打印凭据：

```js
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { readFile, writeFile } from 'node:fs/promises'

const client = new Client({ name: 'avatar-example', version: '1.0.0' })
try {
  await client.connect(new StreamableHTTPClientTransport(
    new URL(process.env.AVATAR_MCP_URL),
    { requestInit: { headers: { Authorization: `Bearer ${process.env.AVATAR_TOKEN}` } } },
  ))
  const logo = await readFile('logo.svg')
  const result = await client.callTool({
    name: 'render_avatar',
    arguments: {
      line1: '产品研发', line2: 'Product Studio', size: 512,
      logo: { mimeType: 'image/svg+xml', data: logo.toString('base64') },
    },
  })
  if (result.isError) throw new Error(JSON.stringify(result.content))
  const image = result.content.find(block => block.type === 'image')
  if (!image) throw new Error('Server did not return an image')
  await writeFile('avatar.png', Buffer.from(image.data, 'base64'), { flag: 'wx' })
} finally {
  await client.close()
}
```

## 本地 HTTP 与部署

```bash
node service/cli.mjs serve
# 默认 http://127.0.0.1:3000/mcp
```

| 环境变量 | 含义 |
| --- | --- |
| AVATAR_HOST / AVATAR_PORT | 默认 127.0.0.1 / 3000 |
| AVATAR_PUBLIC_URL | 远程部署必须设置完整 HTTPS `/mcp` URL；用于 Host/Origin 白名单 |
| AVATAR_TOKEN | 可选的既有 Bearer token，至少 32 字符；非 loopback 默认必须提供，通过平台密钥管理注入，不写进仓库 |
| AVATAR_PUBLIC=1 | 显式允许匿名服务；必须同时有 HTTPS public URL；运营方需自行承担网关限流与算力费用，默认不启用 |
| AVATAR_CHROMIUM_PATH | 可选系统 Chromium 路径；缺省使用 Playwright 安装版本 |
| AVATAR_CHROMIUM_SANDBOX=0 | 仅供受控离线测试；生产保留默认启用沙箱，并验证宿主支持 |

HTTP 只接受 POST `/mcp`，GET/DELETE 返回 405；没有会话状态。`GET /healthz` 是进程存活探针，不证明浏览器可运行；上线前必须实际调用 render。服务验证 Host 与 Origin；反代应保留与 PUBLIC_URL 一致的 Host，不依据客户端提供的 X-Forwarded-* 放宽校验。客户端无 Origin 可用，有不匹配 Origin 则拒绝；不启用宽泛 CORS。

请求体限 6 MiB、读取 10 秒、进程最多 32 连接、4 个正在处理的 MCP 请求、60 请求/分钟。渲染队列最多 4 项、串行浏览器任务，每个渲染上下文 30 秒超时（不含浏览器启动和排队）；批次最多约 8×30 秒并可能与其他请求交错。反代的超时应与批量操作相容。全局限流只是最小保护，公网部署仍需网关按来源/账户限流与费用上限，不信任任意 X-Forwarded-For。

浏览器每请求一个隔离 context，禁用 service worker 和下载，只能请求构建包的 loopback 静态资源；CSP 禁止 connect-src，图片只允许内联/Blob，远程 URL 和本地路径不在输入契约内。没有上传数据库、公开文件目录或服务端输出落盘；请求结束释放 context。部署时禁用代理的请求体日志；服务自身不记录 Logo 字节、文本或 token。

### 容器

```bash
docker build -f service/Dockerfile -t gradient-avatar:8.1.0 .
```

镜像为 Node 24 + Debian Chromium，非 root 用户。适合独立 ECS/容器服务；当前 ESA Pages 配置只托管静态站，不能直接放这套长驻浏览器进程。主站与 MCP 应分开部署（例如新子域名），不改现有 `esa.jsonc`。

运行时配置应由已授权平台注入：HOST=0.0.0.0、PUBLIC_URL、TOKEN。建议容器只读文件系统、可写临时目录、内存起步 1 GiB（2048 图建议起步 2 GiB，仍需目标机压测）、PID/CPU 限制和外网出口禁用，服务前置 HTTPS 反代。Chromium 默认启用沙箱；宿主必须支持其用户命名空间/沙箱配置。不要为跑通无条件添加 privileged、seccomp=unconfined 或关闭沙箱。

在需要代理 CA 的云端构建环境，可把公开 CA 以 BuildKit `--secret id=proxy_ca,src=...` 挂入；Dockerfile 不把代理 CA 或密钥写入镜像。

## 验证

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build
npm run test:service
npm run build:service
npm run test:service:integration
node service/review.mjs /tmp/gradient-avatar-review
```

`review.mjs` 输出十二组实际 PNG、metadata.json、review.html 和 contact-sheet.png。集成测试覆盖四种 shader、三种编码、黑/白/透明与反色 PNG 等效、恶意 SVG、PNG 尺寸炸弹、批量部分失败、独占输出、官方客户端两种传输、队列限额和超时清理。

简单 SVG 类规则（如 Illustrator 的 fill-rule）会转为绘制属性后移除样式表，只允许类选择器和有限上色声明，不允许 URL、@import、滤镜或任意 CSS。PNG 中的 iCCP/iTXt/zTXt 块会在解码前剥离，并返回 `png-compressed-metadata-removed`；不会解压元数据。移除色彩配置可能影响彩色 Logo 的色彩管理，黑白标识不受该色彩差异影响。


## 字体、光学校正与客户预设

`font` 可选 `sans`（默认）或 `serif`，分别使用随包 Noto Sans SC 700 / Noto Serif SC 600；`optical` 默认 true，关闭后获得几何基线。CLI 使用 `--font serif` 与 `--no-optical`。返回 `optical` 的建议位移、实际位移和边界限制；不得用这些值冒充视觉质量评分。

`preset` / CLI `--preset` 可选 `dongli-symbol-white`、`dongli-lockup-full-white`、`dongli-wordmark-bilingual-inline-white`，与自带 `logo` 互斥，要求深色配色。群聊优先图形标，完整/横版在小尺寸有密集细节警告。原始白色与约 9% 长边留白保留，不能重新染色。自带素材可设 `logo.preservePadding: true` 保留文件画布；默认裁掉透明留白。

```bash
npm run build:service
node service/cli.mjs render --line1 飞书对接 --line2 外部群 --preset dongli-symbol-white --out /tmp/dongli.png
node scripts/optical-review.mjs /tmp/optical-review /path/to/private/harmay-logo.svg
```

第二个参数可省略；脚本用官方 MCP SDK 实际生成几何/光学成对原图、JSON 元数据和 24/32/48/64 px 圆裁网页。HARMAY 原稿自行提供，不进入开源仓库。运行沿用服务的 Chromium 配置，不自动关闭沙箱。32 px 极细衬线或扁宽品牌字标仍可能无法辨字；这不是光学移动能解决的。应同时检查原图、1:1 小图、实际客户端，不以截图放大替代可读性。

图文间距与主副行间距分别求解：宽字标到标题至少短边 7.5%，其他标识至少 6%；有 Logo 的两行间距至少短边 5%，兼顾 0.24em。Logo 内置品牌留白额外保留，因此其可见轮廓之间可能更宽。间距改善不等于保证所有内容好看，应按 `scripts/optical-review.mjs` 生成真实小图验收。
