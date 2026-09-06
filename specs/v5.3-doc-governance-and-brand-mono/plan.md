# 文档治理与品牌单色 v5.3 计划（怎么造）

对应 `spec.md`。每个切片独立过闸门、独立提交；主会话做 git 与目检，子智能体不做 git 操作、不读 `.env.local`。

顺序：D → B → A → C → 收尾。先做代码再做文档，文档才写得到最终态；C 依赖 A 的归位结果。

分工按仓内约定：实现切片交给 Opus 5，文档整理与记忆重组交给 Sonnet 5。

## 切片 D：品牌单色（Opus 5）

1. `src/state/config.ts`：`layout.icon` 加 `mono: boolean`，默认 `false`；`normalizeConfig` 给旧存档补 `false`。契约版本不升。
2. `src/graphics/draw.ts`：`kind: 'image'` 分支在 `mono` 为真时走离屏画布，`drawImage` 后 `globalCompositeOperation = 'source-in'` 填 `color`，再贴回主画布。离屏画布按 `rect` 尺寸建，不缓存。
3. `src/graphics/brand.ts` 与 `source.ts`：`mono` 为真且 `entry.white` 存在时取官方单色稿，否则取原色稿交给绘制期压平。
4. `src/app/workspace/sections/GraphicSection.tsx`：“更换”旁加分段控件，`data-slot="brand-mono"`，两格原色 / 单色，仅 `icon.source === 'brand'` 时渲染。
5. `src/app/panels/IconPicker.tsx`：局部 `brandVariant` state 删除，改读写 `config.layout.icon.mono`；`brandFileOf` 随之简化。
6. i18n：`icon.brand.variant.white` 改名 `icon.brand.variant.mono`，文案“单白”改“单色”；新增 `panel.graphic.mono`。五份字典与 `keys.md` 同步。
7. 测试：`tests/graphics/draw.test.ts` 补有官方稿与无官方稿两条着色路径；`tests/state/config.test.ts` 补旧存档补 `mono`；`tests/app/workspace.smoke.test.tsx` 补切换只在品牌来源时出现；e2e 桌面补一条按 spec §8。

## 切片 B：CI/CD（Opus 5）

1. `e2e/helpers.ts`：`PROBE_TIMEOUT_MS` 保持 60 秒作断言预算；新增 `PROBE_TEST_TIMEOUT_MS` 与 `POLL_TIMEOUT_MS`，两者按 `process.env.CI` 取本机档或 CI 档（CI 档乘 3）。
2. `e2e/*.spec.ts`：六处 `test.setTimeout(PROBE_TIMEOUT_MS)` 换成 `PROBE_TEST_TIMEOUT_MS`；五处 `timeout: 5000` 换成 `POLL_TIMEOUT_MS`。用例里不留裸数字。
3. `playwright.config.ts`：过期注释按 2048² 现状改写；`workers: process.env.CI ? 2 : undefined`。
4. `package.json`：`test` 去掉 `--passWithNoTests`。
5. `.github/workflows/ci.yml`：check job 的 lint 之后加 `npm run format:check`；e2e job 末尾加 `actions/upload-artifact@v5`，`if: failure()`，收 `playwright-report/` 与 `test-results/`。
6. `tests/build/redirects.test.ts` 新建：读 `public/_redirects`，断言无指向 `.html` 的 200 重写。
7. `tests/about/support.test.ts` 新建：`hasSupport()` 全空与部分填的分支，加渲染分支的 jsdom 用例。
8. `tests/app/sw-update.test.ts` 新建：轮询间隔、`visibilitychange` 与 `focus` 复查、`onNeedRefresh` 分支。

## 切片 A：文档漂移清零（Sonnet 5，两个智能体分文件，不重叠）

A-1 负责 `README.md` 与 `docs/architecture.md`；A-2 负责 `docs/contributing.md`、`AGENTS.md`、`docs/adr/`。

按 spec §3 的表逐行改。三条硬要求：

- 首屏体积只在 `docs/architecture.md` 留一处定义，README 与记忆改指针，数字不复述。
- 常驻文档里的变更叙事全部删掉（architecture 三处、README 一处），不改写成别的说法。
- 新建 `docs/adr/0006-multi-page-and-pages-routing.md`，含被否决的 `/about` 200 重写方案与否决理由。

## 切片 C：记忆与规约治理（Sonnet 5）

1. `docs/memory/` 按 spec §C3 重组成 `decisions-and-conventions.md`、`owner-preferences.md` 与索引 `MEMORY.md`，删掉两份版本切分文件。原内容逐条过 §C2 四问，过滤掉的进常驻文档或丢弃。合计不超过 120 行。
2. `specs/v5.0-workspace/spec.md` 尾部补“实到范围”一节，列 spec §3 A5 的六处差异并指向 CHANGELOG 的 5.0.0 段；头部状态行改成已封存。`plan.md` 头部同改。
3. `docs/contributing.md` 补一节“文档与记忆的分层”，把 §C1 三层表、§C2 四问与 §C4 规约口径写进去；`AGENTS.md` 留一行指针，不复述。
4. 本轮 spec 头部状态行同步。

## 切片 E：收尾（主会话）

- `CHANGELOG.md` 加 5.3.0 段，四个 §各一组条目；`package.json` 升 5.3.0。
- 本 spec 尾部补“实到范围”并封存。
- 闸门全绿后 commit 加 push，确认 main 的 CI 转绿，再打 tag。

## 风险与对策

- D 的离屏画布在导出 8192 时按 `rect` 尺寸建，图标只占画面一小块，开销可控；真要出问题会体现在导出耗时上，收尾时用探针复测一次。
- D 改了 `icon.mono` 的读写位置，IconPicker 与 GraphicSection 两处读同一份状态，注意撤销栈只应入栈一次。
- B 调大 CI 超时会让红的时候更慢才红。对策是同时上传报告制品，红了能直接看，不靠重跑。
- A 的两个智能体分文件不重叠，但 architecture 与 contributing 有互相指向的段落，收尾时主会话统一核一遍指针。
- C 删记忆文件有信息丢失风险。对策是过滤掉的内容必须先落到常驻文档或确认在 CHANGELOG 里已有，才允许删。
