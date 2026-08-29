# 用途模板与图形 v3.1 计划（怎么造）

对应规约 `spec.md`。原计划四个阶段，**实际停在阶段一与阶段三的状态徽章部分**。

## 落地范围

| 阶段 | 内容 | 结果 |
| ---- | ---- | ---- |
| 一 | 契约与排版内核 | 已落地，只保留 `text` 与 `status` 两种用途 |
| 二 | 图形来源（lucide、emoji、上传） | 未做，推迟到 v3.2 |
| 三 | 界面：用途分段控件、两输入框、次行字号滑杆、五语字典 | 已落地 |
| 三 | 界面：图形选择区与 IconPicker | 未做，推迟到 v3.2 |
| 四 | 预览与导出对齐、e2e、截图、文档 | 已落地状态徽章那部分 |

停在这里是取舍不是烂尾：图标徽章只落排版内核会在主干留下一块画不出东西的预留区，
所以连同 `LayoutKind` 的 `logo` 取值一起收回规约。下面阶段二与阶段三后半段的设计原样保留，
v3.2 直接照着做，不必重新推导。

## 一处非本计划内的修复

阶段一给 `LayoutLine` 加了 `font` 字段，但 `drawText` 从头到尾只设一次 `ctx.font = layout.font`，
那个字段没人读，次行是按首行字号画的，实际画面里直接冲出画布。单测没抓到，因为它断言的是
排版产物里字段的值，不是「这个字段真的被用来落笔了」。修法是把 `drawText` 改成按字号分段落笔：
相邻同字体的行并成一段，每段各设 `ctx.font` 与字距，描边、光晕、阴影的尺度也按各段自己的字号算。
新增断言盯的是落笔当时的 `ctx.font`，不再是排版产物。

## 0. 共享契约

下面这份是 v3.2 的目标形态。**本版实到的是它的子集**：`LayoutKind` 只有 `text` 与 `status`，
`layout` 只有 `kind` 与 `scale`，`IconSource`、`graphic`、`icon` 都不在主干。

```ts
// src/state/config.ts
export type LayoutKind = 'text' | 'status' | 'logo'
export type IconSource = 'none' | 'builtin' | 'emoji' | 'upload'

interface AvatarConfig {
  // ...v3 既有字段不动
  layout: {
    kind: LayoutKind
    /** 状态徽章：次行相对首行的字号比例 */
    scale: number // 0.2..0.8，默认 0.42
    /** 图标徽章：图形占安全框高度的比例 */
    graphic: number // 0.3..0.8，默认 0.52
    icon: {
      source: IconSource
      /** builtin 是 lucide 名，emoji 是不带 FE0F 的码点串，upload 是本次会话的 id */
      id: string
    }
  }
}
```

`normalizeConfig` 给 `layout` 全套缺省，旧配置与旧分享链接缺这一整棵子树时落到纯文字用途。`upload` 来源不进 hash，编码时降级成 `none`。

图形的取用统一走一个接口，三种来源各自实现，调用方不认识来源：

```ts
// src/graphics/source.ts
export interface Graphic {
  /** 已经能直接 drawImage 的位图或图片元素 */
  image: CanvasImageSource
  width: number
  height: number
  /** 单色图形跟随文字色重上色，彩色图形原样画 */
  monochrome: boolean
}
export function loadGraphic(icon: AvatarConfig['layout']['icon'], color: string): Promise<Graphic | null>
```

## 1. 目录

```
build/
  icon-index.ts          # 构建期从 lucide-react 抽 __iconNode，出全库索引
  emoji-index.ts         # 构建期从 emojibase-data 抽五语索引
src/graphics/
  source.ts              # loadGraphic 分派
  lucide.ts              # 内置图标：path data 转 Path2D，按文字色填充
  emoji.ts               # 按码点取 Noto Emoji SVG，带内存缓存与失败兜底
  upload.ts              # 上传消毒与本次会话注册表
  curated.ts             # 约 160 个精选图标的中英文关键词与类目
src/text/
  fit.ts                 # 加 fitStatus：状态徽章的两块堆叠求解
  layout.ts              # 按 layout.kind 分派，加 layoutStatus 与 layoutBadge
src/app/panels/
  TextPanel.tsx          # 顶部加用途分段控件，status 下换成两个输入框
  IconPicker.tsx         # 图形与 emoji 选择器，懒加载
```

## 2. 阶段

状态与徽章的求解、落位不另开文件。它们共用 `composeBlock`、二分上下限、`placeBlock` 与 `pillOf`，
拆出去要把这些内部件全导出，为一张目录草图换来更宽的公开面。两个文件都在三五百行，先不拆。

