# ADR-0006 站点路由：多页构建与 Pages 静态资源层直接映射

- 状态：已采纳
- 日期：2026-09-05

## 背景

关于页要能独立分享一个链接，且不拖入工具本体那份 JS chunk。搜索引擎与社交卡片也需要关于页有自己的一套 `<meta>`。这些诉求要求关于页和工具本体是两个真正独立的页面，而不是同一个应用内的一块浮层。

## 决策

- `vite.config.ts` 的 `appType` 从 spa 改成 `mpa`，构建声明两个 Rollup 入口：`index.html`（工具本体）与 `about.html`（关于页）。spa 模式会把 `/about` 的请求也兜底回 `index.html`，开发环境与 `vite preview` 下永远看不到关于页，`mpa` 才会把两个入口各自独立编译与服务。
- `vite-plugin-pwa` 的 workbox 配置把 `navigateFallback` 设为 `null`，关掉 service worker 的导航兜底。留着这条兜底，已经安装过 PWA 的用户打开 `/about` 会命中缓存里的 `index.html`，看到的不是关于页。
- 线上路由交给 Cloudflare Pages 的静态资源层直接处理：`/about` 请求由资源层按文件名映射到 `about.html`。`public/_redirects` 不需要为这两个页面写任何规则。

## 否决的备选：给 /about 写一条 200 重写

给 `/about` 显式写一条 `_redirects` 重写，例如 `/about  /about.html  200`，直觉上是让路由生效最顺手的做法，5.1.0 也确实这样上线过。上线后 `/about` 报 `ERR_TOO_MANY_REDIRECTS`，5.2.0 追查并否决了这个方案：Cloudflare Pages 的静态资源层自带 HTML 规范化，`/about.html` 一定会被 308 规范化到 `/about`。这条规范化对 `_redirects` 重写之后的内部路径同样生效，于是“重写到 about.html”与“规范化回 /about”互相咬成死循环，请求永远拿不到真正的响应。

否决后的改法是把这条重写整条删除。静态资源本来就在 `_redirects` 的通配兜底之前解析，`/about` 请求不经过任何重写规则，直接由资源层映射到 `about.html`。

## 后果

- `/about` 的路由完全交给 Pages 资源层，仓库里不需要为它维护任何重写规则；`tests/build/redirects.test.ts` 断言 `_redirects` 不出现指向 `.html` 的 200 重写，守住这条不再复发。
- 新增静态页面时，只要页面路径与文件名一致，同样不需要改动 `_redirects`。
- service worker 不再兜底导航失败。弱网下用户刷新 `/about` 若缓存未命中又离线，看到的是浏览器原生离线页，工具本体页面不受影响。
