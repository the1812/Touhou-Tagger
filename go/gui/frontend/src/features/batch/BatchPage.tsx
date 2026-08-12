import {
  CheckCircle2,
  CircleAlert,
  FolderOpen,
  Play,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  TriangleAlert,
} from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { computed, defineComponent } from 'vue'

import type { BatchJobPreview, BatchJobStatus } from '../../api'
import { useBatchStore } from '../../stores/batch'
import { useSettingsStore } from '../../stores/settings'
import { OperationPanel } from '../tagging/OperationPanel'

const emptyStateClass =
  'grid min-h-[300px] place-items-center content-center gap-3 border-b border-surface-200 py-8 text-center dark:border-surface-700'

const statusInfo = (status: BatchJobStatus) => {
  const map: Record<
    BatchJobStatus,
    { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }
  > = {
    ready: { label: '已就绪', severity: 'success' },
    'needs-candidate': { label: '需要候选', severity: 'warn' },
    'local-metadata': { label: '本地元数据', severity: 'info' },
    'track-mismatch': { label: '曲目数不匹配', severity: 'danger' },
    'scan-failed': { label: '扫描失败', severity: 'danger' },
    ignored: { label: '已忽略', severity: 'secondary' },
    queued: { label: '等待中', severity: 'secondary' },
    running: { label: '处理中', severity: 'info' },
    succeeded: { label: '完成', severity: 'success' },
    failed: { label: '失败', severity: 'danger' },
    cancelled: { label: '已取消', severity: 'secondary' },
  }
  return map[status]
}

const candidateOptions = (job: BatchJobPreview) =>
  job.candidates.map(candidate => ({
    value: candidate.id,
    label: `${candidate.title} · ${candidate.artists.join(' / ')}`,
  }))

