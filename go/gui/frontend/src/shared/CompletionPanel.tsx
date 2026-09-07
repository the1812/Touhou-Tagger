import { Check, ExternalLink, RotateCcw, TriangleAlert } from 'lucide-vue-next'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { t } from '../i18n'

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
      <div class="workspace-section flex items-center gap-5 border-b-0 py-6">
        <div
          class={[
            'grid size-16 place-items-center rounded-full bg-surface-100 text-primary dark:bg-primary-950',
            {
              'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300': props.warning,
            },
          ]}
        >
          {props.warning ? <TriangleAlert class="size-[34px]" /> : <Check class="size-[34px]" />}
        </div>
        <div class="flex flex-wrap gap-3">
          <Button
            label={t('common.revealDirectory')}
            severity="secondary"
            outlined
            onClick={() => emit('reveal')}
          >
            {{ icon: () => <ExternalLink /> }}
          </Button>
          {props.retryable && (
            <Button
              label={t('operation.retryFailedOnly')}
              severity="secondary"
              outlined
              onClick={() => emit('retry')}
            >
              {{ icon: () => <RotateCcw /> }}
            </Button>
          )}
          <Button label={t('common.complete')} onClick={() => emit('complete')} />
        </div>
      </div>
    )
  },
})
