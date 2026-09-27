import { Ban, Play } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import ProgressSpinner from 'primevue/progressspinner'
import { defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { useBatchStore } from '../../../features/batch'
import { failureTitle, issueText, resultTitle } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { usePageCommands, useDelayedBusy } from '../../../shared/lib'
import { CompletionDialog, DirectoryPickerEmptyState, PageActionBar } from '../../../shared/ui'
import { BatchDirectoryHeader } from './BatchDirectoryHeader'
import { BatchScanSection } from './BatchScanSection'

export const BatchPage = defineComponent({
  name: 'BatchPage',
  setup() {
    const batch = useBatchStore()
    const {
      directory,
      preview,
      selecting,
      scanning,
      operation,
      isWriting,
      completion,
      readyCount,
      skippedCount,
      retryableCount,
      canRun,
    } = storeToRefs(batch)

    const showSpinner = useDelayedBusy(() => isWriting.value)
    usePageCommands({
      openDirectory: target => batch.selectDirectory(target),
      refresh: () => {
        if (!directory.value) {
          return false
        }
        void batch.scan()
        return true
      },
    })

    return () => {
      const currentDirectory = directory.value
      const currentPreview = preview.value
      const currentOperation = operation.value
      const currentCompletion = completion.value
      const result = currentCompletion?.kind === 'result' ? currentCompletion.result : undefined
      const failure = currentCompletion?.kind === 'failure' ? currentCompletion.failure : undefined
      let title = ''
      if (currentCompletion) {
        title =
          currentCompletion.kind === 'failure'
            ? failureTitle(currentCompletion.failure)
            : resultTitle(currentCompletion.result)
      }

      return (
        <div class="workspace-sections round-icon-buttons grid min-h-full content-start gap-0">
          {!currentDirectory ? (
            <DirectoryPickerEmptyState
              loading={selecting.value}
              disabled={!batch.canChangeDirectory}
              onSelect={() => batch.selectDirectory()}
            />
          ) : (
            <>
              <BatchDirectoryHeader />

              <>
                <BatchScanSection />

                {currentPreview && !scanning.value && (
                  <PageActionBar>
                    <div class="shrink-0 text-sm text-muted-color">
                      <Translation
                        keypath="batch.albumCount"
                        scope="global"
                        v-slots={{
                          count: () => (
                            <div class="inline text-color">{currentPreview.jobs.length}</div>
                          ),
                        }}
                      />
                      {skippedCount.value > 0 && (
                        <div class="inline">
                          {t('batch.writeSelection', {
                            ready: readyCount.value,
                            skipped: skippedCount.value,
                          })}
                        </div>
                      )}
                    </div>
                    <div class="flex min-w-0 items-center gap-3">
                      {isWriting.value ? (
                        <>
                          <div class="flex items-center gap-2 text-sm text-muted-color">
                            <ProgressSpinner
                              class={['size-4! m-0!', { invisible: !showSpinner.value }]}
                              strokeWidth="4"
                            />
                            <div>
                              {t('operation.writing')}
                              {currentOperation && (
                                <div class="inline tabular-nums">
                                  {' '}
                                  · {currentOperation.current} / {currentOperation.total}
                                </div>
                              )}
                            </div>
                          </div>
                          <Button
                            label={t('operation.cancel')}
                            class="min-w-28"
                            severity="secondary"
                            text
                            disabled={!currentOperation?.cancellable}
                            onClick={() => void batch.cancel()}
                          >
                            {{ icon: () => <Ban /> }}
                          </Button>
                        </>
                      ) : (
                        <Button
                          label={t('common.start')}
                          class="min-w-28"
                          disabled={!canRun.value}
                          onClick={() => void batch.run(false)}
                        >
                          {{ icon: () => <Play /> }}
                        </Button>
                      )}
                    </div>
                  </PageActionBar>
                )}
              </>

              <CompletionDialog
                visible={Boolean(currentCompletion)}
                title={title}
                warning={Boolean(failure || result?.failed || result?.cancelled)}
                details={
                  failure?.details ??
                  result?.jobs
                    .filter(job => job.outcome === 'failed')
                    .map(job => `${job.relativePath}: ${job.issues.map(issueText).join('；')}`)
                    .join('\n')
                }
                retryable={retryableCount.value > 0}
                onReveal={() => batch.reveal()}
                onRetry={() => batch.run(true)}
                onClose={batch.closeCompletion}
              />
            </>
          )}
        </div>
      )
    }
  },
})
