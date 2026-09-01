# 工程踩坑与经验

## 两行徽章模型（v4.0，2026-09-02）

### 行级参数不要在求解器里跨行归一化

v3 的 `composeHorizontal` 为了包围盒计算，把每行水平补偿统一减去「所有行里的最小补偿」。结果是行与行互相牵连：把第一行往左移，第一行不动，第二行被推着往右走。行级参数的正确落点是「落位时纯位移」：求解阶段只按 `安全区宽 − 2 × |补偿| × 画布宽` 预留余量，摆放时第 i 行加自己的偏移，其余行的坐标不进任何共享归一量。回归用例要盯「改第 i 行，其余行像素位置不变」这条可观测行为，别盯中间字段。

### 空槽位要留住，参数才跟得上内容

「第一行为空、第二行有内容」（图标加说明文字）是合法形态。如果切段时把前导空行去掉，引擎会把第二行当第一行，行级补偿就绑错了槽位——界面上拖第二行的滑杆，画面纹丝不动。两行模型的 `twoLinesOf` 与 `splitParagraphs` 的差别就在这：前者保槽位，后者去空行，迁移与求解共用前者。

### e2e 跑在构建产物上，改了代码先重建

Playwright 的 webServer 跑的是 `vite preview` 的产物。切片合入后直接跑 e2e， dist 还是上一轮的，现象会指向错误的方向（这次差点把「选择器挂载位置」的修复误判成无效）。规则：改完 `src/` 先 `npm run build` 再 `npx playwright test`，诊断脚本同理。

## 付费组件件清单（v3 调研）

调研时间 2026-08-29，工具 `shadcn` CLI 4.19.0，registry 为 `components.json` 里启用的 `@shadcnblocks`、`@reactbits-starter`、`@reactbits-pro`。以下件都只 `view` 过源码，没有装进项目，装哪些由阶段 3 的界面智能体按实际需要决定。

### 逐件读过的五个

#### `@reactbits-pro/mobile-4`：底部栏加双档抽屉

- 结构：外层 `flex h-full flex-col`，顺序是 header、可滚动内容区（`min-h-0 flex-1 overflow-y-auto pb-24`）、底部 `nav`。抽屉与遮罩用 `absolute inset-x-0 bottom-0` 叠在同一个定位容器里，不是 portal。
- 双档：一个 `useState<'closed' | 'peek' | 'full'>`，档位直接映射到 motion 的 `height: '46%' | '82%'`，顶部拖拽把手是一个真 `button`，带 `aria-expanded`，点一下在 peek 与 full 之间切。这套比 Drawer 的 snapPoints 更好控，预览区要常驻时值得照抄。
- 底栏选中态用 `layoutId` 的共享元素做背景滑块，`useReducedMotion()` 为真时 `transition` 直接给 `duration: 0`，不是隐藏动画而是瞬时完成。
- 触控目标一律 `min-h-[48px]`，二级列表项也是；快捷磁贴 `min-h-[76px]` 双列网格。这与 spec 3.7 的 44 px 下限一致，可以直接沿用它的尺寸档。
- 依赖 `motion` 与 `lucide-react`，无 three。样式用 `--rb-r-*` 圆角变量带默认值兜底，改主题只要覆盖变量。

#### `@reactbits-pro/settings-form-3`：分段控件与 radio card

- 分段控件与 radio card 都不是自定义组件，就是 `role="radiogroup"` 包一组 `<label>` 加 `<input type="radio" className="sr-only">`，选中态靠 `peer-checked` 类切换。控制面板的形状、对齐、字号模式、导出格式这类三选一，用这个范式比 ToggleGroup 更好写，也天然支持键盘。
- 开关是手写的 `role="switch"` 按钮，`aria-checked` 加 `h-5 w-9` 轨道，本项目已装 shadcn Switch，这里只借它的 label 与 description 双行排布。
- 有一套值得抄的“脏值”机制：`baseline` 与 `prefs` 两份 state，`dirtyKeys` 用 `useMemo` 求差集，`isChanged(key)` 给每行加变更标记。头像编辑器要做“恢复默认”与“已改动”提示时可以照搬。
- `useScrollFade` hook：`ResizeObserver` 加 `onScroll` 算出上下是否还有内容，给滚动容器加渐隐遮罩。移动端参数面板滚动时可用。
- 注意它从 `el.ownerDocument.defaultView` 取 `ResizeObserver`，不是直接用全局，jsdom 与 iframe 场景下更稳。

#### `@reactbits-pro/navbar-8`：带滑动指示的分段 tab

