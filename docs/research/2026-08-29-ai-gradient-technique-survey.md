# AI 渐变头像技术路线调研沉淀

日期：2026-08-29

## 调研方式

七个维度并行检索（视觉解剖、程序化算法、开源库与许可证、导出管线、排版与 Google Fonts、前端栈与移动端、配色与对比度），各维度独立产出结论、证据与待验证项，再做一次综合，最后抽出 15 条影响选型的主张做对抗核验，逐条找一手来源正反查。检索通道以 Parallel Search 的 web_search 与 web_fetch 为主，库与框架文档走 Context7，版本、许可证、响应头、字体体积用本机 curl 与 npm registry 实测，导出体积用 Playwright 驱动的本地基准页测得。本机出口为北京电信但配置了本地代理且疑似存在 TUN 级透明代理，所有可达性与耗时数据只能证明服务存活与响应格式，不能当作大陆直连结论，凡涉及大陆可达性的结论一律标为未实测。

证据分级口径：official 指来源方一手（官方文档、源码、规范、npm registry、Bugzilla）；official-derived 指对一手材料的转述或聚合（caniuse、MDN 兼容表、媒体对官方访谈的报道）；community 指第三方文章、社区仓库、逆向整理；self-made 指本次调研自行实测或计算所得。

---

## 一、核心结论

1. 目标风格的可量化特征是低频大色块加感知空间混色加轻颗粒：单个色斑直径约画幅 40% 到 60%，模糊半径约画幅 5% 到 10%，OKLCH 明度 0.63 到 0.86、chroma 0.09 到 0.19，色相跨度 60 到 120 度而非全谱，颗粒下限 1 到 2 LSB。
2. 2025 年后业界做这类视觉的主流是单趟 fragment shader，模糊由函数形状（高斯衰减或反距离加权）直接给出，不再用 feGaussianBlur，因此与分辨率无关、4K 导出零额外成本。
3. `@paper-design/shaders` 0.0.80（Apache-2.0、零依赖、WebGL2）是唯一同时满足可商用、零依赖、专做柔和渐变三条的现成库，`speed=0` 时 `frame` 完全定义静态画面，等价于 seed。
4. WebGL2 全球覆盖 95.73%，Safari 与 iOS Safari 自 15 起默认支持；WebGPU 覆盖 85.56% 且平台碎片化，主路线选 WebGL2 成立。
5. 导出尺寸必须运行时探测：WebKit 主线 2D 画布面积上限 iOS 系为 8192²（iOS 18 起，之前是 4096²）、其他平台 16384²，WebGL `MAX_TEXTURE_SIZE` 在 Android 只有 ≥ 4096 是全覆盖，≥ 8192 只有 73%。
6. 文件体积由噪点决定而不是渐变本身：无噪点时 4096² JPG q0.85 只有 226 KB，中等噪点下 2048² 就要 934 KB，所以体积控制必须让 quality 二分与分辨率回退联动。
7. Safari 到 27 仍不支持 `canvas.toBlob('image/webp')`，且规范要求不支持的 type 静默回落为 PNG，必须比对 `blob.type` 而不是假设成功。
8. Google Fonts css2 的 `text=` 对 Noto CJK 系列无效，传几个字仍返回 4.6 MB 整套字体，中文动态加载只能靠 `unicode-range` 切片，单切片 3.7 KB 到 65 KB。
9. 自动文字色以 WCAG 2 对比度 4.5:1 为底线：WCAG 3 工作草案 2026-03 版仍写“对比度算法未定”，APCA 早在 2023 年被移出草案，产品文案不能写 WCAG 3。
10. 17 套新配色与 OKLCH 种子算法已用 culori 4.0.2 全量跑过色域与对比度校验，全部停靠点在 sRGB 内，色值可直接作为实现数据落库（见附录 A、B）。

---

## 二、分维度正文

### 2.1 视觉解剖：目标风格到底是什么

结论：OpenAI 发布图那种柔光质感在生产上不是单一算法，而是三条路线叠加。一是 2022 年品牌规范给摄影定的调性，要求暖调、白平衡偏琥珀加品红、自然光、可见颗粒、软焦，明确禁止 light leak 与过度风格化。二是 2025 年品牌刷新后由内部团队与 Studio Dumbar 用创意编码与 shader 产出动态视觉，静态封面则是委托摄影加 Sora 生成纹理。三是行业共性做法，多层径向或网格渐变叠大半径模糊、感知均匀色彩空间插值、叠一层低幅度颗粒。本项目不做文生图，能对标的只有第三支加 shader 这一路。可量化的部分已经足够清楚：主体是低频大色块，唯一高频成分是颗粒与文字；色相以 250 到 330 度的蓝紫粉为主再加一到两枚暖色点缀；明度带窄，Gemini 三色的 OKLCH 明度几乎恒定在 0.63 到 0.66；模糊后必须提饱和，否则发灰；颗粒是 2025 年后的主流而非可选项。2025 下半年起大厂在往暖白、水彩、低饱和收敛，所以预设不能只有霓虹系。

| 主张                                                                                                                                                                                                     | 来源 URL                                                                          | 访问日期   | 分级             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ---------------- |
| OpenAI 2025 品牌刷新由内部团队主导，Studio Dumbar 负责动态与创意编码，色板以灰与蓝为基底取意地平线与天空，图像体系是委托摄影加 Sora 生成纹理                                                             | https://www.creativereview.co.uk/openai-brand-refresh                             | 2026-08-29 | official-derived |
| Studio Dumbar 案例页确认其自 2024 春起与 OpenAI 合作，含 ChatGPT Advanced Voice 模式的 shader 开发与设计                                                                                                 | https://studiodumbar.com/work/openai                                              | 2026-08-29 | official         |
| OpenAI 2022 品牌规范对摄影的量化要求：白平衡略偏琥珀并带品红偏色、避免高对比与冷色温、可用可见颗粒与软焦、禁止 light leak；配色系统为 10 个核心色各配 light/mid/dark 三档                                | https://archive.area17.com/directory/2023_openai/36_brand-guidelines-OLD-2022.pdf | 2026-08-29 | official         |
| Google 官方设计文写明 Gemini 渐变“前缘锐利、近乎不透明，尾部扩散”，并用圆形容器把能量集中到尖点再向外绽放                                                                                                | https://design.google/library/gemini-ai-visual-design                             | 2026-08-29 | official         |
| Gemini 品牌三色 #4796E3 #9177C7 #CA6673 换算 OKLCH：L 0.659 / 0.626 / 0.631，C 0.139 / 0.120 / 0.127，H 250 / 298 / 13，明度几乎恒定、色相跨约 120 度                                                    | https://www.brandcolorcode.com/gemini                                             | 2026-08-29 | community        |
| Apple Intelligence 发光边的社区复刻用 7 个色 stop（#BC82F3 #F5B9EA #8D9FFF #AA6EEE #FF6778 #FFBA71 #C686FF），结构为一层不模糊描边叠一层模糊描边；自算 OKLCH L 0.657 到 0.855、C 0.093 到 0.188          | https://github.com/jacobamobin/AppleIntelligenceGlowEffect                        | 2026-08-29 | community        |
| SwiftUI MeshGradient 把角点放到 0 到 1 范围之外，可让最强色从画面外开始，得到更柔和的观感                                                                                                                | https://developer.apple.com/documentation/swiftui/meshgradient                    | 2026-08-29 | official         |
| Apple Liquid Glass 把材质定义为 Lensing 折射加镜面高光加柔和散射三层，颜色受下方内容影响                                                                                                                 | https://developer.apple.com/videos/play/wwdc2025/219                              | 2026-08-29 | official         |
| aurora 配方给出可直接量化的参数：4 个 radial-gradient 光斑尺寸 40% 到 60%、alpha 0.40 到 0.55、70% 处透明，一层 conic-gradient 叠 `filter: blur(80px) saturate(1.4)` 与 opacity 0.55，色相上限 3 到 4 种 | https://superdesign.dev/styles/aurora                                             | 2026-08-29 | community        |
| 消除 8 位渐变 banding 的量化下限：每像素加幅度 1/255 的噪声并减去 0.5/255 保持均值，更严谨用三角分布幅度 2 LSB，蓝噪声观感最好                                                                           | https://blog.frost.kiwi/GLSL-noise-and-radial-gradient                            | 2026-08-29 | community        |
| 覆盖 23 家 AI 公司的视觉趋势报告把 Organic Gradients（加颗粒、纹理与细微变化）与 Digital Impressionism（没有元素完全清晰的软焦）列为 2026 主流                                                           | https://www.acolorbright.com/observations/aesthetics-of-ai                        | 2026-08-29 | community        |
| Paper Shaders 的 MeshGradient 提供最多 10 个色点，参数 distortion（0 到 1）、swirl（0 到 1）、grainMixer（作用于色斑边缘）、grainOverlay（后处理黑白颗粒），另有 scale、rotation、offset                 | https://github.com/paper-design/shaders                                           | 2026-08-29 | official         |

对本项目意味着什么：四种质感的默认参数有了对照系。`mesh`（柔光）按低频大色块加轻颗粒调，色相跨度控制在 120 度以内；`silk`（丝绸）的折痕来自域变形而不是硬边遮罩；`grain`（颗粒）的下限不是审美问题而是去 banding 的工程需要，默认必须开。光感层用径向白光 screen 混合叠加，对应的是 bloom 的低频溢出而不是镜面高光。配色库必须同时覆盖蓝紫粉主流与暖白低饱和的收敛方向，不能只做一种 AI 味。圆形裁切与渐变是当下 AI 视觉的两个符号，头像生成器同时命中，圆形应是一级选项。

### 2.2 程序化算法

