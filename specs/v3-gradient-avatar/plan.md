# 渐变头像生成器 v3 实施计划（怎么造）

对应规约：`spec.md`。执行方式：主会话做编排、规约、验收与提交；机械实现交给 Workflow 里的 Opus 5 子智能体，按阶段推进，每个阶段结束由主会话验证并提交一次。

## 0. 共享契约

所有阶段的代码都围绕这份类型写，先落到 `src/state/config.ts`，之后只允许增字段不允许改语义。

```ts
export type StyleId = 'mesh' | 'flow' | 'silk' | 'grain'
export type Shape = 'square' | 'rounded' | 'circle'
export type TextEffect = 'plain' | 'outline' | 'shadow' | 'glow' | 'pill'
export type Anchor = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br'

export interface AvatarConfig {
  v: 3
  text: string
  seed: string // 空字符串表示由 text 哈希派生
  style: StyleId
  styleParams: {
    intensity: number // 0..1，各 style 自行映射（mesh: wave；flow: distortion；silk: 褶皱；grain: intensity）
    softness: number // 0..1（mesh: mixing；flow: 1-swirl；silk: softness；grain: softness）
    grain: number // 0..1，联动 grainMixer / grainOverlay / noise
    scale: number // 0.5..2
    rotation: number // 0..360
  }
  highlight: number // 0..1，2D 合成阶段的柔白高光强度
  palette: string // 内置配色 id 或 'custom'
  customColors: string[] // 2..6 个 hex
  canvas: { width: number; height: number; shape: Shape; radius: number /* 0..0.5 */ }
  typography: {
    fontFamily: string
    fontSource: 'google' | 'system' | 'upload'
    fontWeight: number
    sizeMode: 'auto' | 'manual'
    fontSize: number // 画布短边比例 0.04..0.92，manual 时生效
    padding: number // 每边安全边距比例 0..0.3
    lineHeight: number // 0.85..2
    letterSpacing: number // em，-0.1..0.5
    align: 'left' | 'center' | 'right'
    anchor: Anchor
    offsetX: number // 画布宽比例 -0.5..0.5
    offsetY: number
    vertical: boolean
    autoWrap: boolean
    effect: TextEffect
    effectStrength: number // 0..1
    colorMode: 'auto' | 'custom'
    color: string
    pill: { radius: number; padding: number; opacity: number }
  }
  exportOptions: {
    format: 'jpg' | 'png' | 'webp'
    sizeTarget: 'none' | '1mb' | '2mb'
    bgColor: string // JPG 与圆角外区域的底色
  }
}
```

配套导出 `DEFAULT_CONFIG`、`normalizeConfig(partial)`（补默认、夹范围）、`configHash(config)`。

## 1. 目录结构

```
index.html
src/
  main.tsx  App.tsx  index.css
  app/            AppShell.tsx TopBar.tsx BottomBar.tsx PreviewStage.tsx AmbientBackground.tsx
  app/panels/     TextPanel.tsx PalettePanel.tsx StylePanel.tsx CanvasPanel.tsx ExportDrawer.tsx FontPicker.tsx HistoryStrip.tsx
  components/ui/  shadcn 原语
  components/blocks/  registry 装入的 block（改造后）
  engine/         styles.ts seed.ts mount.ts render.ts caps.ts css-fallback.ts
  text/           measure.ts wrap.ts fit.ts draw.ts auto-color.ts
  palettes/       palettes.ts harmony.ts color.ts
  fonts/          google.ts catalog.ts curated.ts upload.ts loader.ts
  export/         compose.ts encode.ts download.ts share.ts filename.ts
  state/          config.ts store.ts url.ts history.ts persist.ts
  i18n/           index.tsx zh-CN.json zh-HK.json en.json ja.json ko.json
  lib/utils.ts
tests/            vitest 单测（按模块同名）
e2e/              Playwright 冒烟（desktop.spec.ts mobile.spec.ts）
scripts/screenshots.mjs   设备模拟截图工具，供人工与智能体视觉核查
public/           favicon、manifest 图标、_headers、_redirects
```

## 2. 阶段与任务

### 阶段 1：脚手架与清场（单个智能体，串行）

