import { storeToRefs } from 'pinia'
import { defineComponent } from 'vue'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'
import { WorkspaceTitle } from '../../../shared/ui'
import { BatchDirectoryScanSection } from './BatchDirectoryScanSection'
import { BatchEntryTable } from './BatchEntryTable'
import { BatchManualSelectionSection } from './BatchManualSelectionSection'

export const BatchEntriesSection = defineComponent({
  name: 'BatchEntriesSection',
  setup() {
    const batch = useBatchStore()
    const { mode, preview, scanning, canRemoveEntries, canEditEntries } = storeToRefs(batch)

    return () => {
      const currentPreview = preview.value
      return (
        <div class="workspace-section grid min-h-[390px] content-start gap-3">
          <div class="workspace-heading">
            <WorkspaceTitle class="mt-1">{t('batch.scanHeading')}</WorkspaceTitle>
            {mode.value === 'directoryScan' ? (
              <BatchDirectoryScanSection />
            ) : (
              <BatchManualSelectionSection />
            )}
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
            <BatchEntryTable
              entries={currentPreview?.entries ?? []}
              editable
              removable={mode.value === 'manualSelection'}
              removeDisabled={!canRemoveEntries.value}
              onRemove={entryId => batch.removeEntry(entryId)}
              onReveal={directory => batch.reveal(directory)}
              disabled={!canEditEntries.value}
              resolving={batch.isResolving}
              onResolve={(entryId, candidateId) => batch.resolveCandidate(entryId, candidateId)}
              onRetry={entryId => batch.loadEntry(entryId)}
            />
          )}
        </div>
      )
    }
  },
})
