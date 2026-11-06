import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { renderSchema } from '../src/automation/schema.ts'

export const batchSchema = z
  .object({ items: z.array(renderSchema).min(1).max(8) })
  .strict()
  .refine(
    ({ items }) => items.reduce((n, item) => n + item.size ** 2, 0) <= 8 * 1024 ** 2,
    'Batch exceeds 8 megapixels; reduce count or size',
  )

export function createAvatarMcp(renderer) {
  const server = new McpServer({ name: 'gradient-avatar', version: '8.3.0' })
  const annotations = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  }
  const guard = (fn) => async (args) => {
    try {
      return await fn(args)
    } catch (error) {
      // Do not expose browser stack traces, internal filenames or transport state.
      let message = error?.issues
        ? 'Invalid input: ' +
          error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
        : String(error.message)
            .split('\n')[0]
            .replace(/^page\.evaluate: (Error: )?/, '')
      if (/browserType\.|Executable doesn't exist|ENOENT|ECONNREFUSED/.test(message))
        message =
          'Renderer unavailable; check server browser installation and sandbox configuration'
      return { content: [{ type: 'text', text: message.slice(0, 600) }], isError: true }
    }
  }
  server.registerTool(
    'list_avatar_options',
    {
      description:
        'List the available gradient palettes and styles. No network resources are fetched.',
      inputSchema: z.object({}).strict(),
      annotations,
    },
    guard(async () => {
      const result = await renderer.run(null, { catalog: true })
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      }
    }),
  )
  server.registerTool(
    'validate_avatar',
    {
      description:
        'Measure a logo and two physical text lines without rendering the gradient. Returns safe area, bounds, fitted font sizes and warnings. Logo must be inline base64 PNG or outlined SVG, never a path or URL.',
      inputSchema: renderSchema,
      annotations,
    },
    guard(async (input) => {
      const result = await renderer.run(input, { validateOnly: true })
      return {
        content: [{ type: 'text', text: JSON.stringify(result.metadata) }],
        structuredContent: result.metadata,
      }
    }),
  )
  server.registerTool(
    'render_avatar',
    {
      description:
        'Generate a square gradient avatar with an optional black/white PNG or SVG logo, line1 and line2. Trims logo whitespace and adapts ink to the palette. Returns the original image bytes as MCP image content plus layout metadata. No files are retained.',
      inputSchema: renderSchema,
      annotations,
    },
    guard(async (input) => {
      const result = await renderer.run(input)
      return {
        content: [
          { type: 'image', data: result.data, mimeType: result.mimeType },
          { type: 'text', text: JSON.stringify(result.metadata) },
        ],
        structuredContent: result.metadata,
      }
    }),
  )
  server.registerTool(
    'render_avatar_batch',
    {
      description:
        'Generate up to 8 avatars, at most 8 megapixels in total. Images follow successful item order; structured results include index and errors. Each image is original resolution. Partial success is explicit.',
      inputSchema: batchSchema,
      annotations,
    },
    guard(async ({ items }) => {
      const content = [],
        results = []
      let bytes = 0
      for (const [index, input] of items.entries()) {
        try {
          const result = await renderer.run(input)
          bytes += result.metadata.bytes
          if (bytes > 8 * 1024 ** 2)
            throw new Error('Batch output exceeds 8 MiB; use JPG or smaller images')
          content.push({ type: 'image', data: result.data, mimeType: result.mimeType })
          results.push({ index, ok: true, ...result.metadata })
        } catch {
          results.push({
            index,
            ok: false,
            error: 'Item failed; validate or render this item separately for details',
          })
        }
      }
      content.push({ type: 'text', text: JSON.stringify({ results }) })
      return { content, structuredContent: { results }, isError: results.every((r) => !r.ok) }
    }),
  )
  return server
}
