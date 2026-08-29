# 工程踩坑与经验

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
