# 渐变头像生成器 v3 规约（造什么）

状态：已定稿，2026-08-29。技术路线依据见 `docs/research/2026-08-29-ai-gradient-technique-survey.md`，决策记录见 `docs/adr/`。

## 1. 产品定位

一个部署在 Cloudflare Pages 的纯前端工具站：输入几个字，秒出一张 OpenAI 发布图那种柔光质感的渐变头像，主要用于群聊头像、账号头像、部门标识。手机端是第一使用场景，桌面端是精修场景。

产品名：**渐变头像生成器**，英文 **Gradient Avatar**。npm 包名 `gradient-avatar`，GitHub 仓库 `sinnohzeng/jianbiantouxiang`。

## 2. 用户故事

1. 手机上打开页面，输入“产品设计部”，点一下随机，满意就点导出，得到一张 1024×1024、不超过 1 MB 的 JPG，可以直接设为微信群头像。
2. 桌面上打开页面，选一个浅色系配色和“丝绸”质感，把文字换成两行，把字号拉到接近撑满，导出 2048 的 PNG 给设计同事。
3. 把当前效果的链接发给同事，对方打开就是一模一样的图，可以在此基础上改。
4. 切换到英文界面，选一个 Google Fonts 的展示字体，输入英文缩写“AI”，导出圆形透明背景的 PNG。

## 3. 功能规约

### 3.1 渐变引擎

- 引擎是 WebGL2 fragment shader，通过 `@paper-design/shaders`（Apache-2.0）的 `ShaderMount` 驱动，项目自建薄封装，不使用 `@paper-design/shaders-react`。
- 四种质感（style）：
  | style                | 底层 shader          | 种子映射的参数                                                    | 面向用户的滑杆                                     |
  | -------------------- | -------------------- | ----------------------------------------------------------------- | -------------------------------------------------- |
  | `mesh`（柔光，默认） | `staticMeshGradient` | `positions`、`waveX/Y` 与 shift                                   | 四种质感统一暴露五个滑杆：强度、柔和度、颗粒、缩放、旋转。同一个滑杆在不同质感下映射到各自的 uniform，标签随质感变 |
  | `flow`（流动）       | `meshGradient`       | `frame`、`distortion`、`swirl`                                    |                                                    |
  | `silk`（丝绸）       | `warp`               | `frame`、`shape`（`stripes` 为主，少量 `checks`）、`shapeScale`   |                                                    |
  | `grain`（颗粒）      | `grainGradient`      | `frame`、`shape`（`wave` / `ripple` / `corners` 三种）            |                                                    |
- shader 形状池与参数区间以实测为准：`grain` 的 `blob` 与 `sphere` 在头像尺寸下出平色或硬边圆球，`silk` 的 `edge` 压成平淡线性渐变，都不进池；`grain` 的每种形状自带缩放倍率，否则单格色带撑满画面只剩底色。`silk` 在浅色配色上按平均明度压制扭曲与漩涡，避免出锡纸脊线。
- 种子 → 参数的映射用 mulberry32 之类的确定性 PRNG；同一 seed + 同一配置在同一设备上像素级一致，跨 GPU 允许亚像素差异。种子默认由文字内容哈希得出，可手动改、可随机。
- 每种质感都暴露一个“颗粒”参数（`grainMixer` 与 `grainOverlay` 联动），默认低值，让画面有胶片感但不脏。
- 光感层：在 2D 合成阶段叠一层可调强度的柔白高光（径向渐变，screen 混合），默认 0.25，用于模拟“光透过玻璃”的通透感。可关。
- 不支持 WebGL2 的浏览器：显示明确提示，并回落到 CSS 多层 `radial-gradient` 的静态近似，预览与导出都用这张近似图。

### 3.2 配色

- 内置至少 24 套配色，每套 4–6 个 hex 色，附中性命名（不出现任何厂商名）与一句适用场景。保留 v2 的 12 套并按 shader 特性重新调色；新增至少 12 套“AI 感”家族：珊瑚日出、蜜柑、琥珀、柠檬、青柠薄荷、翡翠、冰川、天青、深海、薰衣草雾、樱花、石榴、雾紫蓝、极夜、月光等方向。
- 自定义配色：2–6 个颜色输入，支持粘贴 hex 列表。
- 种子色生成：给 1 个主色，按 OKLCH 生成三种和谐方案（类比、分裂互补、同色相不同明度），一键填入。
- 配色选择器的每个色块用真实渐变缩略图展示，不是圆点。
- 提供“浅色系 / 深色系 / 全部”筛选，浅色系在聊天界面里更像 OpenAI 的风格，默认排前。

