/**
 * 精选字体清单：离线兜底与推荐位的数据源，基础字段取自 fontsource API
 * （https://api.fontsource.org/v1/fonts，2026-08-29 核对）；version 取 jsDelivr
 * 包元数据的 latest 标签，2026-08-31 核对。chiron-sung-hk 没有 npm 包，镜像回落 latest。
 * 中文部分覆盖 Google Fonts 上全部带 chinese-* subset 的字体，
 * 目录接口拉不到时 fetchCatalog 直接回落到这里。
 *
 * 文件末尾的原生名表 NATIVE_NAMES 另有来源：2026-09-23 核对，逐条出处见
 * docs/audits/2026-09-23-v8.0-plan-review.md 附录。
 */

import type { CjkScript, FontEntry } from './catalog'

export const CURATED_FONTS: FontEntry[] = [
  {
    id: 'noto-sans-sc',
    version: '5.3.0',
    family: 'Noto Sans SC',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'sc',
  },
  {
    id: 'noto-serif-sc',
    version: '5.3.0',
    family: 'Noto Serif SC',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'sc',
  },
  {
    id: 'liu-jian-mao-cao',
    version: '5.3.0',
    family: 'Liu Jian Mao Cao',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'long-cang',
    version: '5.3.0',
    family: 'Long Cang',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'ma-shan-zheng',
    version: '5.3.1',
    family: 'Ma Shan Zheng',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'wdxl-lubrifont-sc',
    version: '5.3.0',
    family: 'WDXL Lubrifont SC',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'zcool-kuaile',
    version: '5.3.0',
    family: 'ZCOOL KuaiLe',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'zcool-qingke-huangyou',
    version: '5.3.0',
    family: 'ZCOOL QingKe HuangYou',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'zcool-xiaowei',
    version: '5.3.0',
    family: 'ZCOOL XiaoWei',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'zhi-mang-xing',
    version: '5.3.0',
    family: 'Zhi Mang Xing',
    weights: [400],
    cjk: 'sc',
  },
  {
    id: 'noto-sans-tc',
    version: '5.3.0',
    family: 'Noto Sans TC',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'tc',
  },
  {
    id: 'noto-serif-tc',
    version: '5.3.0',
    family: 'Noto Serif TC',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'tc',
  },
  {
    id: 'bpmf-huninn',
    version: '5.3.0',
    family: 'Bpmf Huninn',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'bpmf-iansui',
    version: '5.3.0',
    family: 'Bpmf Iansui',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'bpmf-zihi-kai-std',
    version: '5.3.0',
    family: 'Bpmf Zihi Kai Std',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'cactus-classical-serif',
    version: '5.3.0',
    family: 'Cactus Classical Serif',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'chiron-goround-tc',
    version: '5.3.0',
    family: 'Chiron GoRound TC',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'tc',
  },
  {
    id: 'chiron-hei-hk',
    version: '5.3.1',
    family: 'Chiron Hei HK',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'tc',
  },
  {
    id: 'chocolate-classical-sans',
    version: '5.3.0',
    family: 'Chocolate Classical Sans',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'huninn',
    version: '5.3.0',
    family: 'Huninn',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'iansui',
    version: '5.3.0',
    family: 'Iansui',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'lxgw-marker-gothic',
    version: '5.3.0',
    family: 'LXGW Marker Gothic',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'lxgw-wenkai-mono-tc',
    version: '5.3.0',
    family: 'LXGW WenKai Mono TC',
    weights: [300, 400, 700],
    cjk: 'tc',
  },
  {
    id: 'lxgw-wenkai-tc',
    version: '5.3.0',
    family: 'LXGW WenKai TC',
    weights: [300, 400, 700],
    cjk: 'tc',
  },
  {
    id: 'uoqmunthenkhung',
    version: '5.3.0',
    family: 'UoqMunThenKhung',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'wdxl-lubrifont-tc',
    version: '5.3.0',
    family: 'WDXL Lubrifont TC',
    weights: [400],
    cjk: 'tc',
  },
  {
    id: 'noto-sans-hk',
    version: '5.3.0',
    family: 'Noto Sans HK',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'hk',
  },
  {
    id: 'noto-serif-hk',
    version: '5.3.0',
    family: 'Noto Serif HK',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'hk',
  },
  {
    id: 'chiron-sung-hk',
    family: 'Chiron Sung HK',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'hk',
  },

  {
    id: 'noto-sans-jp',
    version: '5.3.0',
    family: 'Noto Sans JP',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'jp',
  },
  {
    id: 'noto-serif-jp',
    version: '5.3.0',
    family: 'Noto Serif JP',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'jp',
  },
  {
    id: 'm-plus-rounded-1c',
    version: '5.3.0',
    family: 'M PLUS Rounded 1c',
    weights: [100, 300, 400, 500, 700, 800, 900],
    cjk: 'jp',
  },
  {
    id: 'zen-maru-gothic',
    version: '5.3.0',
    family: 'Zen Maru Gothic',
    weights: [300, 400, 500, 700, 900],
    cjk: 'jp',
  },
  {
    id: 'dela-gothic-one',
    version: '5.3.0',
    family: 'Dela Gothic One',
    weights: [400],
    cjk: 'jp',
  },
  {
    id: 'shippori-mincho',
    version: '5.3.0',
    family: 'Shippori Mincho',
    weights: [400, 500, 600, 700, 800],
    cjk: 'jp',
  },
  {
    id: 'kosugi-maru',
    version: '5.3.0',
    family: 'Kosugi Maru',
    weights: [400],
    cjk: 'jp',
  },
  {
    id: 'rampart-one',
    version: '5.3.0',
    family: 'Rampart One',
    weights: [400],
    cjk: 'jp',
  },
  {
    id: 'yuji-syuku',
    version: '5.3.0',
    family: 'Yuji Syuku',
    weights: [400],
    cjk: 'jp',
  },
  {
    id: 'hachi-maru-pop',
    version: '5.3.0',
    family: 'Hachi Maru Pop',
    weights: [400],
    cjk: 'jp',
  },

  {
    id: 'noto-sans-kr',
    version: '5.3.0',
    family: 'Noto Sans KR',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'kr',
  },
  {
    id: 'noto-serif-kr',
    version: '5.3.0',
    family: 'Noto Serif KR',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
    cjk: 'kr',
  },
  {
    id: 'black-han-sans',
    version: '5.3.0',
    family: 'Black Han Sans',
    weights: [400],
    cjk: 'kr',
  },
  {
    id: 'do-hyeon',
    version: '5.3.0',
    family: 'Do Hyeon',
    weights: [400],
    cjk: 'kr',
  },
  {
    id: 'jua',
    version: '5.3.0',
    family: 'Jua',
    weights: [400],
    cjk: 'kr',
  },
  {
    id: 'gowun-dodum',
    version: '5.3.0',
    family: 'Gowun Dodum',
    weights: [400],
    cjk: 'kr',
  },
  {
    id: 'nanum-myeongjo',
    version: '5.3.0',
    family: 'Nanum Myeongjo',
    weights: [400, 700, 800],
    cjk: 'kr',
  },
  {
    id: 'gasoek-one',
    version: '5.3.0',
    family: 'Gasoek One',
    weights: [400],
    cjk: 'kr',
  },

  {
    id: 'inter',
    version: '5.3.0',
    family: 'Inter',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'poppins',
    version: '5.3.0',
    family: 'Poppins',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'montserrat',
    version: '5.3.0',
    family: 'Montserrat',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'rubik',
    version: '5.3.0',
    family: 'Rubik',
    weights: [300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'nunito',
    version: '5.3.0',
    family: 'Nunito',
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'outfit',
    version: '5.3.0',
    family: 'Outfit',
    weights: [100, 200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    id: 'sora',
    version: '5.3.0',
    family: 'Sora',
    weights: [100, 200, 300, 400, 500, 600, 700, 800],
  },
  {
    id: 'syne',
    version: '5.3.0',
    family: 'Syne',
    weights: [400, 500, 600, 700, 800],
  },
  {
    id: 'space-grotesk',
    version: '5.3.0',
    family: 'Space Grotesk',
    weights: [300, 400, 500, 600, 700],
  },
  {
    id: 'oswald',
    version: '5.3.0',
    family: 'Oswald',
    weights: [200, 300, 400, 500, 600, 700],
  },
  {
    id: 'archivo-black',
    version: '5.3.0',
    family: 'Archivo Black',
    weights: [400],
  },
  {
    id: 'bebas-neue',
    version: '5.3.0',
    family: 'Bebas Neue',
    weights: [400],
  },
  {
    id: 'fredoka',
    version: '5.3.0',
    family: 'Fredoka',
    weights: [300, 400, 500, 600, 700],
  },
  {
    id: 'righteous',
    version: '5.3.0',
    family: 'Righteous',
    weights: [400],
  },
  {
    id: 'playfair-display',
    version: '5.3.0',
    family: 'Playfair Display',
    weights: [400, 500, 600, 700, 800, 900],
  },
  {
    id: 'dm-serif-display',
    version: '5.3.0',
    family: 'DM Serif Display',
    weights: [400],
  },
  {
    id: 'abril-fatface',
    version: '5.3.0',
    family: 'Abril Fatface',
    weights: [400],
  },
  {
    id: 'bungee',
    version: '5.3.0',
    family: 'Bungee',
    weights: [400],
  },
  {
    id: 'lobster',
    version: '5.3.0',
    family: 'Lobster',
    weights: [400],
  },
  {
    id: 'pacifico',
    version: '5.3.0',
    family: 'Pacifico',
    weights: [400],
  },
]

/** 系统字体：不走网络，直接用本机已有的字形，选择器的“系统字体”一组列的就是这几款。 */
export const SYSTEM_FONTS: readonly string[] = [
  'system-ui',
  'PingFang SC',
  'Microsoft YaHei',
  'Hiragino Sans',
  'Apple SD Gothic Neo',
]

/**
 * 原生名：字体在自己书写系统里的正式名，以 family 为键，界面上显示它而不是西文 family。
 *
 * 来源与核对日期：2026-09-23，逐条出处见 docs/audits/2026-09-23-v8.0-plan-review.md 附录。
 * 只收作者或发行方渠道查得到的名字，每个名字都用 css2 `text=` 请求过，字形全覆盖；
 * 查不到的不收，这些字体显示西文 family。
 * 系统字体收操作系统自带的本地化名，它们用本机字形渲染，不走网络。
 */
export const NATIVE_NAMES: Readonly<Record<string, string>> = {
  // 简体
  'WDXL Lubrifont SC': '滑油字',
  'ZCOOL KuaiLe': '站酷快乐体',
  'ZCOOL QingKe HuangYou': '站酷庆科黄油体',
  'ZCOOL XiaoWei': '站酷小薇LOGO体',
  'Zhi Mang Xing': '钟齐志莽行书',
  // 繁体
  'Bpmf Huninn': '粉圓',
  'Bpmf Iansui': '芫荽',
  'Bpmf Zihi Kai Std': '字嗨注音標楷',
  'Cactus Classical Serif': '仙人掌明體',
  'Chiron GoRound TC': '昭源環方',
  'Chiron Hei HK': '昭源黑體',
  'Chocolate Classical Sans': '朱古力黑體',
  Huninn: '粉圓',
  Iansui: '芫荽',
  'LXGW Marker Gothic': '霞鶩漫黑',
  'LXGW WenKai TC': '霞鶩文楷 TC',
  UoqMunThenKhung: '宇文天穹',
  'WDXL Lubrifont TC': '滑油字',
  // 香港
  'Chiron Sung HK': '昭源宋體',
  // 日文
  'Shippori Mincho': 'しっぽり明朝',
  'Rampart One': 'ランパート',
  'Yuji Syuku': '佑字肅',
  'Hachi Maru Pop': 'はちまるポップ',
  // 韩文
  'Black Han Sans': '검은고딕',
  'Do Hyeon': '도현체',
  Jua: '주아체',
  'Gowun Dodum': '고운돋움',
  'Nanum Myeongjo': '나눔명조',
  'Gasoek One': '가석체',
  // 系统字体
  'PingFang SC': '苹方-简',
  'Microsoft YaHei': '微软雅黑',
  'Hiragino Sans': 'ヒラギノ角ゴシック',
  'Apple SD Gothic Neo': '애플 SD 산돌고딕 Neo',
}

/** 带原生名的系统字体所属的书写系统，给原生名那一格标 lang。Google 字体的书写系统在目录条目的 cjk 上。 */
export const SYSTEM_FONT_SCRIPTS: Readonly<Record<string, CjkScript>> = {
  'PingFang SC': 'sc',
  'Microsoft YaHei': 'sc',
  'Hiragino Sans': 'jp',
  'Apple SD Gothic Neo': 'kr',
}
