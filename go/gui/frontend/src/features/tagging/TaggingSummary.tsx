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

import { issueText } from '../../api/display'
import { t } from '../../i18n'
import { Message } from '../../shared/Message'
import { StatusIcon } from '../../shared/StatusIcon'
import { TruncatedText } from '../../shared/TruncatedText'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useWorkspaceStore } from '../../stores/workspace'
import { TaggingSummarySkeleton } from './TaggingSummarySkeleton'

export const TaggingSummary = defineComponent({
  name: 'TaggingSummary',
  setup() {
    const workspace = useWorkspaceStore()
    const { summary, activity, stalePlan, isBusy } = storeToRefs(workspace)

    return () => {
      const currentSummary = summary.value
      const isOpening = activity.value === 'opening'
      return (
        <div class="workspace-section">
          {isOpening ? (
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
                      loading={activity.value === 'selecting'}
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
                      (currentSummary.localCover.issue &&
                        issueText(currentSummary.localCover.issue)) ||
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
                      {issueText(issue)}
                    </Message>
                  ))}

                {stalePlan.value && (
                  <Message severity="warn">{t('tagging.planInvalidated')}</Message>
                )}
              </>
            )
          )}
        </div>
      )
    }
  },
})
