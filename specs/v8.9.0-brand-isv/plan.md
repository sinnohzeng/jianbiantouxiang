# 实施计划

1. 素材：ISV 92 个 PNG 落到 `assets/brand/isv/`，附 `manifest.json` 与 `README.md`；豆包工作新素材落到 `assets/brand/bytedance/` 并删旧文件；`scripts/brand-list.json` 加 `isv` 分类与条目，`npm run gen:brand` 重建。
2. 加载：`src/graphics/brand.ts` 按可见像素裁边，东黎除外；精确原稿判定收进 `isExactBrand`，编辑面板与选择器共用。
3. 排版：`src/text/layout.ts` 带文字时取等面积与两道封顶的较小值；东黎预设换算。
4. 附带修复：`sanitizeSvg` 百分比宽高；`build/brand-svg.ts` 展开 `<use>`；PWA 预缓存排除 ISV；历史缩略图版本升到 2；五语分组标签。
5. 验证：单测与变异测试，量测脚本加“每个素材都画得出来”，新旧合成对照，e2e 加 ISV 选择用例，`npm run ci`，截图。
6. 文档、CHANGELOG、定版 8.9.0，提交推送，核对线上。

## 依赖与执行顺序

1 先行；2、3、4 可并行 [P]；5 依赖 1–4；6 最后。
