import { defineComponent } from 'vue'

export const FormSection = defineComponent({
  name: 'FormSection',
  inheritAttrs: false,
  props: {
    title: String,
  },
  setup(props, { attrs, slots }) {
    return () => (
      <div
        {...attrs}
        class={[
          'grid gap-4 py-app-section-y',
          attrs.class,
        ]}
      >
        {(slots.title || props.title) && (
          <div class="text-base font-bold">{slots.title?.() ?? props.title}</div>
        )}
        {slots.default?.()}
      </div>
    )
  },
})
