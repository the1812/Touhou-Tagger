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
import { defineComponent } from 'vue'

import { usePageCommands } from '../../app/pageCommands'
import { t } from '../../i18n'
import { CompletionDialog } from '../../shared/CompletionDialog'
import { DirectoryPickerEmptyState } from '../../shared/DirectoryPickerEmptyState'
import { Message } from '../../shared/Message'
import { StatusIcon } from '../../shared/StatusIcon'
import { TruncatedText } from '../../shared/TruncatedText'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaggingPlanSkeleton } from './TaggingPlanSkeleton'
import { TaggingPlanStep } from './TaggingPlanStep'
import { TaggingSearchStep } from './TaggingSearchStep'
import { TaggingSummarySkeleton } from './TaggingSummarySkeleton'

export const TaggingPage = defineComponent({
  name: 'TaggingPage',
  setup() {
    const workspace = useWorkspaceStore()
    const { phase, summary, result, failure, resultOpen, isBusy } = storeToRefs(workspace)

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
              <div class="workspace-section">
                {isScanning ? (
                  <TaggingSummarySkeleton />
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
                              onClick={() => void workspace.reveal()}
                            >
                              {{ icon: () => <ExternalLink /> }}
                            </Button>
                            <Button
                              v-tooltip={t('tagging.rescan')}
                              severity="secondary"
                              text
                              rounded
                              disabled={isBusy.value}
                              onClick={() => void workspace.scan(currentSummary.directory)}
                            >
                              {{ icon: () => <RefreshCw /> }}
                            </Button>
                          </div>
                          <Button
                            label={t('common.changeDirectory')}
                            loading={currentPhase === 'selecting'}
                            severity="secondary"
                            outlined
                            disabled={isBusy.value}
                            onClick={() => void workspace.selectDirectory()}
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