1. 删除：`generate.js`、`src/cli/`、`src/core/`、`config/`、`examples/`、`output/`、`web/`、`tests/`、`docs/api-reference.md`、`docs/configuration.md`、`docs/troubleshooting.md`、`firebase-debug.log`、`.superpowers/`、`dist/`。
2. `package.json` 重写：name `gradient-avatar`、version `3.0.0`、scripts `dev build preview lint format typecheck test test:watch e2e screenshots`；依赖 react 19、react-dom、@paper-design/shaders、culori、zustand、lucide-react、clsx、tailwind-merge、class-variance-authority，`@base-ui/react` 由 shadcn 带入；开发依赖 vite 8、@vitejs/plugin-react、typescript、tailwindcss 4、@tailwindcss/vite、vite-plugin-pwa、vitest、jsdom、@playwright/test、eslint 10、typescript-eslint、eslint-plugin-react-hooks、eslint-config-prettier、prettier、prettier-plugin-tailwindcss。
3. `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` 按 shadcn Vite 文档配 `@/*` 别名；`vite.config.ts` 用 `@tailwindcss/vite`、`@vitejs/plugin-react`、`vite-plugin-pwa`、`resolve.alias`、`test` 段（jsdom）。
4. `npx shadcn@latest init`（CLI 4 默认 Base UI 底层，baseColor neutral，css variables），`components.json` 合并三个付费 registry（URL 与 header 形态见 `react-bits-pro` 技能），根目录 `.mcp.json` 写 shadcn MCP。
5. `npx shadcn@latest add button tabs slider select drawer sheet tooltip toggle-group input textarea popover switch badge scroll-area dialog dropdown-menu sonner separator label command`。
6. `npx shadcn@latest add @reactbits-starter/skill`，把生成的 `SKILL.md` 移到 `.agents/skills/react-bits-pro-official/SKILL.md`，frontmatter `name` 改为 `react-bits-pro-official`，并建 `.claude/skills/react-bits-pro-official` 软链。
7. 按 `frontend-component-priority` 枚举候选件并 `view` 源码，把可借鉴的写进 `docs/engineering-lessons.md` 的“付费组件件清单”一节。首批必看：`@reactbits-pro/mobile-4`（底部栏 + 双档抽屉）、`@reactbits-pro/settings-form-3`（分段控件与 radio card）、`@reactbits-pro/navbar-8`（带滑动指示的分段 tab）、`@reactbits-pro/app-shell-8`（自适应外壳）、`@shadcnblocks/navbar6`（悬浮导航）。
8. 落 `src/state/config.ts` 契约、`src/lib/utils.ts`、空的 `App.tsx`，`.gitignore` 去掉 `README.md` 这条错误忽略，`.env.local` 继续忽略。
9. 验证：`npm run dev` 能起、`npm run build` 通过、`npm run lint`、`npm run typecheck` 通过。

### 阶段 2：核心库（并行，按目录分工，互不改对方文件）

| 智能体   | 目录            | 产出                                                                                                                                                                                                                                                                                                                                                                                                             | 测试                                                  |
| -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| engine   | `src/engine/`   | `STYLES` 定义（四种 style 的 shader、参数映射、默认值）；`seedToParams(seed, style)`；`createGradientMount(container, config)`（像素尺寸由容器布局尺寸决定）；`renderGradient(config, w, h): Promise<HTMLCanvasElement>`（离屏 ShaderMount，`speed 0`，`preserveDrawingBuffer`，读 `MAX_RENDERBUFFER_SIZE` 限幅后放大）；`hasWebGL2()`；`cssFallbackStyle(config)`                                                                     | seed 确定性、参数落在合法区间、限幅逻辑               |
| text     | `src/text/`     | `measureText`（canvas measureText 封装，含字间距）；`wrapLines(text, maxWidth, mode)`（CJK 逐字、拉丁按词）；`fitText(config, box)`（二分字号，返回 lines、fontSize、lineHeight 像素）；`drawText(ctx, layout, style)`（描边 / 投影 / 发光 / 胶囊、竖排）；`pickTextColor(imageData, region)`（明度 + WCAG 对比度）                                                                                              | 用 stub measure 测 wrap / fit / 竖排；auto color 阈值 |
| palettes | `src/palettes/` | 24+ 套配色（保留旧 12 套里视觉合格的，加入调研文档附录的 17 套新配色，字段 id、family、tone: light/dark、colors、text、bg；名字走 i18n key）；`harmonize(hex, mode)`（culori OKLCH）；`paletteThumb(colors)` CSS 字符串                                                                                                                                                                                          | 数量与格式校验、harmony 输出在色域内                  |
| fonts    | `src/fonts/`    | 精选清单 `CURATED_FONTS`（含全部 Google Fonts 中文字体与 20 个拉丁展示字体，字段 id / family / category / subsets / weights）；`fetchCatalog()`（fontsource API，localStorage 7 天）；`loadGoogleFont(family, weights, text)`（css2 link + `document.fonts.load`，4 s 超时依次切 `cdn.jsdelivr.net`、`gcore.jsdelivr.net` 的 fontsource CSS）；`registerUploadedFont(file)`（FontFace）；`fontFamilyCss(config)` | 缓存逻辑、URL 构造、回退顺序（mock fetch）            |
| export   | `src/export/`   | `composeAvatar(config, w, h): Promise<HTMLCanvasElement>`（gradient → highlight → text → shape mask）；`encode(canvas, options)`（toBlob，目标体积二分，质量下限 0.6）；`downloadBlob`、`shareBlob`（Web Share 优先）；`buildFilename`                                                                                                                                                                           | 二分收敛（mock toBlob）、文件名、圆角 mask 透明像素   |
| state    | `src/state/`    | zustand store（config、history、ui）；`encodeConfigToHash` / `decodeConfigFromHash`（base64url JSON，容错）；`persist`（localStorage）；`history` 最近 8 条                                                                                                                                                                                                                                                      | 编解码往返、坏输入回默认、历史去重上限                |

