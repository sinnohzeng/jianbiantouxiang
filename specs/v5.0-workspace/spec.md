# 工作台与债务清理 v5.0 规约（造什么）

状态：进行中，2026-09-04 起。§A 已落地；§B 待定稿。本轮分两段：§A 是已拍板的技术债与体验修正，直接落地；
§B 是桌面工作台重排，等 owner 回答一个决定信息架构的问题后再定稿。
两段合并为一个 major 发布：§A4 移除既有功能，按 `docs/contributing.md` 的定档表归 major。

## 1. 目标

把用户实测到的四处不顺手修掉（补偿牵连、字号模式跳变、缺网格、多余的链接分享），
再把桌面端从「一列页签、层层折叠」改成一眼看全的工作台。
项目仍在开发期，不做任何兼容层：旧链接、旧存档、旧控件形态一律不迁就。

## 2. 用户故事

1. 两行都填、字号自动：拖第一行的水平补偿，第二行的字号与位置一个像素都不变。
2. 默认自动字号；一碰字号滑杆就切成手动，滑杆起点就是刚才自动算出的值，画面不跳。
3. 点「自动」回到自动字号；再拖又切手动。
4. 打开网格，画布上铺一层浅色方格与中心十字，任何配色下都看得见；导出的图上没有它。
5. 网格与安全区开关的状态刷新后还在。
6. 底部操作条没有「复制链接」；地址栏在任何操作后都保持干净，不再挂配置载荷。
7. 桌面 1440 宽：文字、配色、质感、画布全部展开可见，挑配色或改字号不用先切页签、再滚一屏。
8. 手机上预览只占屏幕上方一小块，剩下的都是操作区。

## 3. §A 技术债与体验修正（已拍板）

### A1 行级水平补偿完全独立

- 求解阶段不再为补偿预留宽度余量：`fitStack` 按完整安全区宽度换行与二分，
  `lineOffsetsX` 只在落位时做纯位移。
- 验收判据：任何 `sizeMode`、任何图标组合下，只改 `lineOffsetsX[i]`，
  其余行的 `x`、`y`、`fontSizePx` 不变，第 i 行的 `fontSizePx` 也不变，位移等于补偿差乘画布宽。
  现有回归用例只覆盖 `manual`，本轮补 `auto` 档，先红后绿。
- 位移后越出安全区仍要反映在 `overflow` 提示里：`fits` 按位移后的外沿判定，不按未位移的块判定。
- 用户把补偿拉到 25% 时文字可能被圆形遮罩裁掉：这是用户主动选的位移，界面用现有的
  「文字超出安全区」提示，不自动缩字号。

### A2 字号自动与手动无缝切换

- `sizeMode` 语义不变：`auto` 按内容填满，`manual` 用 `fontSize`。
- 预览每次排版后把求解器直接带出的基准字号比例（`TextLayout.fontRatio`，不由主行 `fontSizePx / 短边` 反推，主行的行级比例未必是 1）按滑杆步进向下对齐后写进 `ui.autoFontSize`，
  不进配置、不进存档。
- 字号滑杆常驻可用。`auto` 时滑杆显示 `ui.autoFontSize`；拖动或输入数值即
  `setTypography({ sizeMode: 'manual', fontSize })`，起点就是显示值，不跳变。
- 滑杆旁一个「自动」按钮（`aria-pressed`），`auto` 时点亮；手动状态下点它回到 `auto`。
- 「字号模式」分段控件与其三条词条删除。

### A3 画布网格参考线

- 预览画框内加一层网格：正方形格子，边长为画布短边的 1/12，从画框中心对齐铺开；
  中心横竖两条线加粗一档。颜色用白色低透明度加 `mix-blend-mode: difference`，深浅底都可辨。
- 只在预览显示，`composeAvatar` 与导出不受影响；`role="img"` 子树内 `aria-hidden`。
- 开关放在预览角上，与安全区参考线并列；两个开关的状态存 localStorage
  （键 `gradient-avatar:overlays`），不进 `AvatarConfig`。

### A4 移除 URL 配置分享

- 删除「复制链接」按钮、`buildShareUrl`、`encodeConfigToHash`、`decodeConfigFromHash`、
  `hasBrokenConfigHash`、坏链接提示 `share.invalid`，以及 `history.replaceState` 写 hash 的同步。
