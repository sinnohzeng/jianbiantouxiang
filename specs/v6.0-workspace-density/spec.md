# 工作台致密化与债务清理 v6.0 规约（造什么）

状态：已封存。与实到实现的差异见文末“实到范围”，现状以常驻文档与代码为准。

## 1. 目标

一轮做完两件事：把桌面工作台从「预览吃满视口、左列滚三屏」改成「四组内容同屏不滚」；把盘点确认的技术债务清掉。

判据来自实测（`1440×900`、微调收起）：配色与质感那一列内容高 **1615 px**，可视 **812 px**，溢出 **803 px**——最高频的两个操作整组在滚动区里。同视口微调打开时挑选栏并回一列，内容高 **2441 px**，溢出 **1629 px**。而预览画框在 `1920×1080` 收到 **890 px**，比三列控制面板加起来还宽。价值与需求是一体两面的：这个工具的真需求是「打几个字、挑一套颜色、换两版构图、导出」，配色与质感是这条主路上的第一步，让它们滚三屏才露出来，等于把价值藏起来。

## 2. 用户故事

- 作为使用者，我在 `1440×900` 上一眼看到文字、图标、配色、质感四组内容，不需要滚动就完成一次「改字—换色—换质感—导出」。
- 作为使用者，我打开微调后，默认那些组一屏放得下；标签、数值、滑杆三者对齐，字号不再比正文还大。
- 作为使用者，图标这一节只有一个入口：没选时一颗按钮，选了之后点缩略图换、点叉移除；没有一个开关在标题右边让我猜它是干嘛的。
- 作为使用者，操作条上「换一版」就是换一版构图，不会写着「随机颜色」却只换种子。
- 作为维护者，仓库里没有零引用的原语、桶、钩子与退役字段分支；同一份 `clamp` 只存在一处。

## 3. §A 桌面栅格重平衡

### A1 现状与病灶

列模板在 `src/index.css` 的 `[data-slot='workspace']` 一段（197–320 行）。挑选栏列宽由 `--pick-w` 一族 clamp 给出，预览列是 `1fr` 吃剩余，画框边长再取 `min(var(--preview-max), 960px)`（`src/app/PreviewStage.tsx:292`），`--preview-max` 桌面档是 `calc(100svh - 190px)`（`src/app/AppShell.tsx:81`）。三个毛病：

1. 预览列无上限地吃剩余宽度，`1920` 上画框 890 px，控制面板被压到 400。
2. 挑选栏列宽与内容高度无关：配色磁贴固定 4 列、每块 56 px 高加名字，37 套就是 10 行 780 px，列再宽也不变矮。
3. `1024–1535` 且微调打开时挑选栏并回一列，四节竖排 2400 px。

### A2 新列模板

工作台外壳加 `lg:mx-auto lg:w-full lg:max-w-[1520px]`：超宽屏不再把富余全灌给画框，两侧让给氛围背景。

轨道改为「预览按视口定宽、挑选栏吃剩余」，预览不再靠 `1fr` 捡漏。变量只留两个：`--inspector-w: clamp(272px, 17vw, 312px)`、`--preview-w: clamp(400px, 34vw, 640px)`；删 `--pick-w`、`--pick-w-open`、`--pick-w-solo` 三个。

| 形态 | 断点 | 列模板 |
| --- | --- | --- |
| 收起 | ≥96rem | `minmax(300px,1fr) minmax(300px,1fr) 522px` |
| 收起 | 70–96rem | `minmax(300px,1fr) minmax(300px,1fr) var(--preview-w)` |
| 收起 | 64–70rem | `minmax(300px,1fr) var(--preview-w)` |
| 打开 | ≥96rem | `272px minmax(300px,1fr) minmax(300px,1fr) 522px` |
| 打开 | 91–96rem | `var(--inspector-w) minmax(300px,1fr) minmax(300px,1fr) var(--preview-w)` |
| 打开 | 64–91rem | `var(--inspector-w) minmax(280px,1fr) var(--preview-w)` |

**96rem 冻结档是必需的**：`vw` 永远对真实视口取值，而容器已被 `max-w-[1520px]` 钉死。1647 px 以上若仍用 `34vw`，预览会顶到 640、微调顶到 312，两条挑选列被压出 `minmax(300px,1fr)` 下限之外，合计超出容器最多 112 px，而 `main` 是 `lg:overflow-hidden`（`AppShell.tsx:76`），超出部分被裁不是滚。冻结档把两条 clamp 钉在 1520 容器对应的取值上（522 = 0.34×1536 的封顶前值、272 = 下限）。

