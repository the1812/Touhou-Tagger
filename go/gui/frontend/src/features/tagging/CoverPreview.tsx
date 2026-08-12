import { Image as ImageIcon, Maximize2 } from 'lucide-vue-next'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { computed, defineComponent, type PropType, ref } from 'vue'

import type { CoverPreview as CoverPreviewData } from '../../api'

const coverFrameClass =
  'relative grid size-[188px] place-items-center overflow-hidden rounded-xl border border-surface-200 bg-surface-50 text-muted-color dark:border-surface-700 dark:bg-surface-800 max-[720px]:w-[min(188px,100%)]'

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
        : '尺寸未知',
    )
    const fileSize = computed(() => {
      if (!props.cover.byteSize) {
        return '大小未知'
      }
      if (props.cover.byteSize < 1024 * 1024) {
        return `${Math.round(props.cover.byteSize / 1024)} KB`
      }
      return `${(props.cover.byteSize / 1024 / 1024).toFixed(1)} MB`
    })

    return () => (
      <>
        <section class="grid w-[188px] min-w-0 gap-2">
          {props.cover.url ? (
            <button
              type="button"
              class={`${coverFrameClass} group cursor-zoom-in p-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-primary`}
              onClick={() => {
                expanded.value = true
              }}
            >
              <img
                class="size-full object-contain"
                src={props.cover.url}
                alt={`${props.cover.sourceLabel}预览`}
              />
              <span class="image-hover-label">
                <Maximize2 size={16} /> 查看大图
              </span>
            </button>
          ) : (
            <div class={`${coverFrameClass} content-center gap-2 p-5 text-center`}>
              <ImageIcon size={38} stroke-width={1.5} />
              <strong class="text-color">没有封面</strong>
            </div>
          )}

          <div class="grid min-w-0 gap-2">
            <div class="flex items-center justify-center gap-3 whitespace-nowrap text-[.78rem] text-muted-color">
              <span>{dimensions.value}</span>
              <span>{fileSize.value}</span>
            </div>
            {props.cover.issue && (
              <Message severity="error" closable={false}>
                {props.cover.issue.message}
              </Message>
            )}
          </div>
        </section>

        <Dialog
          v-model:visible={expanded.value}
          modal
          header="封面预览"
          class="w-[min(760px,90vw)]"
        >
          <img
            class="block max-h-[70vh] w-full object-contain"
            src={props.cover.url}
            alt={`${props.cover.sourceLabel}大图`}
          />
        </Dialog>
      </>
    )
  },
})
