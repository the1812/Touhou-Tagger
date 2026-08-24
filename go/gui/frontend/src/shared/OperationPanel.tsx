import { Ban, LockKeyhole } from 'lucide-vue-next'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { computed, defineComponent, type PropType } from 'vue'

import type { OperationProgress } from '../api'
import { t } from '../i18n'
import { TruncatedText } from './TruncatedText'

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
      <div class="grid gap-5 py-app-section-y">
        <div class="flex items-center justify-between gap-4">
          <div class="mt-1 font-bold">{stageLabel.value}</div>
          <div class="font-bold text-primary tabular-nums">
            {props.operation.current} / {props.operation.total}
          </div>
        </div>
        <ProgressBar value={progress.value} />
        <div class="flex items-center justify-between gap-4 text-sm text-muted-color">
          <div class="grid min-w-0 gap-1">
            {props.operation.path && (
              <TruncatedText class="font-bold text-color">{props.operation.path}</TruncatedText>
            )}
            {props.operation.message !== props.operation.path && (
              <TruncatedText class="text-xs">{props.operation.message}</TruncatedText>
            )}
          </div>
          {props.operation.cancellable ? (
            <Button
              label={t('operation.cancel')}
              severity="secondary"
              outlined
              onClick={() => emit('cancel')}
            >
              {{ icon: () => <Ban size={16} /> }}
            </Button>
          ) : (
            <div class="flex items-center gap-1.5 text-color">
              <LockKeyhole size={15} />
              {t('operation.committingNotCancellable')}
            </div>
          )}
        </div>
      </div>
    )
  },
})