结论：把“模糊色斑”交给函数形状而不是滤镜，是这条路线的核心。Justin Jay Wang 为 openai.com 2020 到 2022 年首页做的多层 radialGradient 法，在数学上就是椭圆高斯斑加仿射变换的叠加，只是把模糊交给了 feGaussianBlur，而 WebKit 对大半径 SVG 模糊有明确且未修复的性能缺陷记录。Paper Shaders 的 MeshGradient 给出了同一模型的 GPU 写法：value noise 驱动的 sin/cos 扭曲、按半径旋转的 swirl、按 1/(d^3.5) 的反距离加权混色，再叠 grain。丝绸折痕的来源是 domain warping，即 f(p) 改为 f(p + h(p))，但强度要压到 Inigo Quilez 大理石示例的十分之一量级，落在 0.2 到 0.8 UV 单位、3 到 4 倍频、1 到 2 级。噪声基函数在多倍频下差异很小，simplex 专利 2022 年已到期，MIT 实现随手可得；但 GLSL 里的 sin-hash 跨 GPU 结果不一致，是“同一 seed 出同一张图”的头号杀手。色彩上，色斑混色应在 Oklab 做，OKLCH 只用于两端都有色相的双色渐变，消色差端点必须显式赋同色相与极小 chroma，否则中段会绕出青紫。去 banding 的标准答案是 sRGB 空间量化前加 2 LSB 三角分布抖动，黑白边界回退到 1 LSB。流体模拟快照不适合本项目，随机 splat 与网格分辨率使同一 seed 在不同导出尺寸下结果不同。

| 主张                                                                                                                                                                                                                      | 来源 URL                                                                                                  | 访问日期   | 分级             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| Justin Jay Wang 在 OpenAI 用过三种随机渐变法，layered radial 于 2020 到 2022 年上线，单张 SVG 约 6 KB；社区逆向出的参数分布为 12 个椭圆、fx 0.1 到 0.4、scale 0.7 到 1.5、skew ±10°、rotation 0 到 360°、translation ±250 | https://justinjay.wang/methods-for-random-gradients/                                                      | 2026-08-29 | official         |
| Paper Shaders mesh-gradient 片元着色器结构：hash21 驱动的 value noise、两次迭代的 sin/cos 坐标扭曲按 center 权重衰减、swirl 为 `angle = 3 * swirl * radius`、混色为 `weight = 1/(pow(dist, 3.5) + 1e-3)` 归一化           | https://raw.githubusercontent.com/paper-design/shaders/main/packages/shaders/src/shaders/mesh-gradient.ts | 2026-08-29 | official         |
| Domain warping 公式与调参：`q=(fbm(p), fbm(p+(5.2,1.3)))`、`r=(fbm(p+4q+…))`、`f=fbm(p+4r)`；fBm 每倍频乘旋转矩阵去相关，lacunarity 取 2.01 到 2.04 而非 2.0 以避免格点伪影                                               | https://iquilezles.org/articles/warp/                                                                     | 2026-08-29 | official         |
| psrdnoise 提供 GLSL 1.20 / WebGL1 兼容的 2D/3D 平铺 simplex 流噪声，含 mediump 16 位精度兼容变体，MIT；simplex noise 专利 US6867776 已于 2022-01-08 到期                                                                  | https://github.com/stegu/psrdnoise                                                                        | 2026-08-29 | official         |
| lygia shader 库为 Prosperity（非商业）加 Patron 双许可，商业用途只有 30 天试用                                                                                                                                            | https://github.com/patriciogonzalezvivo/lygia                                                             | 2026-08-29 | official         |
| 2D curl noise 只需一个标量噪声 f 即可得 `v=(f_y, −f_x)`，自动无散度，流线就是 f 的等值线，是流体快照的确定性替代                                                                                                          | https://dl.acm.org/doi/10.1145/3757377.3763980                                                            | 2026-08-29 | official         |
| CSS Color 4 明确：需要感知均匀用 Oklab，要避免混色发灰、保持全程 chroma 用 OkLCh；sRGB 插值会得到偏暗或发灰的中间色                                                                                                       | https://www.w3.org/TR/css-color-4                                                                         | 2026-08-29 | official         |
| OKLCH 插值在消色差端点（白 / 黑 / 灰 / 透明）会出现色偏，blue→white 中段出现青或紫且 Chrome 与 Safari 不一致；解法是把中性色写成同色相、chroma 0.001                                                                      | https://keithjgrant.com/posts/2023/11/problematic-color-gradients-and-workarounds/                        | 2026-08-29 | community        |
| 抖动噪声应为三角分布、幅度 2 LSB，必须在量化发生的色彩空间（sRGB）里加噪；靠近纯黑纯白时三角噪声被裁剪会产生偏差，需插值回 1 LSB 均匀噪声                                                                                 | https://loopit.dk/banding_in_games.pdf                                                                    | 2026-08-29 | official-derived |
| GLSL 的 sin-hash 在 Nvidia、AMD、Mac、手机上结果各不相同，应改用 Hoskins 的 fract-hash；WebGL2 强制支持 highp，ES 2.0 片元 highp 可选                                                                                     | https://github.com/danilw/GPU-sin-hash-stability                                                          | 2026-08-29 | community        |
| 无模糊的“模糊色斑”写法：每个色斑按 `exp(−k·d²)` 高斯衰减加性叠加后压亮部，或按高斯权重归一化混合；Paper 用 1/(d^3.5) 反距离加权                                                                                           | https://en.wikipedia.org/wiki/Inverse_distance_weighting                                                  | 2026-08-29 | community        |
| WebKit bug 283156“blur effects on SVG have performance issues”于 2024-11-14 提交，状态 NEW，至今未修                                                                                                                      | https://bugs.webkit.org/show_bug.cgi?id=283156                                                            | 2026-08-29 | official         |

对本项目意味着什么：这一维度的价值从“怎么自写 shader”转成了“怎么给 paper shaders 调参和验收”。种子映射用 mulberry32 之类的确定性 PRNG，把 seed 映射到 `frame`、`positions`、`distortion`、`swirl`、`rotation` 上；跨 GPU 只承诺视觉一致不承诺 bit-exact，因为库内部的哈希与精度路径不受项目控制。颗粒参数默认低值有工程依据，去 banding 下限是 1 到 2 LSB，风格化档位在此之上另加。导出时颗粒尺寸应按 `exportSize / 1024` 缩放，否则同一 seed 在 512 与 4096 下观感不一致。丝绸质感的强度滑杆区间要往小了取，参照的是柔和渐变而不是大理石纹。

### 2.3 开源库与许可证

结论：候选库里只有 `@paper-design/shaders` 同时满足可商用、零依赖、专做柔和渐变三条。它 0.0.80 版于 2026-08-09 发布，0.0.77 起许可证由 PolyForm Shield 改为 Apache-2.0，vanilla 包 dependencies 为空，`ShaderMount` 是纯 WebGL2 的类，公开 `canvasElement` 字段，构造函数第四参 `webGlContextAttributes` 直接透传给 `getContext('webgl2')`，传 `preserveDrawingBuffer: true` 后可直接 `toBlob`。代价是 WebGL2 硬依赖、README 明确要求锁精确版本、0.0.x 阶段会有破坏性更新。其余候选各有硬伤：React Bits 是 MIT 加 Commons Clause，用在自己站点没问题但不得把组件本身再分发，且背景组件依赖分裂在 ogl 与 three 两套栈；shadergradient 要拖进整套 three 3D 场景；whatamesh 无 LICENSE 文件且源自 Stripe 逆向、2023-10 后停更；unicorn.studio 与 npm 上的 `shaders` 包都是专有许可；gradient-gl 的 seed 只编码色相饱和明度不接受自定义色板；trianglify 是 GPL-3.0 会传染整仓；boring-avatars 与 DiceBear 是身份头像生成器，渐变只是双色线性。

| 主张                                                                                                                                                                                                                                                        | 来源 URL                                                                               | 访问日期   | 分级      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- | --------- |
| `@paper-design/shaders` 与 `-react` 均为 0.0.80、2026-08-09 发布、Apache-2.0，vanilla 包零依赖；CHANGELOG 记录 0.0.77 由 PolyForm Shield 改为 Apache-2.0，再分发需保留 LICENSE 与 NOTICE；README 要求锁版本                                                 | https://github.com/paper-design/shaders/blob/main/CHANGELOG.md                         | 2026-08-29 | official  |
| `ShaderMount` 构造签名为 `(parentElement, fragmentShader, uniforms, webGlContextAttributes?, speed=0, frame=0, minPixelRatio=2, maxPixelCount=8294400, mipmaps)`，实例公开 `canvasElement`，可用 `setUniformValues` / `setSpeed` 更新；不支持 WebGL2 时抛错 | https://github.com/paper-design/shaders/blob/main/packages/shaders/src/shader-mount.ts | 2026-08-29 | official  |
| 所有 shader 共享 speed / frame 语义，官方 Common Props 原文“When speed=0 frame fully defines the state of static shader”                                                                                                                                    | https://shaders.paper.design/grain-gradient                                            | 2026-08-29 | official  |
| StaticMeshGradient 最多 10 色，参数 warpStrength / blendSharpness / grain，另有 waveX / waveY 与 mixing；0.0.69 起 mixing 使用更平滑曲线，0.0.54 起 grain 改为像素级噪点                                                                                    | https://shaders.paper.design/static-radial-gradient                                    | 2026-08-29 | official  |
| OpenAI 风格渐变的开源复刻 venkr/gradient-gen（MIT）用 12 个 rect 各 fill 一个带 fx 焦点的 radialGradient，transform 链为 translate→scale→skewX→rotate→translate，外层 `filter: saturate(125%)`                                                              | https://github.com/venkr/gradient-gen/blob/main/src/EllipseGenerator.tsx               | 2026-08-29 | community |
| React Bits 为 MIT 加 Commons Clause Condition v1.0：可用于应用、网站或产品，但不得单独、打包或移植后出售、再许可、再分发组件本身                                                                                                                            | https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md                           | 2026-08-29 | official  |
| shadergradient 主包 2.4.20（2025-12-08，MIT）需自行安装 `@react-three/fiber`、`three>=0.158`、`three-stdlib`、`camera-controls`                                                                                                                             | https://github.com/ruucm/shadergradient                                                | 2026-08-29 | official  |
| whatamesh npm 0.2.0（2023-10-04）license 字段为空、仓库无 LICENSE 文件，核心代码是 Stripe 官网的逆向                                                                                                                                                        | https://github.com/jordienr/whatamesh                                                  | 2026-08-29 | official  |
| ogl 1.0.11（2025-01-27）为 Unlicense、零依赖、核心 8 kB，但一年半无新版，且 npm 包内缺 LICENSE 文件                                                                                                                                                         | https://www.npmjs.com/package/ogl                                                      | 2026-08-29 | official  |
| trianglify 4.1.1（2020-11-01）为 GPL-3.0，闭源项目需购买商业许可                                                                                                                                                                                            | https://www.npmjs.com/package/trianglify                                               | 2026-08-29 | official  |
| `@mesh-gradient/core` 2.0.2（2026-05-05，MIT）零依赖 8 kB gzip、WebGL、提供 isStatic 静态模式，但最多 4 色                                                                                                                                                  | https://github.com/mikhailmogilnikov/mesh-gradient                                     | 2026-08-29 | official  |
| keshav-exe/gradii（MIT）是 Next.js 15 + Canvas 2D 的开源渐变壁纸生成器，支持文字叠加与多分辨率导出，产品形态与本项目最接近                                                                                                                                  | https://github.com/keshav-exe/gradii                                                   | 2026-08-29 | official  |

