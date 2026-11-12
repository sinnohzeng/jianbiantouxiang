# 实施计划

1. `src/state/config.ts`：导出 Logo 大小区间与参照值、默认行高常量，归一按新区间夹值。
2. `src/text/layout.ts`：带文字时按参照框定 Logo 尺寸，自动档不按安全框宽收边；纯 Logo 时按圆内最大尺寸定，且不走排版边距抬升与填满放大。
3. `src/text/spacing.ts`、`src/text/fit.ts`、`src/text/layout.ts`：两行留白统一走一个函数，接上行高。
4. `src/text/optical.ts`：整组纵向修正改为可见边界居中，Logo 可见比例按素材缓存。
5. 界面滑杆区间读常量；单测、文档、CHANGELOG 同步。
6. 量测脚本前后对照，门禁与 e2e，截图，定版 8.8.0，提交推送。

## 依赖与执行顺序

1 先行；2、3、4 可并行 [P]；5 依赖 1–4；6 最后。
