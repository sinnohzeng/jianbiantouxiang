# 参与开发

模块划分与数据流见 `docs/architecture.md`，这份只写约定。

## 环境

Node.js 24 以上，npm 随 Node 安装。克隆后 `npm install` 即可，构建与测试都不需要任何密钥。

```bash
git clone https://github.com/sinnohzeng/jianbiantouxiang.git
cd gradient-avatar
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
| `npm run budget` | 按 entry 加 modulepreload 的 gzip 和检查首屏 JS 预算 |
| `npm run format` | Prettier 写回 |
| `npm run format:check` | Prettier 只检查 |

提交前至少跑 `npm run lint && npm run typecheck && npm test && npm run build`，CI 跑的就是这四步。

## 目录约定

新文件按职责放进对应目录，不在 `src/` 根下堆散文件。

| 放什么 | 放哪 |
| --- | --- |
| 纯逻辑 | `src/engine/`、`src/text/`、`src/palettes/`、`src/fonts/`、`src/export/`、`src/state/` 六个库目录之一 |
| 页面结构与面板 | `src/app/` 与 `src/app/panels/` |
| shadcn 原语 | `src/components/ui/`，由 CLI 生成，不手改 |
| 跨面板复用的组合件 | `src/components/blocks/` |
| 单测 | `tests/`，目录与文件名跟 `src/` 对齐 |
| 端到端 | `e2e/`，文件名决定跑在哪一档 |

每个库目录有一个 `index.ts` 作为对外出口，跨目录引用走出口，不深挖到内部文件。

## 提交

Conventional Commits，类型用英文，描述用中文，一行说清这次做了什么。

```
feat: 配色面板支持粘贴 hex 列表
fix: 竖排文字在圆形画布上被裁掉一列
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
| minor | 新功能、新控件、新入口、契约只增不改；旧分享链接与旧存档仍然有效 |
| major | `AvatarConfig` 契约语义变更（旧分享链接失效）、移除既有功能、大规模重写 |

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
- 界面文案一律走 i18n key，源码里不出现硬编码的中文或英文文案。key 是扁平的点分命名，一级前缀就是区域，现有的是 `app`、`panel`、`style`、`preview`、`export`、`font`、`topbar`、`bottombar`、`history`、`theme`、`locale`、`common`。加 key 要同时改五份字典，少一份 typecheck 就报错。配色名与家族名不进字典，它们在 `src/palettes/palettes.ts` 里自带五语。
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
- 改默认值要同步更新 `DEFAULT_CONFIG`、对应 spec、README、architecture、CHANGELOG 和测试；还要补一条显式旧值的用例。URL hash 只编码与当前默认值的差异，省略字段的旧链接会按新默认值渲染。
- 新增 i18n key 后跑一遍 `npm test`，`tests/i18n/keys.test.ts` 会扫源码核对五份字典。

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

需要多文件改动的新功能先写规约再写计划再动手，一句话能描述的改动直接做。