对本项目意味着什么：依赖清单收敛到一条，`@paper-design/shaders` 锁 0.0.80 精确版本，只用 vanilla 包自建薄封装，不装 `-react`。再分发时保留 LICENSE 与 NOTICE 是 Apache-2.0 的硬要求，需要在构建产物或仓库里体现。React Bits Pro 的组件源码落进仓库属于使用而非再分发，边界清楚，但不能把渐变组件抽成独立 npm 包发布。同页面挂多个 `ShaderMount` 做配色缩略图会撞到浏览器的 WebGL 上下文数量上限，配色选择器的真实渐变缩略图应该用单个 mount 切 uniforms 逐张离屏渲染后缓存位图，不要每个色块一个上下文。

### 2.4 导出管线

结论：四条硬约束。第一，尺寸上限靠运行时探测而不是写死常量。WebKit 主线 `CanvasBase.cpp` 的 `maxCanvasArea()` 在 iOS 系为 8192×8192、其他平台 16384×16384，按设备像素的面积计；iOS 这个上限是 2024-03-15 的提交提上来的、随 iOS 18 发布，iOS 17 及更早仍是 4096²。WebGL 侧 Android 只有 `MAX_TEXTURE_SIZE` ≥ 4096 是全覆盖。第二，文件体积由噪点决定而不是渐变本身，无噪点 4096² JPG q0.85 只有 226 KB，噪点幅度 0.06 时 2048² q0.85 就要 934 KB，PNG 带噪点 4096² 高达 32.7 MB，所以体积控制必须让 quality 二分与分辨率回退联动。第三，编码器以浏览器原生 `toBlob` / `convertToBlob` 为主，4096² JPG 编码约 100 ms，WASM 编码器只在两个缺口有价值：Safari 不能出 WebP，以及用户主动要求更小文件时的 MozJPEG，后者同质量只多省 5% 到 15%。第四，不支持的 type 会静默回落 PNG，必须比对 `blob.type`。

| 主张                                                                                                                                                                                                                                                                                                | 来源 URL                                                                                                                                               | 访问日期   | 分级             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- |
| WebKit 主线 2D canvas 面积上限：iOS 系 8192×8192（67,108,864 像素），macOS 与其他平台 16384×16384，按设备像素计，超限报“Canvas area exceeds the maximum limit”                                                                                                                                      | https://github.com/WebKit/WebKit/blob/main/Source/WebCore/html/CanvasBase.cpp                                                                          | 2026-08-29 | official         |
| iOS 画布上限从 4096² 提到 8192² 的提交为 2024-03-15 的 276145@main（bug 271002），社区实测随 iOS 18.0 发布                                                                                                                                                                                          | https://commits.webkit.org/276145@main                                                                                                                 | 2026-08-29 | official         |
| canvas-size 实测表：Chrome 桌面 16384²、Firefox 122+ 23168²、Safari macOS 16384²、Android Chrome 在 Android 8 到 11 为 16384²、Mobile Safari 为 4096²（iOS 18 之前）                                                                                                                                | https://jhildenbiddle.github.io/canvas-size/                                                                                                           | 2026-08-29 | community        |
| iOS 有画布总内存上限，WebKit bug 195325 记录为 384 MB，一个 4096² 画布占 64 MB；分配失败后不恢复的问题在 2023-06 修复                                                                                                                                                                               | https://bugs.webkit.org/show_bug.cgi?id=195325                                                                                                         | 2026-08-29 | official         |
| web3dsurvey 遥测：`MAX_TEXTURE_SIZE` ≥ 4096 全平台 100%、≥ 8192 为 97%；Android ≥ 8192 仅 73%、≥ 16384 仅 2% 到 3%；iOS ≥ 8192 为 100%                                                                                                                                                              | https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE                                                                                              | 2026-08-29 | community        |
| `canvas.toBlob` 的 quality 只对 image/jpeg 与 image/webp 生效、默认 0.92；不支持的 type 静默回退为 PNG；Safari 到 27 / TP 仍不支持 image/webp 输出                                                                                                                                                  | https://caniuse.com/mdn-api_htmlcanvaselement_toblob_type_parameter_webp                                                                               | 2026-08-29 | official-derived |
| libjpeg-turbo 官方对 MozJPEG 的评价：靠 trellis 量化与渐进扫描换更小体积，代价是编码显著变慢；社区口径为同质量下小 5% 到 15%                                                                                                                                                                        | https://libjpeg-turbo.org/About/Mozjpeg                                                                                                                | 2026-08-29 | official         |
| jSquash 各包 WASM 体积实测：webp enc 281,261 B（gzip 113,965），SIMD 版 345,584 B（gzip 125,975）；jpeg enc 251,524 B（gzip 59,068）加 38 KB 胶水 JS                                                                                                                                                | https://registry.npmjs.org/@jsquash/webp/-/webp-1.5.0.tgz                                                                                              | 2026-08-29 | self-made        |
| browser-image-compression 2.0.2 最后发布与最后提交均为 2023-03-06，Snyk 标为 Inactive；实现是最多 10 轮 quality 迭代                                                                                                                                                                                | https://github.com/Donaldcwl/browser-image-compression/releases                                                                                        | 2026-08-29 | official         |
| libimagequant 与 pngquant 为 GPL-3.0 加商业双许可，前端捆绑需整仓改 GPL                                                                                                                                                                                                                             | https://pngquant.org/lib/                                                                                                                              | 2026-08-29 | official         |
| 自测（Chromium 152 / macOS，Playwright 驱动本地基准页）：无噪点 2048² JPG q0.85 为 87 KB、4096² 为 226 KB；噪点 0.06 时 2048² q0.7/0.8/0.85/0.9 为 473/722/934/1247 KB，4096² 为 1847/2830/3660/4903 KB；PNG 带噪点 2048² 8.2 MB、4096² 32.7 MB；JPG 编码耗时 2048² 20 到 30 ms、4096² 73 到 103 ms | file:///private/tmp/claude-501/-Users-hubby-Workspace-Zixuan-jianbian-touxiang-shengchengqi/7839cee9-aef2-4cbe-ae94-f7c6cc727faa/scratchpad/bench.html | 2026-08-29 | self-made        |
| `createImageBitmap` 的 resizeQuality 在 Chromium 有长期缺陷（issue 41313833），high 只等于 Lanczos2，不宜用作高质量缩放                                                                                                                                                                             | https://issues.chromium.org/issues/41313833                                                                                                            | 2026-08-29 | official         |

对本项目意味着什么：导出默认 1024×1024 加 JPG 目标 1 MB 是有余量的选择，按自测系数 1024² 头像 JPG 落在 150 到 300 KB。目标体积二分的质量下限取 0.6 合理，因为 4096² 带中等噪点即使 q0.7 也进不了 2 MB，达不到目标时提示降分辨率比自动改噪点更诚实，噪点属于作品本身不该被体积逻辑改动。尺寸上限探测要读三项：`MAX_RENDERBUFFER_SIZE`、`MAX_TEXTURE_SIZE`，以及 2D 画布可分配面积（画 1 像素后 `getImageData` 校验）。同时存活的全尺寸画布不超过 2 个，用完立即把宽高置 1 释放。PNG 无法控制体积，只能在 4096 及以上给出体积提示。

### 2.5 排版与 Google Fonts

结论：中文字体的动态加载可行，但路径与最初设想不同。Google css2 的 `text=` 参数官方称能缩小最多 90%，实测对 ZCOOL KuaiLe 一类静态中文字体确实只返回 1 到 3 KB 的子集，但对最关键的 Noto Sans / Serif SC、TC、JP 完全不生效，传几个字仍返回 2.4 到 5.5 MB 的整套字体（30,796 个 glyph），可变字体的子集化在这里是失效的。可用的机制是 `unicode-range` 切片：Noto Sans SC 每个字重被切成 101 个 `@font-face`，单切片 3,748 到 65,472 字节，浏览器只会拉命中的那几片，配合 `document.fonts.load(font, text)` 的第二参数即可把下载范围限制到覆盖输入字符的 face。字体目录的可用来源里，Fontsource 的 `/v1/fonts` 免 key 且返回 2096 个字体含分类与子集，是唯一不需要密钥又能直接在前端用的一条；Google 官方 Developer API 需要 key，只能放在构建期。Google Fonts 上的中文家族一共 29 个（简体 10、繁体 16、香港 3）。排版侧，`Intl.Segmenter` 已 Baseline 2024，CJK 断词不需要第三方库；Canvas `letterSpacing` 已 Baseline 2025（Safari 18.4 起）。自动填满用 `canvas.measureText` 二分不触发回流，但多行拟合的搜索空间并非严格单调，必须记录最后一次可行解。

