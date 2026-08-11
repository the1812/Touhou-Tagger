import { computed, defineComponent, type PropType } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTableRowClickEvent } from 'primevue/datatable'
import { Pencil } from 'lucide-vue-next'

import type { PlanItemPreview } from '../../api'

import './PlanTable.css'

export const PlanTable = defineComponent({
  name: 'PlanTable',
  props: {
    items: {
      type: Array as PropType<PlanItemPreview[]>,
      required: true,
    },
    disabled: Boolean,
  },
  emits: {
    edit: (_item: PlanItemPreview) => true,
  },
  setup(props, { emit }) {
    const hasMultipleDiscs = computed(
      () => new Set(props.items.map(item => item.discNumber)).size > 1,
    )
    const onRowClick = (event: DataTableRowClickEvent) => {
      if (!props.disabled) {
        emit('edit', event.data as PlanItemPreview)
      }
    }
    const rowClass = (item: PlanItemPreview) => ({
      'plan-table__row--disabled': props.disabled,
      'plan-table__row--error': item.issues.some(issue => issue.severity === 'error'),
      'plan-table__row--warning':
        item.issues.length > 0 && !item.issues.some(issue => issue.severity === 'error'),
    })
    const bodySlot = (render: (item: PlanItemPreview) => unknown) =>
      ({ data }: { data: PlanItemPreview }) => render(data)

    return () => (
      <DataTable
        value={props.items}
        dataKey="id"
        scrollable
        scrollHeight="flex"
        size="small"
        class="plan-table"
        rowClass={rowClass}
        v-slots={{ empty: () => <div class="table-empty">没有可预览的曲目。</div> }}
        {...{ onRowClick }}
      >
        <Column field="sourceName" header="本地文件" style={{ minWidth: '13rem' }} />
        {hasMultipleDiscs.value && (
          <Column
            field="discNumber"
            header="碟号"
            style={{ width: '4.5rem' }}
            v-slots={{
              body: bodySlot(item => <span class="track-index">{item.discNumber}</span>),
            }}
          />
        )}
        <Column
          field="trackNumber"
          header="轨号"
          style={{ width: '4.5rem' }}
          v-slots={{
            body: bodySlot(item => <span class="track-index">{item.trackNumber}</span>),
          }}
        />
        <Column field="title" header="标题" style={{ minWidth: '15rem' }} />
        <Column
          header="艺术家"
          style={{ minWidth: '12rem' }}
          v-slots={{ body: bodySlot(item => item.artists.join(' / ') || '—') }}
        />
        <Column
          field="targetName"
          header="目标文件名"
          style={{ minWidth: '18rem' }}
          v-slots={{
            body: bodySlot(item => (
              <span class={{ 'target-name--changed': item.willRename }}>{item.targetName}</span>
            )),
          }}
        />
        <Column
          header="操作"
          frozen
          alignFrozen="right"
          style={{ width: '4rem' }}
          v-slots={{
            body: bodySlot(item => (
              <Button
                title="编辑曲目"
                aria-label={`编辑曲目：${item.title}`}
                severity="secondary"
                text
                rounded
                disabled={props.disabled}
                onClick={event => {
                  event.stopPropagation()
                  emit('edit', item)
                }}
              >
                {{ icon: () => <Pencil size={15} /> }}
              </Button>
            )),
          }}
        />
      </DataTable>
    )
  },
})