各档实算（轨道宽，px；已计入 `lg:px-4` 的 32 与 `lg:gap-4` 的 16×(轨道数−1)）：

| 视口 | 形态 | 微调 | 挑选左 | 挑选右/壳 | 预览 |
| --- | --- | --- | --- | --- | --- |
| 1024×768 | 收起 | — | 壳 576（内两列 282） | | 400 |
| 1024×768 | 打开 | 272 | 壳 288（单列） | | 400 |
| 1280×800 | 收起 | — | 390 | 390 | 435 |
| 1280×800 | 打开 | 272 | 壳 509（内两列 248） | | 435 |
| 1440×900 | 收起 | — | 443 | 443 | 490 |
| 1440×900 | 打开 | 272 | 壳 614（内两列 301） | | 490 |
| 1536×864 | 收起 | — | 475 | 475 | 522 |
| 1536×864 | 打开 | 272 | 331 | 331 | 522 |
| 1920×1080 | 收起 | — | 459 | 459 | 522 |
| 1920×1080 | 打开 | 272 | 323 | 323 | 522 |

画框边长上限从 960 收到 **640**：`min(var(--preview-max), 640px)`；`--preview-max` 桌面档改 `calc(100svh - 200px)`。画框取「列宽、`--preview-max`、640」三者最小。

### A3 挑选栏壳的有界断点内拆

并回一列的那些档里，壳宽足够时内部改两列。**用有界 media 查询，不用容器查询**：`pick-columns` 在拆列档是 `display: contents`（index.css 271–272、301–302 行），不生成盒，而 `container-type: inline-size` 的 containment 作用于元素的 principal box，`display: contents` 的元素承担不了；且壳宽完全由视口断点乘微调开合决定，容器查询量不到新信息。

```css
@media (min-width: 64rem) and (max-width: 69.99rem) {
  [data-inspector='closed'] > [data-slot='pick-columns'] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    min-height: 0;
  }
}
@media (min-width: 77.5rem) and (max-width: 90.99rem) {
  [data-inspector='open'] > [data-slot='pick-columns'] {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    min-height: 0;
  }
}
```

77.5rem = 1240 px，是打开态壳宽过 480 px 的实测阈值（1238）。`min-height: 0` 是新加的：壳从 flex 变 grid 后子列才滚得了。壳里本来就只有 `pick-column` 与 `pick-column-color` 两个子列，内拆即各占一列。这一条替掉今天「1280 打开并回一列滚 1845 px」的形态：壳 509 px 内拆两列后每列约 248 px，致密化后的四节两两配对各约 540–670 px 高，一屏放得下。

### A4 滚动与滚动条

内拆态的两个子列补 `min-height: 0; overflow-y: auto`，与拆列档（index.css 322–338 行）同一套规则。`scrollbar-gutter: stable` 与悬停提亮两段的选择器已经含 `pick-columns` 与两个子列，不动；391 行与 404–419 行里「子列要写回静息色」的注释保留。index.css 215–218 行「pick-columns 只有 flex」的注释按 A3 改写。

## 4. §B 微调面板致密化与对齐

### B1 病灶

`src/components/blocks/slider-field.tsx` 的 `row` 形态（229–247 行）是两行：第一行 `justify-between` 放标签与右侧控件组，第二行滑杆独占。行高实为 **70 px**：第一行 `min-h-8`（32）加 `gap-0.5`（2），滑杆 `py-4 lg:py-2.5` 加 16 px thumb 是 36，`lg:min-h-6` 只是下限压不下 padding。三个毛病：

1. **数值框不对齐**。右侧控件组是 `auto 钮 + 数值框 + 重置占位` 顺序排布：全仓只有字号行有 `auto` 钮且它没有 `defaultValue`（因而没有重置占位），其余行相反。`justify-between` 把控件组右缘钉死，于是字号行缺的 24 px 占位加 4 px gap 让它的数值框比其余行**右移恰好 28 px**。
2. 标签 `text-xs`（12 px）、组标题 `text-sm`（14 px）semibold，比同级工具大一档。
3. 70 px 一行，默认 12 行加组头约 950 px，任何桌面高度都滚。

### B2 新行结构

行高 **38 px**：第一行 20 px，第二行滑杆 16 px，中间 2 px。第一行改用固定列的 grid，数值框的位置与兄弟元素有无无关：

