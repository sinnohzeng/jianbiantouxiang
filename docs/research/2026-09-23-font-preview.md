# 字体选择器的字体名预览与逐行字体（2026-09-23）

服务于 `specs/v8.0-line-fonts-and-preview/`。每条事实标来源类型：官方原文、官方派生、实测、第三方、推断。未注日期的出处访问日期均为 2026-09-23。

实测环境：macOS，请求用 Chrome 140 的 UA；浏览器侧用 Playwright 自带的 Chromium 151 与 153。本机出口经 Clash TUN，境外域名实际从洛杉矶出去，所以除 §4 的 DNS 视图外，网络耗时不能当大陆直连结论。

## §1 行业怎么让人看字体

| 产品 | 列表里的名字用字体本身渲染 | 样例文字 | 画布悬停或方向键预览 | 出处 |
| --- | --- | --- | --- | --- |
| Google Fonts 官网 | 否，名字用界面字体，样例用字体本身 | 按语言给默认，可自定义 | 不适用 | 实测 fonts.google.com |
| Figma | 是 | 无 | 有，2023 年秋恢复 | 官方原文 help.figma.com/hc/en-us/articles/360041308034；第三方 forum.figma.com（2023-06-22、2024-06-13） |
| Microsoft Office | 是，CJK 浏览器语言下显示本地化名 | 无 | 未核实 | 官方原文 support.microsoft.com “Use the modern font picker in Office” |
| MasterGo | 本地字体显示中文名 | 无 | 有 | 官方原文 mastergo.com/updateRecord |
| Canva | 推断为名字图片（Apps SDK 每款字体带 `previewUrl`） | 无 | 可能没有 | 官方原文 canva.dev/docs/apps/fonts；第三方 reddit r/canva（2026-09-07） |
| Adobe Express | 未核实 | 无 | 有（2026） | 官方原文 helpx.adobe.com/express/web/whats-new/release-notes.html（2026-08-28） |
| 即时设计 | 未核实 | 无 | 有（方向键） | 官方原文 js.design/tutorial/640a9b80d76ed0b9ce961c3b |

- 共识：列表要让人一眼看到字形，三种做法是名字用自身字体（Figma、Office）、样例卡片（Google Fonts）、预渲染图（Canva）。
- CJK 字体名：Figma 一律显示英文名，官方员工 2025-06-05 在论坛确认，用户把它当 bug 报（第三方，forum.figma.com/report-a-problem-6/…-41446）。Office 与 MasterGo 显示本地化名。
- 实测：Google 下发的子集文件 name 表只有英文名（fontTools 读 name ID 1 与 4），原生名拿不到，只能手工维护。
- 多行字体“默认跟随、改了才独立”的先例：shadcn/create 的标题字体默认 `inherit`（官方原文，源码 preset.ts）；Office 的 +Headings/+Body 主题字体，手选具体字体即断开（第三方，learn.microsoft.com 社区回答，2023-12-24）。本仓 `line2Size: null` 已是同一心智。

## §2 Google Fonts 官网自己怎么做预览

- 实测：官网列表每款字体单独发一个 css2 请求，`css2?family=X:ital,wght@0,400&directory=3&display=block&text=<样例去重字符>`；75 个 css2 请求里 74 个带 `text=`。
- 实测：页面上没有 `<link>` 样式表，字体经 FontFace API 用别名注册，形如 `"gf_ZCOOL_KuaiLe variant0"`，回退链末尾是一款画问号方框的 `Tofu` 字体。
- 官方原文：`text=` 最多能把文件缩小 90%，一次请求只能带一个，作用于请求里全部 family（developers.google.com/fonts/docs/css2，2024-07-23）。

## §3 css2 `text=` 实测

命令：`curl -A "$UA" "https://fonts.googleapis.com/css2?family=<F>&text=<URL 编码>"`，取出 `src` 再 `curl` 一次量字节。

