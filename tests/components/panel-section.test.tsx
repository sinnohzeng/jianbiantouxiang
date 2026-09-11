/**
 * 折叠组的两条：`data-slot` 要透传到 Collapsible 根上，测试与端到端靠它认人；
 * 收起时内容整块不挂，不是藏起来。
 */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { PanelSection } from '@/components/blocks/panel-section'

afterEach(() => {
  cleanup()
})

describe('PanelSection', () => {
  it('data-slot 落在折叠根上，触发器与内容都在它里面', () => {
    const { container } = render(
      <PanelSection data-slot="text-group-offset" title="位置微调">
        <p>一条滑杆</p>
      </PanelSection>,
    )

    const root = container.querySelector('[data-slot="text-group-offset"]')
    expect(root).not.toBeNull()
    expect(root!.querySelector('[data-slot="collapsible-trigger"]')).not.toBeNull()
    expect(root!.textContent).toContain('一条滑杆')
  })

  it('defaultOpen 为假时内容不挂，点开才有', () => {
    const { container } = render(
      <PanelSection data-slot="text-group-layout" title="版面" defaultOpen={false}>
        <p>一条滑杆</p>
      </PanelSection>,
    )

    const trigger = container.querySelector<HTMLButtonElement>(
      '[data-slot="text-group-layout"] [data-slot="collapsible-trigger"]',
    )!
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(container.textContent).not.toContain('一条滑杆')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('一条滑杆')
  })
})
