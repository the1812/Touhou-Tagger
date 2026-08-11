import { computed, defineComponent, type PropType, ref } from 'vue'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { Image as ImageIcon, Maximize2 } from 'lucide-vue-next'

import type { CoverPreview as CoverPreviewData } from '../../api'

import './CoverPreview.css'

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
        <section class={['cover-card', { 'cover-card--error': props.cover.issue }]}>
          {props.cover.url ? (
            <button
              type="button"
              class="cover-card__image-button"
              aria-label="查看封面大图"
              onClick={() => {
                expanded.value = true
              }}
            >
              <img src={props.cover.url} alt={`${props.cover.sourceLabel}预览`} />
              <span class="cover-card__expand">
                <Maximize2 size={16} /> 查看大图
              </span>
            </button>
          ) : (
            <div class="cover-card__empty">
              <ImageIcon size={38} stroke-width={1.5} />
              <strong>没有封面</strong>
            </div>
          )}

          <div class="cover-card__details">
            <div class="cover-card__metadata">
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
          class="cover-dialog"
          style={{ width: 'min(760px, 90vw)' }}
        >
          <img
            class="cover-dialog__image"
            src={props.cover.url}
            alt={`${props.cover.sourceLabel}大图`}
          />
        </Dialog>
      </>
    )
  },
})
