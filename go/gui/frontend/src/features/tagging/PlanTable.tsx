import Column from 'primevue/column'
import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
import { computed, defineComponent, type PropType } from 'vue'

import type { PlanItemPreview } from '../../api'
import { t } from '../../i18n'
import { cx } from '../../shared/classNames'
import { TruncatedText } from '../../shared/TruncatedText'

export const PlanTable = defineComponent({
  name: 'PlanTable',
  props: {
    items: {
      type: Array as PropType<PlanItemPreview[]>,
      required: true,
    },
    disabled: Boolean,
  },
  emits: ['edit'],
  setup(props, { emit }) {
    const hasMultipleDiscs = computed(
      () => new Set(props.items.map(item => item.discNumber)).size > 1,
    )
    const onRowClick = (event: DataTableRowClickEvent) => {
      if (!props.disabled) {
        emit('edit', event.data as PlanItemPreview)
      }
    }
    const rowClass = (item: PlanItemPreview) => {
      const hasError = item.issues.some(issue => issue.severity === 'error')
      const hasWarning = item.issues.length > 0 && !hasError
      return cx(
        'h-[42px]',
        props.disabled
          ? 'cursor-default'
          : 'cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-950',
        hasError && 'bg-red-50 hover:bg-red-50 dark:bg-red-950/50 dark:hover:bg-red-950/50',
        hasWarning &&
          'bg-amber-50 hover:bg-amber-50 dark:bg-amber-950/50 dark:hover:bg-amber-950/50',
      )
    }
    const bodySlot =
      (render: (item: PlanItemPreview) => unknown) =>
      ({ data }: { data: PlanItemPreview }) =>
        render(data)

    return () => (
      <DataTable
        value={props.items}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        size="small"
        tableClass="w-full min-w-0 max-w-full table-fixed"
        class="compact-data-table"
        data-fit-content="true"
        rowClass={rowClass}
        pt={{ tableContainer: { class: 'w-full min-w-0 max-w-full' } }}
        v-slots={{
          empty: () => <div class="p-8 text-center text-muted-color">{t('tagging.table.empty')}</div>,
        }}
        {...{ onRowClick }}
      >
        <Column
          field="sourceName"
          header={t('tagging.table.localFile')}
          headerClass={[
            'compact-table-cell',
            'w-[20%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[20%]',
          ].join(' ')}
          v-slots={{
            body: bodySlot(item => (
              <TruncatedText class="block" tooltip={item.sourceName}>
                {item.sourceName}
              </TruncatedText>
            )),
          }}
        />
        {hasMultipleDiscs.value && (
          <Column
            field="discNumber"
            header={t('tagging.table.discNumber')}
            headerClass={[
              'compact-table-cell',
              'w-16',
            ].join(' ')}
            bodyClass={[
              'compact-table-cell',
              'w-16',
            ].join(' ')}
            v-slots={{
              body: bodySlot(item => (
                <span class="text-muted-color tabular-nums">{item.discNumber}</span>
              )),
            }}
          />
        )}
        <Column
          field="trackNumber"
          header={t('tagging.table.trackNumber')}
          headerClass={[
            'compact-table-cell',
            'w-16',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-16',
          ].join(' ')}
          v-slots={{
            body: bodySlot(item => (
              <span class="text-muted-color tabular-nums">{item.trackNumber}</span>
            )),
          }}
        />
        <Column
          field="title"
          header={t('tagging.table.title')}
          headerClass={[
            'compact-table-cell',
            'w-[23%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[23%]',
          ].join(' ')}
          v-slots={{
            body: bodySlot(item => (
              <TruncatedText class="block" tooltip={item.title}>
                {item.title}
              </TruncatedText>
            )),
          }}
        />
        <Column
          header={t('tagging.table.artists')}
          headerClass={[
            'compact-table-cell',
            'w-[20%]',
          ].join(' ')}
          bodyClass={[
            'compact-table-cell',
            'w-[20%]',
          ].join(' ')}
          v-slots={{
            body: bodySlot(item => {
              const artists = item.artists.join(' / ') || '—'
              return (
                <TruncatedText class="block" tooltip={artists}>
                  {artists}
                </TruncatedText>
              )
            }),
          }}
        />
        <Column
          field="targetName"
          header={t('tagging.table.targetFileName')}
          headerClass="compact-table-cell"
          bodyClass="compact-table-cell"
          v-slots={{
            body: bodySlot(item => (
              <TruncatedText
                class={['block', { 'font-semibold text-primary': item.willRename }]}
                tooltip={item.targetName}
              >
                {item.targetName}
              </TruncatedText>
            )),
          }}
        />
      </DataTable>
    )
  },
})
