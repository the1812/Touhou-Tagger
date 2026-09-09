import type { LucideIcon } from 'lucide-vue-next'
import { defineComponent, type PropType } from 'vue'

export const StatusIcon = defineComponent({
  name: 'StatusIcon',
  props: {
    icon: {
      type: Function as PropType<LucideIcon>,
      required: true,
    },
    active: Boolean,
    count: Number,
    tooltip: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div
        class={[
          'inline-flex items-center justify-center gap-1.5 p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-primary-950',
          props.active ? 'text-primary' : 'text-surface-400 dark:text-surface-500',
        ]}
        v-tooltip={props.tooltip}
      >
        <props.icon />
        {props.count !== undefined && (
          <div class="text-sm tabular-nums font-medium">{props.count}</div>
        )}
      </div>
    )
  },
})
