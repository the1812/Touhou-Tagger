import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { defineComponent, type PropType } from 'vue'

import type { BatchJobPreview, BatchJobStatus } from '../../api'
import { t } from '../../i18n'
import { cx } from '../../shared/classNames'
import { TruncatedText } from '../../shared/TruncatedText'

const statusInfo = (status: BatchJobStatus) => {
  const map: Record<
    BatchJobStatus,
    { label: string; severity: 'success' | 'info' | 'warn' | 'danger' | 'secondary' }
  > = {
    loading: { label: t('batch.status.loading'), severity: 'info' },
    ready: { label: t('batch.status.ready'), severity: 'success' },
    'needs-candidate': { label: t('batch.status.needsCandidate'), severity: 'warn' },
    'local-metadata': { label: t('batch.status.localMetadata'), severity: 'info' },
    'track-mismatch': { label: t('batch.status.trackMismatch'), severity: 'danger' },
    'scan-failed': { label: t('batch.status.scanFailed'), severity: 'danger' },
    ignored: { label: t('batch.status.ignored'), severity: 'secondary' },
    queued: { label: t('batch.status.queued'), severity: 'secondary' },
    running: { label: t('batch.status.running'), severity: 'info' },
    succeeded: { label: t('batch.status.succeeded'), severity: 'success' },
    failed: { label: t('batch.status.failed'), severity: 'danger' },
    cancelled: { label: t('batch.status.cancelled'), severity: 'secondary' },
  }
  return map[status]
}

const candidateOptions = (job: BatchJobPreview) =>
  job.candidates.map(candidate => ({
    value: candidate.id,
    label: `${candidate.title} · ${candidate.artists.join(' / ')}`,
  }))

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
    retry: (jobId: string) => Boolean(jobId),
  },
  setup(props, { emit }) {
    const bodySlot =
      (render: (job: BatchJobPreview) => unknown) =>
      ({ data }: { data: BatchJobPreview }) =>
        render(data)
    const rowClass = (job: BatchJobPreview) =>
      cx(
        'h-[46px]',
        ['track-mismatch', 'scan-failed', 'failed'].includes(job.status) &&
          'bg-red-50/60 dark:bg-red-950/30',
        job.status === 'needs-candidate' && 'bg-amber-50/60 dark:bg-amber-950/30',
        job.status === 'ignored' && 'text-muted-color',
      )
    const matchCell = (job: BatchJobPreview) => {
      if (!props.editable) {
        return <TruncatedText class="block">{job.matchDescription}</TruncatedText>
      }
      if (job.status === 'loading') {
        return <span class="text-muted-color">{t('batch.loadingAlbum')}</span>
      }
      if (job.status === 'scan-failed') {
        return (
          <div class="flex items-center justify-between gap-2">
            <TruncatedText class="block text-red-600 dark:text-red-300">
              {job.matchDescription}
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
      if (job.status === 'needs-candidate' && job.candidates.length === 0) {
        return (
          <div class="flex items-center justify-between gap-2">
            <span class="text-muted-color">{t('batch.noSearchResults')}</span>
            <Button
              label={t('batch.ignore')}
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
            placeholder={t('batch.selectAlbum')}
            fluid
            loading={props.resolving(job.id)}
            disabled={props.disabled}
          />
        )
      }
      return <TruncatedText class="block">{job.matchDescription}</TruncatedText>
    }
    return () => (
      <DataTable
        value={props.jobs}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        size="small"
        tableClass="w-full min-w-[720px] table-fixed"
        class="compact-data-table"
        rowClass={rowClass}
        virtualScrollerOptions={props.jobs.length > 100 ? { itemSize: 46 } : undefined}
        pt={{ tableContainer: { class: 'w-full min-w-0 max-w-full' } }}
        v-slots={{
          empty: () => (
            <div class="p-8 text-center text-muted-color">
              {t('batch.empty')}
            </div>
          ),
        }}
      >
        <Column
          field="relativePath"
          header={t('batch.columns.directory')}
          frozen
          headerClass={[
            'compact-table-cell',
            'w-[24%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[24%]',
          ].join(' ')}
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
          headerClass={[
            'compact-table-cell',
            'w-[24%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[24%]',
          ].join(' ')}
        />
        <Column
          header={t('batch.columns.match')}
          headerClass={[
            'compact-table-cell',
            'w-[34%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[34%]',
          ].join(' ')}
          v-slots={{ body: bodySlot(matchCell) }}
        />
        <Column
          field="audioCount"
          header={t('batch.columns.tracks')}
          headerClass={[
            'compact-table-cell',
            'w-16',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-16 tabular-nums',
          ].join(' ')}
        />
        <Column
          header={t('batch.columns.status')}
          headerClass={[
            'compact-table-cell',
            'w-28',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-28',
          ].join(' ')}
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
                <TruncatedText class="inline-flex" tooltip={issueText}>
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
