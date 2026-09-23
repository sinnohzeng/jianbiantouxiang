/**
 * 桌面 1440 冒烟，对应 plan §2 阶段 4.4。
 * 只跑 desktop project，分派见 playwright.config.ts 的 testMatch。
 */

import { expect, test, type Page } from '@playwright/test'
import {
  APP_URL,
  POLL_TIMEOUT_MS,
  PREVIEW_SUBSET_FIXTURE,
  PROBE_TEST_TIMEOUT_MS,
  PROBE_TIMEOUT_MS,
  SETTLE_TIMEOUT_MS,
  openApp,
  openGroup,
  probeConfig,
  probeEncode,
  probeFlush,
  probeStats,
  waitReady,
  type ProbeConfig,
} from './helpers'

test('预览挂着 WebGL 画布，合成结果不是一张平色', async ({ page }) => {
  await openApp(page)

  const canvas = page.locator('[data-slot="preview-shader"] canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()

  const stats = await probeStats(page)
  // 默认是方形，四角不应再被遮罩清成透明
  expect(stats.opaque).toBe(stats.width * stats.height)
  // 平色的话去重后只有一两个值，这里要的是真渐变
  expect(stats.colors).toBeGreaterThan(16)
})

test('点导出能出 JPG，非空且不超过 1 MB', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()

  // 连点防护：点击后按钮立即禁用，loading 至少 600ms 可见
  await expect(page.locator('[data-slot="export-action"]')).toBeDisabled()

  const file = await download
  // v4.0 起文件名带秒级时间戳：`文字_宽x高_YYYYMMDD-HHmmss.jpg`
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  // 体积与类型按探针的结果断言：它走的是导出同一条 composeAvatar + encodeCanvas
  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(encoded.hitTarget).toBe(true)

  // 导出后历史条应该拿到一张真实缩略图，而不是只靠配色近似。
  // v5 起它收在顶栏「最近生成」的浮层里，跟撤销重做放一起
  await page.locator('[data-slot="history-menu"]').click()
  await expect(page.locator('[data-slot="history-strip"] img')).toBeVisible({
    timeout: PROBE_TIMEOUT_MS,
  })
})

test('导出抽屉能把 PNG 复制到剪贴板', async ({ context, page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openApp(page)

  await page.locator('[data-slot="export-options"]').click()
  await page.locator('[data-slot="export-copy"]').click()

  await expect(page.locator('[data-slot="export-notice"]')).toHaveText('图片已复制', {
    timeout: PROBE_TIMEOUT_MS,
  })
  const copied = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read()
    if (!item || !item.types.includes('image/png')) return false
    const blob = await item.getType('image/png')
    return blob.size > 0
  })
  expect(copied).toBe(true)
})

test('改文字后刷新页面，文字从本机存档恢复，地址栏不带配置', async ({ page }) => {
  await openApp(page)

  await page.locator('#avatar-text-first').fill('存档往返')
  // 存档是防抖写入，刷新前让探针立刻落盘
  await probeFlush(page)
  expect(await page.evaluate(() => window.location.hash)).toBe('')

  await page.reload()
  await expect(page.locator('#avatar-text-first')).toHaveValue('存档往返')
})

test('改文字后可以用键盘撤销与重做', async ({ page }) => {
  await openApp(page)

  const firstLine = page.locator('#avatar-text-first')
  await firstLine.fill('撤销往返')
  await page.getByRole('heading', { level: 1 }).click()
  await page.keyboard.press('ControlOrMeta+z')
  await expect(firstLine).toHaveValue('飞书')
  await expect(page.locator('#avatar-text-second')).toHaveValue('效率先锋')

  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(firstLine).toHaveValue('撤销往返')
})

