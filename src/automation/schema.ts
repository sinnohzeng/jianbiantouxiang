import { CLIENT_PRESET_IDS } from '../graphics/client-presets.ts'
import { z } from 'zod'

export const LOGO_BYTES = 512 * 1024
const line = z
  .string()
  .trim()
  .max(80)
  .refine(
    (s) => ![...s].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    'Use one line without control characters',
  )
export const logoSchema = z
  .object({
    mimeType: z.enum(['image/png', 'image/svg+xml']),
    data: z
      .string()
      .min(4)
      .max(Math.ceil(LOGO_BYTES / 3) * 4)
      .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
    background: z.enum(['auto', 'transparent', 'white', 'black']).default('auto'),
    color: z.enum(['auto', 'original']).default('auto'),
    preservePadding: z.boolean().default(false),
  })
  .strict()

/** Public v1 contract; deliberately smaller than the mutable browser store. */
export const renderSchema = z
  .object({
    schemaVersion: z.literal(1).default(1),
    line1: line.default(''),
    line2: line.default(''),
    logo: logoSchema.optional(),
    preset: z.enum(CLIENT_PRESET_IDS).optional(),
    font: z.enum(['sans', 'serif']).default('serif'),
    secondaryFont: z.enum(['sans', 'serif']).default('sans'),
    optical: z.boolean().default(true),
    size: z.number().int().min(128).max(2048).default(1024),
    safeShape: z.enum(['circle', 'square']).default('circle'),
    padding: z.number().min(0.02).max(0.25).default(0.03),
    logoScale: z.number().min(0.2).max(0.55).default(0.38),
    style: z.enum(['mesh', 'flow', 'silk', 'grain']).default('mesh'),
    palette: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/)
      .default('steel-slate'),
    seed: z.string().max(128).default('gradient-avatar-v1'),
    format: z.enum(['png', 'jpg', 'webp']).default('png'),
    strict: z.boolean().default(true),
  })
  .strict()

export type RenderRequest = z.infer<typeof renderSchema>
export type LogoInput = z.infer<typeof logoSchema>