```
grid-template-columns: minmax(0,1fr) 36px 56px 20px;  column-gap: 6px;
                        标签          自动  数值  重置占位
```

- 标签：`text-[11px] leading-5 font-medium truncate`，`title` 保留全称。11 px 是 M3 `label-small` 与 macOS Subheadline 的交点。
- 自动档：36 px 常留列，没有自动档的行放空 `<span>`。自动钮同步收 `text-[11px] px-1`：en 的 "Auto" 在 12 px 加 `px-1.5` 下是 41 px，装不进 36；收到 11 px 加 `px-1` 是 34 px。
- 数值框：`w-14`（56 px）、`text-right font-mono tabular-nums`、`h-5`。宽度按真实最长口径「-0.10em」7 字符算：11 px 等宽约 46 px 加 `px-1` 与边框恰好 56。字号用 `lg:text-[11px]` 而不是 `text-[11px]`：`Input` 基类带 `lg:text-sm`，tailwind-merge 视二者为不同变体，裸 `text-[11px]` 在桌面压不过它；基值保持 16 px 也守住 contributing.md「输入类控件字号不小于 16 px」的 iOS 防缩放约定。
- 重置占位：`w-5` 常留，钮 `size-5`，显隐规则不变（桌面悬停/聚焦显形，触控常显）。
- 滑杆：`h-4`，thumb `size-3`，桌面用 `after:-inset-2` 把命中区撑到 24 px（WCAG 2.5.8 AA）；基值仍是 `min-h-11` 与 `size-5` thumb，命中区查询写 `[@media(hover:none),(pointer:coarse)]`，触屏笔记本（`hover:hover` 且 `pointer:coarse`）也拿回 44 px。
- **所有致密尺寸一律 `lg:` 前缀**，基值保持本仓 44 px 触控与 16 px 输入字号口径。手机渲染同一棵树（AppShell 同构），不带前缀的 `h-5`、`size-5`、`h-9`、`h-7` 会整片破线。

行高 70 → 38。默认态 12 行 3 组头（排版 5、效果 1、质感 6，见 B3）实高约 **618 px**：12×38 + 3×26 组头 + 3×20 卡片内边距 + 2×8 卡距 + 8 底边距。`1280×800` 的可用高是 704（800 − 56 顶栏 − 32 上下边距 − 8），放得下。

### B3 组头、卡片与分组

- 组头：`min-h-5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground`，下边距 6 px。不做 sticky：短列里 sticky 组头净亏，同类工具反过来把预览做 sticky。
- 「逐行」组合并进「排版」组：它本来就是行级排版参数，单独成组只多一个组头与一次视觉扫描。条件显隐规则不变。
- 微调面板在 `lg:` 以上不再渲染自己的折叠头（`inspector-header`）：它与操作条的「微调」钮是同一个开关的两个入口，桌面上同时出现只会让人犹豫；手机上保留，那里折叠头是流内的展开 affordance。省 44 px。
- `SectionCard` 基值统一 `p-2.5`、头行 `min-h-6`、标题 `text-xs font-semibold`、下边距 `mb-1.5`、子内容 `gap-2`；删 `Inspector.tsx:56` 上 `className="p-2.5"` 的覆盖，挑选栏与微调真正共用一套外观。`Inspector.tsx:110` 的 `StaggerRoot gap-3` 与 `PickColumn.tsx:18/26` 的 `gap-3` 同步收 `gap-2`。

### B4 删 stack 形态

`SliderField` 的 `layout` prop 与 `stack` 分支（slider-field.tsx:39、249–263）删除，`row` 成唯一形态。生产调用点只有两处且都传 `row`（`Inspector.tsx:46`、`CanvasFields.tsx:162`），`stack` 的默认值只被两个测试文件走到；头注释里「stack 是挑选栏里的上下两行」早已过期。同步改 `CanvasFields.tsx:162`、`tests/components/input.test.tsx`、`tests/components/slider-field.test.tsx` 与文件头。

## 5. §C 图标模块：单控件两态

### C1 病灶

`src/app/workspace/sections/GraphicSection.tsx` 里同一件事有四个入口：标题右侧的 `Switch`（开=拉起选择器、关=清空）、72 px 磁贴按钮（拉起选择器）、「挑一个/换一个」`Button`（拉起选择器）、`X` 清除钮。开关打开时拉起选择器是一个 call to action，而 Material 3 对 Switch 的明文禁令正是「A switch can't replace a button」；Carbon 的 Tag 用法也写明「Avoid using tags with multiple functions」。标题「图标」加两行介绍文案，第一次进来的人仍然不知道这一节要他干什么；选中后显示的 `icon.id`（如 `1f334`）比没有名字更糊涂。

