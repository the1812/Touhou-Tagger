import { Info } from '@lucide/vue'
import Button from 'primevue/button'
import { defineComponent } from 'vue'

export const FieldLabel = defineComponent({
  name: 'FieldLabel',
  inheritAttrs: false,
  props: {
    for: { type: String, required: true },
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
        <label for={props.for}>{slots.default?.()}</label>
        {props.help && (
          <Button unstyled type="button" class="help-icon" v-tooltip={props.help}>
            <Info class="size-[13px]" />
          </Button>
        )}
      </div>
    )
  },
})
