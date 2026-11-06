import { defineConfig } from 'vite'
import path from 'node:path'
import { readFileSync } from 'node:fs'

export default defineConfig({
  root: path.resolve(import.meta.dirname, '..'),
  publicDir: false,
  plugins: [
    {
      name: 'font-license',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'FONT-LICENSE.txt',
          source: readFileSync(
            path.resolve(import.meta.dirname, '../node_modules/@fontsource/noto-sans-sc/LICENSE'),
            'utf8',
          ),
        })
      },
    },
  ],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, '../src') } },
  build: {
    outDir: 'dist-service',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'renderer.html') },
  },
})
