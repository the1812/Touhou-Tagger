import { computed, defineComponent } from 'vue'
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
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

import type { BatchJobPreview, BatchJobStatus } from '../../api'
import { useBatchStore } from '../../stores/batch'
import { useSettingsStore } from '../../stores/settings'
import { OperationPanel } from '../tagging/OperationPanel'

import './BatchPage.css'

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
      void settings.load()
    }

    const sourceOptions = computed(
      () =>
        settings.capabilities?.sources.filter(option => option.supportsSearch) ?? [
          { value: 'thb-wiki', label: 'THBWiki', supportsSearch: true },
        ],
    )
    const bodySlot = (render: (job: BatchJobPreview) => unknown) =>
      ({ data }: { data: BatchJobPreview }) => render(data)
    const controlsDisabled = () =>
      selecting.value || scanning.value || resolvingCount.value > 0 || Boolean(operation.value)

    return () => (
      <div class="batch-page">
        <section class="batch-toolbar">
          <div class="batch-toolbar__directory">
            {directory.value ? (
              <div class="selected-directory" title={directory.value}>
                <FolderOpen size={18} />
                <strong>{directory.value}</strong>
              </div>
            ) : null}
          </div>
          <Button
            label={directory.value ? '更换根目录' : '选择批处理根目录'}
            severity="secondary"
            outlined
            loading={selecting.value}
            disabled={controlsDisabled()}
            onClick={() => void batch.selectDirectory()}
          >
            {{ icon: () => <FolderOpen size={17} /> }}
          </Button>

          <div class="batch-toolbar__controls">
            <label>
              <span>扫描深度</span>
              <InputNumber
                modelValue={depth.value}
                {...{ 'onUpdate:modelValue': (value: number | null) => batch.setDepth(value) }}
                min={1}
                max={8}
                showButtons
                buttonLayout="horizontal"
                disabled={controlsDisabled()}
                inputClass="depth-input"
              />
            </label>
            <label>
              <span>默认数据源</span>
              <Select
                modelValue={source.value}
                {...{ 'onUpdate:modelValue': (value: unknown) => batch.changeSource(String(value)) }}
                options={sourceOptions.value}
                optionLabel="label"
                optionValue="value"
                disabled={controlsDisabled()}
              />
            </label>
            <Button
              label="扫描专辑"
              loading={scanning.value}
              disabled={selecting.value || !directory.value || resolvingCount.value > 0 || Boolean(operation.value)}
              onClick={() => void batch.scan()}
            >
              {{ icon: () => <ScanSearch size={17} /> }}
            </Button>
          </div>
        </section>

        {!preview.value && !scanning.value && (
          <section class="batch-empty">
            <div class="batch-empty__icon">
              <ScanSearch size={38} />
            </div>
            <h2>先预检，再开始批处理</h2>
          </section>
        )}

        {scanning.value && (
          <section class="batch-empty">
            <div class="batch-empty__spinner" />
            <h2>正在扫描专辑目录</h2>
          </section>
        )}

        {preview.value && (
          <>
            <section class="batch-summary">
              <div>
                <span>发现专辑</span>
                <strong>{preview.value.jobs.length}</strong>
              </div>
              <div>
                <span>已就绪</span>
                <strong class="success-text">{readyCount.value}</strong>
              </div>
              <div>
                <span>需要处理</span>
                <strong class={{ 'warning-text': unresolvedCount.value > 0 }}>
                  {unresolvedCount.value}
                </strong>
              </div>
              <div>
                <span>执行失败</span>
                <strong class={{ 'error-text': failedCount.value > 0 }}>{failedCount.value}</strong>
              </div>
            </section>

            {unresolvedCount.value > 0 && (
              <Message severity="warn" closable={false}>
                有 {unresolvedCount.value} 个任务尚未解决。请在开始写入前选择候选或修复目录问题。
              </Message>
            )}

            <section class="batch-table-card">
              <div class="card-heading">
                <div>
                  <h2>逐项确认匹配状态</h2>
                </div>
                <Tag value={`深度 ${preview.value.depth}`} severity="secondary" />
              </div>

              <DataTable
                value={preview.value.jobs}
                dataKey="id"
                scrollable
                scrollHeight="flex"
                size="small"
                class="batch-table"
                virtualScrollerOptions={
                  preview.value.jobs.length > 100 ? { itemSize: 44 } : undefined
                }
              >
                <Column
                  field="relativePath"
                  header="专辑目录"
                  frozen
                  style={{ minWidth: '13rem' }}
                  v-slots={{
                    body: bodySlot(job => (
                      <div class="batch-path">
                        <FolderOpen size={15} />
                        <span>{job.relativePath}</span>
                      </div>
                    )),
                  }}
                />
                <Column field="inferredAlbumName" header="推断名称" style={{ minWidth: '15rem' }} />
                <Column field="source" header="数据源" style={{ width: '8rem' }} />
                <Column
                  header="匹配结果"
                  style={{ minWidth: '16rem' }}
                  v-slots={{
                    body: bodySlot(job =>
                      job.status === 'needs-candidate' && job.candidates.length === 0 ? (
                        <div class="no-candidate-action">
                          <span>未找到可用候选，可只跳过此项。</span>
                          <Button
                            label="忽略此任务"
                            size="small"
                            severity="secondary"
                            text
                            loading={batch.isResolving(job.id)}
                            disabled={controlsDisabled()}
                            onClick={() => void batch.ignoreJob(job.id)}
                          />
                        </div>
                      ) : job.candidates.length > 1 || job.status === 'needs-candidate' ? (
                        <Select
                          modelValue={job.selectedCandidateId}
                          {...{
                            'onUpdate:modelValue': (value: unknown) =>
                              void batch.resolveCandidate(job.id, String(value)),
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
                <Column field="audioCount" header="曲目数" style={{ width: '6rem' }} />
                <Column
                  header="状态"
                  style={{ width: '10rem' }}
                  v-slots={{
                    body: bodySlot(job => {
                      const status = statusInfo(job.status)
                      return <Tag value={status.label} severity={status.severity} />
                    }),
                  }}
                />
                <Column
                  header="问题"
                  style={{ minWidth: '15rem' }}
                  v-slots={{
                    body: bodySlot(job =>
                      job.issues.length ? (
                        <ul class="job-issues">
                          {job.issues.map(issue => (
                            <li key={issue.code}>
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
                        <span class="no-issues">
                          <CheckCircle2 size={15} /> 检查通过
                        </span>
                      ),
                    ),
                  }}
                />
              </DataTable>
            </section>

            {operation.value && (
              <OperationPanel operation={operation.value} onCancel={() => void batch.cancel()} />
            )}

            {result.value && (
              <section class="batch-result">
                <div
                  class={[
                    'batch-result__icon',
                    { 'batch-result__icon--warning': result.value.failed || result.value.cancelled },
                  ]}
                >
                  {result.value.failed || result.value.cancelled ? (
                    <TriangleAlert size={28} />
                  ) : (
                    <CheckCircle2 size={28} />
                  )}
                </div>
                <div>
                  <h2>{result.value.message}</h2>
                  <p>
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
                    onClick={() => void batch.run(true)}
                  >
                    {{ icon: () => <RotateCcw size={17} /> }}
                  </Button>
                )}
              </section>
            )}

            {!operation.value && (
              <div class="batch-action-bar">
                <div>
                  <strong>{readyCount.value} 个任务可执行</strong>
                </div>
                <div>
                  <Button
                    label="重新预检"
                    severity="secondary"
                    text
                    disabled={controlsDisabled()}
                    onClick={() => void batch.scan()}
                  >
                    {{ icon: () => <RefreshCw size={17} /> }}
                  </Button>
                  <Button
                    label="开始批处理"
                    disabled={!canRun.value}
                    onClick={() => void batch.run(false)}
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