### C2 新形态

一个控件两种状态，M3 input chip / Carbon dismissible tag 的单控件写法：

- **空态**：一颗整宽虚线按钮，`h-11`，图标加文案「选图标」（复用 `icon.title` 现值，五语已有）。点它拉起选择器。
- **填充态**：一行三件——48 px 缩略图磁贴（点它=换，`title` 与无障碍名给「选图标」；磁贴内保留 `sr-only` 的 `icon.id`，端到端对磁贴文本的四处断言因此不用改）、图形名 `graphic-name`（`truncate text-[11px]`；内置图标给 `curated.ts` 的中英文名、emoji 给当语 label、品牌给中英文名、上传给文件名，都取不到才回退 id）、`X` 移除钮（可见 20 px、命中区基值 44、`lg:` 收 28）。
- 品牌来源时，移除钮右侧仍挂「原色/单色」分段控件，读写 `layout.icon.mono`，与选择器内那份同一字段。
- 删除：`Switch`（连同 `src/components/ui/switch.tsx`，它的唯一 importer 就是这里）、「挑一个/换一个」`Button`、两行介绍文案、「还没选图标」占位句。
- 保留 `panel.text.icon.hint`（图标置顶、文字自动缩小）作为填充态的一行说明，`text-[11px]` 弱色。

`data-slot` 契约：空态按钮 `graphic-pick`，填充态磁贴 `graphic-picker`，图形名 `graphic-name`，移除钮 `icon-clear`，单色 `brand-mono`。测试同步：`tests/app/workspace.smoke.test.tsx:146-147` 查 `#text-icon` 并断言 `.checked`，改成断言 `graphic-pick` 存在且 `graphic-picker` 不存在；同文件 :157 断言空态存在 `graphic-picker`，方向反转。e2e 里 desktop 六处、mobile 一处 `text-icon-switch` 全是「空态点开选择器」，一律改 `graphic-pick`；「点 X 移除」当前零覆盖，补在 `e2e/desktop.spec.ts:341` 那条用例尾部（结束时正是「已选品牌图标 + 单色控件可见」）：点 `icon-clear` 后断言 `graphic-picker` 与 `brand-mono` 归零、`graphic-pick` 可见、探针读到的 `icon.source` 回到 `none`（写盘有防抖，走 `expect.poll`）。

## 6. §D 挑选栏致密化

### D1 配色节

- 磁贴网格 4 列改 **6 列**，磁贴 `h-9`、`rounded-md`、间距 6 px。**去掉每块下面的名字**：37 个名字在 4 列下本来就被截成「Champagn…」，信息量约等于零；渐变本身就是名字。名字改两处出现：节头 `action` 位弱色 11 px 显示**当前选中**配色的五语名（`palette: 'custom'` 时显示 `panel.palette.custom`，`min-w-0 max-w-[45%] truncate`）；每块磁贴 `title` 与 `sr-only` 保留全名，键盘与读屏不丢。
- 37 块 = 7 行 × 42 px = 294 px，加明暗筛选 32 px 与节头，整节约 470 px（原约 800 px）。
- 明暗筛选分段控件 `h-8`。
- 自定义配色与种子色生成两个折叠保持折叠，触发器 `h-9`，内部控件 `h-9`/`h-8`。

### D2 质感节

- 四张 radio card 的 2×2 改**单行四格**：每格渐变示意 `h-10` 加名字 11 px `truncate`，选中加环；`radio-card-group.tsx` 的 `grid-cols-2` 改 `grid-cols-4`、`min-h-11`/`p-2`/`gap-2` 收 `p-1`/`gap-1.5`、名字 `text-sm` 收 `text-[11px]`。最窄子列（1280 打开内拆态约 248 px）下每格约 52 px，四字名靠 `truncate` 收住。描述文案（`style.*.desc`）从可见 span 挪进 `title` 与 `sr-only`，另在组下常显**当前选中**质感的描述一行 11 px 弱色：触屏没有 hover，描述不能只活在 tooltip 里。整组约 82 px（原约 330 px）。
- 种子行压成一行：标签内联 11 px、输入 `h-8 flex-1 font-mono`、复制与换种子两颗图标钮基值 `size-11`、`lg:size-8`。约 32 px（原约 84 px）。换种子钮的语义本来就是「换个种子」，与 §E 的改名无关，文案不动。

