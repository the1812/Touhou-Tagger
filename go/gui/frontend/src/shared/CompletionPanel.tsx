import { Check, ExternalLink, RotateCcw, TriangleAlert } from 'lucide-vue-next'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

export const CompletionPanel = defineComponent({
  name: 'CompletionPanel',
  props: {
    warning: Boolean,
    retryable: Boolean,
  },
  emits: {
    reveal: () => true,
    retry: () => true,
    complete: () => true,
  },
  setup(props, { emit }) {
    return () => (
      <section class="workspace-section flex items-center gap-5 border-b-0 py-6">
        <div
          class={[
            'grid size-16 place-items-center rounded-full bg-surface-100 text-primary dark:bg-primary-950',
            {
              'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300':
                props.warning,
            },
          ]}
        >
          {props.warning ? <TriangleAlert size={34} /> : <Check size={34} />}
        </div>
        <div class="flex flex-wrap gap-3">
          <Button
            label="在资源管理器中打开"
            severity="secondary"
            outlined
            onClick={() => emit('reveal')}
          >
            {{ icon: () => <ExternalLink size={17} /> }}
          </Button>
          {props.retryable && (
            <Button
              label="仅重试失败项"
              severity="secondary"
              outlined
              onClick={() => emit('retry')}
            >
              {{ icon: () => <RotateCcw size={17} /> }}
            </Button>
          )}
          <Button label="完成" onClick={() => emit('complete')} />
        </div>
      </section>
    )
  },
})
