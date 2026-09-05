# 渐变头像生成器

输入几个字，得到一张柔光渐变的头像。线上地址：<https://jianbian.zixuan.net>。English summary: see [below](#english).

![13 套浅色配色 × 四种质感](docs/assets/samples/styles-x-palettes-1.jpg)

![另外 13 套配色 × 四种质感](docs/assets/samples/styles-x-palettes-2.jpg)

## 它做什么

- **四种质感**：柔光（mesh）、流动（flow）、丝绸（silk）、颗粒（grain），由 WebGL2 片元着色器实时渲染。同一配置在同一设备上每次输出一致，换个种子就是一张新图；颗粒质感的随机形状池已去掉同心圆，保留波纹与角块。不支持 WebGL2 的浏览器会回落到静态近似渐变，导出得到的也是这张近似图。
- **26 套配色**：按家族分组，浅色深色都有；也可以自定义 2 到 6 个颜色，或给一两个种子色，由 OKLCH 算法生成整套。
- **文字排版**：最多两行（第一行、第二行），第二行为空只渲染第一行；字号默认自动填满，一拖滑杆就以当前值切成手动，点「自动」回去；默认边距 15%、行高 1.03；次行字号比例与逐行水平补偿可调，补偿只动自己那一行，其余行字号与位置一个像素都不变；五种文字效果（纯色、描边、投影、发光、胶囊底），默认投影 40% 且深浅字反色适配；白、黑、米白、明黄四档预设色加自选，也可切自动取色并保留对比度兜底。
- **图标**：文字面板里一个开关，图标置顶、文字两行自动缩小适配；可搜 lucide 内置图标、按中文搜 emoji，或上传 SVG / PNG / WebP。内置图标跟随文字颜色与效果，emoji 跨平台取同一份 Noto SVG，上传 SVG 会先做白名单消毒且只在本次会话有效。
- **字体**：Google Fonts 全库按需加载，中文字体按 unicode-range 切片只拉用到的字，Noto Sans SC 整包 1.1 MB，实际只下载其中几十 KB；也能上传本地 TTF、OTF、WOFF、WOFF2。
- **画布与导出**：64 到 8192 像素，默认方形，也可切圆角或圆形；JPG（默认压到 1 MB 以内）、PNG、WebP；点主按钮直接触发浏览器下载，导出选项里另有“复制图片”按钮；微信内置浏览器里改为长按图片保存。
- **预览参考层**：安全区与网格参考线两个开关，只在预览显示，导出的图上没有；开关状态记在本机。
- **存档与历史**：配置自动存在本机，刷新即恢复；本地保留最近 8 次结果。
- **界面**：五种语言（简体、繁體、English、日本語、한국어），深浅主题，可安装为 PWA。

![文字效果样张](docs/assets/samples/text-effects.jpg)

## 怎么用

1. 打开网址，输入文字。主流聊天应用的列表头像大多在 40 像素上下，两到四个字、字重 700 最清楚。
2. 在“配色”和“质感”里挑，或者点底部常驻的“随机颜色”换种子、“随机配色与质感”连质感一起换；改文字随时点“文字”快捷入口，一步跳到输入框。
3. 点“导出”立即下载；需要粘贴到聊天窗口时，点导出按钮右侧的设置图标，再选“复制图片”。
4. 要做部门或产品标识，在文字面板打开图标开关，选一个内置图标或 emoji，也可以上传自家 logo，再填名称并导出。

## 本地开发

需要 Node.js 24 以上。

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest 单测
npm run e2e          # Playwright，桌面与 iPhone 15 两组
npm run screenshots  # 设备模拟截图到 .screenshots/
npm run build        # 产物在 dist/
npm run budget       # 构建后检查首屏 JS 预算
npm run samples      # 重生成 README 的样张
npm run gen:icons    # 从已安装的 lucide-react 重建图标索引
npm run gen:emoji    # 从 emojibase-data 重建五语 emoji 索引（需要网络）
npm run gen:app-icons # 用本机 chromium 把 SVG 应用图标位图化
```

界面组件来自 shadcnblocks 与 React Bits Pro 两个付费 registry，装进来之后就是仓库里的普通源码，构建和部署都不需要密钥。只有再从 registry 拉新组件时，才要在 `.env.local` 里放密钥。

## 部署

Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`，Node 版本读 `.node-version`。`public/_headers` 与 `public/_redirects` 会随构建进入输出目录。

## 技术说明

- Vite 8、React 19、TypeScript、Tailwind CSS v4、shadcn/ui（Base UI 底层）、zustand。
- 渲染引擎是 [@paper-design/shaders](https://github.com/paper-design/shaders)（Apache-2.0）的 `staticMeshGradient`、`meshGradient`、`warp`、`grainGradient` 四个着色器，项目只做种子映射、离屏渲染与限幅。
- 内置图标来自 lucide-react 1.37（ISC），emoji 索引来自 emojibase-data 15.0.0（MIT），emoji 图形来自 Noto Emoji v2.047（Apache-2.0）；索引产物入库，选择器按需加载。
- 颜色计算用 culori，全部在 OKLCH 空间做。
- 首屏 JS 控制在 250 KB gzip 以内，着色器与字体选择器按需加载。

文档：

| 想看什么 | 去哪看 |
| --- | --- |
| 模块划分与数据流 | `docs/architecture.md` |
| 为什么选这条技术路线 | `docs/adr/`、`docs/research/` |
| 规约与实施计划 | `specs/` |
| 踩过的坑 | `docs/engineering-lessons.md` |
| 跨会话项目记忆 | `docs/memory/` |
| 参与开发 | `docs/contributing.md` |

## 与 v2 的关系

v3 是整体重写。v2 的 SVG 多层径向渐变、SVG 导出与命令行工具都已下线：渲染换成了着色器，头像也只需要位图。要用旧版本，切到 `v2.3.0` 标签。变更细节见 `CHANGELOG.md`。

## 致谢

- [Justin Jay Wang](https://justinjay.wang/methods-for-random-gradients/) 的多层径向渐变方法是 v1 与 v2 的出发点。
- [Paper](https://paper.design) 开源的 shader 库让 v3 的四种质感不必从零写 GLSL。

## English

Gradient Avatar turns a few characters into a soft, luminous gradient avatar, entirely in the browser. Try it at <https://jianbian.zixuan.net>.

What it does: four WebGL2 textures (mesh, flow, silk, and grain without circular ripple seeds); 26 palettes plus OKLCH palette generation from one or two seed colors; any Google Font, with CJK fonts loaded as unicode-range slices; auto-fit typography with 15% padding, 1.03 line height, and per-line size and nudge controls; one-click browser download and PNG clipboard copy; JPG, PNG, and WebP export with a file-size target; safe-area and grid overlays for the preview only; settings persist locally; five UI languages; installable as a PWA.

Development: `npm install && npm run dev` (Node 24+). Deploy to Cloudflare Pages with `npm run build` and output directory `dist`.

## 许可

MIT，见 `LICENSE`。