- 初始配置只剩两档：localStorage、默认值。`?lang=` 与 `?probe=1` 查询参数不受影响。
- `common.copyFailed` 改为通用文案，仍供「复制种子」使用；`common.copied` 删除。
- e2e 里链接往返两条用例删除；「随机颜色」按钮的断言改看存档变化，不再看 hash。
- 端到端与截图脚本需要喂任意配置时，用 `page.addInitScript` 往 localStorage 的
  `gradient-avatar:v3` 写存档。这一条写进项目记忆，替代原来的 `#c=` 做法。
- README、architecture、contributing、AGENTS.md 里关于分享链接与 hash 的描述同轮删改。

### A5 文档漂移

- README 与 architecture 只描述现状：删「分享」相关段落，改「补偿参与包围盒计算」这一句。
- 项目记忆 `docs/memory/project-v3-rewrite.md` 里「用 `#c=` 喂配置」的操作口径改为存档注入。

## 4. §B 工作台、控件、手机预览、品牌图形与炫技层（已拍板：方向乙）

典型使用是改两行字、可能加个图标、随机刷配色挑一张顺眼的，极少数人调视觉补偿。
布局围绕这个来：挑选类控件占首屏、尺寸大；数值微调收成一条紧凑的检查器带。
整体气质要压得住场，动效与着色器能上的都上。体积与首开速度不是约束：这不是搜索首页，多等两三秒也行，
慢就上加载动画；reduced-motion 仍然尊重。

### B1 桌面两层平铺工作台

- 断点与网格：
  - ≥1280：三列 `[380px | minmax(0,1fr) | 320px]`。左列挑选栏，中列预览，右列检查器带。
    三列各自在顶栏之下独立滚动（高度 `calc(100svh - 3.5rem)`），预览列内容垂直居中。
  - 1024 到 1279：两列 `[360px | minmax(0,1fr)]`，检查器带落到预览下方，按两栏紧凑网格排。
  - <1024：手机纵向栈，见 B3。
- 页签、手风琴全部取消。挑选栏自上而下五节，每节一张卡片，标题常驻：
  1. 文字：两行输入（高 44px）与第二行右侧的图标开关沿用；效果分段（无 / 描边 / 投影 / 发光 / 胶囊）；
     文字色分段（自动 / 自定）加色块。
  2. 图形：当前图形磁贴 72px（无图形时是虚线空位），旁边“更换”“清除”；点磁贴或“更换”打开 IconPicker。
  3. 配色：色调分段与色系筛选沿用；配色缩略图改成 4 列渐变磁贴（高 56px，名字在下，选中态渐变描边）；
     “随机配色”放大成主按钮并带流光；自定义色与种子生成器留在本节末尾、默认折叠，是全站仅有的两处折叠。
  4. 风格：四种风格 2×2 磁贴，每块用当前配色画一小张 CSS 渐变示意。
  5. 画布：形状分段（方 / 圆角 / 圆）与尺寸预设胶囊沿用，宽高输入保留。
- 检查器带按“标签 | 滑杆 | 数字框”一行 32px 排，分组小标题：
  - 排版：字号（含自动按钮，必须是全页第一个 `input[type=range]`，e2e 依赖）、字重（改为分段 400 / 500 / 600 / 700 / 800）、行距、字距、边距；
  - 逐行：第 1、2 行缩放，第 1、2 行水平补偿；
  - 效果：效果强度，胶囊三参只在效果为胶囊时显示；
  - 风格：强度、柔和、颗粒、缩放、旋转、高光；
  - 画布：圆角只在形状为圆角时显示。
  - 每行悬停出现“重置”小按钮回默认值。
- 代码落点：新建 `src/app/workspace/`（`PickColumn.tsx` 五节、`Inspector.tsx`、`MobileDivider.tsx`），
  `AppShell.tsx` 重排；删除 `TextPanel` `PalettePanel` `StylePanel` `CanvasPanel` 与 `SegmentedTabs`。
  `PanelSection` 只在自定义色与种子生成器两处沿用。
- e2e 依赖的槽位不改名：`preview-pane` `grid-toggle` `guide-toggle` `slider-auto` `shuffle-color`
  `shuffle-all` `edit-text` `line-input` `icon-toggle`、图标选择入口与导出相关槽位。

### B2 控件形态

- `SliderField` 加常驻数字框 `data-slot="slider-number"`：显示沿用 `format`，无 `format` 时按 step 的小数位；
  回车或失焦提交，按 step 对齐并夹在范围内；`onChange` 语义不变。
- 离散量一律分段或磁贴：字重、效果、颜色模式、形状、色调、风格。不再“一切皆滑杆”。
- `ColorField` 加预设色块行：白、黑、暖白、暖黑与当前配色前四色。
- 触控目标手机 44px，桌面 32px。

### B3 手机预览与拖拽分隔

