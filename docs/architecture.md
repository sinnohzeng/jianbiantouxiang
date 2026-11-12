# 架构

渐变头像生成器是一个纯前端静态站：一份可序列化的 `AvatarConfig` 驱动 WebGL 渲染与 2D 合成，产出一张位图并落到磁盘或图片剪贴板。

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 构建 | Vite 8、`@vitejs/plugin-react`、`vite-plugin-pwa` | 单包根目录应用，产物在 `dist/` |
| 语言 | TypeScript 6 | `strict` 加 `noUncheckedIndexedAccess`，路径别名只用 `@/` |
| 框架 | React 19 | 无路由，两个入口：`index.html`、`about.html`（`appType: 'mpa'`，详见“构建与部署”） |
| 样式 | Tailwind CSS v4、`@tailwindcss/vite` | 主题走 CSS 变量，深浅两套 |
| 组件 | shadcn/ui（CLI 4，Base UI 底层）、lucide-react、cmdk、sonner | 原语在 `src/components/ui/`，跟随上游 |
| 状态 | zustand 5 | 单 store，模块加载即读本机存档 |
| 渲染 | `@paper-design/shaders` 0.0.82 | WebGL2 fragment shader，Apache-2.0 |
| 颜色 | culori 4 | 全部计算在 OKLCH 空间 |
| 测试 | Vitest 5（jsdom）、Testing Library、Playwright 1.64 | 单测加两组端到端 |
| 规范 | ESLint 10、typescript-eslint、Prettier | `src/components/ui` 与散文目录不进格式化 |
| 托管 | 阿里云 ESA Pages（主站）、Cloudflare Pages（旧域名 301） | 构建 `npm run build`，输出 `dist`；构建配置在 `esa.jsonc`，接入步骤与核对命令见 `docs/deploy.md` |

## 目录结构

| 路径 | 职责 |
| --- | --- |
| `src/main.tsx` | 挂 React 根，接上系统主题监听，按条件装端到端探针 |
| `src/App.tsx` | 套 i18n Provider，让文档标题跟随界面语言 |
| `src/app/` | 应用外壳、顶栏、底部操作条、实时预览与参考层开关、预览高度、氛围背景、主题状态 |
| `src/app/workspace/` | 挑选栏两列（文字、图标 / 配色、质感），按设备呈现精调控件与折叠组，手机分隔条 |
| `src/app/panels/` | 导出抽屉外壳及按需加载的导出控件、字体选择器、图形选择器、历史条 |
| `src/about/` | 关于页那一小段脚本与赞赏配置。正文在根目录的 `about.html` 里 |
| `src/components/ui/` | shadcn 生成的原语，本仓不改写、不格式化 |
| `src/components/blocks/` | 界面复用件：分段控件、radio card、带数值框与重置钮的滑杆、“自动”与“跟随”共用的开关钮、颜色格、可折叠分组 |
| `src/engine/` | 质感定义与参数映射、种子、预览挂载、离屏渲染、设备能力探测、无 WebGL2 兜底 |
| `src/engine/shaders/` | 四段 fragment shader 源码，一种质感一份 chunk |
| `src/text/` | 文字量测、换行、自动填满、排版、绘制、明暗判定 |
| `src/palettes/` | 47 套内置配色、OKLCH 色彩工具、种子色和谐生成 |
| `src/fonts/` | 精选清单与原生名表、fontsource 目录缓存与条目查找、默认字体的本站分片、按行加载的 css2 与镜像加载链、字体名预览、本地上传注册 |
| `src/fonts/family.ts` | font-family 与 canvas font 简写的字符串工具。`src/text` 引用它，`src/fonts` 不引用 `src/text` |
| `src/graphics/` | 图形来源分派、lucide Path2D、Noto Emoji、上传消毒、五语 emoji 索引、图形绘制 |
| `src/graphics/generated/` | lucide 全库与精选索引、emoji 基础索引与五语标签，由 `npm run gen:icons` / `gen:emoji` 生成 |
| `src/export/` | 画布合成、编码与体积二分、导出动作、下载、图片剪贴板、文件名 |
| `src/state/` | `AvatarConfig` 契约、zustand store、本地存档、历史 |
| `src/i18n/` | 五份扁平字典与 Provider |
| `src/hooks/` | 媒体查询与防抖 |
| `src/lib/` | 画布小工具（含画布属性的像素串 `cssPx`）与 `cn`：engine、export、text、fonts 共用的最底层，不依赖任何业务目录 |
| `tests/` | Vitest 单测，目录与 `src/` 同名 |
| `e2e/` | Playwright 用例，`smoke` 两档都跑，`desktop` 与 `mobile` 各归一档 |
| `scripts/screenshots.mjs` | 设备模拟截图，输出到 `.screenshots/` |
| `public/` | 图标、`_headers`、`_redirects`（只在 Cloudflare Pages 上生效），随构建进入 `dist/` |

## 界面结构

一棵组件树按 CSS 断点重排，DOM 顺序为预览、分隔条、挑选栏和操作条。≥1120 px 是文字/图标、配色/质感、预览三列；1024–1119 px 控件并入一列，和预览并排；小于 1024 px 为纵向页面。桌面工作台最大宽 1520 px，列模板在 `index.css`。

手机预览 sticky，分隔条支持拖动、键盘、44 px 点按缩放与恢复。预览高度单独持久化，不属于头像配置。根滚动区按预览高度、分隔条和底栏设置焦点避让。手机编辑节平铺，桌面保留分组容器。

文字节按行展示内容、字号和上下位置，第二行为空时隐藏其尺寸位置。字体、字重、颜色、效果及左右位置收在“字体与样式”。Logo 大小和上下位置常显。手机精调为加减与数值输入，桌面保留滑块；质感参数用于连续探索，仍配数值输入。输入支持中间状态，提交时对齐步进与范围。

“恢复自动排版”清除尺寸位置手调并恢复客户 Logo 比例，保留文字、字体、Logo 和配色。字体选择器桌面为锚定弹层、手机为抽屉，按行选择；第二行可显式跟随第一行。字体加载失败在该行显示提示。

