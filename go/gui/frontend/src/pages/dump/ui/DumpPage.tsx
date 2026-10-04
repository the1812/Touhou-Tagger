import { Download, FileAudio, FolderOpen, Image as ImageIcon } from 'lucide-vue-next'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

import { useDumpStore } from '../../../features/dump'
import { t } from '../../../shared/i18n'
import { usePageCommands } from '../../../shared/lib'
import {
  DirectoryPickerEmptyState,
  Message,
  PageActionBar,
  StatusIcon,
  TruncatedText,
  WorkspaceTitle,
} from '../../../shared/ui'
import { DumpPreview } from './DumpPreview'

export const DumpPage = defineComponent({
  name: 'DumpPage',
  setup() {
    const dump = useDumpStore()
    usePageCommands({
      openDirectory: dump.selectDirectory,
      refresh: () => {
        if (!dump.summary) {
          return false
        }
        void dump.scan(dump.summary.directory)
        return true
      },
    })
    return () => {
      const { summary } = dump
      return (
        <div class="workspace-sections round-icon-buttons flex h-full min-h-0 flex-col">
          {!summary ? (
            <DirectoryPickerEmptyState
              loading={Boolean(dump.activity)}
              disabled={!dump.canChangeDirectory}
              onSelect={() => void dump.selectDirectory()}
            />
          ) : (
            <>
              <div class="workspace-section">
                <div class="workspace-heading">
                  <div class="flex min-w-0 flex-col gap-1.5">
                    <WorkspaceTitle>{summary.name}</WorkspaceTitle>
                    <TruncatedText
                      tooltip={summary.directory}
                      class="max-w-[min(760px,65vw)] text-base text-muted-color"
                    >
                      {summary.directory}
                    </TruncatedText>
                  </div>
                  <Button
                    label={t('common.changeDirectory')}
                    severity="secondary"
                    outlined
                    loading={Boolean(dump.activity)}
                    disabled={!dump.canChangeDirectory}
                    onClick={() => void dump.selectDirectory()}
                  >
                    {{ icon: () => <FolderOpen /> }}
                  </Button>
                </div>
                <div class="mt-3 -mx-1.5 -mb-1.5 flex w-max max-w-full items-center">
                  <StatusIcon
                    icon={FileAudio}
                    active
                    count={summary.audioCount}
                    tooltip={t('tagging.audioSummary', {
                      count: summary.audioCount,
                      mp3: summary.mp3Count,
                      flac: summary.flacCount,
                    })}
                  />
                  <StatusIcon icon={ImageIcon} active tooltip={t('dump.coverHint')} />
                </div>
                {summary.audioCount === 0 && <Message severity="warn">{t('dump.noAudio')}</Message>}
              </div>
              <div class="mt-app-page-y flex min-h-0 flex-1 overflow-hidden rounded-(--p-button-border-radius)">
                <DumpPreview value={summary.json} />
              </div>
              <PageActionBar>
                {{
                  secondaryAction: () => (
                    <Button
                      label={t('dump.saveAs')}
                      loading={dump.saveAction === 'saveAs'}
                      severity="secondary"
                      text
                      disabled={!dump.canExtract}
                      onClick={() => void dump.extract(summary.directory, true)}
                    />
                  ),
                  action: () => (
                    <Button
                      label={t('dump.extract')}
                      loading={dump.saveAction === 'extract'}
                      disabled={!dump.canExtract}
                      onClick={() => void dump.extract(summary.directory, false)}
                    >
                      {{ icon: () => <Download /> }}
                    </Button>
                  ),
                }}
              </PageActionBar>
            </>
          )}
        </div>
      )
    }
  },
})