- `role="tablist"` 容器加 `bg-neutral-100 p-1` 的凹槽，每个 tab 是 `role="tab"` 按钮，选中项内部渲染一个 `layoutId` 的白色药丸，`SPRING = { type: 'spring', bounce: 0, duration: 0.35 }`。桌面控制面板的“文字 / 配色 / 质感 / 画布”四段切换可以直接用这个形。
- 键盘：`tabIndex={isActive ? 0 : -1}` 的 roving tabindex，容器 `onKeyDown` 处理 ArrowLeft、ArrowRight、Home、End。这是 tablist 的正确做法，shadcn Tabs 也是这套，自造分段控件时别漏。
- 溢出菜单用 `data-menu-root` 属性加 document 级 `pointerdown` 判断 `closest()` 关闭，Escape 也关。轻量弹层不想上 Popover 时可用。

#### `@reactbits-pro/app-shell-8`：自适应外壳

- 断点全部是 CSS 类（统计下来只用了 `md:` 与 `lg:`），没有 `matchMedia`，也没有按视口宽度分支渲染。同一棵树在窄屏显示底部 tab bar、中屏显示图标 rail、宽屏显示完整侧栏，靠的是三段 `hidden md:flex` 之类的组合。桌面双栏与手机 sticky 预览应当照这个思路做，避免两套组件树。
- 移动抽屉自己实现了焦点陷阱：打开时 `requestAnimationFrame` 后聚焦第一个可聚焦元素，`Tab` 与 `Shift+Tab` 在首尾之间循环，Escape 关闭并把焦点还给触发按钮。本项目用 shadcn Drawer 可以免掉这段，但“关闭后焦点归还触发器”这条要自己保证。
- 根节点是 `h-full min-h-[Npx]`，父容器必须有确定高度，这是 App UI block 的通例。
- 只依赖 `lucide-react`，没有动画库。

#### `@shadcnblocks/navbar6`：悬浮导航

- 与前四个不同，它直接用 `@/components/ui/*` 原语（`Button`、`NavigationMenu`）加 `cn()`，装完就是一份普通示例组合，价值在结构不在组件。
- 悬浮壳：`absolute top-5 left-1/2 -translate-x-1/2 w-[min(90%,700px)] rounded-full border bg-background/70 backdrop-blur-md`。顶栏要浮在预览渐变之上时，这套半透明加模糊的写法可以直接拿。
- 桌面与移动用 `max-lg:hidden` 与对应的显隐类切换，移动端是自绘的汉堡按钮加展开面板，不走 Sheet。
- 它依赖 `navigation-menu` 原语，本项目没装；真要用得先 `add navigation-menu`。

### 按关键词枚举出的候选（未细读）

`@shadcnblocks`（slug 无连字符，component 级件的 slug 形如 `<family>-<family>-<variant>`）：

| 件 | 一句话 |
| --- | --- |
| `color-picker-color-picker-standard-1` | 选色区加色相滑杆加格式输入框，自定义配色面板的完整形态 |
| `color-picker-color-picker-compact-1` | 只留选色区与色相滑杆的紧凑版，适合移动端抽屉 |
| `color-picker-color-picker-alpha-1` | 多一条透明度滑杆与吸管，胶囊底透明度可能用得上 |
| `color-picker-color-picker-controlled-1` | 受控用法示例，`onChange` 实时更新外部色块，接 zustand 时照它写 |
| `slider-slider-standard-3` | 滑杆带数值显示，质感参数面板的基本款 |
| `slider-slider-standard-4` | 滑杆带最小最大值标签 |
| `slider-slider-standard-5` | 滑杆带步进刻度点，形状与字重这类离散值可用 |
| `slider-slider-styled-2` | 拖动时跟随的 tooltip |
| `slider-slider-range-2` | 双端范围滑杆 |
| `button-group-button-group-interactive-4` | 用 button group 做的分段控件 |
| `button-group-button-group-advanced-4` | 富文本工具条形态的按钮组，导出抽屉的动作区可参考 |
| `drawer-drawer-bottom-1` | 底部抽屉基础款 |
| `drawer-drawer-bottom-5` | 从第一层抽屉里再开第二层，导出面板套字体选择器时的范式 |
| `drawer-drawer-top-5` | 顶部抽屉里放命令面板式搜索，字体搜索可借 |
| `drawer-drawer-left-4` | 抽屉里搜索框加过滤后的导航结果 |
| `select-select-compact-toolbar` | 工具条里的紧凑排序 select |
| `input-group-input-group-textarea-1` | 文本域加内嵌控件，多行文字输入框可参考 |
| `application-shell10` | 带命令面板搜索的应用外壳 |

