import { Image as ImageIcon, Maximize2 } from 'lucide-vue-next'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Image from 'primevue/image'
import Message from 'primevue/message'
import { computed, defineComponent, type PropType, ref } from 'vue'

import type { CoverPreview as CoverPreviewData } from '../../api'
import { t } from '../../i18n'

export const CoverPreview = defineComponent({
  name: 'CoverPreview',
  props: {
    cover: {
      type: Object as PropType<CoverPreviewData>,
      required: true,
    },
  },
  setup(props) {
    const expanded = ref(false)
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
      <>
        <div class="grid w-app-cover min-w-0 gap-2">
          {props.cover.url ? (
            <Button
              unstyled
              type="button"
              class={[
                'relative grid size-app-cover place-items-center overflow-hidden rounded-xl border',
                'border-surface-200 bg-surface-50 text-muted-color dark:border-surface-700 dark:bg-surface-800',
                'group cursor-zoom-in p-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary',
                'max-[720px]:w-[min(var(--spacing-app-cover),100%)]',
              ]}
              onClick={() => {
                expanded.value = true
              }}
            >
              <Image
                class="size-full"
                imageClass="size-full object-contain"
                src={props.cover.url}
              />
              <div class="image-hover-label">
                <Maximize2 size={16} /> {t('tagging.cover.viewFull')}
              </div>
            </Button>
          ) : (
            <div
              class={[
                'relative grid size-app-cover place-items-center overflow-hidden rounded-xl border',
                'border-surface-200 bg-surface-50 text-muted-color dark:border-surface-700 dark:bg-surface-800',
                'content-center gap-2 p-5 text-center max-[720px]:w-[min(var(--spacing-app-cover),100%)]',
              ]}
            >
              <ImageIcon size={38} stroke-width={1.5} />
              <div class="font-bold text-color">{t('tagging.cover.noCover')}</div>
            </div>
          )}

          <div class="grid min-w-0 gap-2">
            <div class="flex items-center justify-center gap-3 whitespace-nowrap text-app-caption text-muted-color">
              <div>{dimensions.value}</div>
              <div>{fileSize.value}</div>
            </div>
            {props.cover.issue && (
              <Message severity="error" closable={false}>
                {props.cover.issue.message}
              </Message>
            )}
          </div>
        </div>

        <Dialog
          v-model:visible={expanded.value}
          modal
          header={t('tagging.cover.previewHeader')}
          class="w-[min(760px,90vw)]"
        >
          <Image
            class="block w-full"
            imageClass="block max-h-[70vh] w-full object-contain"
            src={props.cover.url}
          />
        </Dialog>
      </>
    )
  },
})
