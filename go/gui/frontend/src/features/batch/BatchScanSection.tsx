import { RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { computed, defineComponent } from 'vue'

import { t } from '../../i18n'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useBatchStore } from '../../stores/batch'
import { BatchJobTable } from './BatchJobTable'

export const BatchScanSection = defineComponent({
  name: 'BatchScanSection',
  setup() {
    const batch = useBatchStore()
    const { depth, preview, selecting, scanning, resolvingCount, isWriting } = storeToRefs(batch)
    const controlsDisabled = computed(
      () => selecting.value || scanning.value || resolvingCount.value > 0 || isWriting.value,
    )
    const tableDisabled = computed(() => selecting.value || scanning.value || isWriting.value)

    return () => {
      const currentPreview = preview.value
      return (
        <div class="workspace-section grid min-h-[390px] content-start gap-3">
          <div class="workspace-heading items-center">
            <WorkspaceTitle>{t('batch.scanHeading')}</WorkspaceTitle>
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-2">
                <div class="whitespace-nowrap text-sm font-semibold">{t('batch.depth')}</div>
                <InputNumber
                  useGrouping={false}
                  class="w-28"
                  modelValue={depth.value}
                  {...{
                    'onUpdate:modelValue': (value: number | null) => batch.setDepth(value),
                  }}
                  min={1}
                  max={8}
                  showButtons
                  fluid
                  disabled={controlsDisabled.value}
                />
              </div>
              <Button
                class="shrink-0 whitespace-nowrap"
                label={t('batch.rescan')}
                severity="secondary"
                outlined
                disabled={controlsDisabled.value}
                onClick={() => void batch.scan()}
              >
                {{
                  icon: () => <RefreshCw class={{ 'animate-spin': scanning.value }} />,
                }}
              </Button>
            </div>
          </div>

          {scanning.value && !currentPreview ? (
            <div class="grid min-h-64 place-items-center content-center gap-4 text-center">
              <div
                class={[
                  'size-[46px] animate-spin rounded-full border-[3px]',
                  'border-primary-200 border-t-primary dark:border-primary-800 dark:border-t-primary',
                ]}
              />
              <div class="text-base font-medium">{t('batch.scanning')}</div>
            </div>
          ) : (
            <BatchJobTable
              jobs={currentPreview?.jobs ?? []}
              editable
              disabled={tableDisabled.value}
              resolving={batch.isResolving}
              onResolve={(jobId, candidateId) => batch.resolveCandidate(jobId, candidateId)}
              onRetry={jobId => batch.loadJob(jobId)}
            />
          )}
        </div>
      )
    }
  },
})
