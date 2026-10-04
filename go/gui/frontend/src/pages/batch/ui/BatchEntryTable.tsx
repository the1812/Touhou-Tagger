import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import { defineComponent, type PropType } from 'vue'

import type { BatchEntryPreview } from '../../../shared/api'
import { batchStatusInfo, issueText } from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { cx } from '../../../shared/lib'
import { TruncatedText } from '../../../shared/ui'
import { BatchEntryActions } from './BatchEntryActions'
import { BatchEntryMatch } from './BatchEntryMatch'

export const BatchEntryTable = defineComponent({
  name: 'BatchEntryTable',
  props: {
    entries: {
      type: Array as PropType<BatchEntryPreview[]>,
      required: true,
    },
    editable: Boolean,
    removable: Boolean,
    removeDisabled: Boolean,
    disabled: Boolean,
    resolving: {
      type: Function as PropType<(entryId: string) => boolean>,
      required: true,
    },
  },
  emits: {
    remove: (entryId: string) => Boolean(entryId),
    reveal: (directory: string) => Boolean(directory),
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
    return () => (
      <DataTable
        value={props.entries}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        showGridlines
        tableClass="w-full min-w-[720px] table-auto"
        class="compact-data-table"
        rowClass={rowClass}
        virtualScrollerOptions={props.entries.length > 100 ? { itemSize: 46 } : undefined}
        v-slots={{
          empty: () => (
            <div class="p-8 text-center text-muted-color">
              {t(props.removable ? 'batch.selectionEmpty' : 'batch.empty')}
            </div>
          ),
        }}
      >
        <Column
          field="relativePath"
          header={t('batch.columns.directory')}
          frozen
          headerClass={['compact-table-cell', 'w-[24%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[24%] max-w-0'].join(' ')}
          v-slots={{
            body: bodySlot(entry => (
              <TruncatedText class="block" tooltip={entry.directory}>
                {entry.relativePath || entry.directory}
              </TruncatedText>
            )),
          }}
        />
        <Column
          field="inferredAlbumName"
          header={t('batch.columns.album')}
          headerClass={['compact-table-cell', 'w-[24%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[24%] max-w-0'].join(' ')}
        />
        <Column
          header={t('batch.columns.match')}
          headerClass={['compact-table-cell', 'w-[34%]'].join(' ')}
          bodyClass={['compact-table-cell', 'w-[34%] max-w-0', 'py-1!'].join(' ')}
          v-slots={{
            body: bodySlot(entry => (
              <BatchEntryMatch
                entry={entry}
                editable={props.editable}
                disabled={props.disabled}
                loading={props.resolving(entry.id)}
                onResolve={(entryId, candidateId) => emit('resolve', entryId, candidateId)}
                onRetry={entryId => emit('retry', entryId)}
              />
            )),
          }}
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
        {props.removable && (
          <Column
            header={t('batch.columns.actions')}
            headerClass="compact-table-cell w-px"
            bodyClass="compact-table-cell w-px px-1.5! py-1!"
            v-slots={{
              body: bodySlot(entry => (
                <BatchEntryActions
                  disabled={props.removeDisabled}
                  onReveal={() => emit('reveal', entry.directory)}
                  onRemove={() => emit('remove', entry.id)}
                />
              )),
            }}
          />
        )}
      </DataTable>
    )
  },
})
