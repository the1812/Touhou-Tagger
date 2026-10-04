import { Image as ImageIcon } from '@lucide/vue'
import { defineComponent, render } from 'vue'

import { t } from '../i18n'

export const CoverPlaceholder = defineComponent({
  name: 'CoverPlaceholder',
  props: {
    compact: Boolean,
  },
  setup(props) {
    return () => (
      <div
        class={[
          'relative grid place-items-center overflow-hidden rounded-xl border',
          'border-surface-200 bg-surface-50 text-muted-color dark:border-surface-700 dark:bg-surface-800',
          props.compact ? 'p-2' : 'content-center gap-2 p-5 text-center',
        ]}
      >
        <ImageIcon class={props.compact ? 'size-6' : 'size-[38px]'} stroke-width={1.5} />
        {!props.compact && <div class="font-medium">{t('tagging.cover.noCover')}</div>}
      </div>
    )
  },
})

export const coverPlaceholderHTML = (className: string) => {
  const container = document.createElement('div')
  render(<CoverPlaceholder class={className} />, container)
  const html = container.innerHTML
  render(null, container)
  return html
}
