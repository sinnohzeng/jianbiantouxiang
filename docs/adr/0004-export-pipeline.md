# ADR-0004 导出：浏览器原生编码与目标体积二分

- 状态：已采纳
- 日期：2026-08-29

## 决策

- 导出格式 JPG（默认）、PNG、WebP，全部用 `canvas.toBlob`；JPG 与 WebP 支持“目标 1 MB / 上限 2 MB / 不限制”三档，用质量二分逼近目标，下限 0.6，达不到提示降分辨率。
- 默认尺寸 1024×1024，头像场景 JPG 约 150 到 300 KB；4096 及以上 PNG 提示体积。
- WebP 只在 `toBlob('image/webp')` 实际返回 `image/webp` 的浏览器里提供，Safari（到 27 仍不支持）隐藏该选项。
- 移动端优先 `navigator.share({ files })`，不可用时回落 `<a download>`。
- 尺寸上限运行时探测：WebGL `MAX_RENDERBUFFER_SIZE` / `MAX_TEXTURE_SIZE`（Android 只有 ≥ 4096 是全覆盖），2D 画布面积上限（iOS 17 及以下 4096²，iOS 18 起 8192²），超出时按上限渲染后放大并在导出面板提示。
- 当前配置在导出时写进 URL hash，分享链接即可复现。

## 不引入 WASM 编码器的理由

jSquash（MozJPEG / oxipng / WebP）在同质量下能再省 10 % 到 20 % 体积，但要多 300 KB 以上的 wasm 与 worker 边界处理。头像场景体积目标宽松，原生编码加二分已能稳定命中 1 MB，先不引入；若未来做批量或超大导出再评估。

## 后果

- 无法控制 PNG 体积，界面提示替代。
- 二分需要多次编码，4096 级别在手机上有 1 到 2 秒等待，导出按钮要有进行中状态。
