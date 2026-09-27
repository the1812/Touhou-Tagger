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
  },
  setup(props, { attrs, slots }) {
    return () => (
      <div
        {...attrs}
        class={[
          'grid gap-1.5 font-normal',
          props.variant === 'settings'
            ? ['w-full max-w-app-field content-start text-sm text-color']
            : 'text-base',
          attrs.class,
        ]}
      >
        {slots.default?.()}
        {props.error &&
          (slots.error?.({ error: props.error }) ?? (
            <div
              class={[
                'font-normal text-red-700! dark:text-red-300!',
                props.variant === 'settings' ? 'text-base leading-[1.4]' : 'text-sm',
              ]}
            >
              {props.error}
            </div>
          ))}
      </div>
    )
  },
})
