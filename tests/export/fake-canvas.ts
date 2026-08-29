import { vi } from 'vitest'

/** 记录下来的一次画布操作，属性赋值记成 `set:<属性名>`。 */
export interface Op {
  name: string
  args: unknown[]
}

export interface FakeEntry {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  ops: Op[]
}

/**
 * jsdom 没有真正的 canvas 后端，getContext 直接是未实现桩。
 * 这里用记录型假上下文替代，断言绘制指令的顺序与参数。
 */
export function createFakeContext(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = []
  const record =
    (name: string) =>
    (...args: unknown[]): void => {
      ops.push({ name, args })
    }
  let fillStyle: unknown = '#000000'
  let composite: unknown = 'source-over'

  const ctx = {
    fillRect: record('fillRect'),
    drawImage: record('drawImage'),
    save: record('save'),
    restore: record('restore'),
    beginPath: record('beginPath'),
    closePath: record('closePath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arc: record('arc'),
    arcTo: record('arcTo'),
    rect: record('rect'),
    fill: record('fill'),
    get fillStyle(): unknown {
      return fillStyle
    },
    set fillStyle(value: unknown) {
      fillStyle = value
      ops.push({ name: 'set:fillStyle', args: [value] })
    },
    get globalCompositeOperation(): unknown {
      return composite
    },
    set globalCompositeOperation(value: unknown) {
      composite = value
      ops.push({ name: 'set:globalCompositeOperation', args: [value] })
    },
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, ops }
}

export interface FakeCanvasRegistry {
  entries: FakeEntry[]
  /** 第 index 张被取过 2D 上下文的画布的操作记录。 */
  opsAt(index: number): Op[]
}

/** 接管 HTMLCanvasElement.getContext，每张画布配一份记录型上下文。 */
export function installFakeCanvas(): FakeCanvasRegistry {
  const entries: FakeEntry[] = []
  const impl = function (this: HTMLCanvasElement, kind: string): CanvasRenderingContext2D | null {
    if (kind !== '2d') return null
    const found = entries.find((entry) => entry.canvas === this)
    if (found) return found.ctx
    const { ctx, ops } = createFakeContext()
    entries.push({ canvas: this, ctx, ops })
    return ctx
  } as unknown as HTMLCanvasElement['getContext']

  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(impl)

  return {
    entries,
    opsAt: (index) => entries[index]?.ops ?? [],
  }
}

/** 操作名序列，方便断言顺序。 */
export function opNames(ops: Op[]): string[] {
  return ops.map((op) => op.name)
}

/** 取某个操作首次出现的下标，用来比较先后。 */
export function indexOfOp(ops: Op[], name: string): number {
  return ops.findIndex((op) => op.name === name)
}
