import { CircleX, TriangleAlert } from 'lucide-vue-next'
import PrimeMessage, { type MessageProps } from 'primevue/message'
import { defineComponent, type PropType } from 'vue'

export const Message = defineComponent({
  name: 'Message',
  inheritAttrs: false,
  props: {
    severity: {
      type: String as PropType<MessageProps['severity']>,
      default: 'info',
    },
    size: {
      type: String as PropType<MessageProps['size']>,
      default: 'small',
    },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const icons: Partial<Record<string, typeof TriangleAlert>> = {
        warn: TriangleAlert,
        error: CircleX,
      }
      const Icon = icons[props.severity]

      return (
        <PrimeMessage closable={false} {...attrs} severity={props.severity} size={props.size}>
          {{
            ...slots,
            ...(Icon && {
              icon: ({ class: iconClass }: { class: string }) => (
                <Icon class={[iconClass, 'shrink-0']} />
              ),
            }),
          }}
        </PrimeMessage>
      )
    }
  },
})
