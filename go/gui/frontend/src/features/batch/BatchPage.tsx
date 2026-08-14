import { CircleAlert, ExternalLink, FolderOpen, Play, RefreshCw, TriangleAlert } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import { computed, defineComponent } from 'vue'

import { CompletionPanel } from '../../shared/CompletionPanel'
import { useBatchStore } from '../../stores/batch'
import { OperationPanel } from '../tagging/OperationPanel'
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
      unresolvedCount,
      failedCount,
      resolvingCount,
      canRun,
    } = storeToRefs(batch)

    const directoryLabel = computed(() => {
      const parts = directory.value.split(/[\\/]/).filter(Boolean)
      return parts[parts.length - 1] || '批量写入目录'
    })
    const failedJobs = computed(
      () => preview.value?.jobs.filter(job => job.status === 'failed') ?? [],
    )
    const controlsDisabled = computed(
      () =>
        selecting.value ||
        scanning.value ||
        resolvingCount.value > 0 ||
        Boolean(operation.value),
    )
    const unresolvedHasError = computed(
      () =>
        preview.value?.jobs.some(
          job =>
            ['track-mismatch', 'scan-failed', 'failed'].includes(job.status) ||
            job.issues.some(issue => issue.severity === 'error'),
        ) ?? false,
    )

    return () => {
      const currentDirectory = directory.value
      const currentPreview = preview.value
      const currentOperation = operation.value
      const currentResult = result.value

      return (
        <div
          class={[
            'round-icon-buttons grid min-h-full content-start gap-0 pb-[4.5rem]',
            { '-mt-5': currentDirectory },
          ]}
        >
          {!currentDirectory ? (
            <section class="page-empty-state">
              <Button
                class="directory-picker-button"
                label="选择目录"
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
                      title="在资源管理器中打开"
                      severity="secondary"
                      text
                      rounded
                      onClick={() => batch.reveal()}
                    >
                      {{ icon: () => <ExternalLink size={17} /> }}
                    </Button>
                    <Button
                      label="更换目录"
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
                      <h2 class="mt-1 text-[1.18rem] font-bold">专辑扫描</h2>
                      <div class="flex items-center gap-3">
                        <label class="flex items-center gap-2 text-[.78rem] font-semibold">
                          <span class="whitespace-nowrap">目录层级</span>
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
                          label="重新扫描"
                          severity="secondary"
                          outlined
                          disabled={controlsDisabled.value}
                          onClick={() => batch.scan()}
                        >
                          {{
                            icon: () => (
                              <RefreshCw
                                class={{ 'animate-spin': scanning.value }}
                                size={17}
                              />
                            ),
                          }}
                        </Button>
                      </div>
                    </div>

                    {scanning.value ? (
                      <div class="grid min-h-64 place-items-center content-center gap-4 text-center">
                        <div class="size-[46px] animate-spin rounded-full border-[3px] border-primary-200 border-t-primary dark:border-primary-800 dark:border-t-primary" />
                        <h3 class="m-0 text-[.95rem] font-bold">正在扫描专辑目录</h3>
                      </div>
                    ) : (
                      <BatchJobTable
                        jobs={currentPreview?.jobs ?? []}
                        editable
                        disabled={controlsDisabled.value}
                        resolving={batch.isResolving}
                        onResolve={(jobId, candidateId) =>
                          batch.resolveCandidate(jobId, candidateId)
                        }
                        onIgnore={jobId => batch.ignoreJob(jobId)}
                      />
                    )}
                  </section>

                  {currentPreview && !scanning.value && (
                    <div class="action-bar fixed right-0 bottom-0 left-[216px] justify-between backdrop-blur-md">
                      <span class="shrink-0 text-[.85rem] text-muted-color">
                        共 <strong class="text-color">{currentPreview.jobs.length}</strong> 个专辑
                      </span>
                      <div class="flex min-w-0 items-center gap-5">
                        {unresolvedCount.value > 0 && (
                          <span
                            class={[
                              'flex min-w-0 items-center gap-1.5 text-[.75rem] text-amber-700 dark:text-amber-300',
                              {
                                'text-red-700 dark:text-red-300': unresolvedHasError.value,
                              },
                            ]}
                          >
                            {unresolvedHasError.value ? (
                              <CircleAlert class="shrink-0" size={15} />
                            ) : (
                              <TriangleAlert class="shrink-0" size={15} />
                            )}
                            <span class="overflow-hidden text-ellipsis whitespace-nowrap">
                              有 {unresolvedCount.value}{' '}
                              个专辑尚未解决，请选择搜索结果或忽略无法匹配的专辑。
                            </span>
                          </span>
                        )}
                        <Button
                          label="开始处理"
                          disabled={!canRun.value}
                          onClick={() => batch.run(false)}
                        >
                          {{ icon: () => <Play size={17} /> }}
                        </Button>
                      </div>
                    </div>
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
                        <h2 class="mt-1 text-[1.18rem] font-bold">失败项目</h2>
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