阶段 2 结束：`npm test` 全绿，`npm run typecheck` 通过。

### 阶段 3：界面（阶段 2 完成后，两个智能体并行）

| 智能体 | 范围                                                                                                                                                                                                                                                                                                                                          |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shell  | `src/app/AppShell.tsx`（桌面双栏 / 手机 sticky 预览 + 底栏）、`TopBar`、`BottomBar`、`PreviewStage`（用 engine mount 做实时预览，防抖 80 ms，形状与安全区参考线）、`AmbientBackground`、主题（class 策略 + 系统跟随）、`src/i18n/`（Provider、`useT`、五份字典，从 `web/i18n/*.json` 迁移并补新 key）、PWA manifest 与图标、`index.html` meta |
| panels | `src/app/panels/*`：文字、配色（渐变缩略图、筛选、自定义、种子色生成）、质感（style 切换与滑杆）、画布（尺寸预设、形状、圆角）、导出抽屉（格式、体积档、底色、复制链接、分享 / 下载、设备上限提示）、字体选择器（command 面板 + 搜索 + 分类 + 最近使用 + 上传）、历史条                                                                       |

约束：所有文案走 i18n key；触控目标 ≥ 44 px；输入类字号 ≥ 16 px；`prefers-reduced-motion` 关闭装饰动画；组件优先来自 shadcn 原语与阶段 1 记录的付费件范式。

### 阶段 4：集成与视觉核查（串行，最多 3 轮）

1. 把 panels 接进 shell，跑 `lint / typecheck / test / build`。
2. `scripts/screenshots.mjs` 用 Playwright 设备描述符（iPhone 15、iPhone SE、桌面 1440）截深浅两套主题，另外截导出抽屉打开态。
3. 视觉核查智能体读截图，按 spec 3.7 与验收 1 逐条判定，输出问题清单；修复智能体按清单改；直到无阻塞问题。
4. e2e：`e2e/desktop.spec.ts`、`e2e/mobile.spec.ts`（画布非空像素、导出 JPG ≤ 1 MB、链接往返）。

### 阶段 5：审查

- clean-context 代码审查（不带实现上下文），维度：正确性、内存与 WebGL 资源释放、a11y、性能、i18n 完整性；再由修复智能体处理确认项。

### 阶段 6：文档、提交、发布

- README 重写（现状口径）、`docs/architecture.md` 重写、`CHANGELOG.md` 3.0.0、`docs/engineering-lessons.md` 增补本次踩坑、`docs/memory/` 更新。
- 主会话分批提交：spec 与调研 → 脚手架 → 核心库 → 界面 → 修复与测试 → 文档；最后 push。
- 改仓库名后确认 Cloudflare Pages 构建仍触发（source 存的是 `repo_id`，改名不影响）。

## 3. 验证命令

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run e2e            # Playwright，headless chromium 加 swiftshader 参数
npm run screenshots    # 设备模拟截图到 .screenshots/（gitignore）
```

## 4. 风险与对策

| 风险                                                             | 对策                                                                                                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 手机 WebGL 最大渲染尺寸不足 4096                                 | `caps.ts` 读取上限，按上限渲染后 drawImage 放大；导出面板提示                                       |
| Google Fonts 在大陆不可达                                        | 4 s 超时依次切 `cdn.jsdelivr.net`、`gcore.jsdelivr.net` 的 fontsource CSS；再失败回系统字体并 toast |
| 变体 CJK 字体 `text=` 子集无效（Noto Sans SC 实测仍返回 4.6 MB） | 不用 `text=`，靠 css2 的 unicode-range 切片按需加载                                                 |
| 多智能体并行改同一文件                                           | 阶段 2 按目录分工，阶段 3 只两个智能体且目录不交叉，集成由单个智能体做                              |
| 付费件 registry 只在本机可用                                     | 装入即普通源码，CI 不需要密钥                                                                       |