test('切换语言后 html[lang] 与标题都跟着变', async ({ page }) => {
  await openApp(page)
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
  await expect(page).toHaveTitle(/渐变头像/)

  await page.locator('[data-slot="language-menu"]').click()
  await page.getByRole('menuitem', { name: '日本語' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  // ja 字典是单独一份 chunk，标题要等它落地才变，toHaveTitle 自带重试
  await expect(page).toHaveTitle(/グラデーションアバター/)
})

test('不带 probe 参数时不挂探针', async ({ page }) => {
  await page.goto(APP_URL.replace('probe=1&', ''))
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const installed = await page.evaluate(
    () => '__gradientAvatarProbe' in (globalThis as Record<string, unknown>),
  )
  expect(installed).toBe(false)
})

test('双列工作台：文字图标一列、配色质感一列', async ({ page }) => {
  await openApp(page)

  // v5 起页签与手风琴全部取消，两列挑选栏与操作条一屏之内都在
  await expect(page.locator('[role="tablist"]')).toHaveCount(0)
  await expect(page.locator('[data-slot="pick-column"]')).toBeVisible()
  await expect(page.locator('[data-slot="pick-column-color"]')).toBeVisible()
  await expect(page.locator('[data-slot="bottom-bar"]')).toBeVisible()

  // 挑选栏里每一行滑杆都有常驻数字框，数量一致。折叠组默认收起，这里数的是常显那几条
  const sliders = await page.locator('[data-slot="pick-columns"] input[type="range"]').count()
  expect(sliders).toBeGreaterThan(1)
  await expect(page.locator('[data-slot="pick-columns"] [data-slot="slider-number"]')).toHaveCount(
    sliders,
  )
})

test('主预览区不出现滚动条', async ({ page }) => {
  await openApp(page)

  // 画框连同上下留白必须落在预览区之内；画框底下那团光晕与投影是装饰层，
  // 探出的部分由工作台外壳兜住，画框自身仍在预览区内，
  // 所以断言看的是画框的位置与外壳滚不滚，不是 scrollHeight，那一项会把光晕算进去
  const view = await page.evaluate(() => {
    const shell = document.querySelector('[data-slot="workspace"]')
    const node = document.querySelector('[data-slot="preview-pane"]')
    const frame = node?.querySelector('[role="img"]')
    if (!shell || !node || !frame) return null
    const box = node.getBoundingClientRect()
    const art = frame.getBoundingClientRect()
    return {
      shellOverflowY: getComputedStyle(shell).overflowY,
      inside: art.top >= box.top - 1 && art.bottom <= box.bottom + 1,
    }
  })
  expect(view).not.toBeNull()
  expect(view!.shellOverflowY).toBe('hidden')
  expect(view!.inside).toBe(true)
})

test('桌面首屏放得下四节内容', async ({ page }) => {
  await openApp(page)
  // 进场编排期间卡片还在上浮，boundingBox 会漂，等一拍再量
  await page.waitForTimeout(SETTLE_TIMEOUT_MS)

  // 判据是底边与溢出量：「顶边在首屏内」对溢出八百像素的旧布局同样成立，抓不到回归
  const closed = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-slot="pick-columns"] section')]
    const columns = [
      ...document.querySelectorAll('[data-slot="pick-column"], [data-slot="pick-column-color"]'),
    ]
    const frame = document.querySelector('[data-slot="preview-pane"] [role="img"]')
    return {
      cardBottoms: cards.map((node) => Math.round(node.getBoundingClientRect().bottom)),
      overflows: columns.map((node) => node.scrollHeight - node.clientHeight),
      frameEdge: frame ? Math.round(frame.getBoundingClientRect().width) : null,
      viewport: window.innerHeight,
    }
  })
  expect(closed.cardBottoms).toHaveLength(4)
  for (const bottom of closed.cardBottoms) {
    expect(bottom).toBeLessThanOrEqual(closed.viewport)
  }
  for (const overflow of closed.overflows) {
    expect(overflow).toBeLessThanOrEqual(0)
  }
  expect(closed.frameEdge).not.toBeNull()
  expect(closed.frameEdge!).toBeLessThanOrEqual(641)
})

test('版面组：改过的边距出现重置钮，点一下回默认', async ({ page }) => {
  await openApp(page)
  await openGroup(page, 'text-group-layout')

  const padding = page.getByRole('slider', { name: '边距' })
  await expect(padding).toHaveValue('0.15')
  await padding.focus()
  await page.keyboard.press('ArrowRight')
  await expect(padding).toHaveValue('0.155')

  const reset = page.locator('[data-slot="text-group-layout"] [data-slot="slider-reset"]')
  await expect(reset).toHaveCount(1)
  await reset.click()
  await expect(padding).toHaveValue('0.15')
  await expect(
    page.locator('[data-slot="text-group-layout"] [data-slot="slider-reset"]'),
  ).toHaveCount(0)
})