| 主张                                                                                                                                                                                                                                                                                                                                                                                                                            | 来源 URL                                                                                                     | 访问日期   | 分级             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- | ---------------- |
| CSS Font Loading API：`new FontFace(family, 'url(...)', {weight, unicodeRange})` 后 `document.fonts.add()`，`load()` 完成才能绘制；`FontFaceSet.load(font, text)` 的第二参数把加载范围限制到 unicode-range 覆盖 text 中至少一个字符的 face，Baseline Widely available                                                                                                                                                           | https://developer.mozilla.org/en-US/docs/Web/API/FontFaceSet/load                                            | 2026-08-29 | official         |
| Google Fonts css2 支持 `text=` 按字符子集化，官方称最多缩小 90%，一次请求只能带一个 `text=`；CSS 与字体文件均以 `Access-Control-Allow-Origin: *` 响应，前端可直接 fetch                                                                                                                                                                                                                                                         | https://developers.google.com/fonts/docs/css2                                                                | 2026-08-29 | official         |
| 实测 css2 对 Noto Sans SC 每个字重生成 101 个 `@font-face` 切片，单切片 3,748 到 65,472 字节；ZCOOL KuaiLe 为 93 个切片，传 `text=` 只返回一个含 3 个码位的 `@font-face`                                                                                                                                                                                                                                                        | https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&text=%E7%8C%AA%E7%8C%AA%E5%AE%B6%E6%97%8F&display=swap | 2026-08-29 | self-made        |
| Fontsource API `GET /v1/fonts` 免 key、硬上限 2500 次每 10 秒，全量返回 2096 个字体（1976 个 type=google），JSON 538 KB，`/v1/fonts/{id}` 返回 unicodeRange 映射与各格式 URL；其 jsDelivr CDN 文件 URL 为 `https://cdn.jsdelivr.net/fontsource/fonts/{id}@{version}/{subset}-{weight}-{style}.{ext}`，支持 woff2/woff/ttf、均带 `Access-Control-Allow-Origin: *`，实测 noto-sans-sc 编号切片 `4-400-normal.woff2` 仅 2,300 字节 | https://fontsource.org/docs/api/font-id                                                                      | 2026-08-29 | official         |
| Google Fonts 当前中文家族：chinese-simplified 10 个（Liu Jian Mao Cao、Long Cang、Ma Shan Zheng、Noto Sans SC、Noto Serif SC、WDXL Lubrifont SC、ZCOOL KuaiLe、ZCOOL QingKe HuangYou、ZCOOL XiaoWei、Zhi Mang Xing）、chinese-traditional 16 个、chinese-hongkong 3 个                                                                                                                                                          | https://fonts.google.com/specimen/LXGW%2BWenKai%2BTC                                                         | 2026-08-29 | official-derived |
| cdn.jsdelivr.net 于 2021-12 失去 ICP 备案，2022-04 起在大陆遭 DNS 污染与 SNI 阻断，可用替代子域为 gcore.jsdelivr.net、fastly.jsdelivr.net、testingcf.jsdelivr.net                                                                                                                                                                                                                                                               | https://github.com/jsdelivr/jsdelivr/issues/18397                                                            | 2026-08-29 | community        |
| `Intl.Segmenter` 于 2024-04-16 进入 Baseline Newly available，caniuse 全球覆盖 94.88%，granularity 支持 grapheme / word / sentence，可正确切分无空格的中日文                                                                                                                                                                                                                                                                    | https://web.dev/blog/intl-segmenter                                                                          | 2026-08-29 | official         |
| 单行拟合有闭式解 `fontSize = W / w₁`（1px 字号下的自然宽度），多行拟合利用缩放不变性做二分、10 次迭代到像素精度；但多行搜索空间并非严格单调，换行位置变化会改变字距与连字，纯二分必须加“取最后一次可行解”的保护                                                                                                                                                                                                                 | https://github.com/darkroomengineering/fitbox                                                                | 2026-08-29 | official         |
| 飞书群头像基准 208×208 px、描边 6.5 px，文字按字数取 116 / 92 / 72 / 60 px，5 到 8 字时行高 68 px（比值 1.13），最多两行；个人默认文字头像基准 640×640 px                                                                                                                                                                                                                                                                       | https://open.feishu.cn/document/design-specification/component---data-display/avatar?lang=zh-CN              | 2026-08-29 | official         |
| Discord 头像推荐 512×512 显示为圆形、社区建议主体保持在中央约 70% 安全区；圆内接正方形边长为直径的 0.707                                                                                                                                                                                                                                                                                                                        | https://roundcut.app/blog/github-avatar-square-crop-survives-circle/                                         | 2026-08-29 | community        |
| 微信群聊头像由成员头像自动拼合、无法直接上传自定义群头像；企业微信群支持在群信息页更换自定义头像                                                                                                                                                                                                                                                                                                                                | https://cloud.tencent.com/developer/news/773194                                                              | 2026-08-29 | community        |
| Material Design 3：title / headline / display 等大字建议行高比 1.2，display-large 57 px 行高 64 px、tracking -0.25 px                                                                                                                                                                                                                                                                                                           | https://m3.material.io/styles/typography/applying-type                                                       | 2026-08-29 | official         |

对本项目意味着什么：字体加载走 css2 端点靠 `unicode-range` 切片，不传 `text=`，实现上就是解析 CSS 后只注册命中的 `@font-face`，避免把上百条 `@font-face` 全塞进页面。`document.fonts.load()` 就绪后才绘制是硬要求，否则会画出回退字体。镜像回退用 Fontsource 在 jsDelivr 上的 CSS，域名必须可配置，且要清楚 cdn.jsdelivr.net 在大陆不可靠、gcore 子域是替代。排版默认值（安全区、行高、字间距、字号区间）见附录 C，其中圆形 70% 有几何依据。产品文案要注意“微信群头像”场景对个人微信不成立，实际目标是企业微信、飞书、钉钉、Slack、Discord 与个人头像。

### 2.6 前端栈与移动端

结论：脚手架定在 Vite 8 + React 19 + Tailwind v4 + shadcn CLI 4.19，四者都在 2026 年 7 到 8 月有过发布，维护活跃。shadcn 自 2026 年 7 月起默认底层是 Base UI，Radix 需显式 `init -b radix`，两者都还支持。付费 registry 通过 `components.json` 的 `registries` 字段接入，对象形态里的 `headers.Authorization` 支持 `${ENV_VAR}` 从 `process.env` 展开，密钥只写 `.env.local`。移动端抽屉的选型很清楚：vaul 最新版 1.1.2 停在 2024-12-14，此后无发布，Snyk 判定 Inactive；Base UI 的 Drawer 自 1.3.0 起稳定，原生提供 `snapPoints` / `snapPoint` / `onSnapPointChange` 与 `--drawer-snap-point-offset` CSS 变量，shadcn 的 base 风格 drawer 已经切到它。触控与输入的三条硬约束分别来自 Apple HIG（44×44 pt）、WCAG 2.2（AA 级 24×24 CSS px）与 iOS Safari 的聚焦缩放行为（输入框字号 ≥ 16 px）。分享走 `navigator.canShare({files})` 再 `share()`，但 Android WebView 长期不实现 Web Share API，微信安卓端用的是自研 XWeb 内核，能力不等同系统 Chrome，必须准备回退。

| 主张                                                                                                                                                                                                                                                                                    | 来源 URL                                                             | 访问日期   | 分级             |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------- | ---------------- |
| shadcn CLI latest 为 4.19.0、2026-08-21 发布、MIT；`init` 支持 `-t vite`、`--preset`、`-b base\|radix\|aria`；自 2026 年 7 月起默认底层为 Base UI，Radix 需显式 `-b radix` 且未弃用，Base UI 用 `render` prop 替代 Radix 的 `asChild`                                                   | https://ui.shadcn.com/docs/cli                                       | 2026-08-29 | official         |
| `components.json` 的 `registries` 支持字符串模板或 `{url, headers, params}` 对象，URL、headers、params 中的 `${ENV_VAR}` 从 `process.env` 展开，命名空间以 `@` 开头                                                                                                                     | https://ui.shadcn.com/docs/registry/namespace                        | 2026-08-29 | official         |
| React Bits Pro registry 端点未带密钥时返回 401 并回显官方配置：`@reactbits-starter` 用 `https://pro.reactbits.dev/api/r/starter/{name}.json`，`@reactbits-pro` 用 `/api/r/pro/{name}.json`，header 均为 `Authorization: Bearer ${REACTBITS_LICENSE_KEY}`                                | https://pro.reactbits.dev/api/r/starter/skill                        | 2026-08-29 | official         |
| `@base-ui/react` 1.7.0（2026-08-04，MIT）；Drawer 自 1.3.0 起稳定，提供 `snapPoints` / `snapPoint` / `onSnapPointChange` 与 `--drawer-snap-point-offset`，1.6.0 加入 VirtualKeyboardProvider；shadcn base 风格的 Drawer 已封装它，radix 风格仍用 vaul，而 vaul 停在 1.1.2（2024-12-14） | https://base-ui.com/react/components/drawer                          | 2026-08-29 | official         |
| Vite 8.0 于 2026-03-12 发布并切换到 Rolldown，当前 latest 8.2.2（2026-08-20）；`@vitejs/plugin-react` 6.1.1（2026-08-28）默认走 Oxc 不再依赖 Babel；同期锁定的其余版本为 React 19.2.8、Tailwind 4.3.3、zustand 5.0.15                                                                   | https://vite.dev/blog/announcing-vite8                               | 2026-08-29 | official         |
| vite-plugin-pwa 1.3.0（2026-05-05，MIT）peer 支持 Vite 8，React 用 `virtual:pwa-register/react` 的 `useRegisterSW` 拿到 `needRefresh` / `offlineReady`                                                                                                                                  | https://github.com/vite-pwa/vite-plugin-pwa/releases/tag/v1.3.0      | 2026-08-29 | official         |
| Web Share API 需安全上下文与用户手势，分享文件前先 `navigator.canShare({ files })`；MDN 兼容表显示 Safari 与 Chrome Android 支持文件分享                                                                                                                                                | https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share     | 2026-08-29 | official         |
| Chromium 长期 issue 记录 Android WebView 不实现 Web Share API，iOS WKWebView 开箱支持                                                                                                                                                                                                   | https://issues.chromium.org/issues/40540400                          | 2026-08-29 | official-derived |
| Apple HIG 要求可点击控件至少 44×44 pt；WCAG 2.2 的 2.5.8 Target Size 为 AA 级 24×24 CSS px、2.5.5 为 AAA 级 44×44                                                                                                                                                                       | https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html | 2026-08-29 | official         |
| iOS Safari 对字号小于 16 px 的输入框聚焦时自动缩放页面，字号设为 16 px 可避免                                                                                                                                                                                                           | https://css-tricks.com/16px-or-larger-text-prevents-ios-form-zoom/   | 2026-08-29 | community        |
| `env(safe-area-inset-*)` 需要 `<meta name="viewport" content="viewport-fit=cover">` 才有非零值                                                                                                                                                                                          | https://developer.mozilla.org/en-US/docs/Web/CSS/env                 | 2026-08-29 | official         |
| Apple HIG Sheets 支持 medium / large detents 与 grabber；Material 3 规定 modal bottom sheet 初始高度不超过屏幕 50%、最大宽度 640 dp                                                                                                                                                     | https://developer.apple.com/design/human-interface-guidelines/sheets | 2026-08-29 | official         |

