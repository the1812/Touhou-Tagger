import { Info } from 'lucide-vue-next'
import { defineComponent, type PropType } from 'vue'

export const FormField = defineComponent({
  name: 'FormField',
  inheritAttrs: false,
  props: {
    variant: {
      type: String as PropType<'dialog' | 'settings'>,
      default: 'dialog',
    },
    error: String,
    emphasis: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { attrs, slots }) {
    return () => (
      <label
        {...attrs}
        class={[
          'grid gap-1.5',
          props.emphasis ? 'font-semibold' : 'font-normal',
          props.variant === 'settings'
            ? [
                'w-full max-w-app-field content-start text-app-caption text-color',
                '[&>small]:font-normal [&>small]:leading-[1.4] [&>small]:text-muted-color',
              ]
            : 'text-app-control [&>small]:text-xs [&>small]:font-normal',
          attrs.class,
        ]}
      >
        {slots.default?.()}
        {props.error &&
          (slots.error?.({ error: props.error }) ?? (
            <small class="text-red-700! dark:text-red-300!">{props.error}</small>
          ))}
      </label>
    )
  },
})

export const FieldLabel = defineComponent({
  name: 'FieldLabel',
  inheritAttrs: false,
  props: {
    help: String,
  },
  setup(props, { attrs, slots }) {
    return () => (
      <span {...attrs} class={['flex items-center gap-1', attrs.class]}>
        {slots.default?.()}
        {props.help && (
          <span
            role="button"
            tabindex="0"
            class="help-icon"
            aria-label={props.help}
            v-tooltip={{ value: props.help }}
          >
            <Info size={13} />
          </span>
        )}
      </span>
    )
  },
})