export const BatchPage = defineComponent({
  name: 'BatchPage',
  setup() {
    const batch = useBatchStore()
    const settings = useSettingsStore()
    const {
      directory,
      depth,
      source,
      preview,
      selecting,
      scanning,
      operation,
      result,
      unresolvedCount,
      readyCount,
      failedCount,
      resolvingCount,
      canRun,
    } = storeToRefs(batch)

    if (!settings.capabilities) {
      settings.load()
    }

    const sourceOptions = computed(
      () =>
        settings.capabilities?.sources.filter(option => option.supportsSearch) ?? [
          { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
        ],
    )
    const bodySlot =
      (render: (job: BatchJobPreview) => unknown) =>
      ({ data }: { data: BatchJobPreview }) =>
        render(data)
    const controlsDisabled = () =>
      selecting.value || scanning.value || resolvingCount.value > 0 || Boolean(operation.value)

    return () => (
      <div class="grid content-start gap-0 pb-[4.5rem]">
        <section class="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-surface-200 py-5 dark:border-surface-700">
          <div class="min-w-0">
            {directory.value ? (
              <div class="flex min-w-0 items-center gap-2" title={directory.value}>
                <FolderOpen class="shrink-0 text-primary" size={18} />
                <strong class="overflow-hidden text-ellipsis whitespace-nowrap">
                  {directory.value}
                </strong>
              </div>
            ) : null}
          </div>
          <Button
            label={directory.value ? '更换根目录' : '选择批处理根目录'}
            severity="secondary"
            outlined
            loading={selecting.value}
            disabled={controlsDisabled()}
            onClick={() => batch.selectDirectory()}
          >
            {{ icon: () => <FolderOpen size={17} /> }}
          </Button>

          <div class="col-span-full grid grid-cols-[11rem_minmax(12rem,1fr)_auto] items-end gap-3 border-t border-surface-200 pt-4 dark:border-surface-700">
            <label class="grid gap-1.5 text-xs text-muted-color">
              <span>扫描深度</span>
              <InputNumber
                modelValue={depth.value}
                {...{ 'onUpdate:modelValue': (value: number | null) => batch.setDepth(value) }}
                min={1}
                max={8}
                showButtons
                buttonLayout="horizontal"
                disabled={controlsDisabled()}
                inputClass="w-full"
              />
            </label>
            <label class="grid gap-1.5 text-xs text-muted-color">
              <span>默认数据源</span>
              <Select
                modelValue={source.value}
                {...{
                  'onUpdate:modelValue': (value: unknown) => batch.changeSource(String(value)),
                }}
                options={sourceOptions.value}
                optionLabel="label"
                optionValue="value"
                disabled={controlsDisabled()}
              />
            </label>
            <Button
              label="扫描专辑"
              loading={scanning.value}
              disabled={
                selecting.value ||
                !directory.value ||
                resolvingCount.value > 0 ||
                Boolean(operation.value)
              }
              onClick={() => batch.scan()}
            >
              {{ icon: () => <ScanSearch size={17} /> }}
            </Button>
          </div>
        </section>

        {!preview.value && !scanning.value && (
          <section class={emptyStateClass}>
            <div class="grid size-[72px] place-items-center rounded-full bg-primary-50 text-primary dark:bg-primary-950">
              <ScanSearch size={38} />
            </div>
            <h2 class="m-0 font-bold">先预检，再开始批处理</h2>
          </section>
        )}

        {scanning.value && (
          <section class={emptyStateClass}>
            <div class="size-[46px] animate-spin rounded-full border-[3px] border-primary-200 border-t-primary dark:border-primary-800 dark:border-t-primary" />
            <h2 class="m-0 font-bold">正在扫描专辑目录</h2>
          </section>
        )}

        {preview.value && (
          <>
            <section class="metric-strip">
              <div>
                <span>发现专辑</span>
                <strong>{preview.value.jobs.length}</strong>
              </div>
              <div>
                <span>已就绪</span>
                <strong class="text-emerald-700 dark:text-emerald-300">{readyCount.value}</strong>
              </div>
              <div>
                <span>需要处理</span>
                <strong
                  class={{
                    'text-amber-700 dark:text-amber-300': unresolvedCount.value > 0,
                  }}
                >
                  {unresolvedCount.value}
                </strong>
              </div>
              <div>
                <span>执行失败</span>
                <strong class={{ 'text-red-700 dark:text-red-300': failedCount.value > 0 }}>
                  {failedCount.value}
                </strong>
              </div>
            </section>

            {unresolvedCount.value > 0 && (
              <Message severity="warn" closable={false}>
                有 {unresolvedCount.value} 个任务尚未解决。请在开始写入前选择候选或修复目录问题。
              </Message>
            )}

            <section class="grid min-h-[390px] gap-4 border-b border-surface-200 py-5 dark:border-surface-700">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="mt-1 text-lg font-bold">逐项确认匹配状态</h2>
                </div>
                <Tag value={`深度 ${preview.value.depth}`} severity="secondary" />
              </div>

              <DataTable
                value={preview.value.jobs}
                dataKey="id"
                scrollable
                scrollHeight="flex"
                size="small"
                class="[&_.p-datatable-tbody>tr]:min-h-11"
                virtualScrollerOptions={
                  preview.value.jobs.length > 100 ? { itemSize: 44 } : undefined
                }
              >
                <Column
                  field="relativePath"
                  header="专辑目录"
                  frozen
                  headerClass="min-w-[13rem]"
                  bodyClass="min-w-[13rem]"
                  v-slots={{
                    body: bodySlot(job => (
                      <div class="flex items-center gap-1.5">
                        <FolderOpen class="shrink-0 text-primary" size={15} />
                        <span class="overflow-hidden text-ellipsis">{job.relativePath}</span>
                      </div>
                    )),
                  }}
                />
                <Column
                  field="inferredAlbumName"
                  header="推断名称"
                  headerClass="min-w-[15rem]"
                  bodyClass="min-w-[15rem]"
                />
                <Column field="source" header="数据源" headerClass="w-32" bodyClass="w-32" />
                <Column
                  header="匹配结果"
                  headerClass="min-w-[16rem]"
                  bodyClass="min-w-[16rem]"
                  v-slots={{
                    body: bodySlot(job =>
                      job.status === 'needs-candidate' && job.candidates.length === 0 ? (
                        <div class="grid gap-1 text-[.78rem] text-muted-color">
                          <span>未找到可用候选，可只跳过此项。</span>
                          <Button
                            label="忽略此任务"
                            size="small"
                            severity="secondary"
                            text
                            class="-ml-2 w-max"
                            loading={batch.isResolving(job.id)}
                            disabled={controlsDisabled()}
                            onClick={() => batch.ignoreJob(job.id)}
                          />
                        </div>
                      ) : job.candidates.length > 1 || job.status === 'needs-candidate' ? (
                        <Select
                          modelValue={job.selectedCandidateId}
                          {...{
                            'onUpdate:modelValue': (value: unknown) =>
                              batch.resolveCandidate(job.id, String(value)),
                          }}
                          options={candidateOptions(job)}
                          optionLabel="label"
                          optionValue="value"
                          placeholder="选择候选专辑"
                          fluid
                          loading={batch.isResolving(job.id)}
                          disabled={controlsDisabled()}
                        />
                      ) : (
                        <span>{job.matchDescription}</span>
                      ),
                    ),
                  }}
                />
                <Column field="audioCount" header="曲目数" headerClass="w-24" bodyClass="w-24" />
                <Column
                  header="状态"
                  headerClass="w-40"
                  bodyClass="w-40"
                  v-slots={{
                    body: bodySlot(job => {
                      const status = statusInfo(job.status)
                      return <Tag value={status.label} severity={status.severity} />
                    }),
                  }}
                />
                <Column
                  header="问题"
                  headerClass="min-w-[15rem]"
                  bodyClass="min-w-[15rem]"
                  v-slots={{
                    body: bodySlot(job =>
                      job.issues.length ? (
                        <ul class="grid list-none gap-1.5 p-0 text-[.78rem] text-red-700 dark:text-red-300">
                          {job.issues.map(issue => (
                            <li class="flex items-center gap-1.5" key={issue.code}>
                              {issue.severity === 'error' ? (
                                <CircleAlert size={14} />
                              ) : (
                                <TriangleAlert size={14} />
                              )}
                              {issue.message}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span class="flex items-center gap-1.5 text-[.78rem] text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 size={15} /> 检查通过
                        </span>
                      ),
                    ),
                  }}
                />
              </DataTable>
            </section>

            {operation.value && (
              <OperationPanel operation={operation.value} onCancel={() => batch.cancel()} />
            )}

            {result.value && (
              <section class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-surface-200 py-5 dark:border-surface-700">
                <div
                  class={[
                    'grid size-[52px] place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                    {
                      'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300':
                        result.value.failed || result.value.cancelled,
                    },
                  ]}
                >
                  {result.value.failed || result.value.cancelled ? (
                    <TriangleAlert size={28} />
                  ) : (
                    <CheckCircle2 size={28} />
                  )}
                </div>
                <div>
                  <h2 class="m-0 mt-1 text-[1.08rem] font-bold">{result.value.message}</h2>
                  <p class="m-0 mt-1.5 text-[.84rem] text-muted-color">
                    成功 {result.value.succeeded} 项，失败 {result.value.failed} 项，重命名{' '}
                    {result.value.renamed} 个文件，另存封面 {result.value.coversSaved} 张，生成{' '}
                    {result.value.lrcFiles} 个 LRC，耗时{' '}
                    {(result.value.durationMs / 1000).toFixed(1)} 秒。
                  </p>
                </div>
                {(failedCount.value > 0 || result.value.failed > 0) && (
                  <Button
                    label="仅重试失败项"
                    severity="secondary"
                    outlined
                    onClick={() => batch.run(true)}
                  >
                    {{ icon: () => <RotateCcw size={17} /> }}
                  </Button>
                )}
              </section>
            )}

            {!operation.value && (
              <div class="action-bar fixed right-0 bottom-0 left-[216px] justify-between backdrop-blur-md [&>div]:flex [&>div]:items-center [&>div]:gap-3">
                <div>
                  <strong>{readyCount.value} 个任务可执行</strong>
                </div>
                <div>
                  <Button
                    label="重新预检"
                    severity="secondary"
                    text
                    disabled={controlsDisabled()}
                    onClick={() => batch.scan()}
                  >
                    {{ icon: () => <RefreshCw size={17} /> }}
                  </Button>
                  <Button
                    label="开始批处理"
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
      </div>
    )
  },
})