图形选择器默认品牌，客户成品置顶，再到字节品牌、其他品牌、内置图标及 emoji。索引失败显示网络错误和保存编辑后刷新入口；上传素材只在当前会话有效。原色/程序染色及授权边界见“图形来源”。

底栏提供「变换底纹」（只换种子）、随机配色、导出和导出选项。顶栏提供撤销重做、历史、语言和设置；简介在设置内以新标签打开（noopener noreferrer）。字体、图形、历史和导出控件按需加载；ExportDrawer 外壳常驻，首次打开经过关闭到打开状态，内容下载期间显示加载状态。关于页是独立静态入口。

## 共享契约

`src/state/config.ts` 的 `AvatarConfig` 是全仓唯一的参数来源。它同时是 localStorage 的存档格式与历史条目的内容。项目在开发期，契约随需要改结构，不写迁移：换结构就升 `src/state/persist.ts` 的 `PERSIST_KEY`，旧存档不读。`normalizeConfig` 负责同一结构下的残缺与越界输入，缺的补默认，越界的夹回。

| 字段组 | 内容 | 谁在读 |
| --- | --- | --- |
| `text`、`seed` | 文字内容与随机种子，`seed` 为空时由 `text` 哈希派生 | 引擎、文字、文件名 |
| `style`、`styleParams` | 四种质感之一，加强度、柔和度、颗粒、比例、旋转五个归一化滑杆 | 引擎 |
| `highlight` | 2D 合成阶段的柔白高光强度 | 合成 |
| `palette`、`customColors` | 内置配色 id 或 `custom`，自定义时给 2 到 6 个 hex | 配色、引擎 |
| `canvas` | 宽高、形状、圆角比例 | 合成、导出 |
| `typography` | 逐行参数两组 `line1`、`line2`，每组是字体（family、来源、字重）、字号与水平垂直两向补偿；两行共用的边距、行高、字间距、文字效果与强度、颜色、胶囊底参数。两组里的 `null` 表示由系统派生：第一行字号由求解器派生，第二行的字体与字号由第一行派生 | 文字、字体 |
| `layout` | 图形比例、图形来源与品牌单色开关（`icon.mono`，仅品牌来源生效，默认 `false`）；v4 起无用途分派，图标、第一行、第二行一个纵向栈 | 文字排版、图形 |
| `exportOptions` | 格式、体积档、底色 | 编码 |

同一模块另外导出三个函数。`DEFAULT_CONFIG` 是默认值的唯一定义处；`normalizeConfig` 把任意局部输入补成完整配置，数值按区间夹值、枚举做合法性校验，任何输入都不抛错；`configHash` 对键排序后做 FNV-1a，用作历史去重与渲染去重的标记。

字体整份成立或整份作废：family 去掉首尾空白后非空、来源是 google、system、upload 之一才成立，字重取整到 100 到 900 九档。第一行字体作废回默认字体，第二行字体缺字段补无衬线默认，显式 null 或非法字体即跟随。字号、补偿与图形大小的区间是导出常量：`LINE_SIZE_MIN` 0.04、`LINE2_SIZE_MIN` 0.02、`LINE_SIZE_MAX` 0.92、`LINE_OFFSET_MAX` 0.25、`GRAPHIC_MIN` 0.1、`GRAPHIC_MAX` 0.8，无图标自动双行由 `line2FollowScale` 返回 1，有图标自动排版 `AUTO_LOGO_LINE2_SCALE` 为 0.62，首行手动时 `LINE2_FOLLOW_SCALE` 为 0.62，两行之间的留白比例 `LINE_GAP_RATIO` 0.18，留白在默认行高 `LINE_HEIGHT_DEFAULT` 1.03 下取这个基准值。

逐行字体的读写也收在这里。`lineFont(t, line)` 取某一行的生效字体，第二行为 `null` 时就是第一行那款；`fontKey` 是一款字体的身份键，来源、family、字重任一不同就是另一款。写字体只走三个函数：`withLine1Font` 写第一行，第二行只改过字重时随第一行换款并吸附字重；`withLine2Font` 写第二行，与第一行全相同时写 `null` 回到跟随；`FOLLOW_LINE1` 把第二行写回跟随。`nearestWeight` 把字重吸附到字体真有的一档，`twoLinesOf` 是两行模型对换行的唯一解释，归一、排版、字体加载与界面共用。

## 渲染管线

预览与导出走两条独立的路径，共用引擎、文字与图形三个模块，因此参数改动只需落在一处。

```mermaid
flowchart LR
  config[AvatarConfig] --> preview[PreviewStage]
  config --> compose[composeAvatar]
  preview --> shared[字体 / 渐变 / layoutText / 图形文字绘制]
  compose --> shared
  compose --> mask[形状遮罩]
  mask --> encode[encodeCanvas]
  encode --> output[下载 / 图片剪贴板]
```

预览把三层叠在一个定长方框里：底下是 `ShaderMount` 的 WebGL 画布，中间一张 2D 画布画高光，上面一张 2D 画布按“先图形后文字”绘制，形状裁切交给 CSS。配置停 80 ms 才推给 shader；图形只按来源与 id 变化重新加载。

导出的顺序是硬性的。高光要压在渐变之上，形状遮罩必须最后做，否则被裁掉的边角会被后续绘制重新填满。合成逻辑在 `src/export/compose-core.ts`，引擎、文字、字体与图形四个模块的真实实现在 `compose.ts` 一处装配，单测因此不必拉起 WebGL、字体网络或 emoji CDN。

## 四种质感

`src/engine/styles.ts` 是引擎里唯一知道 shader uniform 名字的地方。质感卡片的“参数”组只认 `styleParams` 的五个滑杆，渲染层只认 `StyleRenderPlan`，换 shader 或调区间都只动这一个文件。

