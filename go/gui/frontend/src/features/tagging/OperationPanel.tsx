import { computed, defineComponent, type PropType } from 'vue'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import { Ban, LockKeyhole } from 'lucide-vue-next'

import type { OperationProgress } from '../../api'

import './OperationPanel.css'

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
    const cancelLabel = computed(() =>
      props.operation.kind === 'batch' ? '停止后续任务' : '取消操作',
    )
    const stageLabel = computed(() => {
      const labels: Record<string, string> = {
        preparing: '准备写入',
        writing: '写入临时文件',
        committing: '提交文件',
        renaming: '重命名',
        complete: '完成',
      }
      return labels[props.operation.stage] ?? props.operation.message
    })

    return () => (
      <section class="operation-panel" aria-live="polite">
        <div class="operation-panel__heading">
          <div>
            <h2>{stageLabel.value}</h2>
          </div>
          <strong>
            {props.operation.current} / {props.operation.total}
          </strong>
        </div>
        <ProgressBar value={progress.value} />
        <div class="operation-panel__detail">
          <span class="operation-panel__current">
            {props.operation.path && <strong>{props.operation.path}</strong>}
            {props.operation.message !== props.operation.path && (
              <small>{props.operation.message}</small>
            )}
          </span>
          {props.operation.cancellable ? (
            <Button
              label={cancelLabel.value}
              severity="secondary"
              outlined
              onClick={() => emit('cancel')}
            >
              {{ icon: () => <Ban size={16} /> }}
            </Button>
          ) : (
            <span class="operation-panel__locked">
              <LockKeyhole size={15} />
              正在提交，暂时无法取消
            </span>
          )}
        </div>
      </section>
    )
  },
})
