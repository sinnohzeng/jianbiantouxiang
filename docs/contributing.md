# 参与开发

模块划分与数据流见 `docs/architecture.md`，这份只写约定。

## 环境

Node.js 24 以上，npm 随 Node 安装。克隆后 `npm install` 即可，构建与测试都不需要任何密钥。

```bash
git clone https://github.com/sinnohzeng/jianbiantouxiang.git
cd jianbiantouxiang
npm install
npm run dev
```

## 命令

| 命令 | 做什么 |
| --- | --- |
| `npm run dev` | 开发服务器，<http://localhost:5173> |
| `npm run build` | 先 `tsc -b` 再 `vite build`，产物在 `dist/` |
| `npm run preview` | 预览构建产物，端到端与截图脚本都打这个地址 |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm test` | Vitest 单跑一遍 |
| `npm run test:watch` | Vitest 监听模式 |
| `npm run e2e` | Playwright，桌面 1440 与 iPhone 15 两组 |
| `npm run screenshots` | 三个设备各截深浅两套主题到 `.screenshots/` |
| `npm run gen:icons` | 从 lucide-react 重建内置图标索引 |
| `npm run gen:emoji` | 从 emojibase-data 重建五语 emoji 索引 |
| `npm run gen:app-icons` | 用本机 chromium 把 SVG 应用图标位图化成三张 PNG |
| `npm run gen:brand` | 按 `scripts/brand-list.json` 拉取或拷贝品牌图形，重建 `src/graphics/generated/brand-index.ts` |
| `npm run samples` | 重生成 README 的样张到 `docs/assets/samples/` |
| `npm run budget` | 按 entry 加 modulepreload 的 gzip 和报一次首屏 JS 体积，只作参考 |
| `npm run format` | Prettier 写回 |
| `npm run format:check` | Prettier 只检查 |

提交前至少跑 `npm run lint && npm run format:check && npm run typecheck && npm test && npm run build`，CI 的 check job 跑的就是这五步；e2e job 只在 main 分支的 push 与手动触发时跑，失败会把 `playwright-report/` 与 `test-results/` 上传成制品，不用只靠日志猜。

## 目录约定

新文件按职责放进对应目录，不在 `src/` 根下堆散文件。

| 放什么 | 放哪 |
| --- | --- |
| 纯逻辑 | `src/engine/`、`src/text/`、`src/palettes/`、`src/fonts/`、`src/export/`、`src/state/`、`src/graphics/` 七个库目录之一 |
| 工具本体的页面结构、面板与工作台分区 | `src/app/`、`src/app/panels/`、`src/app/workspace/` |
| 首屏演示动效 | `src/app/showcase/` 与 `src/components/showcase/` |
| 关于页 | `src/about/`，纯静态入口，不挂 React 树，样式复用 `src/index.css` |
| shadcn 原语 | `src/components/ui/`，由 CLI 生成，不手改 |
| 跨面板复用的组合件 | `src/components/blocks/` |
| 单测 | `tests/`，目录与文件名跟 `src/` 对齐 |
| 端到端 | `e2e/`，文件名决定跑在哪一档 |

七个库目录里只有 `src/fonts/` 保留 `index.ts` 出口（`src/App.tsx` 在用），其余六个目录与 `src/graphics/` 一样没有出口文件，跨目录按需直接引用内部模块（如 `@/graphics/draw`、`@/engine/math`、`@/palettes/color`）。桶文件会把整目录的符号拖进引用方的依赖图，懒加载边界因此变糊。

## 提交

Conventional Commits，类型用英文，描述用中文，一行说清这次做了什么。

```
feat: 配色面板支持粘贴 hex 列表
fix: 第一行补偿在自动字号下不再牵动第二行
docs: 补齐字体加载链的说明
```

常用类型：`feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`chore`、`build`、`ci`。

提交信息不带任何署名或协作者尾注。

## 定版与标签

每轮改动收尾时自动定版、自动打标签并推送，不需要人来手动打。

