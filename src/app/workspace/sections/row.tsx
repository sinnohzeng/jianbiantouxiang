/**
 * 四张卡片共用的一行数值。滑杆的编辑名与重置名都由标签派生，调用处只写标签，
 * 省得每加一行就把两句可访问名再抄一遍。
 *
 * displayOf 是质感参数的显示口径，只有质感卡片用，与 Row 放在一起省一个文件。
 */

import { SliderField, type SliderFieldProps } from '@/components/blocks/slider-field'
import { type StyleParamKey } from '@/engine/styles'
import { useT } from '@/i18n'

/** 滑杆的显示口径：0..1 的参数显示成百分数，比例保留两位，角度带度数符号。 */
export function displayOf(key: StyleParamKey): { scale: number; precision: number; unit: string } {
  if (key === 'scale') return { scale: 1, precision: 2, unit: '×' }
  if (key === 'rotation') return { scale: 1, precision: 0, unit: '°' }
  return { scale: 100, precision: 0, unit: '%' }
}

export type RowProps = Omit<SliderFieldProps, 'editLabel' | 'resetLabel'>

/** 一行参数。编辑名与重置名都由标签派生，调用处只写标签。 */
export function Row(props: RowProps) {
  const t = useT()
  return (
    <SliderField
      {...props}
      editLabel={t('panel.common.edit', { name: props.label })}
      resetLabel={t('panel.common.reset', { name: props.label })}
    />
  )
}
