import { storeToRefs } from 'pinia'
import { defineComponent } from 'vue'

import { failureTitle, resultTitle } from '../../api/display'
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
    const { activity, completion, summary } = storeToRefs(workspace)

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
      const currentCompletion = completion.value
      const loadingAlbum = activity.value === 'opening'
      let title = ''
      if (currentCompletion) {
        title =
          currentCompletion.kind === 'failure'
            ? failureTitle(currentCompletion.failure)
            : resultTitle(currentCompletion.result)
      }

      return (
        <div class="round-icon-buttons flex min-h-full flex-col">
          {!summary.value ? (
            <DirectoryPickerEmptyState
              loading={activity.value === 'selecting' || loadingAlbum}
              disabled={!workspace.canChangeDirectory}
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
                visible={Boolean(currentCompletion)}
                title={title}
                warning={Boolean(
                  currentCompletion?.kind === 'failure' ||
                  (currentCompletion?.kind === 'result' &&
                    (currentCompletion.result.cancelled || currentCompletion.result.failed)),
                )}
                details={
                  currentCompletion?.kind === 'failure'
                    ? currentCompletion.failure.details
                    : undefined
                }
                onReveal={() => workspace.reveal()}
                onClose={workspace.closeCompletion}
              />
            </div>
          )}
        </div>
      )
    }
  },
})