站点托管在 Cloudflare Pages，main 分支 **Push 即部署**：推送一到远端，线上同步更新。
所以改完必须 commit 加 push 一条龙；只 commit 不 push 等于没上线，不算收尾。
代理或智能体代改时同样适用：本轮最后一个动作是把提交与标签推到 origin。

档次看这轮的用户可见面：

| 档次 | 触发条件 |
| --- | --- |
| patch | 修复、文案与 i18n 调整、格式、文档与规约、依赖更新；没有新增用户可见行为 |
| minor | 新功能、新控件、新入口、契约只增不改；旧存档仍然有效 |
| major | `AvatarConfig` 契约语义变更（旧存档需要迁移或作废）、移除既有功能、大规模重写 |

流程：

1. 收尾时按上表定档，同轮更新 `package.json` 的 `version` 与 CHANGELOG 最新条目。
2. 提交按逻辑分批，推送。
3. 在本轮最后一个提交上 `git tag -a v<semver>`，注解用 CHANGELOG 该轮的一句话摘要，标签同轮推送。
4. 纯规约或文档提交不单独触发新版本，随当前轮的标签一起走。
5. 档次有边界争议时按表裁决，并在收尾汇报里说明依据，不把选号的问题抛给人。

历史标签补打前先核对提交内容，别只按日期猜。

## 代码约定

- TypeScript strict，另开 `noUncheckedIndexedAccess`。取数组元素与可选字段要显式处理 `undefined`，不用非空断言绕过。
- 模块内引用用相对路径，跨目录一律用 `@/` 别名，不写 `../../`。
- 格式交给 Prettier：单引号、不加分号、行宽 100、尾随逗号。`src/components/ui`、`docs/`、`specs/` 与根目录的长文档都在 `.prettierignore` 里，改这些文件不必也不要跑格式化。
- 新组件按这个顺序找：先看 `src/components/ui/` 的 shadcn 原语够不够用，不够就去付费 registry 找可借鉴的范式并按本仓需要改造，都不合适才自己写。`src/components/blocks/` 里的件都在文件头注明了范式来源。
- 界面文案一律走 i18n key，源码里不出现硬编码的中文或英文文案。key 是扁平的点分命名，一级前缀就是区域，现有的是 `about`、`app`、`bottombar`、`common`、`export`、`font`、`history`、`icon`、`locale`、`panel`、`preview`、`reset`、`style`、`theme`、`topbar`、`update`。加 key 要同时改五份字典，少一份 typecheck 就报错。配色名不进字典，它在 `src/palettes/palettes.ts` 里自带五语。
- 触控目标不小于 44 px，输入类控件字号不小于 16 px，后者是为了避开 iOS 聚焦时的自动缩放。
- 装饰性动画要读 `prefers-reduced-motion`。用 `usePrefersReducedMotion()` 或 CSS 媒体查询，做法是把时长归零而不是移除元素，布局才不会跟着跳。

## 付费 registry

`components.json` 启用了 `@shadcnblocks`、`@reactbits-starter`、`@reactbits-pro` 三个付费 registry。装进来的件就是仓库里的普通源码，CI 与 Cloudflare 构建都不需要密钥；只有再从 registry 拉新件时才要密钥。

用项目里的 CLI，不要用 npx：

```bash
./node_modules/.bin/shadcn add @reactbits-pro/mobile-4
```

`npx shadcn` 会把本机 `~/.npmrc` 的 `allow-scripts` 以环境变量传给子进程，项目级 `npm install` 不接受这个选项，直接报错。走 devDependencies 里的那份还顺带锁住了 CLI 版本。

密钥只放 `.env.local`，它已在 `.gitignore` 里。不要把密钥写进 `components.json`、命令行历史或任何提交。

已经 `view` 过源码的候选件与它们的可借鉴之处记在 `docs/engineering-lessons.md`，动手前先翻一遍，省一轮枚举。

## 测试

