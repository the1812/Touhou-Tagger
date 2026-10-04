import { storeToRefs } from 'pinia'
import { defineComponent } from 'vue'

import { useWorkspaceStore } from '../../../features/workspace'
import { usePageCommands } from '../../../shared/lib'
import { DirectoryPickerEmptyState } from '../../../shared/ui'
import { TaggingPlanSkeleton } from './TaggingPlanSkeleton'
import { TaggingPlanStep } from './TaggingPlanStep'
import { TaggingSearchStep } from './TaggingSearchStep'
import { TaggingSummary } from './TaggingSummary'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const { activity, summary } = storeToRefs(workspace)

    usePageCommands({
      openDirectory: directories => {
        if (directories && directories.length !== 1) {
          return false
        }
        return workspace.selectDirectory(directories?.[0])
      },
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
      const loadingAlbum = activity.value === 'opening'

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
            </div>
          )}
        </div>
      )
    }
  },
})