**阶段一：契约与排版内核。** `config.ts` 加 `layout` 与 normalize；`fit.ts`、`layout.ts` 按 kind 分派；新增 `status.ts` 与 `badge.ts`。图形在这一阶段用一个假的固定尺寸方块占位，不碰网络。单测覆盖：三种 kind 的块尺寸与安全框贴合、`scale` 与 `graphic` 的边界值、缺 `layout` 的旧配置、旧 hash 解码。

**阶段二：图形来源。** `src/graphics/` 四个文件加 `build/` 两个索引脚本。lucide 走 `Path2D` 按文字色填充，emoji 与上传走 `Image`。emoji 与索引都要内存缓存加失败兜底，断网时图形位留空而不是整张图画不出来。单测覆盖：SVG 消毒（`script`、`on*`、外部引用）、emoji 文件名推导（去 `FE0F`、ZWJ 序列）、索引生成的产物结构。

### 2.1 阶段二的产物约定

索引**生成一次、产物入库**，不在 `npm run build` 里现算。

```
scripts/gen-icon-index.ts      # npm run gen:icons，读 node_modules/lucide-react/dist/esm/icons/*.mjs
scripts/gen-emoji-index.ts     # npm run gen:emoji，取 jsDelivr 上的 emojibase-data，不装依赖
build/icon-index.ts            # 纯转换：__iconNode 形状转索引条目，IO 由 scripts 注入
build/emoji-index.ts           # 纯转换：emojibase 条目转索引条目
src/graphics/generated/        # 产物，文件头写明由哪条命令生成，不手改
  lucide-curated.ts            # 精选约 160 个，带 path data，随 IconPicker 一起加载
  lucide-full.ts               # 全库 path data，只在搜索超出精选时才拉，单独一个 chunk
  emoji-base.ts                # 码点、分组、顺序，五种语言共用
  emoji-labels.<locale>.ts     # 每种语言的名称与关键词，只加载当前语言那一份
```

Node 26 原生剥类型，生成脚本直接写 `.ts` 用 `node` 跑，不加构建步骤。
`build/` 下两个模块沿用 `build/pwa-manifest.ts` 的写法：只做纯转换、不碰 node API，
读写文件留在 `scripts/`，转换那一层因此可以直接进单测。

emojibase-data 解包 50 MB，不进 devDependencies；生成脚本按需从 CDN 取，
产物入库之后日常开发与 CI 都不碰网络。

**阶段三：界面。** `TextPanel` 的用途分段控件与两输入框；`IconPicker` 对话框加搜索，手机端底部抽屉；`logo` 用途下的图形缩略图、换图按钮、比例滑杆；五份字典新增 key 与 `keys.md` 同步。`status` 用途下隐藏锚点、对齐、竖排、自动换行四个控件。

**阶段四：收尾。** 预览与导出两条路径对齐；懒加载分块（图形索引、emoji 索引、`IconPicker` 各自成 chunk）；e2e 补三条（状态徽章导出、图标徽章导出、旧链接仍是纯文字用途）；截图核查桌面与 iPhone SE 两档；文档与 CHANGELOG。

## 3. 智能体分派

阶段一由主会话自己做，它定契约，不并行。阶段二与阶段三各派两个，一批不超过四个：

| 智能体 | 范围 |
| ------ | ---- |
| A | `build/icon-index.ts` 与 `src/graphics/lucide.ts` 加 `curated.ts` |
| B | `build/emoji-index.ts` 与 `src/graphics/emoji.ts` 加 `upload.ts` |
| C | `TextPanel` 改造与五份字典 |
| D | `IconPicker` 与手机端抽屉 |

阶段四由主会话自己收。所有子智能体不做 git 操作、不读 `.env.local`、输出不含密钥。

## 4. 验证

```bash
npm run lint && npm run typecheck && npm test && npm run build
npm run e2e
npm run screenshots   # 之后用 Read 逐张看
```

首屏 JS 不超过 160 KB gzip，图形与 emoji 索引、`IconPicker` 都不得进首屏 chunk。

## 5. 风险

- **图形索引把包撑大。** lucide 全库 1791 个图标的 path data 约 360 KB 原始。对策是精选进主索引、全库单独一个 chunk，只有搜索超出精选范围时才拉。构建后核对 chunk 清单，超了就砍全库。
- **emoji 依赖 jsDelivr。** 断网或 CDN 挂掉时图形位留空并提示，不影响其余部分出图。已有字体那条链的镜像经验可以照搬。
- **状态徽章的自动填满有两个自由度。** 首行字号与 `scale` 联动，二分要固定 `scale` 只搜首行字号，否则解不唯一。
- **上传 SVG 的消毒。** 只保留白名单元素与属性，不做黑名单。消毒后仍失败的直接拒绝，不猜。