test('位置微调组能拖垂直补偿，配置里落第一行的 offsetY', async ({ page }) => {
  await openApp(page)
  await openGroup(page, 'text-group-offset')

  const vertical = page.getByRole('slider', { name: '第 1 行垂直' })
  await expect(vertical).toHaveValue('0')
  await vertical.focus()
  await page.keyboard.press('ArrowRight')
  await expect(vertical).toHaveValue('0.0025')

  expect((await probeConfig(page)).typography.line1.offsetY).not.toBe(0)
})

test('第二行字体：选择器贴在按钮下方且不盖遮罩，字重下拉改第二行，跟随钮回到第一行', async ({
  page,
}) => {
  await openApp(page)
  const field = page.locator('[data-slot="text-line2-font"]')
  const trigger = field.locator('[data-slot="font-trigger"]')

  await trigger.click()
  const popover = page.locator('[data-slot="popover-content"]')
  await expect(popover.locator('[data-slot="command-input"]')).toBeVisible()
  // 进场带缩放与位移，等动画放完再量
  await popover.evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished)))
  const [anchor, panel] = await Promise.all([trigger.boundingBox(), popover.boundingBox()])
  expect(panel!.y).toBeGreaterThanOrEqual(anchor!.y + anchor!.height - 0.5)
  expect(Math.abs(panel!.x - anchor!.x)).toBeLessThanOrEqual(1)
  await expect(
    page.locator('[data-slot$="-overlay"], div[role="presentation"][data-base-ui-inert]'),
  ).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(popover).toHaveCount(0)

  await page.getByRole('combobox', { name: '第二行字重' }).click()
  await page.getByRole('option', { name: /常规/ }).click()
  await expect
    .poll(async () => (await probeConfig(page)).typography.line2.font?.weight, {
      timeout: POLL_TIMEOUT_MS,
    })
    .toBe(400)

  const follow = field.locator('[data-slot="font-follow"]')
  await expect(follow).toHaveAttribute('aria-pressed', 'false')
  await follow.click()
  await expect(follow).toHaveAttribute('aria-pressed', 'true')
  expect((await probeConfig(page)).typography.line2.font).toBeNull()
})

