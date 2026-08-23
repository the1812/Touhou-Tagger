import { defineComponent } from 'vue'

export const FormSection = defineComponent({
  name: 'FormSection',
  inheritAttrs: false,
  props: {
    title: String,
  },
  setup(props, { attrs, slots }) {
    return () => (
      <section
        {...attrs}
        class={[
          'grid gap-4 py-app-section-y',
          '[&>h2]:m-0 [&>h2]:text-base [&>h2]:font-bold',
          attrs.class,
        ]}
      >
        {(slots.title || props.title) && <h2>{slots.title?.() ?? props.title}</h2>}
        {slots.default?.()}
      </section>
    )
  },
})
