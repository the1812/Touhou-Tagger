import { Ban, ExternalLink, FolderOpen, Play, RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import ProgressSpinner from 'primevue/progressspinner'
import { computed, defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { usePageCommands } from '../../app/pageCommands'
import { t } from '../../i18n'
import { CompletionDialog } from '../../shared/CompletionDialog'
import { DirectoryPickerEmptyState } from '../../shared/DirectoryPickerEmptyState'
import { PageActionBar } from '../../shared/PageActionBar'
import { TruncatedText } from '../../shared/TruncatedText'
import { useDelayedBusy } from '../../shared/useDelayedBusy'
import { WorkspaceTitle } from '../../shared/WorkspaceTitle'
import { useBatchStore } from '../../stores/batch'
import { BatchJobTable } from './BatchJobTable'

export const BatchPage = defineComponent({
  name: 'BatchPage',
  setup() {
    const batch = useBatchStore()
    const {
      directory,
      depth,
      preview,
      selecting,
      scanning,
      operation,
      isWriting,
      result,
      failure,
      resultOpen,
      readyCount,
      skippedCount,
      retryableCount,
      resolvingCount,
      canRun,
    } = storeToRefs(batch)

    const showSpinner = useDelayedBusy(() => isWriting.value)
    const directoryLabel = computed(() => {
      const parts = directory.value.split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || t('batch.directoryFallback')
    })
    const controlsDisabled = computed(
      () => selecting.value || scanning.value || resolvingCount.value > 0 || isWriting.value,
    )
    const tableDisabled = computed(() => selecting.value || scanning.value || isWriting.value)
    usePageCommands({
      openDirectory: () => batch.selectDirectory(),
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
      const currentResult = result.value

      return (
        <div class="workspace-sections round-icon-buttons grid min-h-full content-start gap-0">
          {!currentDirectory ? (
            <DirectoryPickerEmptyState
              loading={selecting.value}
              onSelect={() => batch.selectDirectory()}
            />
          ) : (
            <>
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
                      disabled={controlsDisabled.value}
                      onClick={() => void batch.selectDirectory()}
                    >
                      {{ icon: () => <FolderOpen /> }}
                    </Button>
                  </div>
                </div>
              </div>

              <>
                <div class="workspace-section grid min-h-[390px] content-start gap-3">
                  <div class="workspace-heading items-center">
                    <WorkspaceTitle>{t('batch.scanHeading')}</WorkspaceTitle>
                    <div class="flex items-center gap-3">
                      <div class="flex items-center gap-2">
                        <div class="whitespace-nowrap text-sm font-semibold">
                          {t('batch.depth')}
                        </div>
                        <InputNumber
                          useGrouping={false}
                          class="w-28"
                          modelValue={depth.value}
                          {...{
                            'onUpdate:modelValue': (value: number | null) => batch.setDepth(value),
                          }}
                          min={1}
                          max={8}
                          showButtons
                          fluid
                          disabled={controlsDisabled.value}
                        />
                      </div>
                      <Button
                        class="shrink-0 whitespace-nowrap"
                        label={t('batch.rescan')}
                        severity="secondary"
                        outlined
                        disabled={controlsDisabled.value}
                        onClick={() => void batch.scan()}
                      >
                        {{
                          icon: () => <RefreshCw class={{ 'animate-spin': scanning.value }} />,
                        }}
                      </Button>
                    </div>
                  </div>

                  {scanning.value && !currentPreview ? (
                    <div class="grid min-h-64 place-items-center content-center gap-4 text-center">
                      <div
                        class={[
                          'size-[46px] animate-spin rounded-full border-[3px]',
                          'border-primary-200 border-t-primary dark:border-primary-800 dark:border-t-primary',
                        ]}
                      />
                      <div class="text-base font-medium">{t('batch.scanning')}</div>
                    </div>
                  ) : (
                    <BatchJobTable
                      jobs={currentPreview?.jobs ?? []}
                      editable
                      disabled={tableDisabled.value}
                      resolving={batch.isResolving}
                      onResolve={(jobId, candidateId) => batch.resolveCandidate(jobId, candidateId)}
                      onRetry={jobId => batch.loadJob(jobId)}
                    />
                  )}
                </div>

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
                visible={resultOpen.value}
                title={failure.value?.message ?? currentResult?.message ?? ''}
                warning={Boolean(
                  failure.value || currentResult?.failed || currentResult?.cancelled,
                )}
                details={
                  failure.value?.details ??
                  currentResult?.jobs
                    .filter(job => job.status === 'failed')
                    .map(
                      job =>
                        `${job.relativePath}: ${job.issues.map(issue => issue.message).join('；')}`,
                    )
                    .join('\n')
                }
                retryable={retryableCount.value > 0}
                onReveal={() => batch.reveal()}
                onRetry={() => batch.run(true)}
                onClose={() => {
                  batch.resultOpen = false
                }}
              />
            </>
          )}
        </div>
      )
    }
  },
})