### D3 文字节

- 六个字段标签统一 `text-[11px] leading-4 text-muted-foreground`，下边距 4 px（原 `Label` 默认 14 px）。
- 两行输入 `h-9`；字体按钮 `h-9`；字重 chips 基值 `h-11 min-w-11` 收 `lg:h-7 lg:min-w-7 lg:px-2 lg:text-xs`（9 颗在 300 px 列里两行，原 96 px 现 62 px）。
- 文字样式分段控件 `h-9`、选项 `text-[11px] px-1.5`：修掉「Shadow」被截成「Shad…」的问题（1440 实测可见）。
- 文字色：预设七块 `h-8`，hex 输入 `h-9`。

## 7. §E 操作条语义与文案

| 位置 | 现文案 | 新文案 | 行为 |
| --- | --- | --- | --- |
| 一级实心 | 随机颜色 / 短称「随机」 | **换一版**（单 span，长短同文） | 只换 `seed`。hint：配色与质感不变，换一版构图 |
| 次级 | 全部随机 / 短称「全随机」 | **随机颜色和质感** / 短称「全随机」 | `seed` + 配色 + 质感。hint：颜色、质感与种子一起换 |
| 视图开关 | 微调 | 微调 | 不变，点亮态不变 |
| 溢出菜单 | 更多 | 更多 | 四项不变（复制图片、网格、安全区、恢复默认），符合 PatternFly「溢出项 ≥3 才做 overflow」 |
| 一级实心 | 导出 + 齿轮 | 不变 | 不变 |

「随机颜色」与它自己的 hint「只换种子，配色与质感不变」互相矛盾，是本轮文案问题的根；「换一版」不承诺它没做的事。两档随机的语义边界照「小随机=换种子、大随机=换更多」的行业两档写法。单 span 照 `BottomBar.tsx:259/272/345` 的既有写法用裸 `data-label`（不带值），index.css 355–366 的两条长短规则都不命中它、恒显。`data-slot` 名保留不改：`shuffle-color` 承载的语义变了，但槽名与文案同轮改会让 diff 里看不出哪处是语义变更。

i18n，五份字典加 `src/i18n/keys.md` 同轮同步（keys.md 受 `tests/i18n/keys.test.ts:181-206` 的双向断言，漏改必红）：

- **删（10 条）**：`bottombar.random`、`bottombar.random.short`、`bottombar.random.hint`、`panel.graphic.pick`、`panel.graphic.change`、`panel.graphic.intro`、`panel.graphic.empty`、`panel.graphic.current`、`panel.text.icon`、`panel.inspector.group.line`。
- **增（2 条）**：`bottombar.reroll`、`bottombar.reroll.hint`。
- **改（2 条）**：`bottombar.randomAll`、`bottombar.randomAll.hint`。`bottombar.randomAll.short` 保持「全随机」不动。
- **保留**：`panel.text.icon.clear`、`panel.text.icon.hint`、`panel.graphic.title`、`panel.graphic.mono`、`style.*.desc`（D2 只挪渲染位置，模板串仍在，由 keys.test.ts 的 dynamicKeys 白名单覆盖）。

五语取值：

| key | zh-CN | zh-HK | en | ja | ko |
| --- | --- | --- | --- | --- | --- |
| `bottombar.reroll` | 换一版 | 換一版 | Reroll | 別パターン | 새 구성 |
| `bottombar.reroll.hint` | 配色与质感不变，换一版构图 | 配色與質感不變，換一版構圖 | Same colors and texture, a new composition | 配色と質感はそのままに、構成だけ変えます | 색상과 질감은 그대로, 구성만 바꿉니다 |
| `bottombar.randomAll` | 随机颜色和质感 | 隨機顏色和質感 | Shuffle colors and texture | 配色と質感をランダム | 색상과 질감 랜덤 |
| `bottombar.randomAll.hint` | 颜色、质感与种子一起换 | 顏色、質感與種子一起換 | Colors, texture and seed all change | 配色・質感・シードをまとめて変更 | 색상, 질감, 시드를 함께 바꿉니다 |

## 8. §F 技术债务清理

逐项已自行核实并经评审复核（引用计数、grep 取证），不在规约里复述取证命令。

### F1 零风险删除

