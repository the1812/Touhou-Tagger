import { Image as ImageIcon, Maximize2 } from 'lucide-vue-next'
import Image from 'primevue/image'
import { computed, defineComponent, type PropType } from 'vue'

import type { CoverPreview as CoverPreviewData } from '../../api'
import { t } from '../../i18n'
import { Message } from '../../shared/Message'

export const CoverPreview = defineComponent({
  name: 'CoverPreview',
  props: {
    cover: {
      type: Object as PropType<CoverPreviewData>,
      required: true,
    },
  },
  setup(props) {
    const dimensions = computed(() =>
      props.cover.width && props.cover.height
        ? `${props.cover.width} × ${props.cover.height}`
        : t('tagging.cover.unknownDimensions'),
    )
    const fileSize = computed(() => {
      if (!props.cover.byteSize) {
        return t('tagging.cover.unknownSize')
      }
      if (props.cover.byteSize < 1024 * 1024) {
        return `${Math.round(props.cover.byteSize / 1024)} KB`
      }
      return `${(props.cover.byteSize / 1024 / 1024).toFixed(1)} MB`
    })

    return () => (
      <div class="grid w-app-cover min-w-0 gap-2">
        {props.cover.url ? (
          <div class="flex size-app-cover items-center justify-center max-[720px]:w-[min(var(--spacing-app-cover),100%)]">
            <Image
              preview
              src={props.cover.url}
              class="flex max-h-full max-w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800"
              imageClass="block max-h-[calc(var(--spacing-app-cover)-2px)] max-w-full object-contain"
              pt={{
                image: { alt: t('tagging.cover.previewHeader') },
                original: { alt: t('tagging.cover.previewHeader') },
                zoomInButton: { autofocus: true },
                closeButton: { autofocus: false },
              }}
            >
              {{
                previewicon: () => (
                  <div class="flex items-center gap-1.5 text-sm leading-normal">
                    <Maximize2 />
                    {t('tagging.cover.viewFull')}
                  </div>
                ),
              }}
            </Image>
          </div>
        ) : (
          <div
            class={[
              'relative grid size-app-cover place-items-center overflow-hidden rounded-xl border',
              'border-surface-200 bg-surface-50 text-muted-color dark:border-surface-700 dark:bg-surface-800',
              'content-center gap-2 p-5 text-center max-[720px]:w-[min(var(--spacing-app-cover),100%)]',
            ]}
          >
            <ImageIcon class="size-[38px]" stroke-width={1.5} />
            <div class="font-medium">{t('tagging.cover.noCover')}</div>
          </div>
        )}

        {props.cover.url && (
          <div class="flex items-center justify-center gap-3 whitespace-nowrap text-base text-muted-color">
            <div>{dimensions.value}</div>
            <div>{fileSize.value}</div>
          </div>
        )}
        {props.cover.issue && <Message severity="error">{props.cover.issue.message}</Message>}
      </div>
    )
  },
})
