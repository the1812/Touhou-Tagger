import { Info } from 'lucide-vue-next'
import Button from 'primevue/button'
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
      <label
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
                props.variant === 'settings' ? 'leading-[1.4]' : 'text-xs',
              ]}
            >
              {props.error}
            </div>
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
    emphasis: {
      type: Boolean,
      default: true,
    },
  },
  setup(props, { attrs, slots }) {
    return () => (
      <div
        {...attrs}
        class={[
          'flex items-center gap-1',
          props.emphasis ? 'font-semibold' : 'font-normal',
          attrs.class,
        ]}
      >
        {slots.default?.()}
        {props.help && (
          <Button unstyled type="button" class="help-icon" v-tooltip={props.help}>
            <Info class="size-[13px]" />
          </Button>
        )}
      </div>
    )
  },
})