### 3.3 文字

- 内容：多行输入。显式换行按行；开启“自动换行”后按安全区宽度换行，CJK 逐字、拉丁按词。
- 字号模式：
  - 自动填满（默认）：二分搜索字号，让整块文字在安全区内尽可能大。安全区先按“边距”参数内缩（默认每边 10 %），再按画布形状收：圆形与圆角矩形的遮罩会切掉方框四角，所以把方框按原比例缩到四角正好压在遮罩边界上，方角与常规圆角够不着四角，几何原样不动。边距不随形状变，换形状不改用户设的值。
  - 手动：字号以画布短边百分比表示，范围 4 %–92 %。
- 排版参数（全部可调，全部有合理默认）：行高 0.85–2.0（默认 1.15；单行时行高不影响排版）、字间距 -0.1–0.5 em（默认 0，2 到 4 个 CJK 字的短文字自动填满时用 0.05 em 作为起点）、字重（按当前字体可用字重）、对齐（左 / 中 / 右）、锚点（九宫格）加微调偏移、竖排开关（CJK）。
- 文字样式：纯色；描边；投影 / 发光（强度可调）；胶囊底（半透明圆角矩形，圆角与内边距可调）。
- 文字颜色：自动或自定义。自动的规则分两路：内置配色直接用配色表里设计好的文字色，保证同一配色下每块文字颜色一致；自定义配色按文字区域下方像素的相对亮度取白或近黑（阈值 0.5）。两种情况都再算一次 WCAG 2 对比度，低于 3.0（大字门槛）时自动垫一层胶囊底板。
- 字体：
  - 默认：按界面语言选 Noto Sans SC / TC / JP / KR，英文默认 Inter。
  - Google Fonts 全库动态加载：字体列表来自 fontsource API（`https://api.fontsource.org/v1/fonts`），本地缓存 7 天，另内置一份精选清单（含全部 Google Fonts 上的中文字体：Noto Sans / Serif SC 与 TC、ZCOOL KuaiLe、ZCOOL QingKe HuangYou、ZCOOL XiaoWei、Ma Shan Zheng、Long Cang、Zhi Mang Xing、Liu Jian Mao Cao、WDXL Lubrifont SC）作为离线兜底与推荐。
  - 加载走 Google Fonts css2 端点（浏览器按 unicode-range 只拉用到的切片），`document.fonts.load()` 就绪后才绘制；4 秒超时按顺序切到 fontsource 的 jsDelivr CSS（`cdn.jsdelivr.net`，再 `gcore.jsdelivr.net`）；全部失败提示并回落系统字体。Noto CJK 系列不能靠 css2 的 `text=` 子集化（实测仍返回整套字体），靠 unicode-range 切片即可。
  - 本地上传 TTF / OTF / WOFF / WOFF2，用 `FontFace` 直接注册，不再需要 opentype.js。
  - 字体搜索框支持按名称和分类（sans / serif / display / handwriting）过滤，最近使用置顶。

### 3.4 画布与形状

- 尺寸预设：头像 512 / 1024（默认）/ 2048 / 4096；横幅 1920×1080、2560×1440；竖版 1080×1920、1080×1440；自定义宽高（64–8192）。
- 形状：方形、圆角（圆角比例 0–50 %）、圆形。PNG 导出时圆角外透明，JPG 导出时以可选底色填充。
- 预览可开启“裁切安全区”参考线，同时画出圆形裁切范围与排版实际用的安全框。
- 超过设备 WebGL 最大渲染尺寸（读取 `MAX_RENDERBUFFER_SIZE`）时，按上限渲染再放大合成，并在导出面板提示“本设备最高原生 N px”。

### 3.5 导出