- `src/components/ui/` 九件零引用原语：`badge`、`scroll-area`、`select`、`separator`、`sheet`、`tabs`、`toggle`、`toggle-group`、`tooltip`。`toggle.tsx` 的唯一 importer 是 `toggle-group.tsx`，删后者即孤儿，必须同轮删。`switch.tsx` 不在本切片：它的唯一 importer 是 `GraphicSection.tsx`，由 §C 那一轮删，否则中间态 typecheck 红。已核实安全：`dropdown-menu.tsx` 的 `DropdownMenuSeparator` 直接用 `MenuPrimitive.Separator`，不 import `ui/separator`；`workspace.smoke.test.tsx:204` 的 `select-trigger` 是否定断言。
- 零 importer 桶：`src/engine/index.ts`、`src/text/index.ts`、`src/export/index.ts`、`src/state/index.ts`。`src/app/panels/index.ts` 删除后 `tests/app/workspace.smoke.test.tsx:10` 拆成 `@/app/panels/ExportDrawer`、`@/app/panels/FontPicker`、`@/app/panels/HistoryStrip` 三条叶子导入；`src/palettes/index.ts` 删除后 `tests/components/segmented-control.test.tsx:13` 的 `contrastRatio` 改指 `@/palettes/color`——必须是指 `color.ts` 的 culori 版：`text/ink.ts` 的 `parseHex` 只认 `#hex`，喂 CSS token 会退成 `[0,0,0]`、对比度恒 21，而该测试传的正是 `token(scope,'--muted')`。`src/fonts/index.ts` **保留**（contributing.md 的桶约定里 fonts 在列，`src/App.tsx:7` 在用）。contributing.md 的桶约定同步改成「七个库目录里 `fonts` 有出口，其余按需引用内部模块」。
- `src/hooks/use-debounced.ts`：生产零引用，仅 `tests/app/use-throttled.test.tsx:47-53` 在用。删文件与该用例；文件保留其余三个 `useThrottled` 用例，头注释从「对照两个 hook」改写为只留节流尾沿补齐与卸载安全两条立意；删 `src/app/use-throttled.ts:6` 那句指向注释。
- 死导出三处去 `export`：`WCAG_AA`（`text/ink.ts:14`）、`DESKTOP_BREAKPOINT`（`hooks/use-media.ts:6`）、`StyleParamMeta`（`engine/styles.ts:45`）。`STYLES` 与 `StyleDefinition` **不动**：`tests/engine/styles.test.ts:6` 在用 `STYLES`，`getStyle()`/`STYLE_LIST` 的公开签名引用 `StyleDefinition`。`PreloaderProps`、`StaggeredTextHandle` 在 `src/components/showcase/`（跟随上游的 registry 件），为一个关键字改它下次拉取即冲掉，不做。
- `src/graphics/source.ts:30` 的 `return null`：现状是四段 `if` 链无 `else`，TS 眼里可达、是必需兜底而非死代码。先把 `icon.source` 解构成 `const`（属性收窄会被中间的 `await import()` 打断，const 不会），链尾写 `const exhausted: never = source; return exhausted`，兜底才真正不可达。
- `tsconfig.json:4-8` 的 `paths` 删除：根配置是 `files: []` 加 `references` 的 solution style，不参与编译，别名由 `tsconfig.app.json` 提供。
- **`.gitignore`、`.prettierignore`、`eslint.config.js` 三份不动**。盘点曾把 `dev-dist/`、`.firecrawl/`、`.superpowers/`、`playwright-report` 判成孤儿条目，复核后不成立：ignore 天生为「还不存在的路径」而写，这些是构建器与工具运行时才生成的目录，`git check-ignore` 报未忽略只因尾斜杠模式不匹配不存在的非目录路径，目录一生成即生效。

### F2 退役兼容代码

- `src/state/config.ts:293-295` 的 `lay.kind === 'status'` 分支删除。**行为会变，这是有意的**：该分支把 v3.1 状态徽章存档的 `layout.scale` 迁到 `lineSizeScales[1]`，删后这类存档的次行字号回默认值。owner 已授权开发期不作兼容，v4 及以后的存档不受影响。`tests/state/config.test.ts:268-275` 是该分支的用例，删；同文件 :164 断言 `normalizeConfig({layout:{kind:'status'}}).layout` 等于默认，与分支无关，留。
- `src/state/config.ts:263-265` 的 normalizeConfig 文档注释「旧状态徽章的 layout.scale 迁移到次行字号档」与 :6-9 的退役字段名单同步改写：不再以迁移叙事出现，改成契约不变量描述（读进来即忽略）。

