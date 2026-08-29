/** 字体模块对外出口。 */

export type { CjkScript, FontCategory, FontEntry, SearchOptions } from './catalog'
export {
  CATALOG_CACHE_KEY,
  CATALOG_TTL_MS,
  CATALOG_URL,
  cjkOfSubsets,
  clearCatalogCache,
  fetchCatalog,
  searchFonts,
  toFontEntry,
} from './catalog'

export { CURATED_FONTS, getCuratedByFamily, getCuratedById } from './curated'

export {
  GOOGLE_CSS2_ENDPOINT,
  MIRROR_HOSTS,
  buildCss2Url,
  buildMirrorCssUrls,
  buildMirrorCssUrlsForHost,
  familyToFontsourceId,
} from './google'

export type { FontLoadResult, FontLoadSource } from './loader'
export {
  DEFAULT_FONT_TIMEOUT_MS,
  fontFamilyCss,
  isFontReady,
  loadFontForConfig,
  nearestWeight,
  quoteFamily,
  resetFontLoaderState,
} from './loader'

export type { FontUploadErrorCode, UploadedFont } from './upload'
export {
  FontUploadError,
  MAX_UPLOADED_FONTS,
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
  UPLOAD_FAMILY_SUFFIX,
  clearUploadedFonts,
  getUploadedFont,
  listUploadedFonts,
  registerUploadedFont,
  removeUploadedFont,
  uploadFamilyName,
} from './upload'
