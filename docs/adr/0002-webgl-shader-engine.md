# ADR-0002 渲染引擎：WebGL shader 取代 SVG 多层径向渐变

- 状态：已采纳
- 日期：2026-08-29

## 背景

v2 参照 Justin Jay Wang 的方法，用多层 `<radialGradient>` 配 transform 叠加，再加 `feGaussianBlur` 与 `feTurbulence`。它的上限是“几团模糊色斑”，缺少目标参考图（OpenAI 发布图）那种低频大色场、丝绸褶皱、通透光感和细颗粒。调研结论见 `docs/research/2026-08-29-ai-gradient-technique-survey.md`：2025 年后业界做这类视觉的主流是 fragment shader 里的 domain warping 与 mesh gradient，React Bits Pro 2026-08 新出的 hero 块底层也是 `@paper-design/shaders`。

## 决策

- 引擎改为 WebGL2 fragment shader，使用 `@paper-design/shaders`（Apache-2.0，零依赖，0.0.80）的 `ShaderMount` 与其 `staticMeshGradient`、`meshGradient`、`warp`、`grainGradient` 四个 shader，项目自建薄封装负责种子映射、离屏渲染与限幅。
- 静态输出靠 `speed = 0` 加确定性的 `frame` / `positions` 种子；同一配置在同一设备像素级一致。
- 光感在 2D 合成阶段用径向白光 screen 混合叠加，文字、形状遮罩也在 2D 阶段完成。
- 不支持 WebGL2 时给 CSS 多层 `radial-gradient` 的静态近似，只预览不导出。

## 后果

- SVG 导出下线：shader 无法矢量化。头像本来就是位图用途。
- Node CLI 与批量生成下线：浏览器外没有 WebGL；需要时可用 Playwright 驱动页面另立脚本。
- `@resvg/resvg-js`、`commander`、`seedrandom`、`opentype.js`、`wawoff2` 依赖全部移除。
- 导出分辨率受设备 `MAX_RENDERBUFFER_SIZE` 限制，超出时按上限渲染后放大。

## 否决的备选

- 继续 SVG 并加 `feDisplacementMap` 做 domain warping：浏览器实现慢、在 4K 光栅化时秒级，且视觉上限仍低于 shader。
- 自写 GLSL：能做，但 paper shaders 已把 mesh / warp / grain 调到设计品质并持续维护，自写只会重复劳动。
- three.js 系（React Bits 的 shader 组件）：为一个全屏四边形拖进整个 three，手机端代价高。