- 格式：JPG（默认）、PNG、WebP。
- JPG 体积控制：目标 1 MB（默认）与上限 2048 KB 两个档位，另有“不限制（质量 92）”；用二分搜索质量达到目标，质量下限 0.6，达不到则提示降分辨率。
- WebP：质量 0.9，同样支持目标体积；启动时用 1×1 画布探测 `toBlob('image/webp')` 的返回类型，Safari 一类不支持的浏览器直接隐藏该选项，不引入 WASM 编码器。
- PNG：无损；分辨率 ≥ 4096 时提示体积可能很大。
- 文件名：`<文字>_<宽>x<高>.<ext>`，文字保留原样（含中文）只去掉文件名非法字符并截断到 12 个字符，为空时用 `avatar`。
- 移动端优先走 Web Share API（`navigator.share({ files })`，可直接分享到微信），不支持时回落下载。
- 导出前把当前配置写入 URL hash，导出面板提供“复制链接”。

### 3.6 状态、链接与历史

- 全部配置是一份可序列化的 `AvatarConfig`，编码进 URL hash（base64url JSON），打开链接即复原；`localStorage` 保存最近一次配置。
- “最近生成”条：最近 8 次导出或随机的配置缩略图，点击回到该状态。
- 随机按钮：只随机 seed；长按或下拉菜单可选“随机配色 + 质感”。

### 3.7 界面与响应式

- 技术栈：Vite 8 + React 19 + TypeScript strict + Tailwind CSS v4 + shadcn/ui（CLI 4 默认的 Base UI 底层）+ lucide 图标；付费 registry `@shadcnblocks`、`@reactbits-starter`、`@reactbits-pro` 在 `components.json` 启用，实现前按 `frontend-component-priority` 技能枚举候选件。
- 桌面（≥ 1024 px）：左侧 380 px 控制面板（分组：文字 / 配色 / 质感 / 画布），右侧大预览，顶栏放语言、主题、随机、导出。
- 手机（< 1024 px）：顶栏紧凑；预览区 sticky 在顶部，高度约 44 vh；控制面板在下方分段切换；底部固定操作条（随机、导出），留出 `env(safe-area-inset-bottom)`；导出与参数面板用底部抽屉（shadcn Drawer，Base UI 实现，支持 snap points）。所有触控目标 ≥ 44 px，输入框字号 ≥ 16 px 防 iOS 聚焦缩放。
- 深浅主题跟随系统并可手动切换；页面本身的氛围背景用同一引擎的低强度静态渐变，深浅主题各一套。
- 界面语言：简体中文（默认）、繁体中文、English、日本語、한국어；语言影响界面文案、默认字体、默认示例文字。
- 可访问性：全部控件有可访问名称，键盘可达，`prefers-reduced-motion` 下不做装饰动画。

### 3.8 PWA

- `vite-plugin-pwa` 生成 manifest 与 service worker，可安装到桌面；离线时界面可用，字体缓存按需。

## 4. 非功能规约

- 首屏 JS（gzip）≤ 250 KB，shader 引擎与字体列表按需加载。
- 1024×1024 JPG 导出在中端手机 ≤ 1.5 s；4096 在桌面 ≤ 3 s。
- 单测覆盖核心纯函数：seed 映射、文字排版与自动填满、自动文字色、体积二分、URL 编解码、五语言 key 对齐。
- Playwright 冒烟（桌面 1440 与 iPhone 15 设备模拟）：页面加载、画布非空、导出产物体积达标。
- CI：lint、typecheck、单测、构建、冒烟；Cloudflare Pages 构建命令 `npm run build`，输出 `dist`。

## 5. 明确不做

- Node CLI 与批量生成：随 WebGL 引擎一并下线，需要时以 Playwright 脚本另立项目。
- SVG 导出：shader 渲染无法矢量化，不再提供。
- 内置阿里字体与 opentype.js 轮廓化：由 Google Fonts 动态加载与 `FontFace` 取代。
- 文生图或任何模型调用。
- 账号、云端保存、协作。

## 6. 验收标准

1. 手机（iPhone 15 设备模拟）上完成“输入 → 随机 → 导出 JPG ≤ 1 MB”全流程，无横向滚动，触控目标合规。
2. 四种质感在 24 套配色下都能出图，且默认参数下效果接近参考图的柔光质感（人工评审通过）。
3. 任选 Google Fonts 中文字体，2 秒内完成加载并正确渲染中文；断网时回落系统字体并提示。
4. 同一链接在两台设备打开得到相同构图与配色。
5. `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` 全绿。
6. README、architecture、ADR、CHANGELOG、engineering-lessons 与代码同步。
