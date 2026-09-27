import { ExternalLink, FolderOpen } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import { computed, defineComponent } from 'vue'

import { useBatchStore } from '../../../features/batch'
import { t } from '../../../shared/i18n'
import { TruncatedText, WorkspaceTitle } from '../../../shared/ui'

export const BatchDirectoryHeader = defineComponent({
  name: 'BatchDirectoryHeader',
  setup() {
    const batch = useBatchStore()
    const { directory, selecting, canChangeDirectory } = storeToRefs(batch)
    const directoryLabel = computed(() => {
      const parts = directory.value.split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || t('batch.directoryFallback')
    })

    return () => {
      const currentDirectory = directory.value
      return (
        <div class="workspace-section">
          <div class="workspace-heading">
            <div class="min-w-0">
              <WorkspaceTitle>{directoryLabel.value}</WorkspaceTitle>
              <TruncatedText
                tooltip={currentDirectory}
                class={['mt-1.5 max-w-[min(760px,65vw)]', 'text-base text-muted-color']}
              >
                {currentDirectory}
              </TruncatedText>
            </div>
            <div class="flex items-center gap-4.5">
              <div class="flex items-center gap-1">
                <Button
                  v-tooltip={t('common.revealDirectory')}
                  severity="secondary"
                  text
                  rounded
                  onClick={() => void batch.reveal()}
                >
                  {{ icon: () => <ExternalLink /> }}
                </Button>
              </div>
              <Button
                label={t('common.changeDirectory')}
                severity="secondary"
                outlined
                loading={selecting.value}
                disabled={!canChangeDirectory.value}
                onClick={() => void batch.selectDirectory()}
              >
                {{ icon: () => <FolderOpen /> }}
              </Button>
            </div>
          </div>
        </div>
      )
    }
  },
})