| 质感 | 底层 shader | 参数映射要点 |
| --- | --- | --- |
| `mesh` 柔光 | `staticMeshGradient` | 强度映射到 `u_waveX` 与 `u_waveY`，柔和度映射到 `u_mixing`，两者铺满全程 |
| `flow` 流动 | `meshGradient` | 强度映射到 `u_distortion`，柔和度映射到 `u_swirl` 的补，构图由 `frame` 定 |
| `silk` 丝绸 | `warp` | 底纹以 stripes 为主，浅配色按 OKLCH 平均明度线性压制 `u_distortion` 与 `u_swirl` |
| `grain` 颗粒 | `grainGradient` | 形状池只取 wave 与 corners，去掉会出同心圆的 ripple；两种形状共用 0.45 的缩放倍率 |

包内的四组常量抄进 `styles.ts` 并注明来源，不从包里 import：`meta` 与 shader 源码同在一个模块，静态引用 `meta` 会把那段 GLSL 拖进首屏 chunk。升级包版本时对照 `dist/` 复核这四组值。

`warp` 没有颗粒 uniform，缺的那份由 `src/engine/film-grain.ts` 在 2D 阶段补上，做法是一张种子噪声小图平铺后 overlay 混合。

## 文字排版

只有一种版式：图标（可选）→ 第一行 → 第二行的纵向栈，水平居中，整体在可用区域里垂直居中。`fitStack` 在 `LINE_SIZE_MIN` 到 `LINE_SIZE_MAX` 之间二分 12 轮找基准字号，第二行的 `line2.size` 为 `null` 时按 `line2FollowScale` 派生（纯文字自动双行同级，带 Logo 或手动主行取 0.62），定了短边比例就按定值排，两种情况都只搜基准一个自由度，两档都放开会有无穷多组解落在安全框里。每一段带自己的字体：第一行取 `line1.font`，第二行取 `lineFont(t, 2)`，量宽与绘制都用 `src/fonts/family.ts` 的 `fontString` 拼出这一段的 canvas font。严格档要求不劈开拉丁词且主行不折行，放不下才落宽松档。

每一行可以按自己那组的 `offsetX`（画布宽比例）与 `offsetY`（画布高比例）做视觉补偿，图标按 `graphicOffsetX`、`graphicOffsetY`（安全框宽高比例）补偿。补偿不参与求解：换行与二分都按完整安全区算，落位时做纯位移，改第 i 行只动第 i 行，其余行的字号与坐标一个像素都不变；图标补偿也不挤压文字可用区。位移后越出安全区只反映在 `overflow` 提示里，不缩字号。绘制层按段设置 `ctx.font`，字号与字体都按段走，描边、投影、发光的尺度也随之按段走。第一行为空、第二行有内容是合法槽位（图标加说明文字），空槽位留住，第二行晋升为主行时整组取 `line2` 的字体、字号与补偿。

第一行字号 `line1.size` 为 `null` 时自动，由 `fitStack` 求解，`TextLayout.fontRatio` 带出求得的基准比例，预览每次排版后把它写进 store 的 `ui.autoFontSize`。这是派生值，不进配置与存档。字号滑杆常驻可用：自动态显示这个回写值，一拖就以它为起点写成定值，旁边的“自动”按钮把 `line1.size` 写回 `null`，滑杆停在刚才的定值上直到新解回写，画面全程不跳。

安全框由 `typography.padding` 从画布四边扣出，默认值 0.03；`typography.lineHeight` 默认 1.03。量宽一律走 canvas `measureText`，CJK 逐字换行、拉丁按词换行。

文字色就是用户挑的那一个，预览与导出读同一个字段，没有第二条判定路径。`src/text/ink.ts` 只留纯色彩数学，供配色表与选择器判明暗。

图标进栈在 `layoutText` 里落位，`layout.graphic` 区间 0.1–0.8。带文字时图形先等比放进参照框（安全框全宽 × 安全框高的 52%，`GRAPHIC_REFERENCE`），再按 `graphic / 0.52` 缩放，占栈顶：方形与竖版图形就是安全框高的 `graphic` 倍，宽图形在 52% 时正好铺满安全框宽，其余档位按比例变。自动排版不按安全框宽收边，超宽由整组圆裁缩放兜住，图形越大文字越小；手动字号时按安全框宽收边。文字拿到剩余高度，两行一起缩小到放得下为止。文字为空时图形在安全框里居中，尺寸是圆形安全区（按用户边距）内能放下的最大同比例矩形的 `graphic / 0.8`，不走排版边距抬升与整组放大。图形缺失时文字退回整块安全框居中。

## 图形来源

`src/graphics/source.ts` 是唯一分派入口：内置图标、emoji、品牌图形与上传图形都按需 `import()`，主界面不带索引。四种来源统一返回 `Graphic`，调用方不认识具体实现。

| 来源 | 索引 | 图形 |
| --- | --- | --- |
| 内置图标 | lucide-react 1.37 的 1790 个主图标；精选 162 个随选择器小索引加载，全库 470 KB 原始数据只在搜索超出精选时加载 | `__iconNode` 转 `Path2D`，按文字色描边，并复用文字效果 |
| emoji | emojibase-data 15.0.0 的 1879 个可分组条目，五种语言各一份标签 chunk | 按码点取 Noto Emoji v2.047 单个 SVG，fetch 转 Blob 再画，保留原色 |
| 品牌 | `src/graphics/generated/brand-index.ts` 的 92 个条目（含客户颜色版本），带中英文名、别名及上游白色源文件（`white` 字段，11 个条目有值） | 同源静态文件 `public/brand/<id>.svg\|png`，SVG 走 fetch 加消毒再转 Blob，PNG 直接 `Image`，保留原色 |
| 上传 | 无索引，模块级会话注册表 | SVG 先经元素与属性白名单重建；PNG / WebP 直接 `Image`，保留原色 |

品牌图形的清单事实来源是 `scripts/brand-list.json`，`npm run gen:brand` 把远端条目从 homarr-labs/dashboard-icons 拉下来、把 `assets/brand/` 里 owner 提供的素材拷过去，统一落到 `public/brand/`，同时生成索引；两个产物都不手改。

