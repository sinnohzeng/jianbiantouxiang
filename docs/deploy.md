# 部署

站点是纯静态产物，`npm run build` 出 `dist/`，里面是两个真实页面 `/` 与 `/about`，构建不需要任何密钥，也不在构建期拉外网。主站域名 `jianbiantouxiang.com`，托管在阿里云边缘安全加速 ESA 的 Pages；旧域名 `jianbian.zixuan.net` 留在 Cloudflare Pages 上，切换完成后只做 301 跳转。两边都接 GitHub 仓库，main 分支 push 即构建、构建完即上线。切换按下文的顺序做：站点接入、新建 Pages 项目、HTTPS、绑定域名、缓存与响应头、上线核对；切完之前旧域名仍是线上入口。

## 阿里云 ESA Pages

### 构建配置

构建参数以仓库根目录的 `esa.jsonc` 为准。官方文档写明这份文件存在时优先级高于控制台，控制台里对应的构建项不再生效，改参数只改文件并推到 main。字段说明见 [Pages 构建和路由指南](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/build-pages)。

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `name` | `jianbiantouxiang` | 控制台里的项目名称，同名即部署到该项目 |
| `installCommand` | `npm ci` | 有 lockfile，可复现且比 `npm install` 快 |
| `buildCommand` | `npm run build` | 先 `tsc -b` 再 `vite build` |
| `assets.directory` | `./dist` | 官方对 Vite 模板的默认值 |
| `assets.notFoundStrategy` | `singlePageApplication` | 没匹配到静态文件的导航请求回 `index.html` 200，与 `public/_redirects` 在 Cloudflare 上的兜底同一口径 |

`entry` 不写，站点没有边缘函数。

`/about` 不需要额外规则。官方路由表写明请求 `/file` 直接命中 `dist/file.html`，`/file.html` 与 `/file/` 反过来 301 到 `/file`。

### 站点接入

