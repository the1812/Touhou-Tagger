import { Maximize2 } from '@lucide/vue'
import Image from 'primevue/image'
import { computed, defineComponent, type PropType } from 'vue'

import type { CoverPreview as CoverPreviewData } from '../../../shared/api'
import { issueText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { CoverPlaceholder, Message } from '../../../shared/ui'

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
        ? `${String(props.cover.width)} × ${String(props.cover.height)}`
        : t('tagging.cover.unknownDimensions'),
    )
    const fileSize = computed(() => {
      if (!props.cover.byteSize) {
        return t('tagging.cover.unknownSize')
      }
      if (props.cover.byteSize < 1024 * 1024) {
        return `${String(Math.round(props.cover.byteSize / 1024))} KB`
      }
      return `${(props.cover.byteSize / 1024 / 1024).toFixed(1)} MB`
    })

    return () => (
      <div class="grid w-app-cover min-w-0 gap-2">
        {props.cover.url ? (
          <div class="flex size-app-cover items-center justify-center">
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
          <CoverPlaceholder class="size-app-cover" />
        )}

        {props.cover.url && (
          <div class="flex items-center justify-center gap-3 whitespace-nowrap text-base text-muted-color">
            <div>{dimensions.value}</div>
            <div>{fileSize.value}</div>
          </div>
        )}
        {props.cover.issue && <Message severity="error">{issueText(props.cover.issue)}</Message>}
      </div>
    )
  },
})