### F3 去重

- 五份 `clamp` 收敛到 `src/engine/math.ts`。先修 engine 版自己的一处错：`!Number.isFinite` 把 +∞ 也打到 min，而夹取的自然语义是 +∞→max、−∞→min；守卫改成只挡 NaN，±∞ 交回比较运算：

  ```ts
  export function clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) return min
    return value < min ? min : value > max ? max : value
  }
  ```

  `text/fit.ts:79` 那份与旧 engine 版逐字相同，行为跟着变：`:185` 的 a→0 分支从「+∞→0」回到「+∞→1」，`tests/text/fit.test.ts` 复核。`config.ts:195`、`slider-field.tsx:52`、`harmony.ts:36` 三份裸版改导入（它们的 NaN 上游已挡，收敛无行为变化）。反序 min>max 五份行为一致。顺带让 `harmony.ts:34` 的 `WCAG_MIN` 导入 `text/ink.ts` 的 `WCAG_AA`，同一门槛不留两份。
- 画布工具下移：`createCanvas`/`get2d`/`releaseCanvas`/`canvasToBlob` 从 `src/export/canvas.ts` 移到 `src/lib/canvas.ts`，`engine/render.ts:120` 与 export 同时向下引用。不让 engine 反向 import export：`export/compose.ts` 已 import `@/engine/render`，反向接上就把两目录接成环，而 architecture.md 把 export 定成装配层。
- 三个「模块级状态 + localStorage」同构件（`inspector-open.ts`、`preview-height.ts`、`preview-overlays.ts`）抽 `createPersistedAtom` 收编。**`theme.ts` 排除在外**：它独有 `apply()` 写 `documentElement` 的 class 与 `meta[name=theme-color]`、挂 `matchMedia` 监听让系统换主题不经写入直接生效、`useTheme` 在同一 store 上开两条订阅且无相等短路；容纳它要给工厂开 `onChange`/`derive`/`effect` 三个口子，那是把工厂做成第二个 store，且它没有单测兜底。最小签名：

  ```ts
  interface PersistedAtomOptions<T> {
    key: string
    fallback: T
    parse: (raw: string) => T | null // null = 非法，落 fallback
    serialize: (value: T) => string
    equals: (a: T, b: T) => boolean
  }
  interface PersistedAtom<T> {
    get(): T // 必须返回模块级引用本身，不能拷贝：preview-overlays 的对象快照会让 useSyncExternalStore 无限重渲
    set(next: T): void
    subscribe(listener: () => void): () => void
    useValue(): T
  }
  export function createPersistedAtom<T>(options: PersistedAtomOptions<T>): PersistedAtom<T>
  ```

  三个模块的公开钩子形状（`{open,setOpen,toggle}`、`{height,setHeight,reset}`、`{guide,grid,setGuide,setGrid}`）留在各自文件用 `useValue()` 组。落盘读写路径的端到端兜底是 `e2e/desktop.spec.ts:434`「网格刷新仍开」与 mobile「分隔条拖拽留存」，本切片收尾加跑 `e2e`。
- 五处裸 `'#c7d2fe'` 收成 `src/engine/colors.ts` 导出的 `FALLBACK_COLOR`（那里已持有 `NEUTRAL_RAMP`，是更合适的家；放 `css-fallback.ts` 会让 `src/app/` 两个文件为一个色值向下依赖引擎兜底渲染模块）。`colors.ts:7`、`css-fallback.ts:56`、`styles.ts:82` 里的同色值是色带成员不是兜底，不收。

### F4 明确不做（避免过度工程）

- 不合并 `palettes/color.ts` 与 `text/ink.ts` 两处 WCAG 色彩数学：同名不同定义域（culori 全色彩空间 vs `#hex` 快路径），`segmented-control.test.tsx` 正是靠这个差异绿的；合并收益为零、风险非零。
- 不给 108 个无单测模块补挂载测试：五个大件的回归由 e2e 黑盒断言覆盖，jsdom 量不到 WebGL 与布局，且与 `docs/memory/owner-preferences.md` 记的姿态冲突。
- 不删 `demo/palette-27` 分支、不动 `assets/brand/` 双份入库、不碰 `sonner.tsx` 的 `next-themes`、不给 `showcase/` 与 `graphics/generated/` 补 eslint 豁免：四者都要 owner 裁决或触碰「不手改 `src/components/ui/`」的边界，留给下一轮。
- 不做滑杆标签拖拽改值（scrub）：数值框常驻已覆盖精确输入，scrub 是省掉数值框之后的补偿手段，这里没有可省的对象。
- 不改 `PERSIST_KEY`：`gradient-avatar:v3` 的 `v3` 是存档结构版本而非产品版本，本轮不动存档结构，改键名只会白白作废用户存档。