test.describe('字体名预览', () => {
  // Service Worker 截走的请求 page.route 拦不到
  test.use({ serviceWorkers: 'block' })

  const SUBSET_URL = 'https://fonts.gstatic.com/l/preview-test.woff2'

  test('选择器的行滚进视口后用自己的字体写名字，关掉再打开照样换', async ({ page }) => {
    // 预览子集请求一律回同一份夹具，记下每次请求的显示名
    const requested: string[] = []
    await page.route(
      (url) => url.hostname === 'fonts.googleapis.com' && url.searchParams.has('text'),
      (route) => {
        requested.push(new URL(route.request().url()).searchParams.get('text') ?? '')
        return route.fulfill({
          contentType: 'text/css',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 400; src: url(${SUBSET_URL}) format('woff2'); }`,
        })
      },
    )
    await page.route(SUBSET_URL, (route) =>
      route.fulfill({
        path: PREVIEW_SUBSET_FIXTURE,
        contentType: 'font/woff2',
        headers: { 'Access-Control-Allow-Origin': '*' },
      }),
    )
    await openApp(page)

    // 卡片上的按钮一直可见，挂载即换
    const trigger = page.locator('[data-slot="text-line1-font"] [data-slot="font-trigger"]')
    await expect(trigger.locator('[data-preview="ready"]')).toHaveCount(1, {
      timeout: SETTLE_TIMEOUT_MS,
    })

    await trigger.click()
    const popover = page.locator('[data-slot="popover-content"]')
    const ready = popover.locator('[cmdk-item] [data-preview="ready"]').first()
    await expect(ready).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
    expect(await ready.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/^"?fp-/)
    expect(requested).not.toContain('Pacifico')

    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)

    // 重开是新的列表节点，观察器跟着新行重建；搜一款第一次打开时没滚到的字体
    await trigger.click()
    await popover.locator('[data-slot="command-input"]').fill('Pacifico')
    const row = popover
      .locator('[cmdk-item][data-value$=":pacifico"] [data-preview="ready"]')
      .first()
    await expect(row).toBeVisible({ timeout: SETTLE_TIMEOUT_MS })
    expect(await row.evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(
      /^"?fp-pacifico"?,/,
    )
    expect(requested).toContain('Pacifico')
  })
})

test('常驻操作条：换一版、随机配色、导出三格', async ({ page }) => {
  await openApp(page)

  // 随机只在这一处，配色节里不再重复摆一遍；每个按钮都带可见文案
  await expect(page.locator('[data-slot="shuffle-color"]')).toBeVisible()
  await expect(page.locator('[data-slot="shuffle-color"]')).toContainText('换一版')
  await expect(page.locator('[data-slot="shuffle-palette"]')).toBeVisible()
  await expect(page.locator('[data-slot="shuffle-palette"]')).toContainText('随机配色')
  await expect(page.locator('[data-slot="export-action"]')).toContainText('导出')
  await expect(page.locator('[data-slot="export-options"]')).toHaveCount(1)

  // 换一版只换种子：点完读 store 里的配置，种子非空且不同于点前
  const seedBefore = (await probeConfig(page)).seed
  await page.locator('[data-slot="shuffle-color"]').click()
  const seedAfter = (await probeConfig(page)).seed
  expect(seedAfter).toBeTruthy()
  expect(seedAfter).not.toBe(seedBefore)
})

test('随机配色只换配色，种子与质感不动', async ({ page }) => {
  await openApp(page)

  const before = await probeConfig(page)
  await page.locator('[data-slot="shuffle-palette"]').click()
  const after = await probeConfig(page)
  expect(after.palette).not.toBe(before.palette)
  expect(after.seed).toBe(before.seed)
  expect(after.style).toBe(before.style)
})

test('图标徽章能选内置棕榈图标并导出', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('图标徽章能用中文搜到棕榈 emoji 并导出', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="emoji"])').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

/** store 里的图标那一位。 */
async function readIcon(page: Page): Promise<ProbeConfig['layout']['icon']> {
  return (await probeConfig(page)).layout.icon
}

test('图标徽章能在品牌页搜到 GitHub 并导出', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="brand"])').click()
  await page.locator('[data-slot="command-input"]').fill('GitHub')
  // 名字精确匹配，免得选中同样命中的 GitHub Copilot
  await page.getByRole('option', { name: 'GitHub', exact: true }).click()

  // 配置里落的是品牌 id 本身，取原色稿还是官方单色稿由 icon.mono 在加载期定
  expect(await readIcon(page)).toMatchObject({ source: 'brand', id: 'github' })

  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('挑选栏能把没有官方单色稿的品牌切成单色并导出', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="brand"])').click()
  await page.locator('[data-slot="command-input"]').fill('飞书')
  await page.getByRole('option', { name: /飞书|Lark/ }).click()

  // 上游没给飞书配官方单色稿，压平在绘制期做，界面上照样切得动
  const monoTile = page.locator('label:has(input[data-group="brand-mono"][value="mono"])')
  await expect(monoTile).toBeVisible()
  await monoTile.click()

  expect(await readIcon(page)).toMatchObject({ id: 'lark', mono: true })

  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('单色那一档只跟着品牌来源出现', async ({ page }) => {
  await openApp(page)

  const monoControl = page.locator('[data-slot="brand-mono"]')
  await expect(monoControl).toHaveCount(0)

  // 内置图标没有单色一说，挑完这一档仍不该冒出来
  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('[data-slot="command-input"]').fill('棕榈')
  await page.getByRole('option', { name: /棕榈树/ }).click()
  await expect(page.locator('[data-slot="graphic-picker"]')).toContainText('palm')
  await expect(monoControl).toHaveCount(0)

  await page.locator('[data-slot="graphic-picker"]').click()
  await page.locator('label:has(input[data-group="icon-source"][value="brand"])').click()
  await page.locator('[data-slot="command-input"]').fill('飞书')
  await page.getByRole('option', { name: /飞书|Lark/ }).click()
  await expect(monoControl).toBeVisible()

  // 移除钮是填充态唯一的清空入口
  await page.locator('[data-slot="icon-clear"]').click()
  await expect(page.locator('[data-slot="graphic-picker"]')).toHaveCount(0)
  await expect(monoControl).toHaveCount(0)
  await expect(page.locator('[data-slot="graphic-pick"]')).toBeVisible()
  expect((await readIcon(page)).source).toBe('none')
})

test('上传的 SVG 会进入本次会话并用于导出', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  await page.locator('[data-slot="graphic-pick"]').click()
  await page.locator('input[type="file"]').setInputFiles({
    name: 'team.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="alert(1)"><script>alert(2)</script><path d="M20 20h60v60h-60z" fill="#3730c3"/></svg>',
    ),
  })
  await expect(page.locator('[data-slot="graphic-picker"]')).toContainText('upload-')
  await page.locator('#avatar-text-first').fill('产品设计部')

  const download = page.waitForEvent('download')
  await page.locator('[data-slot="export-action"]').click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/_\d{8}-\d{6}\.jpg$/)

  const encoded = await probeEncode(page)
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.hitTarget).toBe(true)
})

test('关于是一个独立页面，带版本号，能走回工具', async ({ page }) => {
  await openApp(page)

  // v5.1 起它不是浮层，是 /about 这张真实的静态页，能单独分享一个链接出去
  await page.locator('[data-slot="about-action"]').click()
  await expect(page).toHaveURL(/\/about$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('渐变头像')
  await expect(page.locator('[data-slot="app-version"]')).toHaveText(/\d+\.\d+\.\d+/)

  // 关于页不拉工具那份 chunk，只有自己那一小段脚本
  await expect(page.locator('[data-slot="workspace"]')).toHaveCount(0)

  await page.getByRole('link', { name: '开始做图' }).first().click()
  await expect(page.locator('[data-slot="workspace"]')).toHaveCount(1)
})

test('赞赏区按配置渲染，收款码图真的取到了', async ({ page }) => {
  await page.goto('/about')
  await expect(page.locator('[data-slot="support"]')).toBeVisible()

  for (const id of ['wechat', 'alipay']) {
    const image = page.locator(`[data-slot="support-${id}"] img`)
    await expect(image).toBeVisible()
    // 路径写错时 img 照样在 DOM 里，只有 naturalWidth 会归零
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0)
  }
})

test('顶栏设置菜单里恢复默认，确认后回到默认档', async ({ page }) => {
  await openApp(page)

  await page.locator('#avatar-text-first').fill('重置演练')
  await page.locator('[data-slot="settings-menu"]').click()
  await page.locator('[data-slot="reset-action"]').click()

  // 恢复默认会抹掉当前全部配置，先问一句再动手
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await page.locator('[data-slot="reset-confirm"]').click()
  await expect(dialog).toBeHidden()

  // 重置回到默认档，示例文字重新跟随界面语言
  await expect(page.locator('#avatar-text-first')).toHaveValue('飞书')
  await expect(page.locator('#avatar-text-second')).toHaveValue('效率先锋')
})

test('顶栏有备案号，链到工信部', async ({ page }) => {
  await openApp(page)

  const beian = page.locator('[data-slot="icp-beian"]')
  await expect(beian).toBeVisible()
  await expect(beian).toHaveAttribute('href', /beian\.miit\.gov\.cn/)
})

test('顶栏设置里能切主题', async ({ page }) => {
  await openApp(page)

  // 默认跟随系统，Playwright 的 chromium 是浅色档
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  await page.locator('[data-slot="settings-menu"]').click()
  await page.locator('[data-slot="theme-option"][data-value="dark"]').click()

  // 深浅走 html 上的 class，见 src/app/theme.ts
  await expect(page.locator('html')).toHaveClass(/dark/)
})

test('网格参考线打开后刷新仍开，且不进导出画布', async ({ page }) => {
  await openApp(page)

  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(0)

  // 两个参考层在顶栏的设置菜单里，带文案与勾选态
  await page.locator('[data-slot="settings-menu"]').click()
  const toggle = page.locator('[data-slot="grid-toggle"]')
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()

  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(1)
  // 网格是 DOM 图层，不进着色器宿主，那里仍只有一张画布
  await expect(page.locator('[data-slot="preview-shader"] canvas')).toHaveCount(1)

  await page.reload()
  await waitReady(page)
  await expect(page.locator('[data-slot="preview-grid"]')).toHaveCount(1)
  await page.locator('[data-slot="settings-menu"]').click()
  await expect(page.locator('[data-slot="grid-toggle"]')).toHaveAttribute('aria-checked', 'true')
})

test('字号滑杆默认自动，拖动后切手动且数值连续', async ({ page }) => {
  await openApp(page)

  const auto = page.locator('[data-slot="text-font-size"] [data-slot="slider-auto"]')
  const auto2 = page.locator('[data-slot="text-line2-size"] [data-slot="slider-auto"]')
  await expect(auto).toHaveAttribute('aria-pressed', 'true')
  await expect(auto2).toHaveAttribute('aria-pressed', 'true')

  // 自动态滑杆显示预览回写的求解值，回写前停在下限 0.04，得等首帧排版完成；
  // 网络字体到货会再排一次，值可能再变一档，所以等它连续两次读数相同再取基线
  const slider = page.getByRole('slider', { name: '第一行字号' })
  await expect.poll(() => slider.inputValue(), { timeout: POLL_TIMEOUT_MS }).not.toBe('0.04')
  await expect
    .poll(
      async () => {
        const first = await slider.inputValue()
        await page.waitForTimeout(400)
        return first === (await slider.inputValue())
      },
      { timeout: SETTLE_TIMEOUT_MS },
    )
    .toBe(true)
  const before = Number(await slider.inputValue())
  expect(before).toBeGreaterThan(0.04)

  await slider.focus()
  await page.keyboard.press('ArrowRight')
  await expect(auto).toHaveAttribute('aria-pressed', 'false')
  const after = Number(await slider.inputValue())
  expect(after).toBeCloseTo(before + 0.005, 3)

  // 拖第一行时第二行钉在此刻的大小：它的“自动”钮熄灭，值仍是拖之前基准的 62%
  await expect(auto2).toHaveAttribute('aria-pressed', 'false')
  const line2 = page.getByRole('slider', { name: '第二行字号' })
  expect(Number(await line2.inputValue())).toBeCloseTo(before * 0.62, 2)

  await auto.click()
  await expect(auto).toHaveAttribute('aria-pressed', 'true')
  await auto2.click()
  await expect(auto2).toHaveAttribute('aria-pressed', 'true')
})

test('炫技层背景挂着自己的 WebGL 画布，预览与导出都不受影响', async ({ page }) => {
  test.setTimeout(PROBE_TEST_TIMEOUT_MS)
  await openApp(page)

  // 极光背景走懒 chunk，toHaveCount 自带重试，等它到货
  const backdrop = page.locator('[data-slot="showcase-background"]')
  await expect(backdrop).toHaveCount(1)
  await expect(backdrop.locator('canvas')).toHaveCount(1)

  // 两个 WebGL 上下文并存：预览那一份仍然只有一张画布，没有被背景挤掉或重建
  await expect(page.locator('[data-slot="preview-shader"] canvas')).toHaveCount(1)

  // 导出走离屏合成，与页面装饰无关，结果与加炫技层之前一致
  const encoded = await probeEncode(page)
  expect(encoded.type).toBe('image/jpeg')
  expect(encoded.bytes).toBeGreaterThan(0)
  expect(encoded.bytes).toBeLessThanOrEqual(2 * 1024 * 1024)
  expect(encoded.hitTarget).toBe(true)

  const stats = await probeStats(page)
  expect(stats.opaque).toBe(stats.width * stats.height)
  expect(stats.colors).toBeGreaterThan(16)
})