对本项目意味着什么：手机端布局形状有了外部依据。预览区 sticky 在顶部、高度约 44 vh，底部抽屉的两档 snap 取约 0.45 与 1，对应 Apple 的 detents 与 Material 的 50% 初始高度。底部固定操作条要留 `env(safe-area-inset-bottom)`，前提是 viewport meta 写了 `viewport-fit=cover`。所有触控目标 ≥ 44 px、输入框 ≥ 16 px 是两条不同来源的硬约束，不能只满足其一。分享路径必须先 `canShare({files})` 再 `share()`，失败回落 `<a download>`；如果后续要覆盖微信内置浏览器，还需要长按保存的兜底形态。

### 2.7 配色与对比度

结论：2025 到 2026 年 AI 产品的配色可归成七个家族，黑白灰加地平线蓝灰的极简系、暖陶土配米白纸感、电光蓝到蓝紫的可信科技系、蓝紫粉多段渐变、松石青与薄荷绿、柔彩全息与宇宙渐变、暖白中性与去饱和金属。中文用户对“AI 感”的直觉集中在蓝紫渐变，所以浅色与深色的蓝紫各要有一套。算法层面，Tailwind v4 与 Radix Colors 的色阶都是在 OKLCH 里手工微调的，不是纯公式，可编程且稳妥的路线是固定明度阶梯加受控 chroma。一个必须处理的物理约束是 sRGB 里 OKLCH 的最大 chroma 强依赖色相：L=0.85 时红蓝紫只有约 0.074 到 0.089，绿黄却能到 0.2 以上，所以浅色配色在红蓝紫必须主动压低 chroma，否则会被色域裁切成灰。对比度判定上 WCAG 2 仍是 2026 年的法定基线，WCAG 3 草案 2026-03 版明写算法未定，APCA 2023 年已被移出草案，只能当第二意见；头像在聊天列表只有 40 到 48 px，文字实际只有 10 到 20 px，属于小字场景。

| 主张                                                                                                                                                                                                                                                                                               | 来源 URL                                                                                                             | 访问日期   | 分级             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------- |
| OpenAI 2025 年换标后的调色板是“灰与蓝为底、唤起地平线与天空”，再配对比强的原色；官方品牌页确认论文封面用蓝、黄、橙、绿、粉五种柔彩，周边用从浅到深的蓝色渐变圆                                                                                                                                     | https://www.wallpaper.com/tech/openai-has-undergone-its-first-ever-rebrand-giving-fresh-life-to-chatgpt-interactions | 2026-08-29 | official-derived |
| Anthropic 站点设计令牌：Clay #D97757、Clay Deep #C6613F、Ivory Medium #F0EEE6、Ivory Light #FAF9F5、Oat Warm #E3DACC、Manilla #F5E3C7、Slate Dark #141413、Cloud Medium #B0AEA5；系统明确不用冷灰与蓝                                                                                              | https://styles.refero.design/style/d469cba4-c448-4a43-a033-883f8bfcdc42                                              | 2026-08-29 | official-derived |
| Perplexity 官方品牌指南给出 Turquoise 100 到 900 的完整阶梯：#DEF7F9 #92DCE2 #35BDC8 #2CA0AB #1A6872 #114F56 #0B363C #081F22                                                                                                                                                                       | https://live.standards.site/perplexity/color                                                                         | 2026-08-29 | official         |
| Kimi 品牌书（2026-08-25 更新）色彩系统含 #002F5B #007CFF #00A1FF #A0DAF7 #DFC8F5 #FFD1D4 #B3F4A8 #F4F9A7 等，以电光蓝为中心配柔彩四色                                                                                                                                                              | https://www.kimi.ai/resources/kimi-brand                                                                             | 2026-08-29 | official         |
| Equinor EDS 色板生成器公开算法：每级固定 lightness（浅色背景 0.97 到 0.999、深色 0.15 到 0.25），chroma = gaussian(L, mean, stdDev) × baseChroma，gaussian(x) = exp((-25/stdDev)(mean-x)²)                                                                                                         | https://color-palette-generator-eds-prod.radix.equinor.com/about                                                     | 2026-08-29 | official         |
| APCA 官方阈值：Lc 90 优选正文、Lc 75 正文最低、Lc 60 非正文内容文字最低、Lc 45 大标题最低、Lc 30 绝对下限；Lc 60 约等于 WCAG 4.5:1，Lc 45 约等于 3:1                                                                                                                                               | https://apcacontrast.com/                                                                                            | 2026-08-29 | official         |
| WCAG 3 工作草案 2026-03-03 版编辑注明写“The contrast algorithm used in WCAG 3 is yet to be determined”，APCA 2023 年中被移出草案                                                                                                                                                                   | https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html                                               | 2026-08-29 | community        |
| 自测（culori 4.0.2 的 clampChroma 二分）sRGB 内 OKLCH 最大 chroma 随色相剧烈变化：L=0.85 时 H=0° 为 0.089、60° 0.101、120° 0.202、150° 0.234、240° 0.083、270° 0.074、300° 0.087；L=0.92 时红蓝紫只剩约 0.04                                                                                       | https://culorijs.org/api                                                                                             | 2026-08-29 | self-made        |
| 企业微信官方深色模式色值：浅色聊天页背景 #EBEDF0、一级背景 #FFFFFF；深色底层 #000000、一级 #19191A、二级 #272829、气泡 #222324；微信浅色列表底为 #EDEDED / #F7F7F7、深色聊天背景 #181818                                                                                                           | https://developer.work.weixin.qq.com/document/path/94600                                                             | 2026-08-29 | official         |
| Discord 深色主题主背景 #313338、侧栏 #2B2D31、最深 #1E1F22；Red Hat 设计系统要求头像缩略图与主题匹配，深色模式下高饱和色会“振动”应降饱和                                                                                                                                                           | https://ux.redhat.com/elements/avatar/guidelines/                                                                    | 2026-08-29 | official         |
| culori 最新 4.0.2（2025-06-27，MIT），把 XYZ 与 Oklab 的转换矩阵改为与 css-color-4 一致，并修正 toGamut 在非 LCH 类空间的报错                                                                                                                                                                      | https://github.com/evercoder/culori/releases                                                                         | 2026-08-29 | official         |
| 自测 17 套配色的对比度（文字对最差停靠点 Lc / 对 oklab 均值 Lc）：冰川蓝 59 / 82 且 WCAG 8.19:1，全息虹彩 69 / 87 且 10.17:1，深空 77 / 101 且 4.61:1，珊瑚日出 45 / 77 且 5.9:1，陶土燕麦 36 / 69 且 4.55:1（最低）；电光蓝的白字对最浅停靠点 WCAG 仅 2.57:1 但 Lc 55；全部停靠点均在 sRGB 色域内 | https://apcacontrast.com/                                                                                            | 2026-08-29 | self-made        |

对本项目意味着什么：17 套新配色的色值、背景色、文字色与校验值可以直接入库（附录 A），种子配色算法的九个步骤也可以直接实现（附录 B）。自动文字色只做 WCAG 2 ≥ 4.5，实现上就是取文字区域下方像素算平均明度后在 #141413 与 #FFFFFF 之间二选一并校验。配色预览应同时贴在 #EDEDED、#FFFFFF、#181818、#313338 四种底色上按 40 px 与 80 px 两档看，近白配色在浅色列表里会糊边，可以加 1 px 8% 黑内描边；深色配色在深色聊天界面里会沉底，chroma 不宜超过 0.18。前端用 `culori/fn` 按需引入 oklch、rgb、interpolate、clampChroma、toGamut、wcagContrast、formatHex 即可，包体可控。

---

## 三、对抗核验结果

15 条主张逐条找一手来源正反查，12 条成立，3 条被纠正。

### 成立的 12 条