- 新增或改动纯逻辑要带 Vitest 用例，放进 `tests/` 下的同名目录。合成、编码、字体加载这类有外部依赖的模块把依赖抽成参数，用例不必拉起 WebGL 与网络。
- 改动界面要跑 `npm run e2e`，再跑 `npm run screenshots` 并逐张看图。截图脚本打的是 `npm run preview` 的地址，先构建再截。
- 端到端断言画面走 `window.__gradientAvatarProbe`，它只在开发模式或 URL 带 `?probe=1` 时装。要断言导出产物就用探针的 `encode()`，不要去猜下载文件的落点。
- 改默认值要同步更新 `DEFAULT_CONFIG`、对应 spec、README、architecture、CHANGELOG 和测试；还要补一条显式旧值的用例。存档缺字段时由 `normalizeConfig` 补当前默认值。
- 端到端或截图要喂任意配置时，配置不进 URL，用 `page.addInitScript` 往 localStorage 的 `gradient-avatar:v3` 写一份 `{ v: 3, config }` 再打开页面；应用只在模块初始化时读一次存档。
- 新增 i18n key 后跑一遍 `npm test`，`tests/i18n/keys.test.ts` 会扫源码核对五份字典。

## 智能体协作

- 本仓是轻量级项目。用智能体做核查、对抗检验、评审或验收时，每轮合计不超过 5 个；一遍单人评审只报闸门抓不到的问题，不做多轮反驳投票。用量优先留给设计与取舍，实现切片与机械改动交给 Opus 5 子智能体。
- 子智能体不做 git 操作、不读 `.env.local`；提交与推送由主会话在闸门全绿后执行。

## 文档

| 写什么 | 写哪 |
| --- | --- |
| 现状：模块、数据流、约定、边界 | `README.md`、`docs/architecture.md`、这份文件 |
| 变更叙事：这个版本加了什么、改了什么、去掉了什么 | `CHANGELOG.md` |
| 决策：为什么选这条路线，否决了什么 | `docs/adr/` |
| 踩坑：非显然的失败与它的判据 | `docs/engineering-lessons.md` |
| 规约与实施计划：造什么、怎么造 | `specs/<feature>/` |
| 调研：外部事实与出处 | `docs/research/` |
| 审计：某轮发现、证据与落地去向 | `docs/audits/`，按日期命名，只记当轮发现，不记现状 |
| 交接：跨会话继续未完工作 | `docs/handoff/`，按特性命名；接手会话完成后更新或删除 |
| 项目记忆：跨会话维护口径 | `docs/memory/` |

常驻文档只写现状。不要在 `README.md` 或 `architecture.md` 里写“本次改了什么”“相比上一版”，那些进 `CHANGELOG.md`。

### 分层与记忆准入

上面九行按半衰期归到三层：

| 层 | 落点 | 写什么 | 谁读 |
| --- | --- | --- | --- |
| 常驻文档 | `README.md`、`docs/architecture.md`、`docs/contributing.md`、`AGENTS.md` | 现状。同一事实只定义一次，别处给指针 | 人与智能体，每次 |
| 冻结快照 | `specs/<version>/`、`docs/adr/`、`CHANGELOG.md` | 当时为什么这么定、否决了什么、改了什么；写完封存不回写 | 按需 |
| 项目记忆 | `docs/memory/` | 前两层都推不出来的当前事实 | 按需，索引常驻 |

一条事实要不要写进 `docs/memory/`，过四问，全过才准入：

1. 能从代码或配置读出来吗？能，就不进。
2. 能从 `git log` 或 `CHANGELOG.md` 读出来吗？能，就不进。
3. 属于“现状”吗？属于，就进常驻文档，记忆最多留一行指针。
4. 是踩过的坑吗？是，就进 `docs/engineering-lessons.md`，那里才是教训的 SSOT。

四问都不命中的才是记忆该收的：owner 的偏好与授权、协作口径、外部约束，以及跨会话才用得上而代码里看不出来的约定。

规约与计划是当轮意图快照，实现开始后不再回写正文：需求或设计变了就在新一轮规约里重写，不追溯改旧规约。
每轮收尾时在 `spec.md` 尾部补一节“实到范围”，把与正文不同的地方一次性列清并指向 `CHANGELOG.md` 对应版本段，
再把头部状态行改成已封存。

需要多文件改动的新功能先写规约再写计划再动手，一句话能描述的改动直接做。