`@reactbits-pro`（slug 形如 `<category>-<n>`，全部 default export）：

| 件 | 一句话 |
| --- | --- |
| `mobile-1` | 五段底部栏加弹簧指示器与逐 tab 淡入面板 |
| `mobile-5` | 顶部应用栏带分段控件，配全屏分组菜单 |
| `mobile-2` | 可展开的悬浮动作按钮，扇出若干快捷动作 |
| `navigation-8` | 底部导航带模糊背景与图片预览 |
| `navigation-5` | 固定底栏向上展开成完整菜单 |
| `dashboard-6` | 分段控件驱动的总览页，段切换与内容联动的写法 |
| `analytics-1` | 区间分段控件加可悬停擦除的迷你图 |
| `card-6` | 一行指标由分段日期控件驱动 |
| `forms-11` | 对话框里的分段类型选择器加实时校验 |
| `onboarding-4` | 可选磁贴加分段规模控件 |
| `filtering-2` | 过滤抽屉，滚动主体加吸底的实时结果计数，导出抽屉可参考 |
| `filtering-4` | 严重级别开关加服务选择器加直方图 |
| `command-menu-1` | 分组结果加键盘提示加最近使用的命令面板，字体选择器的目标形态 |
| `command-menu-3` | 搜索优先、支持类型过滤并带内联预览 |
| `command-menu-6` | 锚定在工具条按钮上的紧凑命令弹层 |
| `navbar-11` | 编辑器工具条，标题可内联编辑，带保存状态与分享弹层 |
| `navbar-2` | 面包屑工具条加过滤 chip 加溢出菜单 |
| `editor-1` | 富文本编辑器，块类型菜单加浮动格式条加自动保存状态 |
| `editor-2` | 写作、分栏、预览三态切换 |
| `app-shell-6` | 文档工作区，左树加格式工具条加居中编辑区 |
| `app-sidebar-6` | 移动抽屉导航，含 sheet 与遮罩 |
| `app-dialog-5` | 侧抽屉表单，带未保存变更拦截 |

### 三条通用结论

1. React Bits Pro 的 App UI block 全部 default export，根节点带 `h-full min-h-[Npx]`，接进自己的布局前要先给父容器确定高度，否则整块塌成 0 高。
2. 这批件的动效一律先读 `useReducedMotion()`，reduce 为真时把 duration 归零而不是移除元素，可访问性与布局稳定性都照顾到了。本项目的 `prefers-reduced-motion` 处理照这个口径。
3. shadcnblocks 的 component 级件多是 shadcn 原语的示例组合，原语已装的情况下可以只借结构不 `add`；React Bits Pro 的 block 才是真正的新代码，装完要 `grep "^export"` 确认导出形态再 import。

## 脚手架阶段踩坑（2026-08-29）

### `npx shadcn` 在本机报 `EALLOWSCRIPTS`

- 症状：`npx shadcn@latest init / add` 内部再调 `npm install` 时报 `EALLOWSCRIPTS: --allow-scripts is not allowed in project-scoped installs`。
- 原因：本机 `~/.npmrc` 有 `allow-scripts` 配置，`npx` 把它以 `npm_config_allow_scripts` 环境变量传给子进程，子进程里的项目级 `npm install` 不接受这个选项。
- 规则：把 `shadcn` 装进 devDependencies，用 `./node_modules/.bin/shadcn` 调用，顺带锁定 CLI 版本。CI 与其他机器不受影响。

### shadcn CLI 4 的 `init` 参数

- CLI 4 已没有 `--base-color`，改成 preset：`-p nova`（还有 vega、maia、lyra、mira、luma、sera、rhea）。`nova` 落到 `components.json` 的是 `style: base-nova`、`baseColor: neutral`、`cssVariables: true`，底层 Base UI。
- nova preset 会把 `--font-sans` 设成 Geist 并 import `@fontsource-variable/geist`，中文界面要在 `src/index.css` 里换掉这条 import 与字体栈，否则 76 KB 的拉丁字体白白打进产物。
- `@shadcnblocks` 的 registry URL 是 `https://www.shadcnblocks.com/r/{name}`，不带 `.json`；`@reactbits-*` 是 `https://pro.reactbits.dev/api/r/<starter|pro>/{name}.json`。

### TypeScript 6 与生成代码

