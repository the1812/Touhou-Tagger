import { FolderOpen, Folders } from 'lucide-vue-next'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'
import { DirectoryPickerEmptyState } from '../../../shared/ui'

export const BatchDirectoryPicker = defineComponent({
  name: 'BatchDirectoryPicker',
  setup() {
    const batch = useBatchStore()
    return () => {
      const loading = batch.selecting || batch.scanning
      return (
        <DirectoryPickerEmptyState>
          {{
            actions: () => (
              <div class="flex flex-wrap justify-center gap-3">
                <Button
                  class="w-48"
                  label={t('batch.directoryScan')}
                  size="large"
                  loading={batch.mode === 'directoryScan' && loading}
                  disabled={!batch.canSwitchMode}
                  onClick={() => void batch.chooseMode('directoryScan')}
                >
                  {{ icon: () => <FolderOpen /> }}
                </Button>
                <Button
                  class="w-48"
                  label={t('batch.manualSelection')}
                  size="large"
                  loading={batch.mode === 'manualSelection' && loading}
                  disabled={!batch.canSwitchMode}
                  onClick={() => void batch.chooseMode('manualSelection')}
                >
                  {{ icon: () => <Folders /> }}
                </Button>
              </div>
            ),
          }}
        </DirectoryPickerEmptyState>
      )
    }
  },
})