## 9. §G 验证

- 闸门五步全绿：`lint`、`format:check`、`typecheck`、`test`、`build`；界面改动加 `e2e` 与 `screenshots` 逐张目检。
- **布局验收固化成一条 e2e**，落在 `e2e/desktop.spec.ts`（desktop project 视口已是 1440×900）：断言四张节卡片的**底边**都在 900 以内、两个子列 `scrollHeight − clientHeight ≤ 0`、画框边长 ≤640；微调打开态另断言微调列溢出 ≤0。判据必须是底边或溢出量——「顶边在首屏内」对改动前那 803 px 溢出同样成立，抓不到回归。写法照抄同文件 165–186 行的 `page.evaluate` 加 `getBoundingClientRect`；`StaggerRoot` 进场动画期间 boundingBox 会漂，等一拍再量。一次性量测脚本用完即删，先变成这条 e2e 再删；八组合的量测数进 CHANGELOG 作为本轮证据。
- e2e 受影响钩子见 §C2 与 §E；`slider-number`/`slider-reset`/`slider-auto`/`brand-mono` 槽名不变。

## 10. 版本档次

**major**。触发项是 contributing.md 定版表里的「大规模重写」与「旧存档需要迁移或作废」：index.css 四套列模板、slider-field 行形态、GraphicSection 结构全部重写；F2 移除 `config.ts:293` 的 v3.1 迁移路径后，该类存档的次行字号回默认值。v4 及以后的存档全部有效，`AvatarConfig` 契约不变。

图标开关、「挑一个」按钮、配色磁贴名字、质感描述行都不是能力移除——四个动作分别由空态按钮、填充态磁贴、`title` 加 `sr-only` 加节头承接，是入口重排，单看这一项只到 minor。

## 11. 实到范围

与正文不同的地方，一次性列清，指向 CHANGELOG 的 6.0.0 段：

- **§B2 自动档的落点**：正文写 36 px 常留列。实到把自动钮放进标签那一格（`minmax(0,1fr)` 内），
  第一行 grid 变成三列 `minmax(0,1fr) 56px 20px`。效果相同（数值框位置与自动钮有无无关），
  少一列空占位，en 的 "Auto" 也不再需要为 36 px 挤字号。
- **§D2 质感格**：正文写示意 `h-10`、名字截断。实到示意 `h-9`、名字 `line-clamp-2` 最多两行：
  四格并排时一格只有六十多像素，en 的「Soft Mesh」截断成「Soft M…」，换行比截断诚实。
- **§D3 文字样式**：正文写分段控件收 11 px。实到把文字样式与字重都改成可换行的 radio chips：
  分段控件的选项等分容器宽，250–300 px 的列里「Shadow」仍会被截；chips 按内容自适应、放不下换行。
- **§E 操作条**：正文写单行五颗加长短同文。实到桌面是两行三列 grid（换一版、随机颜色和质感、微调
  在第一行，更多与导出跨两列在第二行）：预览列只有 435–522 px，单行五颗带字按钮在 1280 档必然截断，
  而预览 pane 竖向有富余，两行不挤占挑选栏高度。长短切换阈值从正文的 36rem 改 30rem，
  只有「随机颜色和质感」一颗保留长短双 span；en 全称取 Reroll / Randomize、ja 取別パターン / 全部ランダム、
  ko 取새 구성 / 색상과 질감 랜덤——正文给的 en「Shuffle colors and texture」在 131 px 的格子里放不下，
  完整语义由 hint 承担。
- **§G 之外**：`scripts/screenshots.mjs` 的固定 600 ms 等待改等幕布脱离 DOM 再等一拍。
  本轮目检时手机档截图看起来横向溢出，量 `scrollWidth` 却正常，查下来是撞进了场编排；
  截图是给人看的证据，等待条件不对就会产出假故障。经验落进 `docs/engineering-lessons.md`。
- **量测核对**：§A2 推算表八种组合与实跑逐格吻合（1280 收起 390/390/435、1440 收起 443/443/490、
  1440 打开 272/壳 614 内拆 294×2/490、1536 与 1920 收起 467/467/522、打开 272/323/323/522），
  各列溢出全部为 0。