1. 控制台“站点管理”新增站点，填根域名 `jianbiantouxiang.com`。
2. 加速区域选“全球”。[接入指南](https://help.aliyun.com/zh/edge-security-acceleration/esa/getting-started/add-your-website-to-esa)写明“全球”与“中国内地”两档都要求域名已完成 ICP 备案，且备案刚通过要在 8 小时后再新增站点，否则会误报“域名未备案”。
3. 接入方式选 NS。新域名没有历史解析，DNS 托管给 ESA 之后 Pages 绑域名会自动写记录，不用在两个控制台之间来回配。到域名注册商把 NS 改成 ESA 分配的两条，回站点概况页点“验证 NS 生效”。[站点管理](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/site-management)一页给的生效窗口是 0 到 48 小时。注册商在阿里云时，本人经手的几次都是几分钟内生效，这是经验不是承诺。
4. 套餐按需选。静态站点走免费版即可。[函数和 Pages 概述](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/what-is-functions-and-pages/)给的 Pages 配额是单项目 2000 个文件、单文件 25 MB，当前产物远在其下。

### 新建 Pages 项目

“边缘计算和 AI › 函数和 Pages”里新建 Pages 项目，选“导入 Git 仓库”接本仓库。构建那一步的对照：项目名称 `jianbiantouxiang`，生产分支 `main`，非生产分支构建关，安装命令与构建命令随便填（`esa.jsonc` 存在时以文件为准），根目录 `/`，静态资源目录留空，函数文件路径留空，Node.js 版本 `24.x`，不加函数变量。创建后第一次构建自动触发，构建日志里应看到 `npm ci` 与 `vite build`。

### HTTPS

进站点的“边缘证书”页，申请免费边缘证书，覆盖 `jianbiantouxiang.com` 与 `www.jianbiantouxiang.com`；打开[强制 HTTPS](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/force-https)开关，最低 TLS 1.2。[请求重定向](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/request-redirects)一页的常见问题写明 HTTP 跳 HTTPS 优先用这个开关，不要自己写重定向规则，容易和别的规则撞出循环。Pages 绑定的域名继承站点的证书配置，站点不开证书，绑定的域名就没有 HTTPS。

### 绑定域名

1. 进 Pages 项目的“域名”页签点“添加域名”，填 `jianbiantouxiang.com`。前置条件是账号下已有一个买了套餐且完成 NS 接入的可用站点，也就是“站点接入”一节。
2. 再添加一条 `www.jianbiantouxiang.com`。
3. 站点“规则 › 重定向规则”新增一条：传入请求“主机名 等于 `www.jianbiantouxiang.com`”，重定向类型选“动态”，表达式 `concat("https://jianbiantouxiang.com", http.request.uri.path)`，状态码 301，打开“保留查询字符串”。[请求重定向](https://help.aliyun.com/zh/edge-security-acceleration/esa/user-guide/request-redirects)的常见问题写明两个域名都接入 ESA 时裸域与 www 互跳走这条规则，不要用 DNS 服务商的 URL 转发；免费版规则条数上限 5 条。

NS 接入下绑定约一分钟生效，浏览器直接打开域名核对。

### 缓存与响应头

`public/_headers` 是 Cloudflare Pages 的约定，ESA 不读它，同样的效果要在站点的“缓存规则”与“修改 HTTP 响应头”里补。以下是建议值，部署后用下一节的命令核对实际响应头。

| 路径 | 边缘缓存 | 浏览器缓存 | 理由 |
| --- | --- | --- | --- |
| `/assets/*`、`/fonts/*`、`/brand/*` | 1 年 | 1 年 | 文件名带内容哈希或内容不变 |
| `*.html`、`/sw.js`、`/registerSW.js`、`/workbox-*.js`、`/manifest*.webmanifest` | 10 分钟 | 不缓存 | 浏览器缓存了它们，PWA 的新版本提示就失灵 |

响应头补三条，与 `_headers` 对齐：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: strict-origin-when-cross-origin`。

### 上线核对

```bash
curl -sI https://jianbiantouxiang.com/ | grep -iE "^(http|cache-control|content-type|x-frame)"
curl -sI https://jianbiantouxiang.com/about | grep -iE "^(http|cache-control|content-type)"
curl -sI https://jianbiantouxiang.com/sw.js | grep -iE "^(http|cache-control)"
curl -sI https://www.jianbiantouxiang.com/ | grep -iE "^(http|location)"
curl -sI http://jianbiantouxiang.com/ | grep -iE "^(http|location)"
```

预期：前两条 200，`content-type` 是 `text/html`，`cache-control` 不带长 `max-age`；`sw.js` 同理；后两条 301，`location` 指向 `https://jianbiantouxiang.com/`。再在浏览器里各切一次界面语言与深浅主题，确认语言 chunk 与 manifest 都取得到。

### 国内可用性

- 字体在运行时先走 Google Fonts css2，失败回落 jsDelivr 上的 fontsource 镜像；emoji 走 jsDelivr 上的 Noto Emoji。两条加载路径见 `docs/architecture.md`，ESA 上不需要改。
- 构建机拉 npm 超时时，在仓库加 `.npmrc` 写 `registry=https://registry.npmmirror.com`。lockfile 里 `resolved` 字段写的是 `registry.npmjs.org`，npm 的 `replace-registry-host` 配置默认值 `npmjs` 会在安装时把这个主机换成配置的 registry，不必重生成 lockfile；本地验证方法是 `npm ci --loglevel http 2>&1 | grep -m3 fetch`，看到的主机应是 npmmirror。Cloudflare 那边同样走这份 `.npmrc`，npmmirror 在境外也能访问。这是备选，没有超时就不加。

## Cloudflare Pages

旧域名的托管。构建命令 `npm run build`，输出目录 `dist`，Node 24。`public/_headers` 给哈希资源一年缓存并加三条安全头，`public/_redirects` 只有一条 `/* /index.html 200` 的兜底；`/about` 由静态文件在兜底之前解析，不要再给它写 200 重写，`tests/build/redirects.test.ts` 守着这条。

域名切换后在 Cloudflare 给 `jianbian.zixuan.net` 加一条 Redirect Rule，301 到 `https://jianbiantouxiang.com` 加原路径，保留至少三个月，让搜索引擎与聊天记录里的旧链接都能落到新站。
