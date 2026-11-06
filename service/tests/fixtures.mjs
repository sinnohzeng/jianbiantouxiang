import { deflateSync, crc32 } from 'node:zlib'

export function logoPng({ white = false, transparent = false, width = 100, height = 100 } = {}) {
  const chunk = (name, data) => {
    const type = Buffer.from(name),
      size = Buffer.alloc(4),
      crc = Buffer.alloc(4)
    size.writeUInt32BE(data.length)
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])))
    return Buffer.concat([size, type, data, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const scan = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const foreground =
        x >= width * 0.2 &&
        x < width * 0.8 &&
        y >= height * 0.2 &&
        y < height * 0.8 &&
        !(x >= width * 0.4 && x < width * 0.6 && y >= height * 0.4 && y < height * 0.6)
      const value = foreground ? (white ? 255 : 0) : white ? 0 : 255
      const at = y * (width * 4 + 1) + 1 + x * 4
      scan.set([value, value, value, transparent && !foreground ? 0 : 255], at)
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scan)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
