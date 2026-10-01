import { storeToRefs } from 'pinia'
import { defineComponent } from 'vue'

import { useWorkspaceStore } from '../../../features/workspace'
import { failureTitle, resultTitle } from '../../../shared/api'
import { usePageCommands } from '../../../shared/lib'
import { CompletionDialog, DirectoryPickerEmptyState } from '../../../shared/ui'
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
      const { title, warning } = (() => {
        if (!currentCompletion) {
          return { title: '', warning: false }
        }
        if (currentCompletion.kind === 'failure') {
          return { title: failureTitle(currentCompletion.failure), warning: true }
        }
        return {
          title: resultTitle(currentCompletion.result),
          warning: Boolean(currentCompletion.result.cancelled || currentCompletion.result.failed),
        }
      })()

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
                warning={warning}
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
