import { FolderPlus } from '@lucide/vue'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'

export const BatchManualSelectionSection = defineComponent({
  name: 'BatchManualSelectionSection',
  setup() {
    const batch = useBatchStore()
    return () => (
      <Button
        label={t('batch.addDirectories')}
        severity="secondary"
        outlined
        loading={batch.selecting || batch.scanning}
        disabled={!batch.canChangeDirectory}
        onClick={() => void batch.addDirectories()}
      >
        {{ icon: () => <FolderPlus /> }}
      </Button>
    )
  },
})
