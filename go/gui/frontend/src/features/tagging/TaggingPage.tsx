import {
  ExternalLink,
  FileAudio,
  FileCog,
  FileJson,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

import { usePageCommands } from '../../app/pageCommands'
import { t } from '../../i18n'
import { CompletionPanel } from '../../shared/CompletionPanel'
import { DirectoryPickerEmptyState } from '../../shared/DirectoryPickerEmptyState'
import { Message } from '../../shared/Message'
import { OperationPanel } from '../../shared/OperationPanel'
import { StatusIcon } from '../../shared/StatusIcon'
import { TruncatedText } from '../../shared/TruncatedText'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaggingPlanStep } from './TaggingPlanStep'
import { TaggingSearchStep } from './TaggingSearchStep'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const { phase, summary, operation, result, isBusy } = storeToRefs(workspace)

    usePageCommands({
      openDirectory: () => workspace.selectDirectory(),
      refresh: () => {
        if (!summary.value?.directory) {
          return false
        }
        workspace.scan()
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
      const currentOperation = operation.value
      const currentResult = result.value
      const currentPhase = phase.value

      return (
        <div class="round-icon-buttons flex min-h-full flex-col">
          {!currentSummary && (currentPhase === 'idle' || currentPhase === 'selecting') ? (
            <DirectoryPickerEmptyState
              loading={currentPhase === 'selecting'}
              onSelect={() => workspace.selectDirectory()}
            />
          ) : (
            <div class="workspace-sections flex min-w-0 flex-1 flex-col">
              <div class="workspace-section">
                {!currentSummary && currentPhase === 'scanning' ? (
                  <div>
                    <div class="workspace-heading">
                      <div class="min-w-0 flex-1">
                        <WorkspaceTitle>
                          <Skeleton width="55%" height="1.75rem" />
                        </WorkspaceTitle>
                        <div class="mt-1.5">
                          <Skeleton width="80%" height="1.5rem" />
                        </div>
                      </div>
                      <div class="flex items-center gap-4.5">
                        <div class="flex items-center gap-1">
                          <Skeleton shape="circle" size="2.5rem" />
                          <Skeleton shape="circle" size="2.5rem" />
                        </div>
                        <Skeleton width="7rem" height="2.5rem" />
                      </div>
                    </div>
                    <div class="mt-3 -mx-1.5 -mb-1.5 flex items-center">
                      {[1, 2, 3, 4].map(index => (
                        <div key={index} class="p-1.5">
                          <Skeleton width={index === 1 ? '2.5rem' : '1rem'} height="1.25rem" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  currentSummary && (
                    <>
                      <div class="workspace-heading">
                        <div>
                          <WorkspaceTitle>
                            {currentSummary.inferredAlbumName || t('tagging.unnamedAlbum')}
                          </WorkspaceTitle>
                          <TruncatedText
                            tooltip={currentSummary.directory}
                            class={['mt-1.5 max-w-[min(760px,65vw)]', 'text-base text-muted-color']}
                          >
                            {currentSummary.directory}
                          </TruncatedText>
                        </div>
                        <div class="flex items-center gap-4.5">
                          <div class="flex items-center gap-1">
                            <Button
                              v-tooltip={t('common.revealDirectory')}
                              severity="secondary"
                              text
                              rounded
                              onClick={() => workspace.reveal()}
                            >
                              {{ icon: () => <ExternalLink /> }}
                            </Button>
                            <Button
                              v-tooltip={t('tagging.rescan')}
                              severity="secondary"
                              text
                              rounded
                              disabled={isBusy.value}
                              onClick={() => workspace.scan()}
                            >
                              {{
                                icon: () => (
                                  <RefreshCw
                                    class={{ 'animate-spin': currentPhase === 'scanning' }}
                                  />
                                ),
                              }}
                            </Button>
                          </div>
                          <Button
                            label={t('common.changeDirectory')}
                            loading={currentPhase === 'selecting'}
                            severity="secondary"
                            outlined
                            disabled={isBusy.value}
                            onClick={() => workspace.selectDirectory()}
                          >
                            {{ icon: () => <FolderOpen /> }}
                          </Button>
                        </div>
                      </div>

                      <div class="mt-3 -mx-1.5 -mb-1.5 flex w-max max-w-full items-center">
                        <StatusIcon
                          icon={FileAudio}
                          active
                          count={currentSummary.audioCount}
                          tooltip={t('tagging.audioSummary', {
                            count: currentSummary.audioCount,
                            mp3: currentSummary.mp3Count,
                            flac: currentSummary.flacCount,
                          })}
                        />
                        <StatusIcon
                          icon={ImageIcon}
                          active={currentSummary.localCover.exists}
                          tooltip={
                            currentSummary.localCover.issue?.message ||
                            (currentSummary.localCover.exists
                              ? t('tagging.localCoverFound', {
                                  name: currentSummary.localCover.fileName || t('tagging.found'),
                                })
                              : t('tagging.noLocalCover'))
                          }
                        />
                        <StatusIcon
                          icon={FileJson}
                          active={currentSummary.hasMetadataJson}
                          tooltip={
                            currentSummary.hasMetadataJson
                              ? t('tagging.hasMetadata')
                              : t('tagging.noMetadata')
                          }
                        />
                        <StatusIcon
                          icon={FileCog}
                          active={currentSummary.hasAlbumConfig}
                          tooltip={
                            currentSummary.hasAlbumConfig
                              ? t('tagging.hasAlbumConfig')
                              : t('tagging.noAlbumConfig')
                          }
                        />
                      </div>

                      {currentSummary.issues
                        .filter(item => item.code !== currentSummary.localCover.issue?.code)
                        .map(issue => (
                          <Message
                            key={issue.code}
                            severity={issue.severity === 'error' ? 'error' : 'warn'}
                          >
                            {issue.message}
                          </Message>
                        ))}

                      {currentPhase === 'failed' && (
                        <Message severity="warn">{t('tagging.planInvalidated')}</Message>
                      )}
                    </>
                  )
                )}
              </div>

              <TaggingSearchStep />
              <TaggingPlanStep />

              {currentOperation && (
                <OperationPanel operation={currentOperation} onCancel={() => workspace.cancel()} />
              )}
              {currentResult && (
                <CompletionPanel
                  class="flex-1 justify-center pb-app-section-y"
                  title={currentResult.message}
                  onReveal={() => workspace.reveal()}
                  onComplete={() => workspace.startOver()}
                />
              )}
            </div>
          )}
        </div>
      )
    }
  },
})
