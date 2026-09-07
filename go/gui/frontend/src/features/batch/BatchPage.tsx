import { ExternalLink, FolderOpen, Play, RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { computed, defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { usePageCommands } from '../../app/pageCommands'
import { t } from '../../i18n'
import { CompletionPanel } from '../../shared/CompletionPanel'
import { DirectoryPickerEmptyState } from '../../shared/DirectoryPickerEmptyState'
import { OperationPanel } from '../../shared/OperationPanel'
import { PageActionBar } from '../../shared/PageActionBar'
import { TruncatedText } from '../../shared/TruncatedText'
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
      result,
      failedCount,
      resolvingCount,
      canRun,
    } = storeToRefs(batch)

    const directoryLabel = computed(() => {
      const parts = directory.value.split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || t('batch.directoryFallback')
    })
    const failedJobs = computed(
      () => preview.value?.jobs.filter(job => job.status === 'failed') ?? [],
    )
    const controlsDisabled = computed(
      () =>
        selecting.value || scanning.value || resolvingCount.value > 0 || Boolean(operation.value),
    )
    const tableDisabled = computed(
      () => selecting.value || scanning.value || Boolean(operation.value),
    )
    usePageCommands({
      openDirectory: () => batch.selectDirectory(),
      refresh: () => {
        if (!directory.value) {
          return false
        }
        batch.scan()
        return true
      },
    })

    return () => {
      const currentDirectory = directory.value
      const currentPreview = preview.value
      const currentOperation = operation.value
      const currentResult = result.value

      return (
        <div
          class={[
            'round-icon-buttons grid min-h-full content-start gap-0',
            { '-mt-5': currentDirectory },
          ]}
        >
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
                        onClick={() => batch.reveal()}
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
                      onClick={() => batch.selectDirectory()}
                    >
                      {{ icon: () => <FolderOpen /> }}
                    </Button>
                  </div>
                </div>
              </div>

              {!currentOperation && !currentResult && (
                <>
                  <div class="workspace-section grid min-h-[390px] content-start gap-3 border-b-0">
                    <div class="workspace-heading items-center">
                      <WorkspaceTitle>{t('batch.scanHeading')}</WorkspaceTitle>
                      <div class="flex items-center gap-3">
                        <div class="flex items-center gap-2">
                          <div class="whitespace-nowrap text-sm font-semibold">
                            {t('batch.depth')}
                          </div>
                          <InputNumber
                            class="w-28"
                            modelValue={depth.value}
                            {...{
                              'onUpdate:modelValue': (value: number | null) =>
                                batch.setDepth(value),
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
                          onClick={() => batch.scan()}
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
                        <div class="text-base font-bold">{t('batch.scanning')}</div>
                      </div>
                    ) : (
                      <BatchJobTable
                        jobs={currentPreview?.jobs ?? []}
                        editable
                        disabled={tableDisabled.value}
                        resolving={batch.isResolving}
                        onResolve={(jobId, candidateId) =>
                          batch.resolveCandidate(jobId, candidateId)
                        }
                        onIgnore={jobId => batch.ignoreJob(jobId)}
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
                              <div class="inline font-bold text-color">
                                {currentPreview.jobs.length}
                              </div>
                            ),
                          }}
                        />
                      </div>
                      <div class="flex min-w-0 items-center">
                        <Button
                          label={t('batch.start')}
                          disabled={!canRun.value}
                          onClick={() => batch.run(false)}
                        >
                          {{ icon: () => <Play /> }}
                        </Button>
                      </div>
                    </PageActionBar>
                  )}
                </>
              )}

              {currentOperation && (
                <OperationPanel operation={currentOperation} onCancel={() => batch.cancel()} />
              )}

              {currentResult && (
                <>
                  <CompletionPanel
                    warning={currentResult.failed > 0 || currentResult.cancelled}
                    retryable={failedCount.value > 0}
                    onReveal={() => batch.reveal()}
                    onRetry={() => batch.run(true)}
                    onComplete={() => batch.startOver()}
                  />

                  {failedJobs.value.length > 0 && (
                    <div class="workspace-section grid min-h-64 content-start gap-3 border-b-0">
                      <div class="workspace-heading">
                        <WorkspaceTitle>{t('batch.failedItems')}</WorkspaceTitle>
                      </div>
                      <BatchJobTable
                        jobs={failedJobs.value}
                        disabled
                        resolving={batch.isResolving}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )
    }
  },
})