| 字体 | text | 字体文件 | 不带 text 时浏览器为同样的字要拉的切片 |
| --- | --- | --- | --- |
| Inter 400 | `Inter` | 1,320 B | 23,804 B |
| Lobster | `Lobster` | 1,840 B | 17,068 B |
| Bebas Neue | `Bebas Neue` | 1,072 B | 8,596 B |
| Noto Sans SC 400 | `Noto Sans SC` | 1,576 B | 13,312 B |
| Noto Sans SC 400 | `飞书效率先锋` | 2,116 B | 91,212 B（3 片） |
| Noto Sans SC 700 | `飞书效率先锋` | 2,132 B | 92,820 B |
| ZCOOL KuaiLe | `站酷快乐体` | 1,228 B | 63,820 B（jsDelivr 3 片） |
| Ma Shan Zheng | `马善政楷书` | 3,076 B | 250,300 B（jsDelivr 3 片） |
| Noto Sans KR | `한글가` | 3,364 B | 24,884 B |

- 实测：浏览器 UA 下返回一条 `@font-face`，woff2，带 `unicode-range`，只列请求的字。curl 默认 UA 返回 truetype 且无 `unicode-range`；macOS 的 Safari 与 Firefox 拿到 woff。所以 CSS 只能在浏览器里用真实 UA 取，不能构建期缓存。
- 实测：CSS 与 `fonts.gstatic.com` 的字体文件都带 `Access-Control-Allow-Origin: *`。CSS 缓存 `private, max-age=86400`，`/l/font` 动态子集 `public, max-age=86400`，`/s/` 静态切片一年。`/l/font` 的 `content-type` 标成 `text/html`，但内容是 woff2（魔数 `wOF2`），浏览器按字体加载不受影响。
- 实测：请求字体没有的字重返回 400（Bebas Neue `wght@700`；UnifrakturCook 不写字重）。字重要显式写成该字体有的一档。
- 实测：请求的字全部缺失时 CSS 仍是 200，字体 URL 返回 400 的 HTML，`FontFace.load()` reject `NetworkError`。`unicode-range` 原样回显请求的字，不代表字体真有字形。
- 实测：不同字符数不超过 800 时 `text=` 生效，801 起被静默忽略、退回整套切片 CSS。
- 实测：把 ZCOOL KuaiLe 的 `text=飞书` 子集用真名注册后，`document.fonts.check('32px "ZCOOL KuaiLe"', '永')` 返回 true，`load(…, '永')` resolve 空数组。这就是预览必须用别名的原因：真名注册会污染 `loader.ts` 的就绪判断。
- 实测：`fetch` CSS 后 `new FontFace(别名, url)` 在 Chromium 里正常加载。

## §4 大陆可达性与镜像

DNS 视图（实测，AliDNS DoH 带 ECS，DNSPod HTTPDNS 交叉验证）：

| 域名 | 北京联通 | 广东电信 | 广东移动 |
| --- | --- | --- | --- |
| fonts.googleapis.com | 114.250.66.33 | 58.63.233.97 | 120.232.234.97 |
| fonts.gstatic.com | 114.250.64.34 | 113.108.239.162 | 120.232.234.98 |
| cdn.jsdelivr.net | Fastly 或 Cloudflare 轮换 | Cloudflare | Cloudflare |
| gcore.jsdelivr.net | CNAME 到 Cloudflare，与 cdn 同 IP | 同左 | 同左 |