兼容染色由 `layout.icon.mono` 控制，默认 false。11 个历史品牌条目有经过文件内容检查的上游白色源文件，其他取原稿；`paintMono()` 以 source-in 按文字颜色染色，属于程序转换而非官方稿。客户颜色版本和 TikTok 设置 preserveColor 保留源色。选择器展示原稿与客户成品，染色在已选品牌的属性区明确标注细节损失与非官方性质。源文件与使用授权是两种证据，来源、异常和缺失清单见当轮素材审计。

索引与加载器都只在图形选择器或 `loadGraphic` 命中 brand 时才 `import()`，不进首屏预算。SVG 与上传路径同过一遍 `sanitizeSvg`，取不到或解析失败只 `console.warn` 并让图形位留空。

缺少固有宽高的 SVG 从合法 viewBox 推导等比尺寸，推导最大边 2048，已有尺寸保留，透明裁切使用明确的固有坐标。上传 SVG 只保留常见绘图元素、渐变、裁剪与安全展示属性；未知元素整支丢弃，未知属性删除，`url()` 只允许内部引用。上传上限为 5 MiB，图片解码后在扫描前限制 16 Mi 像素，会话最多 24 份及 64 Mi 像素；达到上限明确提示，不淘汰历史仍引用的素材。浏览器最初解码的峰值仍由浏览器管理。文件字节只在模块级会话注册表里，不写盘；配置里留的是 `source: 'upload'` 加会话 id，会随存档与历史落盘，刷新后注册表已空，图形位留空、图形节仍显示上传来源，用户重新上传即可。加载失败同样只让图形位留空，渐变、文字与导出继续可用。

## 字体

加载器 `src/fonts/loader.ts` 对外三个函数。绘制前必须等 `document.fonts.load` 就绪，否则画布会用回退字形出图。

- `fontJobs(config)` 给出哪款字体要画哪些字：有文字的行按 `lineFont` 取生效字体，同一款字体的两行文字合并成一条；两行都空时给第一行字体，用拉丁与 CJK 各一个字的样本探测。第二行钉了别款字体但还没有文字时不加载它。预览的字体 effect 以这组字体的 `fontKey` 串和上传字体注册版本为依赖，填上第二行文字后依赖变化，effect 重跑，把第二行的字体加载进来。
- `loadFontsForConfig(config)` 对每条并行加载，每款返回 `{ font, via, ok }`：`font` 是输入的那款，界面据它的来源选提示文案；`via` 是实际走的通道（google、mirror、system、upload）。预览、导出、长按图与历史缩略图都走它。加载状态以 `fontKey` 为键，同一款字体只请求一次。
- `topUpGlyphs(config)` 给已就绪的网络字体补上新出现的字，确实补到时返回 true，预览据此重绘一次。css2 按 `unicode-range` 切片下发，新字所在的切片要再 `load` 一次才会去拉；没就绪或加载失败的字体不补。

目录条目只从 `src/fonts/catalog.ts` 的 `findFontEntry(family)` 同步查：先查精选清单，再查内存目录，按去掉首尾空白后的小写比较。内存目录第一次被访问时从本地缓存解析一次，不看有效期，`fetchCatalog` 拉到新目录时替换；有效期只决定选择器打开时要不要刷新列表，过期条目的 id、字重与版本照样可用。查不到条目时按 family 猜 fontsource id。同一文件的 `weightsOf(family)` 给字重控件用，查不到条目时给一份通用档位；`displayName(family, source)` 是界面上字体名的唯一入口，选择器的行、卡片按钮、预览子集的 `text=` 与搜索都调它：上传字体去掉 `-upload` 后缀，其余有原生名的写原生名，没有的写 family。

| 档 | 来源 | 说明 |
| --- | --- | --- |
| 1 | Google Fonts css2 | 返回的 `@font-face` 全部带 `unicode-range`，浏览器只拉用到的切片，常用汉字所在的切片 24 到 43 KB。不加 `text=`：文字每改一个字就是一份新子集，CSS 只缓存一天；按切片的静态字体文件缓存一年，换了文字也能复用 |
| 2 | `cdn.jsdelivr.net` 上的 `@fontsource` CSS | 走 npm 包路径，每条分片都带 `unicode-range` |
| 3 | `fastly.jsdelivr.net` 上的同一份 CSS | 同上，走 Fastly，与第二档不在同一张 CDN 上 |
| 4 | 系统字体栈 | 界面提示已回落 |

每一档各有 4 秒等待上限。字体目录来自 fontsource 公共 API，按 7 天缓存进 localStorage 的 `gradient-avatar:font-catalog:v1`，每条只留 id、版本、family、字重与由 subset 派生的 `cjk`；只保留 `type` 为 google 的非图标条目，字重只收 100 到 900 九档。接口不可用时回落到 `curated.ts` 的精选清单，它覆盖 Google Fonts 上全部带中文 subset 的字体。

加载失败的字体按 `fontKey` 记进 store 的 `ui.fontFallbacks`。每款失败字体整场会话提示一次，提示里带上字体名，上传字体丢失与网络回落各用一句，两款都失败时两条提示分得清。

上传的 TTF、OTF、WOFF、WOFF2 用 `FontFace` 直接注册，不解析字体文件。注册表在模块级，family 名带 `-upload` 后缀，只在本次会话有效。

字体选择器的每一行与卡片上的字体按钮都用字体自身写名字。系统字体与上传字体直接用自己的 family，本机已有字形，不走网络；Google 字体走预览通道 `src/fonts/preview.ts`，它只依赖 `google.ts` 与 `catalog.ts`，与主加载器隔离。

