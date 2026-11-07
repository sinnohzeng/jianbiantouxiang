/// <reference types="node" />
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'
import { BRAND_INDEX } from '@/graphics/generated/brand-index'

it('每个登记的品牌文件格式与扩展名一致，SVG 可解析', () => {
  for (const entry of BRAND_INDEX) {
    const files = [{ id: entry.id, ext: entry.ext }]
    if (entry.white) files.push({ id: entry.white, ext: 'svg' })
    for (const file of files) {
      const name = `${file.id}.${file.ext}`
      const bytes = readFileSync(path.resolve('public/brand', name))
      if (file.ext === 'png') {
        expect(bytes.subarray(0, 8).toString('hex'), name).toBe('89504e470d0a1a0a')
      } else {
        const xml = new DOMParser().parseFromString(bytes.toString('utf8'), 'image/svg+xml')
        expect(xml.querySelector('parsererror'), name).toBeNull()
        expect(xml.documentElement.localName, name).toBe('svg')
      }
    }
  }
})
