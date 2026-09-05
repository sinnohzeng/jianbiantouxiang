/** 版本号由 vite define 构建期注入，来源 package.json 的 version 字段。 */
declare const __APP_VERSION__: string

/** 炫技层的一键关闭，只在排查时设 `VITE_SHOWCASE=0`，生产恒开。 */
interface ImportMetaEnv {
  readonly VITE_SHOWCASE?: string
}