- TS 6 起 `baseUrl` 弃用且直接报 TS5101，`tsconfig` 只留 `paths`。
- `noUnusedLocals` / `noUnusedParameters` 会被 shadcn 生成的 `src/components/ui/*.tsx` 里未使用的 import 卡住，未使用符号交给 ESLint 的 `@typescript-eslint/no-unused-vars`，`src/components/ui` 在 eslint 与 prettier 里都忽略。
- `typescript-eslint@8.68` 的 peer 上限是 TS `<6.1`，本仓锁 TS 6.0.x，不上 TS 7。

### Playwright 设备模拟

- `devices['iPhone 15']` 的 `defaultBrowserType` 是 webkit，project 里要显式 `browserName: 'chromium'`，否则 swiftshader 启动参数不生效、WebGL 不可用。
- headless chromium 跑 WebGL 要加 `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。

### 多智能体并行时的 git 纪律

- 子智能体用 `git rm` 删文件会把删除暂存进 index，主会话之后任何不带 pathspec 的 `git commit` 都会把它们卷进去。规则：子智能体一律不做 git 操作，删文件用 `rm`；主会话提交前先看 `git status --short` 里有没有 `D ` 前缀。
- `prettier --write .` 会重排 `README.md`、`docs/`、`specs/` 的散文，`.prettierignore` 要把这些散文目录与生成代码目录都列上。
- zsh 里未加引号的变量不会按空格拆分，脚本里传多路径要用数组 `paths=(a b c)`，或显式 `bash -c`。

## 阶段 4 收尾（2026-08-29）

### 代码分割：静态引用包入口，等于把整包钉进首屏 chunk

- `@paper-design/shaders` 把 `xxxMeta` 与 `xxxFragmentShader` 放在同一个模块里，`import { warpMeta }` 就会让 rolldown 把 `warp.js` 判给主 chunk，之后再 `import('...')` 拿 shader 源码也拆不出去。
- 规则：要拆的包，主 chunk 里一个符号都不能静态引用（type-only import 不算）。本仓的做法是包只从 `src/engine/shader-mount.ts`、`shader-noise.ts`、`shaders/*.ts` 三个薄模块进来，全部走 `import()`；`maxColorCount`、`ShaderFitOptions`、`WarpPatterns`、`GrainGradientShapes` 这些常量抄进 `styles.ts` 并注明来源，升级包版本时对照 `dist/` 复核。
- 别用 `const { X } = await import('包名')` 直接从包入口取：命名空间访问挡住 tree-shaking，整份入口都会进那个 chunk。要拆就先写一个只 `export { X } from '包名'` 的本地模块，再动态 import 它。

### 首屏 JS 不等于 `dist/assets/index-*.js`

- rolldown 会把「入口与懒加载共同依赖」的模块提成独立 chunk，Vite 给这些 chunk 发 `<link rel="modulepreload">`，它们同样在首屏下载。本次 i18n 与字体加载器就各自被提了出去。
- 量首屏体积要按 `dist/index.html` 里的 entry script 加全部 modulepreload 求 gzip 之和，只看 index chunk 会低估三成。

### culori 按需入口的两个坑

- `wcagLuminance` 内部走 `converter('lrgb')`，`culori/fn` 下必须 `useMode(modeLrgb)`，否则运行时读到 undefined 才报错，单测不注册就发现不了。本仓的注册集中在 `src/palettes/culori.ts`，别的文件不许直接 `import 'culori'`。
- culori 的 `useMode` 会被 `eslint-plugin-react-hooks` 的 rules-of-hooks 当成 React Hook 拦下。导入时改名（本仓叫 `registerMode`）即可，不要加 eslint-disable。

### React.lazy 只有「真要显示才挂」才省首屏

- 懒组件一挂进树就立刻拉 chunk。导出抽屉与字体选择器都改成打开过一次才挂，之后一直留着，关闭动画与上一次的结果都还在。
- 这个「挂载闩」不能用 `useEffect` 里同步 setState，`react-hooks/set-state-in-effect` 会报错。本仓把它做成 store 的 `ui.exportMounted`，由 `setUi` 从 `exportOpen` 派生。

### 高光的混合模式在预览与导出之间必须同名

- 预览是 CSS `mix-blend-mode`，导出是画布 `globalCompositeOperation`，两边只有取同一个模式才等价。screen 可结合，`screen(底, screen(灯1, 灯2))` 与逐盏叠加结果一致，所以预览的「先画到透明图层再整层 screen」与导出的「直接逐盏 screen」出的是同一张图。
- 之前副光用 soft-light 就不成立：soft-light 对底色的响应依赖底色本身，画在透明图层上与画在渐变上不是一回事，预览与导出会差出一层。

### Playwright 的 project 分派与 e2e 的类型环境

- `testDir` 下的文件默认每个 project 都跑一遍，桌面用例会被塞进 iPhone 档。要给每个 project 写 `testMatch`，本仓是 `/(smoke|desktop)\.spec\.ts$/` 与 `/(smoke|mobile)\.spec\.ts$/`。
- `tsconfig.node.json` 管 `e2e/`，它的 `lib` 只有 ES2023，用 `document` 或 `navigator` 会直接报错，要显式加 `DOM`。
- 手机档的点击：顶上是 sticky 预览、底下是 fixed 操作条，Playwright 自带的滚动只保证元素进视口，会把目标停在预览底下判成被拦截。`e2e/helpers.ts` 的 `centreBetweenBars` 先量出中间那条可见带再把目标推到带中央，需要点面板里的控件时先过它一道。

### 预览画布读不回像素，e2e 靠探针

- 预览的 ShaderMount 没开 `preserveDrawingBuffer`，`toDataURL` 与 `getImageData` 拿到的是空的，测试没法直接断言画面。
- 做法是把 `composeAvatar` 与 `encodeCanvas` 包成 `window.__gradientAvatarProbe` 挂出去，只在 `import.meta.env.DEV` 或 URL 带 `?probe=1` 时用 `import()` 装。产品代码一处都不引用它，构建时它是一份独立 chunk，不带参数打开就不会下载。

## 引擎调参（2026-08-29）

四种质感在 26 套配色下逐格看图重调了一轮。样张管线是离屏 `composeAvatar` 加 Playwright headless chromium（`--use-angle=swiftshader`），配一套数值探针：亮度标准差、5 位量化后的可见色桶数、每个停靠色的最近邻覆盖率、拉普拉斯均值。下面是这轮扫出来的东西。

### shader 的合法区间不等于头像尺寸下的有效区间

`@paper-design/shaders` 的图案尺度是按大画面调的，`u_scale = 1` 在几百像素的方图里常常只装得下一格色带。grainGradient 塌成单色场就是这么来的：`shape` 在整张画面上几乎不变，`totalShape` 贴着 0，露出的全是 `u_colorBack`，而 `u_colorBack` 取的又是 `colors[0]`，于是一整张 `colors[0]`。滑杆不是失灵，是没有色带可推。

判据要看停靠色覆盖率而不是标准差。标准差随配色的明度跨度走，aurora-violet 这种明度接近的配色即使五个色都出全，标准差也只有 3；glacier 同样的图能到 28。

### grain：先缩放，再谈强度

320 px 方图上扫过 shape 1..7 × scale 0.3..2 × intensity × softness × noise，结论：

- 形状池曾收到 wave 1、ripple 5、corners 4 三种，各自带一个缩放倍率乘在用户的 scale 上：wave 与 corners 取 0.45，ripple 取 0.30。三种形状的图案尺度差一倍以上，共用一个倍率必然有一种塌掉。取帧从 0 到 20000 ms 全程扫过，这三组的最差一帧仍然五个停靠色齐全，glacier 上标准差 26 到 31。v3.1.2 按用户观感把 ripple 移出形状池，只保留 wave 与 corners。
- `u_intensity` 是把色带边界推歪的噪声量，不是色带行程。0.03 出干净的同心色带，0.85 把边界揉成絮状；再往上逐像素噪声压过图案本身，`fwidth(shape)` 抬起来，`totalShape` 与色带混合的两个 smoothstep 窗口一起被撑开，所有平滑参数同时失效。
- `u_softness` 管色阶软硬，可见色桶数从 7 个（近乎硬边分色）拉到 25 个（完全糊开），映射取 0.1 到 0.9。
- `u_noise` 直接加在 `shape` 上，`u_noise * 10 / colorsCount * noise` 这一项在五色下每 0.1 就抬 0.2 的行程，量大了整片推到最亮的停靠色。上限卡 0.3。
- 舍掉的四种：dots 与 truchet 是图案不是渐变；blob 的色团常落在画面外；sphere 是硬边球，最多只出四个停靠色。

### silk：锡纸是明度问题，不是参数问题

warp 在浅配色上会揉成锡纸，折痕两侧色差本来就小，swirl 一叠就把最浅的停靠色推到纯白，剩下的全是硬脊线。按配色的 OKLCH 平均明度线性压制：0.75 以下不动，0.90 以上压到底，压制系数同时作用在 `u_distortion` 与 `u_swirl` 上，并抬高 `u_softness` 的下限、削 `u_swirlIterations` 的上限。

这条带子是照配色表卡出来的：出问题的 cloud-white 0.869、graphite-mist 0.858、champagne 0.801、peach 0.908、mint 0.904、blush 0.836 都落在带内，出彩的 sunset 0.717、neon-tide 0.486、aurora-violet 0.580 在带外，折痕原样保留。

`u_swirlIterations` 是锡纸的主因，每多一层就多一道脊线。全局从 3 到 8 收到 3 到 7，浅配色再按压制系数削到 3 到 4。`u_shapeScale` 上限从 0.38 收到 0.28，再密就是布纹噪点不是绸缎。

### 滑杆灵不灵，看指标要分类型

同一组参数在不同 style 下改变的东西不是一回事，拿同一个指标衡量会得出错误结论。

- mesh 与 flow 改的是构图。量六格两两的像素平均绝对差就够：mesh 中位数 9 到 14，flow 中位数 4 到 6，都肉眼可分。mesh 的 `u_waveX` / `u_waveY` 铺满 0.05 到 1、`u_mixing` 铺满 0.15 到 0.95 之后才有这个数，之前 waveX 封在 0.7、mixing 下限 0.35，半程之后基本看不出变化。
- grain 与 silk 改的是纹理，构图由种子定死。像素差中位数只有 1 到 3，但可见色桶数与拉普拉斯均值动得很明显（softness 让色桶 7 到 25，intensity 让拉普拉斯 0.6 到 10）。这两个 style 的滑杆按纹理指标验，不按像素差。

### 自动文字色：设计值优先，像素判定只留给自定义配色

内置配色表里的 `text` 是照全部停靠点选好的，直接用它，同一配色下每块文字都是同一个颜色，高光、颗粒、种子都改不动。原来的做法是采样文字包围盒再比白字与深字的对比度，分界点落在相对亮度 0.179，高光一压亮区域就翻面，同一张图里几块文字会取到不同颜色，aurora-violet 这种中明度深底配色在 highlight 0.25 时整个翻成黑字。

自定义配色没有设计值，仍走像素判定，但改成单一门槛（区域相对亮度低于 0.5 取白字），不再比对比度，图里几块文字的取色因此不会互相打架。

底板门槛从 WCAG 4.5 降到 3.0：头像上的文字是大号字，WCAG 对大字的门槛本来就是 3.0，按 4.5 卡会让半数配色默认糊上一层底板。

### 文字效果的两条颜色规则

- glow：浅色字用自己的颜色发光，深色字改用白光。深色字配同色光晕会在字周围堆出一圈脏晕，越强越脏。
- pill：底板一律取文字色的反色。跟着导出底色走的老做法在浅配色上会画出一块白底白字的隐形底板，默认不透明度也从 0.35 提到 0.55 才看得见。

## 评审收尾（2026-08-29）

### 子智能体撞用量上限，评审会返回「零问题」

多智能体评审跑完报 0 findings，看着像代码干净，实际是六个评审 agent 全部以 “You've reached your Fable 5 limit.” 结束，workflow 把失败的 agent 折成 `null`，`.filter(Boolean)` 之后自然是空数组。第二轮给评审与复核 agent 钉上 `model: 'opus'` 重跑，同一份代码出了 59 条。

规则：评审型 workflow 的结论「零问题」不可信，先看有没有 agent 失败再看 findings 数；跨模型的长会话给子智能体显式钉 model，别让它们跟着主会话的额度一起耗尽。

### 圆形安全区：解几何，不要调默认边距

文字块四角被圆形遮罩裁掉，第一版的做法是「切到圆形时把默认边距从 10 % 提到 15 %」。它只在用户没碰过边距滑杆时成立，碰过就失效，而这正是报障的场景；且 15 % 换来的方框（700 × 700）比几何解（707 × 707）还小。

现在按遮罩几何算：把边距算出来的方框按原比例缩到四角正好压在圆角圆弧上（`src/text/fit.ts` 的 `safeArea`）。圆形是圆角拉满的特例，方角与常规圆角的方框够不着四角，函数是恒等变换，已有版式一个像素都不动。判据是解析式而不是经验值，任何边距、任何画布比例都成立。

### 全分辨率质量二分的实测成本

体积二分在全尺寸画布上反复编码，评审判它守不住 3 秒预算。实测（swiftshader 软件渲染，比真机 GPU 慢得多）：4096 单次 JPEG 编码约 220 ms（整张随机噪声，逼近最坏体积），二分最多 7 轮约 1.5 s；4096 一次完整导出 1.95 s，其中合成占 1.7 s，默认配置下首轮就落在 1 MB 内，二分根本不触发。

结论是不换成缩图代理：代理只能估质量与体积的关系，换来的是可能压不进目标，省下的时间在真机上还不到半秒。这条是权衡记录，不是待办。

### 取色探针要串行，防抖挡不住已经在跑的那次

预览的自动取色探针每次起一个离屏 WebGL 上下文。尾沿防抖只挡得住还没起跑的那次，跑了 220 ms 还没回来的那次照样占着上下文；连着改配置时它们并行堆起来，浏览器一超过并发上限，被判掉的往往是常驻预览那个上下文，画面就此定格。现在探针串到上一次后面，同时最多一个在跑、一个在排队。

### 自动填满宁可退一档字号，也不把拉丁词拆开

换行的兜底是「单个原子宽过安全区就拆成字素」，这条对超长词是必需的，但自动填满会顺手接受它：二分只看「块放不放得进安全区」，于是 `GRADIENT` 被断成 `GRADIEN` 加一个孤零零的 `T`，块确实放得下，看着却像排版事故。

现在二分跑两轮：第一轮把「拆过词」也算不可行，第二轮才放开。只有当最小字号都躲不掉拆词（词本身就放不下）时才落到第二轮，不会为一个超长词把整块文字压到下限。

同一处还有一个旧判据要一起改：闭式解的前置条件原来写成「只有一个词就不可换行」，超长的单个拉丁词因此走了单行闭式解，被钉死在单行放得下的那个字号上。判据改成看字素数，能拆就走二分。

## 契约里加了字段，不等于有人读它

**症状。** 状态徽章的次行字号是首行的 0.42 倍，排版产物里 `LayoutLine.font` 也确实是小字号，
单测断言这个字段的值，全绿。真跑起来次行按首行的 273 px 画出去，直接冲出画布。

**错误直觉。** 「排版结果对了，画出来就对了。」排版与绘制是两个模块，中间靠字段传话。
`drawText` 从头到尾只设过一次 `ctx.font = layout.font`，`line.font` 加上去之后没人读，
类型系统对「可选字段没被消费」没有任何意见。

**已验证原因。** 新增的是可选字段（`font?: string`）。可选字段的漏读在 TypeScript 下是合法程序，
既不报错也不告警。而单测断言的是排版函数的返回值，不是绘制时的画笔状态，两者之间正是缺口所在。

**可复用规则。**

- 给跨模块契约加字段时，同一轮里必须补一条**在消费端**断言的用例。断言的对象是消费端的可观测行为
  （落笔当时的 `ctx.font`、发出去的请求体、写进数据库的行），不是生产端的返回值。
- 判据：把消费端那行代码删掉，有没有测试变红？没有就说明这个字段还是没人读。
- 视觉类改动跑一遍真实浏览器再收工。这个 bug 在 jsdom 里永远暴露不出来，
  截一张图三十秒就看见了。`scripts/screenshots.mjs` 那套加上分享链接的 hash 可以直接喂任意配置。

**验证命令。** `npm test` 加一次真实渲染核查：起 `npm run dev`，用 `#c=<base64url(配置差异)>`
把配置喂进去，`page.reload()` 之后截图（只改 hash 是同文档导航，应用只在模块初始化时读一次 hash）。

**失效条件。** 绘制层改成由排版层直接产出绘制指令（不再靠字段传话）之后，这条不再适用。

## v3.1.1 直接导出与行级排版（2026-08-29）

### 这轮跑通的工作范式

- SDD 按可回滚的薄切片推进：先提交规约与验收，再提交契约与消费端测试，然后是排版内核、界面、导出交互，最后文档与记忆。每一片都能独立解释“造什么、怎么造、怎么证明”，不要把默认值、内核、UI 与 e2e 塞进一个不可审查的大提交。
- 改默认值时同步迁移测试口径：测试自动取色就显式 `colorMode: 'auto'`，测试统一字号就显式 `lineSizeScales: [1, 1]`。默认值是产品行为，不是测试夹具的隐形前提。
- 行级排版只存比例，不存像素。`lineSizeScales` 乘在基准字号上，`lineOffsetsX` 用画布宽度比例，同一配置在 512、1024、2048 下自然等比；自动填满则必须重新按每行字号度量整块包络，不能先按统一字号求完再“事后缩放”。

### 图片剪贴板：Promise 必须在手势里交给 ClipboardItem

Safari 的 Async Clipboard 要求 `navigator.clipboard.write` 在用户手势内发起。画布合成与 PNG 编码可能耗时数秒，如果先 `await blob` 再 `new ClipboardItem`，手势已经失效。正确做法是同步创建 `new ClipboardItem({ 'image/png': blobPromise })`，把 Promise 本身交进去；浏览器会等 Promise 完成。

2026-08-29 复核 MDN 与 Clipboard API 实践后的另外两条口径：`canvas.toBlob` 遇到不支持的 MIME 会静默回落 PNG，所以 WebP 仍要按返回类型探测；文件分享前要用真实 `File` 调 `navigator.canShare`，只有 `navigator.share` 不代表支持 files。本项目当前主路径是直接下载与复制图片，不自动弹分享面板。

### Playwright preview 服务的是 dist，不是源码

`npm run e2e` 的 webServer 是 `vite preview`，它只服务上一次 `npm run build` 的 `dist`。这轮给导出提示加了 `data-slot` 后直接跑 e2e，页面里当然找不到新属性，误判成功能缺陷。规则是：改完源码先 `npm run build`，再跑基于 preview 的 e2e；想测源码热更新就用 `npm run dev` 起另一个 webServer，不要混用两种口径。

## v3.1.2 默认值与行级字号输入（2026-08-31）

### 默认值变化会改写省略字段的旧链接

URL hash 只编码与当前默认值的差异。把 `padding` 从 0.1 改到 0.15 后，旧链接里若没有显式写这个字段，打开时会按新默认值渲染；显式写了 0.1 的链接不受影响。改默认值时必须同步三件事：更新默认值测试、补一条显式旧值的兼容用例、在架构文档里写清这条规则。只改 `DEFAULT_CONFIG` 不补测试，下一次调默认值还会把几何测试打红。

### 行级字号的难点是可发现性，不是能力

行级字号本来就存在，但控件排在全局字号后面，数值还要先点一下才变成输入框。用户会把它理解成“不好改”。本轮只做两件事：把行级控件前置到全局字号之前，给行级字号加常驻数值框。不要把所有滑杆都改成常驻输入，那会让界面变重；只给需要精确修改的行级参数开这一档。

## v3.2 图标徽章（2026-08-31）

### 生成索引与脚本必须同批提交

`src/graphics/lucide.ts` 动态 import `generated/lucide-curated` 与 `lucide-full`。只写消费端不跑生成器时，typecheck 直接报模块不存在；这不是可以等到“下次生成”的警告，而是主干缺产物。规则：生成脚本、纯转换层、产物与消费端同批提交；`npm run gen:icons` 与 `npm run gen:emoji` 是唯一重建入口，产物文件头写明命令，不手改。

lucide-react 1.37 的 `icons/` 目录有 2048 个 `.mjs`，其中 1790 个主模块带 `__iconNode`，其余是别名转发。索引只按主模块收，别名不进索引，否则同一个图形会在选择器里出现两次。精选清单要用主名：`filter`、`smile`、`home` 这一批都是别名，规范名分别是 `funnel`、`face-slightly-smiling`、`house`。

### 图形加载不要把索引拖进首屏

`source.ts` 本身可以静态进首屏，但三个实现必须按来源动态 `import()`。如果把 `lucide.ts` 静态接进 source，`curated.ts` 与 React 组件链就会跟着进首屏。选择器再走 `panels/lazy.ts` 的挂载闩，才能做到没点开图形选择器时不拉 cmdk 与索引；内置全库只在搜索超出精选时加载，emoji 标签按当前语言加载。

### SVG 消毒用重建，不做黑名单修补

上传 SVG 走 `DOMParser` 后按元素与属性白名单重建。未知元素整支丢弃，未知属性删除，`url()` 只保留 `#id` 内部引用；`script`、`foreignObject`、`image`、`use` 与事件属性都不在白名单里。这样比“删掉 script 再放行其余”更可解释：产物里只可能出现已知绘图元素。没有安全绘图元素时拒绝上传，不猜一张空图。

### jsdom 没有 Path2D，图形单测要显式装替身

`loadLucideGraphic` 依赖 `Path2D`。jsdom 不实现它，直接测会得到 null，看起来像业务失败。用例先在 `globalThis.Path2D` 装一个带 `addPath`、`rect`、`arc` 等方法的替身，再动态 import 模块，才能守住“图标节点真的被转成路径”的消费端链路。

### 图标徽章的绘制断言盯调用，不盯排版字段

v3.1 的教训在 v3.2 复用：`tests/export/compose.test.ts` 断言 `composeWith` 调 `drawGraphic`，并核对传入的图形对象、落位矩形与取色结果。删掉合成层的落笔调用时测试会红；只断言 layout 里有 `graphic` 字段则不会。图形为空、文字为空、上传失败这些路径也要有独立用例，防止异常路径吞掉整张导出。
