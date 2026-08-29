# ADR-0003 字体：Google Fonts 动态加载与 FontFace，取代内置字体与轮廓化

- 状态：已采纳
- 日期：2026-08-29

## 背景

v2 内置 13 个阿里字体 woff2（数 MB 进仓库），用 wawoff2 解压后交给 opentype.js 量宽与轮廓化，只为了 SVG 导出能脱离字体。v3 只出位图，轮廓化没有必要；用户要求能动态用任意 Google Fonts。

## 决策

- 字体目录来自 fontsource 公共 API（`https://api.fontsource.org/v1/fonts`，2096 个字体，含分类与子集），本地缓存 7 天；另内置精选清单兜底，包含 Google Fonts 上全部中文字体。
- 加载走 Google Fonts css2 端点，浏览器按 `unicode-range` 切片只拉用到的字，用 `document.fonts.load()` 等就绪再绘制。4 秒超时切到 jsDelivr 上的 fontsource CSS（`cdn.jsdelivr.net`，再 `gcore.jsdelivr.net`），再失败回系统字体并提示。fonts.loli.net 一类个人运营的镜像可用性无保证，不纳入回退链。
- 不用 css2 的 `text=` 参数：2026-08-29 实测 Noto Sans SC 700 传 `text=` 仍返回 4.6 MB 的 woff2（可变字体子集无效），ZCOOL KuaiLe 等静态字体才正常。
- 本地上传 TTF / OTF / WOFF / WOFF2 直接用 `FontFace` 注册，不再解析字体文件。
- 文字量宽与排版一律用 canvas `measureText`。

## 后果

- 仓库删除全部字体文件与 wawoff2 wasm。
- 大陆用户依赖镜像可达性，界面要有明确的加载状态与回退提示。
- 字体列表随 fontsource 变化，精选清单需要偶尔核对。

## 否决的备选

- 自建字体子集服务：需要后端，与静态站定位冲突。
- 只内置几款字体：满足不了“任意 Google Fonts”的要求。
