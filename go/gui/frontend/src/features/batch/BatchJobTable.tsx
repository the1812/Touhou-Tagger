import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { defineComponent, type PropType } from 'vue'

import type { BatchJobPreview, BatchJobStatus } from '../../api'

const cellClass = 'min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[.78rem]'

const statusInfo = (status: BatchJobStatus) => {
  const map: Record<
    BatchJobStatus,
    { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }
  > = {
    ready: { label: '可写入', severity: 'success' },
    'needs-candidate': { label: '需要选择', severity: 'warn' },
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

const BatchTableTooltip = defineComponent({
  name: 'BatchTableTooltip',
  props: {
    value: {
      type: String,
      required: true,
    },
    contentClass: {
      type: String,
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => (
      <span class={props.contentClass} v-tooltip={props.value}>
        {slots.default?.()}
      </span>
    )
  },
})

export const BatchJobTable = defineComponent({
  name: 'BatchJobTable',
  props: {
    jobs: {
      type: Array as PropType<BatchJobPreview[]>,
      required: true,
    },
    editable: Boolean,
    disabled: Boolean,
    resolving: {
      type: Function as PropType<(jobId: string) => boolean>,
      required: true,
    },
  },
  emits: {
    resolve: (jobId: string, candidateId: string) => Boolean(jobId && candidateId),
    ignore: (jobId: string) => Boolean(jobId),
  },
  setup(props, { emit }) {
    const bodySlot =
      (render: (job: BatchJobPreview) => unknown) =>
      ({ data }: { data: BatchJobPreview }) =>
        render(data)
    const rowClass = (job: BatchJobPreview) => [
      'h-[46px]',
      ['track-mismatch', 'scan-failed', 'failed'].includes(job.status) &&
        'bg-red-50/60 dark:bg-red-950/30',
      job.status === 'needs-candidate' && 'bg-amber-50/60 dark:bg-amber-950/30',
      job.status === 'ignored' && 'text-muted-color',
    ]
    const matchCell = (job: BatchJobPreview) => {
      if (!props.editable) {
        return (
          <BatchTableTooltip
            value={job.matchDescription}
            contentClass="block overflow-hidden text-ellipsis whitespace-nowrap"
          >
            {job.matchDescription}
          </BatchTableTooltip>
        )
      }
      if (job.status === 'needs-candidate' && job.candidates.length === 0) {
        return (
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-color">未找到搜索结果</span>
            <Button
              label="忽略"
              size="small"
              severity="secondary"
              text
              loading={props.resolving(job.id)}
              disabled={props.disabled}
              onClick={() => emit('ignore', job.id)}
            />
          </div>
        )
      }
      if (job.candidates.length > 1 || job.status === 'needs-candidate') {
        return (
          <Select
            modelValue={job.selectedCandidateId}
            {...{
              'onUpdate:modelValue': (value: unknown) => emit('resolve', job.id, String(value)),
            }}
            options={candidateOptions(job)}
            optionLabel="label"
            optionValue="value"
            placeholder="选择专辑"
            fluid
            loading={props.resolving(job.id)}
            disabled={props.disabled}
          />
        )
      }
      return (
        <BatchTableTooltip
          value={job.matchDescription}
          contentClass="block overflow-hidden text-ellipsis whitespace-nowrap"
        >
          {job.matchDescription}
        </BatchTableTooltip>
      )
    }
    return () => (
      <DataTable
        value={props.jobs}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        size="small"
        tableClass="w-full min-w-[720px] table-fixed"
        class="min-h-60 w-full min-w-0 max-w-full [--p-datatable-body-cell-sm-padding:.375rem_1rem] [--p-datatable-header-cell-sm-padding:.375rem_1rem]"
        rowClass={rowClass}
        virtualScrollerOptions={props.jobs.length > 100 ? { itemSize: 46 } : undefined}
        pt={{ tableContainer: { class: 'w-full min-w-0 max-w-full' } }}
        v-slots={{
          empty: () => (
            <div class="p-8 text-center text-muted-color">
              无匹配目录，请尝试调整目录层级
            </div>
          ),
        }}
      >
        <Column
          field="relativePath"
          header="专辑目录"
          frozen
          headerClass={`${cellClass} w-[24%]`}
          bodyClass={`${cellClass} w-[24%]`}
          v-slots={{
            body: bodySlot(job => (
              <BatchTableTooltip
                value={job.relativePath}
                contentClass="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
              >
                {job.relativePath}
              </BatchTableTooltip>
            )),
          }}
        />
        <Column
          field="inferredAlbumName"
          header="专辑名称"
          headerClass={`${cellClass} w-[24%]`}
          bodyClass={`${cellClass} w-[24%]`}
        />
        <Column
          header="匹配结果"
          headerClass={`${cellClass} w-[34%]`}
          bodyClass={`${cellClass} w-[34%]`}
          v-slots={{ body: bodySlot(matchCell) }}
        />
        <Column
          field="audioCount"
          header="曲目"
          headerClass={`${cellClass} w-16`}
          bodyClass={`${cellClass} w-16 tabular-nums`}
        />
        <Column
          header="状态"
          headerClass={`${cellClass} w-28`}
          bodyClass={`${cellClass} w-28`}
          v-slots={{
            body: bodySlot(job => {
              const status = statusInfo(job.status)
              const tag = (
                <Tag
                  class="text-xs! font-normal!"
                  value={status.label}
                  severity={status.severity}
                />
              )
              const issueText = job.issues.map(issue => issue.message).join('；')
              return issueText ? (
                <BatchTableTooltip value={issueText} contentClass="inline-flex">
                  {tag}
                </BatchTableTooltip>
              ) : (
                tag
              )
            }),
          }}
        />
      </DataTable>
    )
  },
})