- 请求：`buildCss2TextUrl(family, weight, text)` 拼 css2 的 `text=` 子集，`text` 是显示名，子集只含这几个字，拉丁名 1 到 2.4 KB，中文名 1.2 到 3.6 KB。字重取该字体离 400 最近的一档并显式写进链接，缺 400 的字体不写字重会被拒。每款单独请求，不合并：`text=` 对整个请求共用，合并后每个 face 都要带所有名字的字形。
- 注册：`fetch` 样式表，取第一条 `src`，以别名 `fp-<fontsource id>` 建 `FontFace`，不写字重描述符，`load` 成功后才 `document.fonts.add`。别名与画布用的真名互不相干：同名注册一份子集会让 `document.fonts.check` 对没覆盖的字返回 true，污染主加载器的就绪判断。先 load 再 add，`document.fonts.ready` 不被预览拖住。
- 调度：选择器的每一行在 ref 回调里建自己的 `IntersectionObserver`，root 是这次打开的列表滚动容器，下探半屏，进入视口就请求，请求发出后这一行不再观察。观察器随行建销，弹层重开时跟着新的列表节点重建。卡片按钮一直可见，挂载即请求。每款字体整场会话只请求一次，成功与失败都记住；`fetch` 带 `priority: 'low'`，不与画布字体抢带宽。不排队、不设并发上限：样式重算按帧合并，同一帧里注册多少个 face 都只重算一次。
- 就绪态：界面经 `src/app/panels/use-font-preview.ts` 用 `useSyncExternalStore` 订阅预览模块，已加载过的字体第一帧就用别名渲染，重开选择器、搜索后行重新挂载都不闪。
- 失败：这一行留在界面字体，不提示、不超时、不重试，刷新页面才重来。预览只走 Google，不走镜像：jsDelivr 上没有 `text=` 子集，中文字体按 `unicode-range` 拉整片要贵 20 到 70 倍，而预览失败的样子就是纯文字名。
- 分块：预览模块随卡片上的字体行进首屏；按可见性请求的那一段在选择器的行组件 `src/app/panels/font-item.tsx` 里，随面板懒加载。

名字格的排法：有原生名的行，原生名用该字体渲染，后面跟一段界面字体的西文 family 小字，原生名至多占行宽 65%，空间不够先截西文；没有原生名的行写西文 family。所有名字都按 16 px 渲染，不按字母高对齐：Google 字体的度量表良莠不齐，按 `cap-height` 对齐会把 Euphoria Script 放大到被行框裁掉。名字格左右各多留 4 px 裁切框，手写体伸出前进宽度的笔画不被切掉；字重写 normal 并关掉 `font-synthesis`，子集取的是字体自己有的一档，浏览器不再合成假粗体。原生名按书写系统标 `lang`（`zh-Hans`、`zh-Hant`、`zh-HK`、`ja`、`ko`），西文名标 `en`，上传字体的文件名不标。预览就绪前是界面字体，就绪后淡入，偏好减少动效时直接换，行高固定不跳。

原生名表 `NATIVE_NAMES` 在 `src/fonts/curated.ts`，以 family 为键。只收作者或发行方渠道查得到的名字，查不到的不收，显示西文 family；新增一条前先用 css2 `text=` 请求这个名字，确认字形全覆盖。系统字体收操作系统自带的本地化名，所属书写系统记在同文件的 `SYSTEM_FONT_SCRIPTS`。表头写来源与核对日期，逐条出处见 `docs/audits/2026-09-23-v8.0-plan-review.md` 附录。原生名不是界面文案，不进五语字典。

## 配色

`src/palettes/palettes.ts` 用一张元组表定义 47 套配色，浅色 21 套、深色 26 套。每套的字段是 id、明暗、2 到 6 个停靠色、推荐文字色、留白底色，以及五种语言的名字。v5 起没有家族分组：那个下拉只筛不选，与磁贴列表功能重叠。配色名不进 i18n 字典，直接按 `useLocale()` 从 `PALETTES[i].name[locale]` 取。`PLATE_HINT_IDS` 列出推荐文字色对最差停靠点低于 WCAG 4.5 的配色，界面据此默认开启胶囊底。

种子色生成在 `harmony.ts`：给一个主色，按类比、分裂互补、同色相三种方案在 OKLCH 里排出 5 档明度阶梯加 1 个光感点；给两个主色则沿短弧在两个色相之间取档。明度阶梯与 chroma 系数都是定值，同一种子色永远得到同一套。

culori 只从 `src/palettes/culori.ts` 进来，其余文件一律不直接 `import 'culori'`。按需入口不注册任何色彩空间，用到哪个自己注册哪个，本仓的最小集就在那个文件里。

确定性随机在 `src/engine/seed.ts`：`hashSeed` 是 FNV-1a 32 位，`mulberry32` 只做整数运算，同一种子在任何设备上给出同一串数字。`resolveSeed` 定义了种子的派生规则，`seed` 为空退到 `text`，两者都空用常量。合成时高光也必须调它，否则空白种子下高光与渐变会用两串不同的随机数。

## 状态与持久化

单个 zustand store 持有 `config`、历史、撤销重做栈与 `ui`。界面只调 `setConfig` 一类的动作，动作内部逐层深合并再过一遍 `normalizeConfig`。

初始配置只有两档：localStorage 存档、默认值。配置不进 URL；地址栏上只有三个与配置无关的查询参数：`?lang=` 首屏消费后摘掉，`?probe=1` 装端到端探针，`?samples=1` 打开样张页。首次与重置使用共享 DEFAULT_CONFIG，已有存档的明确设置保留。存档缺字段时由 `normalizeConfig` 补当前默认值。

存档是 `PERSIST_KEY`（`gradient-avatar:v4`）下的一份 `{ config, history }`，读档只要求 `config` 是对象，其余交给 `normalizeConfig`。配置或历史变更后攒 300 ms 将两者写入 localStorage；页面隐藏或离开时同步待写状态。导出前调 `flushConfigSync()` 立刻落盘，导出与存档才是同一份配置。端到端用例读配置走探针：`config()` 取 store 里的当前值，`flush()` 立刻落盘，不读 localStorage。要给截图脚本喂配置，用 `page.addInitScript` 往 `PERSIST_KEY` 写一份 `{ config }` 再打开页面。

预览参考层（安全区、网格）的开关与手机预览高度一样是“怎么看”而不是“出什么图”：各自是模块级状态加 localStorage（`gradient-avatar:overlays`、`gradient-avatar:preview-height`），不进 `AvatarConfig`，导出永远不画。两个参考层的开关收在顶栏的设置菜单里，带文案与勾选态，不摆在画框角上挡住要看的那一块。网格是 CSS 渐变画的 DOM 图层，放在着色器宿主之外，格子边长取画框短边的 1/12，从中心铺开，中心十字加粗，白色低透明度加 `mix-blend-mode: difference`，深浅底都可辨。