- 预览区高度由 CSS 变量 `--preview-h` 决定，默认 `28svh`，范围 `[20svh, 60svh]`；
  画布边长 `min(100vw - 32px, var(--preview-h) - 40px)`。
- 预览与内容之间放分隔条 `data-slot="preview-divider"`：28px 高触控区，中间 36×4 圆角把手；
  指针拖动改高度，双击回默认；`role="separator"` `aria-orientation="horizontal"` 带 `aria-valuenow`，
  键盘上下键每次 4svh。
- 高度存 localStorage `gradient-avatar:preview-height`，模块 `src/app/preview-height.ts` 与 overlays 同构。
- 预览仍 sticky 在顶栏下；内容区是挑选栏五节，末尾一节“微调”收着检查器带，默认收起。底栏不变。

### B4 品牌图形（`icon.source = 'brand'`）

- `IconSource` 加 `'brand'`，`icon.id` 是品牌文件名（如 `lark` `github-light` `qoder-white`）。
- 清单 `scripts/brand-list.json` 是唯一真源：id、中文名、英文名、别名、类别、纯白变体；
  远端条目来自 homarr-labs/dashboard-icons（Apache-2.0，商标归各品牌），带 `file` 的条目来自 `assets/brand/`
  （owner 提供的官方素材：飞书 lark、豆包工作位图、Qoder 描摹矢量、WorkBuddy 图标）。
- 生成脚本 `scripts/gen-brand-icons.mjs`（`npm run gen:brand`）：远端条目从 jsDelivr 拉取，本地条目直接拷贝，
  统一落到 `public/brand/<id>.svg|png`，并生成 `src/graphics/generated/brand-index.ts`
  （id、zh、en、aliases、category、ext、white）。生成物勿手改。
- 变体规则：渐变底上默认用纯白变体，没有则原色。IconPicker 品牌页顶部分段“原色 / 单白”切换可见变体；
  已选品牌切换变体时直接写回 `icon.id`。
- 加载：`loadGraphic` 新分支 `import('./brand')`。SVG 走 `fetch(BASE_URL + 'brand/<id>.svg')` → `sanitizeSvg` →
  Image；PNG 直接 Image。结果 `kind: 'image'`，保原色，与 upload 同路径，带内存缓存；404 或解析失败回 null，
  图形不画、不报错。
- IconPicker 模式分段加“品牌”，搜索命中中文名、英文名、别名（沿用 `hit()`），列表按类别分组：
  协作与办公、AI、开发、社交与内容、云与支付、其他品牌；每项 `<img loading="lazy">` 缩略图。
- 归属：README“素材与致谢”加 dashboard-icons 与商标说明。SECURITY 不变，静态同源资产仍过 `sanitizeSvg`。
- `inbox/` 已 gitignore，是 owner 投放素材的入口；并入清单后原件不进仓。

### B6 炫技层（showcase）

- 优先级：炫技需求高于本轮其余维护性约束。体积、文件大小、首开速度都不是考虑项，该加载的都加载；
  `npm run budget` 不再是闸门，只留作体积报告。炫技代码放 `src/app/showcase/`，可以走懒 chunk 也可以进主包，
  以效果与实现顺手为准。`prefers-reduced-motion: reduce` 时不播动效；环境光滑杆为 0 时背景着色器不挂；
  标签页不可见时暂停渲染；WebGL 起不来时静默回落到现有 CSS 光晕。
- 依赖：粒子、背景、文字动效一律优先用 React Bits Pro / starter 现成组件，不自建；经
  `./node_modules/.bin/shadcn add @reactbits-starter/<item>` 安装，落到 `src/components/showcase/`
  （CLI 若放进 `src/components/ui/` 就移出，`ui/` 仍不手改）。组件带来的 `three` `@react-three/fiber` `motion` `gsap`
  照装，只要求它们不进 entry。`motion` 同时用于工作台自己的布局与进场动画。