- 实测：Google 字体两组域名在三网都解析到运营商境内节点（114.250.x 属 UNICOM-BJ）；`--resolve` 指向境内节点时 fonts.gstatic.com 的 TLS 握手约 80 ms。“确为直连”由耗时推断，TUN 路由未从控制器确认。
- 第三方 GreatFire：fonts.googleapis.com 2026-09-07 可访问，fonts.gstatic.com 2026-09-21 可访问；cdn.jsdelivr.net 有两段干扰期（2025-03-15 至 06-03、2025-11-19 至 2026-01-18）；fastly.jsdelivr.net 2026-09-02 可访问（zh.greatfire.org）。
- 第三方反例：appinchina（2025-10-24）笼统称 Google Fonts API 在大陆被墙，与上面的 DNS 实测不符；v2fly issue #3378（2026-03-21）是代理规则把域名走直连、DNS 却解析到境外地址的场景，不代表普通用户。
- 推断：`gcore.jsdelivr.net` 与 `cdn.jsdelivr.net` 在国内 DNS 下同一组 Cloudflare 地址，作为第二档镜像等于没换；`fastly.jsdelivr.net` 至少在联通线路上是另一张 CDN。
- 实测：jsDelivr 上 fontsource 的文件没有 `text=` 这种子集，中文字体按 `unicode-range` 拉整片，显示六个汉字要 69 到 253 KB。

## §5 前端调度与列表规模

- 官方原文：cmdk 1.1.1 README 写“Virtualization? No. Good performance up to 2,000-3,000 items”；方向键导航在已渲染的 `[cmdk-item]` 上 `querySelectorAll`（源码 `node_modules/cmdk/dist/index.mjs`）。npm latest 仍是 1.1.1（2025-03-14）。
- 第三方：cmdk issue #335（2025-01-02，not_planned）关于虚拟化；社区的虚拟化方案要自己维护焦点、绕开 cmdk 导航（github.com/oaarnikoivu/shadcn-virtualized-combobox）。
- 实测（生产构建，Chromium 4 倍降速）：往文档 add 一个已加载的 FontFace 会触发整份文档样式重算，200 行 6.3 ms、2000 行 57.6 ms；新建并 add 2000 个未加载的 FontFace 只要 44.9 ms、不发请求。cmdk 挂载 200 项 33.6 ms、2000 项 162.7 ms。
- 实测（评审轮复核，Playwright 自带 Chromium headless，4 倍 CPU 降速，200 行别名字体加 2000 个普通节点）：每 add 一个已加载的 face 就强制读一次样式，40 次共 219 ms；连续 add 40 个再读一次只要 5 ms；40 次 add 分散在 40 个任务里再读一次是 6.3 ms；`document.fonts.add` 调用本身 40 次合计 2.8 ms。结论：样式重算是惰性的，同一帧里多次 add 合并成一次，成本按帧计，排队限流不会减少重算次数。
- 官方原文：`IntersectionObserver` 的 `rootMargin` 只作用于显式给出的 root，内层滚动容器必须作为 root（MDN IntersectionObserver 构造函数页）。
- 官方原文：`FontFace` 以 URL 构造时不自动加载，加进 FontFaceSet 后才参与渲染；`document.fonts.delete()` 删不掉 CSS `@font-face` 注册的 face（MDN CSS Font Loading API）。
- 推断：别名 face 的 `weight` 描述符、行内 `font-weight` 要一致，否则浏览器会合成假粗体。
- 实测：fontsource 目录共 2,100 条，`type=google` 且非图标 1,972 条，带中日韩 subset 的 136 条。

## §6 被推翻的旧结论

- `docs/adr/0003-google-fonts-loading.md` 与 `src/fonts/google.ts` 写着“`text=` 在 Noto CJK 上不生效，2026-08-29 实测 Noto Sans SC 700 仍返回 4.6 MB”。2026-09-23 复测同一请求返回 2 KB 左右的 woff2，结论不成立。推断旧结果来自非浏览器 UA 或 Google 当时的临时行为，无法复现。
- `src/fonts/google.ts` 的“Noto Sans SC 单片约 2 KB”不准：最小一片是 emoji 区约 2.3 KB，常用字切片 24 到 43 KB，默认文字要 3 片共约 91 KB。
- 调研里“fonts.loli.net 返回 EOT”是非浏览器 UA 造成的，浏览器 UA 下返回 woff2。它是个人公益项目，没有 SLA，结论“不纳入回退链”不变。
