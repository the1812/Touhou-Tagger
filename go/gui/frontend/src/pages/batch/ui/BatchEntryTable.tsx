import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { defineComponent, type PropType } from 'vue'

import type { BatchEntryPreview } from '../../../shared/api'
import { batchMatchText, batchStatusInfo, issueText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { cx } from '../../../shared/lib'
import { CandidateOption, TruncatedText } from '../../../shared/ui'
import { candidateOptions } from '../lib/batchEntryDisplay'

export const BatchEntryTable = defineComponent({
  name: 'BatchEntryTable',
  props: {
    entries: {
      type: Array as PropType<BatchEntryPreview[]>,
      required: true,
    },
    editable: Boolean,
    disabled: Boolean,
    resolving: {
      type: Function as PropType<(entryId: string) => boolean>,
      required: true,
    },
  },
  emits: {
    resolve: (entryId: string, candidateId: string) => Boolean(entryId && candidateId),
    retry: (entryId: string) => Boolean(entryId),
  },
  setup(props, { emit }) {
    const bodySlot =
      (render: (entry: BatchEntryPreview) => unknown) =>
      ({ data }: { data: BatchEntryPreview }) =>
        render(data)
    const rowClass = (entry: BatchEntryPreview) => {
      const hasError = entry.readiness === 'blocked' || entry.outcome === 'failed'
      return cx(
        'h-[46px]',
        hasError && 'bg-red-50/60 dark:bg-red-950/30',
        entry.readiness === 'needs-candidate' && 'bg-amber-50/60 dark:bg-amber-950/30',
      )
    }
    const matchCell = (entry: BatchEntryPreview) => {
      const loading = props.resolving(entry.id)
      if (!props.editable) {
        return <TruncatedText class="block">{batchMatchText(entry, loading)}</TruncatedText>
      }
      if (loading || entry.readiness === 'pending') {
        return <div class="text-muted-color">{batchMatchText(entry, loading)}</div>
      }
      const blockedWithoutAlternatives =
        entry.readiness === 'blocked' && entry.candidates.length <= 1
      const canReload =
        blockedWithoutAlternatives ||
        entry.issues.some(issue => issue.code === 'scan-failed' || issue.code === 'load-failed')
      if (canReload) {
        return (
          <div class="flex items-center justify-between gap-2">
            <TruncatedText class="block text-red-600 dark:text-red-300">
              {batchMatchText(entry, loading)}
            </TruncatedText>
            <Button
              label={t('common.retry')}
              size="small"
              severity="danger"
              text
              loading={props.resolving(entry.id)}
              disabled={props.disabled}
              onClick={() => emit('retry', entry.id)}
            />
          </div>
        )
      }
      if (entry.readiness === 'skipped' || entry.candidates.length === 0) {
        return <div class="text-muted-color">{batchMatchText(entry, loading)}</div>
      }
      if (
        entry.candidates.length > 1 ||
        entry.candidates.some(candidate => !candidate.exactMatch) ||
        entry.readiness === 'needs-candidate'
      ) {
        return (
          <Select
            size="small"
            modelValue={entry.selectedCandidateId}
            {...{
              'onUpdate:modelValue': (value: unknown) => emit('resolve', entry.id, String(value)),
            }}
            options={candidateOptions(entry)}
            optionLabel="label"
            optionValue="value"
            placeholder={t('batch.selectAlbum')}
            fluid
            loading={props.resolving(entry.id)}
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
      return <TruncatedText class="block">{batchMatchText(entry, loading)}</TruncatedText>
    }
    return () => (
      <DataTable
        value={props.entries}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        showGridlines
        tableClass="w-full min-w-[720px] table-fixed"
        class="compact-data-table"
        rowClass={rowClass}
        virtualScrollerOptions={props.entries.length > 100 ? { itemSize: 46 } : undefined}
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
            body: bodySlot(entry => (
              <TruncatedText class="block" tooltip={entry.relativePath}>
                {entry.relativePath}
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
            body: bodySlot(entry => {
              const status = batchStatusInfo(entry, props.resolving(entry.id))
              const tag = (
                <Tag class="font-normal!" value={status.label} severity={status.severity} />
              )
              const details = entry.issues.map(issueText).join('；')
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