历史最多 8 条，按 `configHash` 去重，与配置一起进同一份存档。存档键是存档结构的唯一版本号，结构一变就升键，旧键不读。

## 界面多语言

字典是扁平的点分 key，五种语言：简体中文、繁体中文、English、日本語、한국어。zh-CN 是源语言，其余四份用 `typeof zhCN` 约束，少一个 key 就在 typecheck 报错。

只有 zh-CN 与 en 静态打进首屏，前者是默认语言，后者是所有字典的兜底；其余三份各自一份 chunk，切过去时先用手上这份渲染一帧，字典到了再重绘。

`t()` 的 key 类型是 `I18nKey | (string & {})`，引擎给的 `labelKey` 这类动态 key 在类型上就是 string，卡死成联合类型会逼调用方到处断言。放宽之后由 `tests/i18n/keys.test.ts` 扫源码补上这一层校验。

所有界面语言的首次与重置内容均为「工作新习惯 / 你说豆包干」与原色豆包工作图标（`doubao-work`），主行 Noto Serif SC 700、副行 Noto Sans SC 700。界面语言只影响控件，不改画布内容或字体。自动化 API 的 line1/line2/logo 仍由调用者传入，空输入会拒绝。

## 手机端的长按直存

触屏浏览器的长按保存只认真正的 `<img>`，微信还只接受 `http(s)` 与 `data:` 地址，`blob:` 会保存失败。
所以 `preview-save-image.ts` 在预览停稳 600 毫秒后按导出管线合成一张 JPG，转 data URL 盖在预览画布之上、
参考线之下，长按它直接出系统的保存菜单。排程去抖、页面不可见时不排、新配置来了旧结果作废，
合成失败就留着上一张。桌面不铺这张图，走下载。

## 炫技层

`src/app/showcase/` 是一整套视觉层，组件源码在 `src/components/showcase/`，来自 React Bits（aurora-blur、
staggered-text、preloader），随它们进来的 three、@react-three/fiber、motion 都在懒 chunk 里。两道闸决定挂不挂：
`prefers-reduced-motion: reduce` 与构建期的 `VITE_SHOWCASE=0`，任一为真就整套不挂，背景回落到 `AmbientBackground.tsx`
那套 CSS 光晕；没有 WebGL2 时同样回落。环境光没有强度滑杆，默认就是最大。极光背景取当前配色前三色，标签页不可见时停帧，
手机按 0.5 DPR 渲染。导出走的是 `src/export/` 的离屏合成，与页面装饰完全无关，装饰层不进导出画布。

随机与导出成功的那一下反馈是纯 CSS 的一圈涟漪加预览框弹动，见 `showcase/Ripple.tsx`。

进场幕布在读秒结束的那一刻起停止吃指针事件：抽走要放完整段动画，期间界面已经露出来了，继续挡着点击就是假死。

## 代码分割与体积

首屏 JS 体积由 `npm run budget` 按当前构建量测，250 KB 是参考线。`npm run budget` 只是报一次数，不再是门禁：这个站不是搜索首页，视觉效果排在体积前面，慢就上加载动画。量法按 `dist/index.html` 里的 entry script 加全部 `modulepreload` 求 gzip 之和：打包器会把入口与懒加载的共同依赖提成独立 chunk，Vite 给它们发 `modulepreload`，它们同样在首屏下载，只看 index chunk 会低估。

代码分割遵循以下规则。

- 要拆的包，主 chunk 里一个符号都不能静态引用。`@paper-design/shaders` 只从 `shader-mount.ts`、`shader-noise.ts` 与 `shaders/*.ts` 三个薄模块进来，全部走 `import()`。
- 不用 `const { X } = await import('包名')` 从包入口取符号，命名空间访问挡住 tree-shaking。要拆就先写一个只 `export { X } from '包名'` 的本地模块，再动态 import 它。
- 懒组件一挂进树就立刻拉 chunk。历史条走 `panels/lazy.ts`，只在显示后挂载。导出抽屉的 Drawer 外壳常驻，ExportControls 首次打开按需加载，`ui.exportMounted` 记录已打开状态；首次动画不依赖控件 chunk 到达。字体选择器的面板与手机抽屉同在 `FontPickerPanel.tsx`，`lazy.ts` 给它两个出口 `FontPickerPanelLazy` 与 `FontPickerDrawerLazy`，共用一份 chunk：桌面弹层的外壳常驻，面板在弹层里经 Suspense 懒加载，第一次打开才拉 chunk，占位与列表同高，弹层关闭即卸载；手机抽屉连同面板整块懒加载，点过一次才挂上，之后常驻。cmdk、选择器面板与抽屉都不进首屏。图形选择器同走 `lazy.ts`，没点开前不拉 cmdk 与索引；内置全库、emoji 标签与品牌索引也只在对应搜索模式需要时加载。

详细口径见 `docs/engineering-lessons.md`。

## 测试

| 层 | 命令 | 覆盖 |
| --- | --- | --- |
| 单测 | `npm test` | `tests/` 与 `src/` 同名，jsdom 环境，覆盖种子映射、排版与自动填满、补偿独立性、图标排版、SVG 消毒、品牌图形加载、图形绘制消费端、索引结构、明暗判定、体积二分、预览参考层与预览高度存取、数字框对齐与重置、字体名预览的请求与注册、工作台冒烟、字典对齐 |
| 端到端 | `npm run e2e` | 两个 project：`desktop` 跑 1440 桌面，`iphone-15` 跑设备模拟。覆盖内置图标、emoji、品牌图形、品牌单色切换、上传 SVG、双列工作台、桌面首屏四节不溢出且画框不超 640、预览区无滚动条、折叠组展开后的滑杆与重置钮、垂直补偿落存档、操作条三格与随机配色只换配色、图标移除钮清空回空态、顶栏设置里的恢复默认、主题与参考层、备案号、手机分隔条拖拽留存、手机底部抽屉、存档刷新恢复、网格开关留存、字号自动态切手动、字体名预览、关于页独立成页、赞赏区渲染、炫技层背景、微信长按保存与既有导出路径 |
| 视觉 | `npm run screenshots` | 桌面 1440、iPhone 15、iPhone SE 三个设备各截深浅两套主题，输出到 `.screenshots/` |

