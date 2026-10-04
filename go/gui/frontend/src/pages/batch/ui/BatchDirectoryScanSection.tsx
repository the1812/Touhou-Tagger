import { RefreshCw } from '@lucide/vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { defineComponent } from 'vue'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'

export const BatchDirectoryScanSection = defineComponent({
  name: 'BatchDirectoryScanSection',
  setup() {
    const batch = useBatchStore()
    const { depth, scanning, canChangeDirectory } = storeToRefs(batch)
    return () => (
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
            disabled={!canChangeDirectory.value}
          />
        </div>
        <Button
          class="shrink-0 whitespace-nowrap"
          label={t('batch.rescan')}
          severity="secondary"
          outlined
          disabled={!canChangeDirectory.value}
          onClick={() => void batch.scan()}
        >
          {{
            icon: () => <RefreshCw class={{ 'animate-spin': scanning.value }} />,
          }}
        </Button>
      </div>
    )
  },
})
