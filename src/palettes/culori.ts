/**
 * culori 的按需入口。全仓只从这里取色彩函数，不直接 import 'culori'。
 *
 * 默认入口会注册全部三十来个色彩空间，definition 与转换函数加起来几十 KB；
 * 'culori/fn' 什么都不注册，用到哪个空间自己 useMode 哪个。这里注册的四个是全仓的最小集：
 *   rgb   —— hex 解析、formatHex、sRGB 色域判定，所有函数的落地空间
 *   lrgb  —— wcagLuminance 走线性 sRGB，少了它 wcagContrast 会在运行时读到 undefined
 *   oklab —— 配色求平均（harmony 的 meanColor）
 *   oklch —— 明度阶梯、混色、clampChroma 的工作空间
 * 再要别的空间就在这里补一行 registerMode，不要在调用点直接 import 'culori'。
 *
 * 注册与调用的先后不用操心：culori 的 converter 返回的是闭包，查表发生在调用那一刻，
 * 本模块的注册在导入期就跑完了。
 */

// 别名是必需的：culori 的 useMode 不是 React hook，叫这个名字会被 rules-of-hooks 拦下
import { modeLrgb, modeOklab, modeOklch, modeRgb, useMode as registerMode } from 'culori/fn'

export const rgb = registerMode(modeRgb)
export const lrgb = registerMode(modeLrgb)
export const oklab = registerMode(modeOklab)
export const oklch = registerMode(modeOklch)

export {
  clampChroma,
  displayable,
  fixupHueShorter,
  formatHex,
  wcagContrast,
  wcagLuminance,
} from 'culori/fn'
