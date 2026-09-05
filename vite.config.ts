import fs from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import {
  localizedManifest,
  localizedManifestFiles,
  resolveManifestLocale,
  type DictReader,
} from './build/pwa-manifest.ts'

/** manifest 文案取自 `src/i18n` 的字典，构建期直接读 json，不经过运行时那套按需加载。 */
const readDict: DictReader = (locale) =>
  JSON.parse(
    fs.readFileSync(path.resolve(import.meta.dirname, `./src/i18n/${locale}.json`), 'utf8'),
  ) as Record<string, string>

/** 版本号注入运行时，关于对话框展示，来源就是 package.json 的 version。 */
const pkg = JSON.parse(
  fs.readFileSync(path.resolve(import.meta.dirname, './package.json'), 'utf8'),
) as { version: string }

/**
 * `manifest.webmanifest` 用哪种语言。默认简体中文，与 `<html lang>` 和 i18n 的默认语言一致；
 * 按语言分开部署时设 `VITE_APP_LOCALE` 覆盖。
 */
const manifestLocale = resolveManifestLocale(process.env.VITE_APP_LOCALE)

/**
 * 每种界面语言各出一份 manifest。
 *
 * 规范里一份 manifest 只能声明一种语言，运行时按当前语言改 `<link rel="manifest">` 的 href，
 * 装出来的应用名与主屏图标名才会跟着界面语言走。开发期也按同样的路径给，免得切语言时 404。
 */
function localizedManifests(): Plugin {
  return {
    name: 'gradient-avatar:localized-manifests',
    generateBundle() {
      for (const file of localizedManifestFiles(readDict)) {
        this.emitFile({ type: 'asset', fileName: file.fileName, source: file.source })
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/manifest.') || !url.endsWith('.webmanifest')) return next()
        const file = localizedManifestFiles(readDict).find((item) => `/${item.fileName}` === url)
        if (!file) return next()
        res.setHeader('Content-Type', 'application/manifest+json')
        res.end(file.source)
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 注册交给 app/sw-update：那里要拿 registration 才能定时轮询新版本，
      // 自动注入的那段脚本给不出这个句柄
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'icon-192.png', 'icon-512.png'],
      manifest: localizedManifest(manifestLocale, readDict),
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
    localizedManifests(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
})