headless chromium 默认没有 GPU，WebGL2 靠 `--use-angle=swiftshader` 等启动参数走软件渲染。`devices['iPhone 15']` 的默认浏览器是 webkit，project 里必须显式覆盖成 chromium，否则那几个参数不生效。

预览画布读不回像素，端到端断言因此走探针。`src/app/probe.ts` 把 `composeAvatar` 与 `encodeCanvas` 挂到 `window.__gradientAvatarProbe`，用的是与真实导出完全相同的那条链路；另挂 `config()` 读 store 里的当前配置、`flush()` 把防抖中的配置立刻落盘，用例读配置不经 localStorage。它只在开发模式或 URL 带 `?probe=1` 时用 `import()` 装，产品代码一处都不引用它，不带参数打开就不会下载那份 chunk。

## 构建与部署

`npm run build` 先 `tsc -b` 再 `vite build`，产物在 `dist/`。CI 在每次 push 与 pull request 上跑 lint、格式、typecheck、单测、构建五步，Node 24。

站点是两个入口，不是单页应用：`index.html` 是工具本体，`about.html` 是关于页。
`appType` 必须是 mpa，spa 那一档会把 `/about` 也兜回 `index.html`，开发与 `vite preview` 上就永远看不到关于页。
同理 `vite.config.ts` 里把 `workbox.navigateFallback` 设成 `null`，关掉 service worker 的导航兜底，否则装过 PWA 的人打开 `/about` 会拿到缓存里的 `index.html`。

主站在阿里云 ESA Pages，构建配置在仓库根目录的 `esa.jsonc`，`_headers` 与 `_redirects` 在那里不生效，等价的缓存规则、响应头与接入步骤见 `docs/deploy.md`。旧域名所在的 Cloudflare Pages 构建命令是 `npm run build`，输出目录 `dist`，Node 版本读 `.node-version`。`public/_headers` 给全站发安全头、给 `/assets/*` 发一年不可变缓存；`public/_redirects` 只留一条 `/*  /index.html  200` 给单页应用兜底，`/about` 由 Pages 的静态资源层在这条兜底之前自己解析，映射到 `about.html`，不需要也不能再给它单独写一条重写规则：`/about.html` 会被资源层的 HTML 规范化 308 回 `/about`，与重写规则互相咬成死循环。两份文件随构建进入输出目录。

PWA 由 `vite-plugin-pwa` 生成 manifest 与 service worker，预缓存覆盖 js、css、html、svg、png、woff2。
注册不走插件注入的那段脚本，改在 `src/app/sw-update.ts` 自己注册：只有拿到 registration 才能主动轮询新版本。
service worker 默认只在页面加载时查一次更新，标签页开着不关就一直停在旧版本；这里每 15 分钟问一次，
回到前台与窗口重新聚焦时再各问一次。发现新版本不闷声重载，弹一条不自动消失的提示，
点“刷新”先同步当前配置，再 skipWaiting 加重载：当场重载会把正在敲的字打断。不点也不影响使用，下次进来自然是新版。

## 能力边界

- 没有 WebGL2 的浏览器会拿到静态近似图。预览是多层 CSS `radial-gradient`，导出是同源同种子的 2D 近似，两者构图一致，界面明确提示。
- 导出尺寸受设备限制。`caps.ts` 同时探测 WebGL 上限与 2D 画布面积上限，取较小值，超出时按上限渲染再放大，导出抽屉显示本机的最高原生边长。探测结果缓存 7 天。
- 主“导出”按钮直接触发浏览器下载；导出抽屉提供“下载”与“复制图片”两个显式动作。微信内置浏览器拦截 `a[download]`，那里改为提示长按图片保存。
- WebP 只在 `toBlob('image/webp')` 实际返回 `image/webp` 的浏览器里提供，不引入 WASM 编码器。PNG 无损，体积不可控，靠界面提示。
- 上传的字体与图形只在本次会话有效：文件字节不写盘，配置里只留一个会话内的引用，刷新后字体回落系统字体、图形位留空，界面提示重新上传。

## 自动化服务

`src/automation/` 是独立 v1 输入、Logo 预处理、双行安全排版和渲染桥；复用 `composeWith`、shader、`drawText`、`drawGraphic` 和编码。`service/vite.config.ts` 将此入口和字体构建到 `dist-service/`，不进入网页首屏。`service/renderer.mjs` 运行有界队列与隔离 Chromium context；CLI 和 MCP 共用该 runner。MCP 采用官方 SDK 的 stdio/无会话 Streamable HTTP。部署、安全边界、兼容性与参数以 [automation.md](automation.md) 为准。

## 圆裁与紧凑图文自动排版

自动字号默认按圆形使用场景验收，输出形状仍由 canvas.shape 控制。无图形时 fitStack 根据每行真实墨迹矩形与圆弧求最大字号；有图形时先把图文栈紧凑居中，再将自动图文整体收进圆内。显式手动字号与补偿保留，越界提示不偷偷改值。默认边距 0.03；现有存档的明确边距不被覆盖。零或负的实际下伸部是有效字体数据，不再替换为字体框高度。

网页预览和导出共用 layoutText；CLI/MCP 的单行字段契约复用圆形几何判定，但保留独立的固定字体排版入口。无需数据库、额外队列系统或布局服务。scripts/review-layout.mjs 使用本地打包字体与实际合成管线生成圆裁和 24/32/48/64 px 样张；这些是测试尺寸，不是飞书官方标准。

默认 Noto Serif SC 700 主行与 Noto Sans SC 700 副行通过动态 CSS 从本站打包资源加载，按 unicode-range 加载字形分片；其余字体仍走 Google / jsDelivr。OFL 许可证位于 public/fonts/OFL-NotoSansSC.txt。默认字体先从本站解析并验证 FontFace loaded 状态，避免外部字体不可达时影响初始排版。

### 上传图形的可见边界