1. 现有 SVG 多层 radialGradient 加 transform 链在结构上就是 Justin Jay Wang 为 openai.com 2020 到 2022 年首页实现的 layered radial 方法，具体参数分布未公开、社区实现均为逆向；该方法在 OpenAI 已随 2023 年官网重做退役。（https://justinjay.wang/methods-for-random-gradients/）
2. WebKit Bugzilla 存在 SVG 模糊性能问题的未修复记录 bug 283156，滤镜中间缓冲区限制为面积 4096×4096 设备像素，超过时按比例缩小 filterScale 再渲染而不是不渲染。（https://bugs.webkit.org/show_bug.cgi?id=283156）
3. `@paper-design/shaders` 0.0.80 于 2026-08-09 发布，Apache-2.0（0.0.77 起由 PolyForm Shield 改来，再分发需保留 LICENSE 与 NOTICE），dependencies 为空；`speed=0` 时取消 rAF、`frame` 决定静态画面；`ShaderMount` 公开 `canvasElement`，构造函数第四参 `webGlContextAttributes` 直传 `getContext('webgl2')`。（https://github.com/paper-design/shaders/blob/main/CHANGELOG.md）
4. lygia 最新 1.4.1（2026-02-07）整库为 Prosperity 3.0.0 加 Patron 双许可，但许可证按文件标注，`generative/snoise.glsl` 与 `cnoise.glsl` 头部标 MIT；MIT 仓库应避免拷入标 Prosperity 的文件。（https://raw.githubusercontent.com/patriciogonzalezvivo/lygia/main/LICENSE.md）
5. WebKit 主线 `CanvasBase.cpp` 的 `maxCanvasArea()` 为 iOS 系 8192×8192、其他平台 16384×16384；iOS 从 4096² 提升的提交为 2024-03-15 的 d1f63c0（276145@main，bug 271002），不在 Safari 17.6 分支，包含于 iOS 18.0 分支。（https://github.com/WebKit/WebKit/commit/d1f63c061eadee6c83dc9fa06a2725c3d099a86b）
6. 按 web3dsurvey 统计，Android 的 `MAX_TEXTURE_SIZE` ≥ 4096 约 100%、≥ 8192 为 73%，成因是 Chrome/ANGLE 在 Android 上的 workaround（Android < 14 钳到 4096，≥ 14 放宽到 8192）；规范底线仅为 2048。（https://web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE）
7. `canvas.toBlob` / `toDataURL` 的 image/webp 在 Safari（macOS 与 iOS）到 27 仍不支持，Safari TP 也无支持迹象，因为 Cocoa 端可编码类型来自 ImageIO 的 CGImageDestination 而 macOS 26 上不含 WebP；按 WHATWG 规范不支持的 type 必须静默回退为 image/png。（https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/HTMLCanvasElement.json）
8. libimagequant（imagequant crate 4.4.1）与 pngquant（3.0.3）均为 GPL-3.0-or-later 加商业双许可，商业许可年费 950 美元起，因此不宜打进 MIT 仓库的浏览器 bundle。（https://pngquant.org/licensing.html）
9. opentype.js 2.0.0 于 2026-05-06 发布，MIT，支持 WOFF / OTF / TTF 但不内置 WOFF2 解析，README 推荐先用 wawoff2 解压。（https://github.com/opentypejs/opentype.js/releases/tag/2.0.0）
10. `Intl.Segmenter` 于 2024-04-16 进入 Baseline Newly available（Firefox 125 补齐），Canvas `letterSpacing` / `wordSpacing` 于 2025-03-31 随 Safari 18.4 进入 Baseline Newly available。（https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes）
11. shadcn CLI 4.19.0 于 2026-08-21 发布（MIT，维护活跃），Base UI 成为 `shadcn init` 默认底层是 2026-07 changelog 宣布的既有状态；`components.json` 的 `registries` 支持 `"Authorization": "Bearer ${REGISTRY_TOKEN}"` 从 `process.env` 展开；Base UI Drawer 1.3.0 起稳定并支持 `snapPoints`；vaul 1.1.2 停在 2024-12-14，Snyk 判定 Inactive。（https://ui.shadcn.com/docs/registry/namespace）
12. WCAG 3.0 Working Draft 2026-03-03 的 Glossary 仍把 contrast ratio test 标为 Exploratory，Editor's note 写“对比度算法尚未确定”，APCA 自 2023-07-24 的草案起不再出现；apca-w3 0.1.9 为 Limited W3 License 且 2022 年后停更，apcach 0.6.4 虽为 MIT 但依赖 apca-w3。（https://www.w3.org/TR/2026/WD-wcag-3.0-20260303/）

### 被纠正的 3 条

**第 2 条：WebGPU 在 Firefox 的状态**

- 原主张：WebGL2 全球覆盖 95.73%，Safari 与 iOS Safari 自 15 起支持；WebGPU 在 Firefox 仍默认关闭、Safari 为 partial。
- 纠正后：WebGL2 覆盖 95.73% 与 Safari 15 起支持成立。WebGPU 全球覆盖 85.56%（83.99% 完整加 1.57% 部分）。Firefox 并非默认关闭：141 起在 Windows 默认开启，145 起在 macOS 26 加 Apple Silicon 开启，147 起覆盖所有受支持 macOS 的 Apple Silicon 设备，Intel Mac 与 Linux 仍限 Nightly。Safari 26.0 起在 macOS Tahoe、iOS 26、iPadOS 26 默认开启 WebGPU，caniuse 把桌面 Safari 标为 partial 仅因 Safari 26 装在 Sequoia / Sonoma 上不默认开启。主路线选 WebGL2 仍成立，依据是 WebGPU 的平台碎片化与约 10 个百分点的覆盖差，而不是“两大浏览器未上线”。
- 证据：https://mozillagfx.wordpress.com/2025/07/15/shipping-webgpu-on-windows-in-firefox-141/

**第 5 条：React Bits 背景组件的依赖与动画形态**

- 原主张：React Bits 采用 MIT 加 Commons Clause，可用于站点但不得把组件本身单独或打包再分发；其背景组件全为时间驱动动画且分散依赖 ogl 与 three。
- 纠正后：许可证部分成立，原文还额外禁止 ported version 与 sublicense。依赖部分不成立：约六成走 WebGL，分别依赖 ogl 或 three 加 `@react-three/fiber`，另有一批只用 Canvas 2D 零依赖（Waves、LetterGlitch、ShapeGrid）或只依赖 gsap（DotGrid、GridMotion）；多数背景默认按时间驱动动画，但部分提供 `disableAnimation`（Dither）或把 speed / timeSpeed 置 0 的静态用法，并非全部只能动态渲染。
- 证据：https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md

**第 11 条：Google Fonts css2 的 `text=` 对中文字体的实际效果**

- 原主张：Google Fonts css2 API 支持 `text=` 按字符子集化，文件可缩小最多 90%，字体文件与 CSS 均带 `Access-Control-Allow-Origin: *`，因此中文 Google Fonts 动态加载可行且体积极小。
- 纠正后：`text=` 参数与 CORS 两点成立（官方文档写明最多缩小 90%，实测两端响应头均带 `access-control-allow-origin: *` 与 `cross-origin-resource-policy: cross-origin`）。但截至 2026-08-29 实测，`text=` 子集化对 Noto Sans SC / TC / JP 与 Noto Serif SC 不生效，无论请求几个字都返回 2.4 到 5.5 MB 的整套字体（`family=Noto+Sans+SC:wght@700&text=渐` 返回 4,642,204 字节 woff2，fontTools 解析含 30,796 个 glyph）；仅对 ZCOOL KuaiLe、ZCOOL XiaoWei、ZCOOL QingKe HuangYou、Ma Shan Zheng、Long Cang、Zhi Mang Xing、Liu Jian Mao Cao 等非 Noto 中文字体能得到 1 到 3 KB 的子集。中文动态加载方案须按字体族区分，并对响应体积做阈值兜底。
- 证据：https://developers.google.com/fonts/docs/css2

---

## 四、调研建议与项目决策的差异

| #   | 调研建议                                                                                                                                                    | 项目决定                                                                                                                                                                                                                                       | 理由                                                                                                                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 自写 WebGL2 fragment shader 为主路线，`@paper-design/shaders` 只作 GPU 风格包，保留 SVG 多层 radialGradient 叠层作兜底渲染器与矢量导出，Node CLI 沿用 resvg | 引擎只用 `@paper-design/shaders` 的 `staticMeshGradient`、`meshGradient`、`warp`、`grainGradient` 四个 shader，项目自建薄封装，不写一行 GLSL；SVG 导出与 Node CLI 一并下线；无 WebGL2 时只给 CSS 多层 `radial-gradient` 的静态近似预览，不导出 | spike 网格已验证这四个 shader 的视觉达标，自写 GLSL 是重复劳动；paper shaders 已把 mesh / warp / grain 调到设计品质并持续维护；头像本来就是位图用途，矢量路线没有真实需求；不留历史包袱是明确的产品口径                              |
| 2   | i18n 用 Paraglide JS 2.25（编译期生成、可 tree-shake），托管顺手迁到 Cloudflare Workers Static Assets                                                       | i18n 自研 JSON 字典加 React context；托管继续留在 Cloudflare Pages                                                                                                                                                                             | Paraglide 切语言要整页刷新，会打断正在编辑的作品；五语言的字典几十行就够，不值得引入编译期方案。Pages 仍在维护且当前部署正常，本次不动托管，避免自定义域名与预览分支的迁移成本                                                       |
| 3   | 双层字体架构：第一层 css2 带 `text=` 子集化，第二层 wawoff2 解压加 opentype.js 轮廓化；镜像默认回退 fonts.loli.net，且运行时资源一律避开 cdn.jsdelivr.net   | 只出位图，不做轮廓化；不传 `text=`，靠 `unicode-range` 切片；镜像用 jsDelivr 上的 fontsource CSS，先 cdn.jsdelivr.net 再 gcore.jsdelivr.net；不用 fonts.loli.net                                                                               | 对抗核验证明 `text=` 对 Noto CJK 完全无效，双层架构的前提不成立；位图导出不需要脱离字体的轮廓，`FontFace` 加 `measureText` 就够，可以整块删掉 opentype.js 与 wawoff2；fonts.loli.net 在项目侧实测返回 EOT 格式，浏览器不可用，不纳入 |
| 4   | 对比度用 WCAG 2 加 APCA 双门槛，APCA 按公开常数自实现，门槛取均值 Lc ≥ 75 且最差 Lc ≥ 45                                                                    | 自动配色只用 WCAG 2 对比度 ≥ 4.5，APCA 不做                                                                                                                                                                                                    | APCA 已被移出 WCAG 3 草案、算法可能再改，自实现要维护一组常数；头像文字是单一大字场景，WCAG 2 的 4.5:1 已能挡住不可读的组合。附录 A 里的 Lc 值保留为参考数据，不进代码                                                               |
| 5   | Safari 上按需动态加载 `@jsquash/webp`（SIMD 构建约 126 KB gzip）补齐 WebP 导出                                                                              | 启动时用 1×1 画布探测 `toBlob('image/webp')` 的返回类型，不支持就直接隐藏 WebP 选项，不引入 WASM 编码器                                                                                                                                        | 头像场景 JPG 与 PNG 已覆盖全部需求，WebP 是锦上添花；为一个可选格式加 126 KB gzip 与 Worker 边界处理不划算；探测返回类型本来就是必须做的防御                                                                                         |
| 6   | shadcn 走 Base UI 底层而不装 vaul；17 套新配色与 OKLCH 种子算法作为配色系统                                                                                 | 采纳                                                                                                                                                                                                                                           | vaul 停更、Base UI Drawer 原生支持 snapPoints；配色数据已用 culori 全量校验，直接作为附录进本文档，实现时读取即可                                                                                                                    |
| 7   | 尺寸上限运行时探测，超上限时按 uv 偏移分块渲染再拼接                                                                                                        | 采纳探测，不做分块；超上限按上限渲染后放大                                                                                                                                                                                                     | 分块拼接要处理噪点与域变形在块边界的无缝性，而颗粒在 paper shaders 内部实现、项目无法控制其像素坐标基准；头像场景放大到 4096 以上的画质损失可接受，导出面板明示“本设备最高原生 N px”比静默分块更诚实                                 |

