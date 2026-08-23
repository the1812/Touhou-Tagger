import { ExternalLink, FolderOpen, Play, RefreshCw } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { computed, defineComponent } from 'vue'
import { Translation } from 'vue-i18n'

import { usePageCommands } from '../../app/pageCommands'
import { t } from '../../i18n'
import { CompletionPanel } from '../../shared/CompletionPanel'
import { OperationPanel } from '../../shared/OperationPanel'
import { PageActionBar } from '../../shared/PageActionBar'
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
            <section class="page-empty-state">
              <Button
                class="directory-picker-button"
                label={t('common.selectDirectory')}
                size="large"
                loading={selecting.value}
                onClick={() => batch.selectDirectory()}
              >
                {{ icon: () => <FolderOpen size={19} /> }}
              </Button>
              <span class="text-[.78rem] text-surface-500 dark:text-surface-400">
                <kbd class="app-kbd">Ctrl</kbd> + <kbd class="app-kbd">O</kbd>
              </span>
            </section>
          ) : (
            <>
              <section class="workspace-section">
                <div class="workspace-heading">
                  <div class="min-w-0">
                    <h2 class="mt-1 text-[1.18rem] font-bold">{directoryLabel.value}</h2>
                    <p
                      class="mt-1.5 max-w-[min(760px,65vw)] overflow-hidden text-ellipsis whitespace-nowrap text-[.82rem] text-muted-color"
                      title={currentDirectory}
                    >
                      {currentDirectory}
                    </p>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Button
                      title={t('common.revealDirectory')}
                      severity="secondary"
                      text
                      rounded
                      onClick={() => batch.reveal()}
                    >
                      {{ icon: () => <ExternalLink size={17} /> }}
                    </Button>
                    <Button
                      label={t('common.changeDirectory')}
                      severity="secondary"
                      outlined
                      loading={selecting.value}
                      disabled={controlsDisabled.value}
                      onClick={() => batch.selectDirectory()}
                    >
                      {{ icon: () => <FolderOpen size={17} /> }}
                    </Button>
                  </div>
                </div>
              </section>

              {!currentOperation && !currentResult && (
                <>
                  <section class="workspace-section grid min-h-[390px] content-start gap-3 border-b-0 py-4">
                    <div class="workspace-heading items-center">
                      <h2 class="mt-1 text-[1.18rem] font-bold">{t('batch.scanHeading')}</h2>
                      <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-[.78rem] font-semibold">
                          <span class="whitespace-nowrap">{t('batch.depth')}</span>
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
                            size="small"
                            fluid
                            disabled={controlsDisabled.value}
                          />
                        </label>
                        <Button
                          class="w-[6.75rem]"
                          label={t('batch.rescan')}
                          severity="secondary"
                          outlined
                          disabled={controlsDisabled.value}
                          onClick={() => batch.scan()}
                        >
                          {{
                            icon: () => (
                              <RefreshCw class={{ 'animate-spin': scanning.value }} size={17} />
                            ),
                          }}
                        </Button>
                      </div>
                    </div>

                    {scanning.value && !currentPreview ? (
                      <div class="grid min-h-64 place-items-center content-center gap-4 text-center">
                        <div class="size-[46px] animate-spin rounded-full border-[3px] border-primary-200 border-t-primary dark:border-primary-800 dark:border-t-primary" />
                        <h3 class="m-0 text-[.95rem] font-bold">{t('batch.scanning')}</h3>
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
                  </section>

                  {currentPreview && !scanning.value && (
                    <PageActionBar>
                      <span class="shrink-0 text-[.85rem] text-muted-color">
                        <Translation
                          keypath="batch.albumCount"
                          scope="global"
                          v-slots={{
                            count: () => (
                              <strong class="text-color">{currentPreview.jobs.length}</strong>
                            ),
                          }}
                        />
                      </span>
                      <div class="flex min-w-0 items-center">
                        <Button
                          label={t('batch.start')}
                          disabled={!canRun.value}
                          onClick={() => batch.run(false)}
                        >
                          {{ icon: () => <Play size={17} /> }}
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
                    <section class="workspace-section grid min-h-64 content-start gap-3 border-b-0 py-4">
                      <div class="workspace-heading">
                        <h2 class="mt-1 text-[1.18rem] font-bold">{t('batch.failedItems')}</h2>
                      </div>
                      <BatchJobTable
                        jobs={failedJobs.value}
                        disabled
                        resolving={batch.isResolving}
                      />
                    </section>
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