- 清单按收益排序，前四项本轮必做：
  1. 背景：React Bits 背景组件，候选顺序 `aurora-blur-tw` → `silk-waves-tw` → `watercolor-tw` → `glass-flow-tw`，
     取第一款能接颜色 props、能铺满视口的；颜色取当前配色前三色，透明度接环境光滑杆。桌面与手机都开，
     手机把渲染分辨率压到 0.5 DPR；reduced-motion 与 WebGL 失败时保留现有 CSS 光晕。
  2. 进场编排：挑选栏五节与检查器分组 stagger 淡入上浮（间隔 40ms），预览框从 0.96 缩放加 8px 模糊到清晰（500ms）。
  3. 选中态流动：配色磁贴、风格磁贴、分段控件的选中描边用 `layoutId` 共享元素在选项间滑动。
  4. 随机按钮：点击触发 `star-burst-tw` 粒子（挂在按钮上方一层 `pointer-events-none`），预览框 1.02 弹一下。
  5. 标题：顶栏应用名用 `staggered-text-tw` 首帧逐字模糊入场，只播一次。
  6. 预览悬停：桌面端指针在预览框上时不超过 4° 的 3D 倾斜与随指针的高光，自写 CSS 变量版。
  7. 数字框：值变化时 `useSpring` 平滑计数。
  8. 导出成功：抽屉里再来一次 `star-burst-tw`。
  9. 加载动画：`preloader-tw` 盖住首屏直到字体与首帧就绪，最长 2.5 秒，会话内只播一次；加载慢就让它多转一会儿，不追首开。
  10. 第二梯队，量力：预览框外圈 `frame-border-tw` 噪点描边；历史条用 `animated-list-tw` 进出场。
- 每项都受 `VITE_SHOWCASE=0` 一键关闭，仅供排查；生产恒开。
- 光标特效不做，工具型页面里跟手的自定义光标会碍事；其余能上的都上。

### B8 手机端长按直存（不经导出抽屉）

- 触屏设备（`(pointer: coarse)`，与现有 `isMobile` 二者取或）上，预览框内叠一张 `<img data-slot="preview-save-image">`，
  内容就是当前配置按导出管线生成的 JPG（`format` 固定 jpg，`sizeTarget` 沿用配置）的 data URL，
  `-webkit-touch-callout: default`，长按即出系统的“保存图片”，微信、Safari、Chrome 一致。
- 生成时机：预览每次重绘稳定后去抖 600ms，`requestIdleCallback` 里跑 `createExportArtifact`；新任务到来时旧结果作废；
  `document.hidden` 时不跑；生成期间保留上一张，首张出来前显示实时画布。
- 层级：图片盖在实时画布之上、网格与安全区参考线之下（参考线 `pointer-events-none`，长按穿透到图片）；
  右上角两个开关按钮仍在最上层。图片与画框同圆角同尺寸，`object-fit: cover`。
- 提示：预览下方一行“长按图片可直接保存为 JPG”（新键 `preview.longPressSave`），只在触屏显示。
- 底栏导出与导出抽屉照旧；微信里抽屉的 data URL 路径保留，作为第二条路。桌面端不叠图片，仍靠下载。
- e2e（iphone 项目）：首屏后 `preview-save-image` 的 src 以 `data:image/jpeg;base64,` 开头；改第一行文字后 src 变化；
  开网格开关后 src 不变（网格不进图片）。

### B5 默认配方与配色文字色

owner 试用本轮成果后给一套明确配置作为 `DEFAULT_CONFIG`；内置配色的 `text` 设计值向白色收敛并重跑样张。
版本号升 5.0.0 与 tag 在这一步之后。

## 5. 边界（不做）

- 不做逐行垂直补偿；不做图标与文字左右并排。
- 网格不做吸附、不做刻度数字、不做自定义格数。
- 不保留任何读 hash 的隐藏通道；测试与调试统一走存档注入。
- 撤销栈仍按每次配置变更入栈，拖滑杆一次进多条：这是既有行为，本轮不改，记入待办。
- 炫技层不上光标特效。体积与首开速度不设红线。
- 品牌图形不做在线搜索与自定义上传合流，清单外的品牌走上传。

## 6. 验证

- 单测：A1 的 `auto` 档回归（改第 i 行其余行 `x`、`y`、`fontSizePx` 不变）；A2 的 store
  `ui.autoFontSize` 写入与面板切换用例；A3 的 overlays 存取；A4 删除 url 用例后 store 初始化
  只剩存档与默认两档。
- e2e：底栏没有 `copy-link-action`；随机按钮后存档变化；网格开关刷新留存；字号滑杆在自动态
  拖动后 `sizeMode` 变 manual 且预览无跳变（断言滑杆 `aria-valuenow` 前后连续）。
- 闸门：`npm run lint && npm run typecheck && npm test && npm run build`，
  改界面另跑 `npm run e2e`；截图目检网格与自动态字号。
- §B：brand 加载四态单测；数字框对齐与夹取单测；preview-height 存取单测；reduced-motion 不加载 showcase 单测。
  e2e 桌面加品牌页选 GitHub 导出、showcase 背景存在且导出不变；手机加分隔条拖拽留存与长按直存图片。