---

## 五、尚未证实项与失效条件

### 会让当前路线失效的条件

- `@paper-design/shaders` 处于 0.0.x，官方声明会有破坏性更新，近两个月已从 0.0.69 走到 0.0.80。必须锁精确版本并用视觉快照测试守住；若升级成本失控，退路是把四个 shader 的 fragment 源码 vendor 进仓库（Apache-2.0 允许，需保留 LICENSE 与 NOTICE）。
- 同一 seed 在不同 GPU 上不能承诺像素级一致，库内部的哈希实现与 mediump 精度路径不受项目控制。验收口径只能是视觉一致，需要一组跨设备对比图集来定“可接受差异”的标准。规约里的验收标准 4（同一链接在两台设备得到相同构图与配色）应按这个口径理解。
- iOS 17 及更早的 2D 画布面积上限是 4096²，iOS 画布总内存上限只有 2019 年 bug 记录的 384 MB、现值未知。8192² 单画布加导出编码是否会被 Safari 杀页面，必须真机验证，否则 4096 档位的“探测通过”可能在实际导出时崩溃。
- Google Fonts 官方域在大陆的直连可达率未测（本机有代理与疑似 TUN），jsDelivr 的 cdn 子域在大陆已知不可靠。若两条路都不通，字体功能会退化到系统字体，需要保证这个降级路径的提示清楚且界面仍可用。

### 未验证的实现细节

- 同页面挂多个 `ShaderMount` 做配色缩略图会不会触发 iOS Safari 的 WebGL 上下文数量上限，未实测。规约要求配色选择器每个色块用真实渐变缩略图，这是直接相关的风险点。
- Fontsource 的编号切片（如 noto-sans-sc 的 `4-400-normal`）与 Google css2 的 `.4.woff2` 的 `unicode-range` 是否逐一相同，未做自动化比对。镜像回退依赖这个对应关系。
- Worker 内 OffscreenCanvas 2D 用 `FontFace` 加载字体后 `fillText` 在 Safari 的可用性未验证。若可用，文字合成可以整体搬进 Worker，否则要留在主线程。
- shadcnblocks 与 React Bits Pro 的 block 在 Base UI 的 `render` prop 下兼容度未实测，可能需要退回 radix 风格；当前账号所购 React Bits 档位是否覆盖 `@reactbits-pro` 也需以密钥实测 401 来确认。
- iOS 26 Safari 下 Base UI Drawer 需要全局 `body { position: relative }`，与 sticky 预览区叠加时是否有滚动卡顿，需真机验证。
- 微信安卓端 XWeb 内核是否实现 `navigator.share({ files })`，以及 iOS 微信的 WKWebView 下 `share()` 能否把图片直接投递到聊天，未验证。
- 是否需要 Display P3 宽色域导出未评估。culori 支持 `toGamut('p3')`，但导出的 PNG / JPG 若不带 ICC 描述，P3 色值在微信里会被当 sRGB 解释，当前建议只做 sRGB。

### 结论本身的证据强度限制

- 噪点是文件体积主因、4096² 带噪点进不了 2 MB，这条结论来自单台 macOS Chromium 的基准，未覆盖移动端与 Safari，数值只作量级参考。用户可能对“分辨率被自动降低”不满，UI 上必须明示原因。
- 配色的对比度校验用了“最差停靠点”与“oklab 均值”两个代理值。真实渐变是多层叠加且带模糊，文字落点处的局部对比可能介于两者之间，精确做法是在 canvas 上按文字包围盒采样像素。
- 头像在微信聊天列表的实际渲染尺寸、圆角与是否加描边没有查到官方数字，40 到 48 px 是按企业微信与 Discord 的规范推断，建议真机截图验证。
- 目标风格里“绸缎折痕来自 domain warping”是推断，没有对 OpenAI 原图做频谱测量。模糊半径与颗粒幅度的建议区间同样是 CSS 配方、shader 参数表与去 banding 文献的综合，不是对原图的实测。
- Gemini 三色 hex 与 Apple 发光边七色 hex 均来自社区整理，未在官方规范中核实；OpenAI 2025 完整规范需登录，其正式色板数值未能核对。

---

## 附录 A：17 套新配色完整数据

全部色值由 palette-lab2.mjs 用 culori 4.0.2 计算并校验，所有停靠点在 sRGB 色域内。`minLc` 为文字色对最差停靠点的 APCA 绝对值，`meanLc` 为对 oklab 均值的 APCA 绝对值，二者作为参考数据保留，实现时的判定门槛按项目决策取 WCAG 2 ≥ 4.5。色值不可修改。

| #   | 名称     | 家族       | 明暗 | 色值                                            | 背景    | 文字    | 校验                                                     | 场景                                                                          |
| --- | -------- | ---------- | ---- | ----------------------------------------------- | ------- | ------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | 珊瑚日出 | 暖陶土     | 浅底 | #D97757 #F0A07A #F7C4A5 #FBD9C9 #FFF1E8         | #FBEFE6 | #141413 | minLc 45 / meanLc 77，WCAG 最差 5.9:1                    | 写作、人文、创作类账号                                                        |
| 2   | 陶土燕麦 | 暖陶土     | 浅底 | #C6613F #D97757 #E3B58E #E3DACC #FAF9F5         | #F5E3C7 | #141413 | minLc 36 / meanLc 69，默认开启文字底板或让文字落在浅色区 | 读书会、研究小组、编辑感                                                      |
| 3   | 冰川蓝   | 蓝色单色   | 浅底 | #5FB4F5 #8ED0FA #A0DAF7 #C6ECFB #E3F5FF         | #EAF6FD | #141413 | minLc 59 / meanLc 82，WCAG 最差 8.19:1                   | 通用效率工具、科技团队（建议设为默认）                                        |
| 4   | 电光蓝   | 蓝色       | 深底 | #002F5B #1E48C8 #4D6BFE #2F8CFF #5FA3FF         | #0A0F1E | #FFFFFF | minLc 55 / meanLc 88                                     | 开发者、模型社群，在 #19191A / #313338 深色聊天界面里最醒目                   |
| 5   | 薰衣草雾 | 蓝紫       | 浅底 | #8D7CF0 #B39DF5 #DFC8F5 #EAD9FB #FFD1D4         | #F3EEFB | #141413 | minLc 42 / meanLc 74，深紫端建议开底板                   | 设计、灵感                                                                    |
| 6   | 极光蓝紫 | 蓝紫粉多段 | 深底 | #3F7FD0 #5E6FCB #7E64B5 #A65C90 #C05868         | #1B1638 | #FFFFFF | minLc 73 / meanLc 84，WCAG 最差 4.07:1                   | 多模态、助理类                                                                |
| 7   | 青柠薄荷 | 绿色       | 浅底 | #10A37F #5CCB9B #B3F4A8 #DAF5C4 #F4F9A7         | #EEFBEF | #141413 | minLc 44 / meanLc 81                                     | 学习、成长、健康类                                                            |
| 8   | 松石青   | 青色       | 浅底 | #2CA0AB #35BDC8 #6ACBD4 #92DCE2 #C4EEF2         | #DEF7F9 | #141413 | minLc 45 / meanLc 72                                     | 搜索、问答、知识库                                                            |
| 9   | 琥珀夕照 | 暖橙黄     | 浅底 | #F26A2E #FF8A1F #FFAF00 #FFD000 #FFEBB0         | #FFF4D6 | #141413 | minLc 46 / meanLc 73                                     | 开源社区、热情活跃的群                                                        |
| 10  | 深空     | 深蓝中性   | 深底 | #111827 #1E2A4A #2B3A67 #3B4C8C #5865F2         | #0B0E14 | #FFFFFF | minLc 77 / meanLc 101，深色里最稳的一套                  | 极客、夜间、深色模式用户                                                      |
| 11  | 霓虹暗潮 | 霓虹       | 深底 | #1C2B6B #3B7BFF #6A3BE2 #A82BB2 #0E5F5A         | #070A0F | #FFFFFF | minLc 71 / meanLc 94                                     | 游戏、潮流社群；亮霓虹 #B6FF3B #FF3BD4 只作低不透明度点缀层，不进主色         |
| 12  | 云舞白   | 暖白中性   | 浅底 | #F0EEE9 #E3DACC #D8DEE6 #BFD3E7 #B0AEA5         | #F7F3EE | #141413 | minLc 59 / meanLc 83                                     | 商务、顾问、安静高级感；导出时建议加 1px 8% 黑内描边防止在 #EDEDED 列表里糊边 |
| 13  | 全息虹彩 | 柔彩全息   | 浅底 | #C8B6FF #A0DAF7 #B3F4A8 #FFD1D4 #F4F9A7         | #F8F5FF | #141413 | minLc 69 / meanLc 87，WCAG 最差 10.17:1                  | 年轻社群、Y3K                                                                 |
| 14  | 香槟金   | 去饱和金属 | 浅底 | #B08050 #D4B46A #E8D3B0 #F1E4CC #C9B79C         | #F4ECDC | #141413 | minLc 41 / meanLc 72，深金端开底板                       | 会员、高端、庆典                                                              |
| 15  | 光谱柔彩 | 多色丝带   | 浅底 | #9CC8F5 #A5E3F7 #C9E79A #FFD2A0 #F7B5CC #D9B3EA | #FFFFFF | #141413 | minLc 69 / meanLc 81                                     | 综合助理、全能型工具                                                          |
| 16  | 石墨浅灰 | 黑白极简   | 浅底 | #E6E8EE #D2D6DE #B4B8C0 #9AA0AA #FFFFFF         | #F4F4F5 | #141413 | minLc 52 / meanLc 81                                     | 官方、正式、克制                                                              |
| 17  | 墨黑单色 | 黑白极简   | 深底 | #141413 #2B2F36 #3D3D3A #4B5563 #1E1F22         | #080808 | #FFFFFF | minLc 91 / meanLc 104                                    | 极致克制的深色                                                                |

