import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { defineComponent, type PropType } from 'vue'

import type { BatchJobPreview } from '../../../shared/api'
import { batchMatchText, batchStatusInfo, issueText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { cx } from '../../../shared/lib'
import { CandidateOption, TruncatedText } from '../../../shared/ui'
import { candidateOptions } from '../lib/batchJobDisplay'

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
    retry: (jobId: string) => Boolean(jobId),
  },
  setup(props, { emit }) {
    const bodySlot =
      (render: (job: BatchJobPreview) => unknown) =>
      ({ data }: { data: BatchJobPreview }) =>
        render(data)
    const rowClass = (job: BatchJobPreview) => {
      const hasError = job.readiness === 'blocked' || job.outcome === 'failed'
      return cx(
        'h-[46px]',
        hasError && 'bg-red-50/60 dark:bg-red-950/30',
        job.readiness === 'needs-candidate' && 'bg-amber-50/60 dark:bg-amber-950/30',
      )
    }
    const matchCell = (job: BatchJobPreview) => {
      const loading = props.resolving(job.id)
      if (!props.editable) {
        return <TruncatedText class="block">{batchMatchText(job, loading)}</TruncatedText>
      }
      if (loading || job.readiness === 'pending') {
        return <div class="text-muted-color">{batchMatchText(job, loading)}</div>
      }
      const blockedWithoutAlternatives = job.readiness === 'blocked' && job.candidates.length <= 1
      const canReload =
        blockedWithoutAlternatives ||
        job.issues.some(issue => issue.code === 'scan-failed' || issue.code === 'load-failed')
      if (canReload) {
        return (
          <div class="flex items-center justify-between gap-2">
            <TruncatedText class="block text-red-600 dark:text-red-300">
              {batchMatchText(job, loading)}
            </TruncatedText>
            <Button
              label={t('common.retry')}
              size="small"
              severity="danger"
              text
              loading={props.resolving(job.id)}
              disabled={props.disabled}
              onClick={() => emit('retry', job.id)}
            />
          </div>
        )
      }
      if (job.readiness === 'skipped' || job.candidates.length === 0) {
        return <div class="text-muted-color">{batchMatchText(job, loading)}</div>
      }
      if (
        job.candidates.length > 1 ||
        job.candidates.some(candidate => !candidate.exactMatch) ||
        job.readiness === 'needs-candidate'
      ) {
        return (
          <Select
            size="small"
            modelValue={job.selectedCandidateId}
            {...{
              'onUpdate:modelValue': (value: unknown) => emit('resolve', job.id, String(value)),
            }}
            options={candidateOptions(job)}
            optionLabel="label"
            optionValue="value"
            placeholder={t('batch.selectAlbum')}
            fluid
            loading={props.resolving(job.id)}
            disabled={props.disabled}
            overlayClass="[&_.p-select-option]:p-0!"
            v-slots={{
              option: ({ option }: { option: ReturnType<typeof candidateOptions>[number] }) => (
                <CandidateOption candidate={option.candidate} />
              ),
            }}
          />
        )
      }
      return <TruncatedText class="block">{batchMatchText(job, loading)}</TruncatedText>
    }
    return () => (
      <DataTable
        value={props.jobs}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        showGridlines
        tableClass="w-full min-w-[720px] table-fixed"
        class="compact-data-table"
        rowClass={rowClass}
        virtualScrollerOptions={props.jobs.length > 100 ? { itemSize: 46 } : undefined}
        v-slots={{
          empty: () => <div class="p-8 text-center text-muted-color">{t('batch.empty')}</div>,
        }}
      >
        <Column
          field="relativePath"
          header={t('batch.columns.directory')}
          frozen
          headerClass={['compact-table-cell', 'w-[24%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[24%]'].join(' ')}
          v-slots={{
            body: bodySlot(job => (
              <TruncatedText class="block" tooltip={job.relativePath}>
                {job.relativePath}
              </TruncatedText>
            )),
          }}
        />
        <Column
          field="inferredAlbumName"
          header={t('batch.columns.album')}
          headerClass={['compact-table-cell', 'w-[24%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[24%]'].join(' ')}
        />
        <Column
          header={t('batch.columns.match')}
          headerClass={['compact-table-cell', 'w-[34%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[34%]', 'py-1!'].join(' ')}
          v-slots={{ body: bodySlot(matchCell) }}
        />
        <Column
          field="audioCount"
          header={t('batch.columns.tracks')}
          headerClass={['compact-table-cell', 'w-16'].join(' ')}
          bodyClass={['compact-table-cell', 'w-16 tabular-nums'].join(' ')}
        />
        <Column
          header={t('batch.columns.status')}
          headerClass={['compact-table-cell', 'w-28'].join(' ')}
          bodyClass={['compact-table-cell', 'w-28'].join(' ')}
          v-slots={{
            body: bodySlot(job => {
              const status = batchStatusInfo(job, props.resolving(job.id))
              const tag = (
                <Tag class="font-normal!" value={status.label} severity={status.severity} />
              )
              const details = job.issues.map(issueText).join('；')
              return details ? (
                <TruncatedText class="inline-flex" tooltip={details}>
                  {tag}
                </TruncatedText>
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
