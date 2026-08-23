import { Ban, LockKeyhole } from 'lucide-vue-next'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { computed, defineComponent, type PropType } from 'vue'

import type { OperationProgress } from '../api'
import { t } from '../i18n'

export const OperationPanel = defineComponent({
  name: 'OperationPanel',
  props: {
    operation: {
      type: Object as PropType<OperationProgress>,
      required: true,
    },
  },
  emits: {
    cancel: () => true,
  },
  setup(props, { emit }) {
    const progress = computed(() =>
      props.operation.total > 0
        ? Math.round((props.operation.current / props.operation.total) * 100)
        : 0,
    )
    const stageLabel = computed(() => {
      const labels: Record<string, string> = {
        preparing: t('operation.preparing'),
        writing: t('operation.writing'),
        committing: t('operation.committing'),
        renaming: t('operation.renaming'),
        complete: t('operation.complete'),
      }
      return labels[props.operation.stage] ?? props.operation.message
    })

    return () => (
      <section class="grid gap-5 py-app-section-y">
        <div class="flex items-center justify-between gap-4">
          <h2 class="mt-1 font-bold">{stageLabel.value}</h2>
          <strong class="text-primary tabular-nums">
            {props.operation.current} / {props.operation.total}
          </strong>
        </div>
        <ProgressBar value={progress.value} />
        <div class="flex items-center justify-between gap-4 text-sm text-muted-color">
          <span class="grid min-w-0 gap-1">
            {props.operation.path && (
              <strong class="overflow-hidden text-ellipsis whitespace-nowrap text-color">
                {props.operation.path}
              </strong>
            )}
            {props.operation.message !== props.operation.path && (
              <small class="overflow-hidden text-ellipsis whitespace-nowrap">
                {props.operation.message}
              </small>
            )}
          </span>
          {props.operation.cancellable ? (
            <Button label={t('operation.cancel')} severity="secondary" outlined onClick={() => emit('cancel')}>
              {{ icon: () => <Ban size={16} /> }}
            </Button>
          ) : (
            <span class="flex items-center gap-1.5 text-color">
              <LockKeyhole size={15} />
              {t('operation.committingNotCancellable')}
            </span>
          )}
        </div>
      </section>
    )
  },
})