数据结构建议：每套除色值外带 `text`（推荐文字色）、`mode`（light / dark）、`family`（家族标签）、OKLCH 停靠点，以及 `minLc` / `meanLc` 两个校验字段；配色选择器按家族分组展示。v2 的 12 套（warm / cool / sunset / forest / ocean / creative / tech / elegant / peach / mint / aurora / blush）与新 17 套不重名，保留但标为 legacy。每套给 5 到 6 色是为随机抽取 4 色留余量。

实现时要注意一处冲突：这 17 套是按 APCA 双门槛调出来的，按项目决定的 WCAG 2 ≥ 4.5 单门槛去卡，电光蓝的白字对其最浅停靠点只有 2.57:1、极光蓝紫最差 4.07:1，都过不了 4.5。自动文字色是按文字区域下方像素的实际平均明度判定的，不是按单个停靠点，所以多数构图下不会触发；但深色配色配白字、文字恰好压在最浅色斑上时会判失败。落地方案是让自动文字色在判失败时启用胶囊底，而不是把这两套配色从库里删掉。

## 附录 B：种子配色算法

从 1 到 2 个种子色生成整套配色，已用 culori 4.0.2 验证。

1. `oklch(seed1)` 得 (L0, C0, H0)，可选 `oklch(seed2)` 得 H1。
2. 定色相。有 seed2 时用 `fixupHueShorter` 沿短弧在 H0 与 H1 之间取 t = 0、0.25、0.5、0.75、1 五个色相；只有 seed1 且 C0 < 0.03 时五个色相全取 H0（中性方案）；否则默认类比色 H0 + [-40, -20, 0, 20, 40]，split 方案取 H0 + [0, 20, 150, 180, 210]。
3. 定明度阶梯，固定值不随种子变。浅色模式 L = [0.68, 0.76, 0.83, 0.89, 0.94]，深色模式 L = [0.34, 0.42, 0.50, 0.58, 0.66]。
4. 定 chroma。`Cbase = clamp(C0, 0.04, 浅色 0.14 / 深色 0.18)`；浅色乘 [1.0, 0.9, 0.75, 0.55, 0.35]（随明度递减，对应 sRGB 在高明度处色域变窄），深色乘 [0.7, 0.85, 1.0, 1.0, 0.9]；每个停靠点再过 `clampChroma(color, 'oklch')` 保色相入色域。
5. 加第 6 个“光感”停靠点。浅色 L 0.975、C 0.015；深色 L 0.72、C 0.6 × Cbase；色相取中间色相，用于高光层。
6. 背景基底。浅色 L 0.955、C = min(0.25 × C0, 0.03)；深色 L 0.17、C = min(0.5 × C0, 0.06)；色相取种子色相，双种子取中间色相。
7. 文字色。候选 #FFFFFF 与 #141413，对全部停靠点加背景各算 APCA |Lc| 取最小值，选最小值更大的那个，再算对 oklab 均值的 Lc 与 WCAG。
8. 门槛。均值 Lc ≥ 75 且最差 Lc ≥ 45，且均值 WCAG ≥ 4.5，否则返回 `plate = true` 让 UI 自动启用文字底板。按项目决策，落地时的判定门槛只保留 WCAG 2 ≥ 4.5 这一项，Lc 作参考。
9. 实测样例。`#D97757` 浅色得到 `#d87397 #f39194 #ffb298 #ffd0ad #fce8ca #fff4f1`，背景 `#ffebe5`，文字 `#141413`，minLc 46 / meanLc 77；`#4D6BFE` 深色得到 `#003e54 #004f8a #3d55c8 #7b61dc #b072dc #8aa1e9`，背景 `#060c29`，文字 `#FFFFFF`，minLc 54 / meanLc 88；`#4796E3` 加 `#CA6673` 浅色得到 `#4e9dea #a3a7ff #deb4f9 #ffc8e8 #ffe3e5`，minLc 49 / meanLc 78。

进阶可选：把第 3、4 步换成 Equinor EDS 的高斯 chroma（`chroma = exp((-25/stdDev)(mean-L)²) × Cbase`，浅色 mean 约 0.6、深色 mean 约 0.7），或按 Harmonizer 思路先定每级对背景的目标 Lc 再反推 L。两者都比线性系数更接近手调质感，当前线性系数已够用。

实现要点：用 `culori/fn` 按需引入 oklch、rgb、interpolate、clampChroma、toGamut、wcagContrast、formatHex；渐变中间色用 `interpolate(['a','b'], 'oklch', { h: fixupHueShorter })` 计算，避免 sRGB 插值发灰；shadcn 主题令牌用 Tailwind v4 的 `@theme` 写 `oklch()`。默认深色文字用 #141413（暖近黑），浅色文字用 #FFFFFF；浅色配色一律配深字，深色配色一律配白字；文字底板色取背景基底叠 70% 不透明度。

## 附录 C：排版默认值

| 项                     | 默认值                                                      | 依据                                                                               |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 安全区（圆形）         | 内容框 70%（四周各留 15%）                                  | 圆内接正方形边长为直径的 0.707，Discord 与 GitHub 社区口径同样是 70%               |
| 安全区（方形与圆角）   | 内容框 80%（四周各留 10%）                                  | 圆角方形比圆形多露出，可放宽                                                       |
| 行高（Latin）          | 1.1                                                         | Material 3 给展示级标题 1.2，社区排版指南给 1.1 到 1.2                             |
| 行高（CJK）            | 1.15 到 1.18                                                | 飞书群头像 68 / 60 = 1.13；Noto Sans SC 各字重默认 lineHeight 1.448 对头像大字过松 |
| 行高可调范围           | 0.85 到 2.0                                                 | 单行时行高不影响排版                                                               |
| 字间距（Latin 展示级） | -0.02 em                                                    | Material 3 display-large tracking -0.25 px；社区展示标题惯例                       |
| 字间距（CJK）          | 单字 0，2 到 4 字取 +0.05 em                                | 短文字自动填满时需要一点疏朗感                                                     |
| 字间距可调范围         | -0.1 em 到 +0.5 em                                          | 覆盖紧排与疏排两端                                                                 |
| 字号搜索区间           | 短边的 4% 到 92%（自动填满时在 10% 到 60% 之间二分 10 次）  | 二分 10 次到像素精度；搜索空间非严格单调，必须取最后一次可行解                     |
| maxLines               | 3（飞书群头像口径为 2）                                     | 飞书群头像单行最多 2 个中文或 4 个英文字母、最多两行                               |
| 默认字重               | 700（该字体只有 400 时自动降级）                            | 头像文字在列表里只有 10 到 20 px，需要粗体                                         |
| 垂直居中基准           | 字体真实 ascender / descender，CJK 用 em 框中线             | 不用 fontSize × 0.85 的经验值                                                      |
| 断词                   | `Intl.Segmenter`，Latin 用 word、CJK 用 grapheme 并加避头尾 | 行首禁排 、。，！？：；）」』】，行尾禁排 （「『【                                 |

字号阶梯参考（飞书群头像基准 208×208 px）：1 字 116 px、2 字 92 px、3 到 4 字 72 px、5 到 8 字 60 px 且行高 68 px。

## 附录 D：@paper-design/shaders 四个 shader 的参数

以下参数名与取值范围直接抄自本机安装的 `@paper-design/shaders@0.0.80` 的 `dist/shaders/*.d.ts`（2026-08-29 核对）。调研阶段经 Context7 拿到的 `warpStrength` / `blendSharpness` 一类名字与包内不符，以包内为准。

### 通用

- `ShaderMount(parentElement, fragmentShader, uniforms, webGlContextAttributes?, speed = 0, frame = 0, minPixelRatio = 2, maxPixelCount = 1920 × 1080 × 4, mipmaps?)`；`speed` 为 0 时不开 requestAnimationFrame，`frame` 完全决定静态画面；导出前传 `webGlContextAttributes = { preserveDrawingBuffer: true }`；公开方法 `render`、`setUniformValues`、`setMaxPixelCount`、`dispose`，画布在 `canvasElement`。
- 尺寸参数（ShaderSizingParams，四个 shader 共用）：`fit`（none / contain / cover）、`scale` 0.01 到 4、`rotation` 0 到 360、`originX` / `originY` 0 到 1、`offsetX` / `offsetY` -1 到 1、`worldWidth` / `worldHeight`。
- 颜色统一为 CSS 颜色字符串数组，包内转成 `u_colors: vec4[]` 与 `u_colorsCount`。

### staticMeshGradient（style `mesh`）

最多 10 色。`positions` 0 到 100（色斑布局种子）、`waveX` / `waveY` 0 到 1（正弦扭曲强度）、`waveXShift` / `waveYShift` 0 到 1（相位）、`mixing` 0 到 1（0 硬条纹，0.5 平滑，1 渐变）、`grainMixer` 0 到 1（边缘颗粒扰动）、`grainOverlay` 0 到 1（后处理黑白颗粒）。

### meshGradient（style `flow`）

最多 10 色。`distortion` 0 到 1（有机噪声扭曲）、`swirl` 0 到 1（漩涡）、`grainMixer`、`grainOverlay` 同上；静态画面靠 `speed` 0 与 `frame`。

### warp（style `silk`）

最多 10 色。`proportion` 0 到 1（颜色分配点）、`softness` 0 到 1（0 硬边，1 平滑）、`shape` 取 `checks` / `stripes` / `edge`（`WarpPatterns` 常量表 0 / 1 / 2）、`shapeScale` 0 到 1、`distortion` 0 到 1、`swirl` 0 到 1、`swirlIterations` 0 到 20、`rotation`；内部用 `u_noiseTexture` 作随机源，包内自带。

### grainGradient（style `grain`）

最多 7 色，另有 `colorBack`。`softness` 0 到 1、`intensity` 0 到 1（色带间扭曲）、`noise` 0 到 1（颗粒）、`shape` 取 `wave` / `dots` / `truchet` / `corners` / `ripple` / `blob` / `sphere`（`GrainGradientShapes` 常量表 1 到 7）。颗粒按 `gl_FragCoord` 与 `u_resolution` 计算，不随 `scale` 与 `fit` 变化，因此导出尺寸不同时颗粒粒径的相对大小会变。