上传图形由 `graphics/trim.ts` 有界扫描 alpha 边界，布局使用可见宽高，`Graphic.sourceRect` 保留原图中的源矩形，绘制不把透明画布再次拉回来。原始 SVG 继续参与最终绘制。`graphics/svg-style.ts` 只把简单类选择器的有限绘制声明转成属性，再删除样式表；不执行 CSS 或保留网络引用。

默认视觉：`steel-slate` 深色渐变、白色纯色字、光感 0.08；显式旧配色、光感与文字效果不会被默认值覆盖。CLI/MCP 使用同样默认配色与视觉配置。


### 光学补偿与客户案例

默认启用有界光学补偿，不调整单个字的字距；显式手动位置优先，可在文字排版中关闭。每行按掩膜质心整行横移，不超过 0.02em。整组纵向按可见边界居中：文字取实际 TextMetrics 字形框，Logo 取素材可见像素在落位框里的比例（每张素材量一次），并集中心移到画布中心，纵移不超过短边 3.5%；自动 Logo 图文组在圆裁需要时整体最多缩小 6%，不足则减小位移。素材自带大片透明留白且 Logo 调到很大时，留白先顶到圆边，居中修正会被限住。预览、导出和自动化复用 `src/text/optical.ts`。

Noto Serif SC 600/700 按需加载，新选宋体默认 600，已有字重保留，许可见 `public/FONT-NOTO-SERIF-SC-LICENSE.txt`。东黎品牌案例保留原白色和素材内置留白，品牌权利见 `src/graphics/client-assets/README.md`，不属于项目 MIT 授权。自动化参数和样张复现见 [自动化说明](automation.md)。

品牌与标题之间按标识宽高比分配间距：宽字标取短边 6%，其他图形取 4.5%；带 Logo 的主副行间距取短边 3.5% 与主字号 18% 中的较大值，纯文字取较大字号的 18%。行高偏离默认 1.03 时，两行间距按较大字号等量加减，不小于 0，算法在 `src/text/spacing.ts` 的 `stackGap`。自动圆裁求解保留间距，再重新居中整组。

光学微缩的每个候选字号使用实际 TextMetrics 重新量测，最终行框与元数据同步，避免字体取整被线性缩放假设掩盖。

`src/text/fill.ts` 保持自动图文组的基准布局（有文字时至少 6% 排版边距），在光学校正后统一放大不超过 16%，以实际字体量测和完整品牌框限制在用户指定圆形安全区内。默认安全边距为 3%。手动字号、位移或装饰效果保留原排版。网页与 CLI/MCP 共用此步骤；新配置的简体中文两行分别为宋体 700、黑体 700，旧存档明确设置（含 null 跟随）保持。

手机与桌面共用一棵控件树：文字输入后是字号及上下位置；“字体与样式”内含两行字体、文字效果、颜色、版面与左右位置。Logo 大小及上下位置常显，左右位置折叠。`automaticLayoutPatch` 只恢复两行自动字号、图文位移及品牌对应图形比例，保留内容和视觉选择；预览继续 sticky，恢复入口位于文字节标题旁。

手机长按保存用的 JPG 只在其配置与当前配置相同时覆盖实时画布。调整时立即撤下旧图，后台单在途编码、只保留最新待办，完成才显示新图；编码失败继续显示实时预览，不能长按保存旧状态。

移动预览按 ResizeObserver 量测提示区高度，扣除提示与间隔后计算头像长边；小字号或溢出提示增加时不会把头像上沿裁掉。


### 手机精调与素材颜色

手机编辑节在单层页面内距上平铺，字号和位置使用 44px 减/加按钮及数值输入，桌面保留滑块；尺寸显示 0.5% 步进、位置显示 0.25% 步进的真实数值。背景质感保留连续滑块。简介位于设置菜单，通过带 noopener noreferrer 的新标签链接打开。

图形选择器优先品牌，客户成组置顶。HARMAY 黑色 SVG、白色 PNG 与东黎深咖/黑/白成品直接取各自源文件，源颜色保留；HARMAY 的透明画布按可见范围量测，东黎按品牌要求保留内置留白。其他历史品牌的“程序染色”是兼容选项，UI 明确标识其会丢失细节及非官方性质；TikTok 保留源色。来源与缺失版本见 [逐项素材审计](audits/2026-11-07-brand-assets.md)。

安全区提示根据布局最终的逐行框与图形框验证，与界面参考线使用同一矩形/圆形条件；求解阶段的文字预留区域用于字号计算。提示包含图形，48px 可读性提示单独计算。

## 异步结果与存档一致性

下载和复制记录开始时的配置快照，历史缩略图按配置哈希回填。微信固定 JPG，体积控件依据有效格式；抽屉结果绑定配置身份，继续编辑后隐藏旧图片。公共导出依据实际 Blob MIME 命名，浏览器回退 PNG 时按无损结果处理。

配置平时去抖 300 ms 写 localStorage，pagehide、页面隐藏及明确刷新动作同步待写状态。存储可能因权限、配额或浏览器清理失效，不保证进程强杀时保存。上传字体和图形字节不持久化。

网页合成在浏览器完成；默认字体来自本站，其他字体、目录、emoji 可请求外部服务。正文字体请求不带用户文字的 text 参数；字体名预览的 text 参数是目录显示名。可选远程 MCP 的输入在部署方服务器处理，边界见 automation.md。

字节精选稿以 `bd-` ID登记，加载时设置 preserveColor，界面不提供程序染色；doubao-work、lark 使用用户素材的独立图形并保留源色，存档ID保持稳定；可选 asset 字段把资源文件名与ID分离，替换素材必须改资源名以避开长缓存。tiktok保留原稿。品牌清单中的 bytedance 类别决定组内顺序，客户分组仍由选择器优先展示。

历史缩略图作为配置的渲染缓存保存。豆包工作、飞书素材更新后，仅失效缺少thumbVersion:1的对应旧缩略图，历史配置及其他品牌缩略图保留；新渲染缓存带版本，缺图使用已有文字与配色占位。恢复及导出始终使用当前品牌素材。
