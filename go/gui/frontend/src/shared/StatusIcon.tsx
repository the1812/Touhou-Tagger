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
          'inline-flex h-8 items-center justify-center rounded-md hover:bg-primary-50 dark:hover:bg-primary-950',
          props.active ? 'text-primary' : 'text-surface-400 dark:text-surface-500',
          props.count !== undefined ? 'w-auto gap-1.5 pl-1 pr-2' : 'w-8',
        ]}
        v-tooltip={props.tooltip}
      >
        <props.icon class="size-[16px]" />
        {props.count !== undefined && (
          <div class="text-base tabular-nums font-medium">{props.count}</div>
        )}
      </div>
    )
  },
})
