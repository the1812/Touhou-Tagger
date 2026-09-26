import { storeToRefs } from 'pinia'
import { defineComponent } from 'vue'

import { usePageCommands } from '../../app/pageCommands'
import { CompletionDialog } from '../../shared/CompletionDialog'
import { DirectoryPickerEmptyState } from '../../shared/DirectoryPickerEmptyState'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaggingPlanSkeleton } from './TaggingPlanSkeleton'
import { TaggingPlanStep } from './TaggingPlanStep'
import { TaggingSearchStep } from './TaggingSearchStep'
import { TaggingSummary } from './TaggingSummary'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const { phase, summary, result, failure, resultOpen } = storeToRefs(workspace)

    usePageCommands({
      openDirectory: directory => workspace.selectDirectory(directory),
      refresh: () => {
        if (!workspace.directory) {
          return false
        }
        void workspace.scan(workspace.directory)
        return true
      },
      focusSearch: () => {
        const input = document.querySelector<HTMLInputElement>('#album-search')
        if (!input) {
          return false
        }
        input.focus()
        return true
      },
    })

    return () => {
      const currentSummary = summary.value
      const currentResult = result.value
      const currentPhase = phase.value
      const isScanning = currentPhase === 'scanning'
      const isInitialSearch = currentPhase === 'searching' && !workspace.hasSearched
      const canSkipAlbumSelection =
        currentSummary?.hasMetadataJson || workspace.candidates.length === 1
      const isAutomaticPreparation = currentPhase === 'preparing' && canSkipAlbumSelection
      const loadingAlbum = isScanning || isInitialSearch || isAutomaticPreparation

      return (
        <div class="round-icon-buttons flex min-h-full flex-col">
          {!currentSummary && (currentPhase === 'idle' || currentPhase === 'selecting') ? (
            <DirectoryPickerEmptyState
              loading={currentPhase === 'selecting'}
              onSelect={() => workspace.selectDirectory()}
            />
          ) : (
            <div class="workspace-sections flex min-w-0 flex-1 flex-col">
              <TaggingSummary />

              {loadingAlbum ? (
                <TaggingPlanSkeleton />
              ) : (
                <>
                  <TaggingSearchStep />
                  <TaggingPlanStep />
                </>
              )}

              <CompletionDialog
                visible={resultOpen.value}
                title={failure.value?.message ?? currentResult?.message ?? ''}
                warning={Boolean(
                  failure.value || currentResult?.cancelled || currentResult?.failed,
                )}
                details={failure.value?.details}
                onReveal={() => workspace.reveal()}
                onClose={() => {
                  workspace.resultOpen = false
                }}
              />
            </div>
          )}
        </div>
      )
    }
  },
})
