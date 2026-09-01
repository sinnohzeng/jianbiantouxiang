# v3.3 实施计划

1. favicon：两稿（人形、渐字）位图化后 16/32/192 实测，选“渐”字稿；写 gen-app-icons 脚本重生三张 PNG。
2. 状态：新增 src/app/ambient.ts（强度存储加光晕压制纯函数），单测覆盖。
3. 界面：BrandMark 与 AboutDialog 新组件；TopBar 换品牌标、关于按钮、主题菜单加滑杆；AppShell 历史挪列顶。
4. 版本号：vite define 注入 __APP_VERSION__，src/env.d.ts 声明。
5. i18n：五语各加 7 个 key，keys.md 同步。
6. 验证：lint、typecheck、test、build、budget、e2e、screenshots；端到端补关于与重置、环境光留存两条。
7. 收尾：package.json 升 3.3.0，CHANGELOG 与本文档状态回填。
