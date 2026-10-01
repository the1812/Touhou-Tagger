import { defineComponent } from 'vue'

export const FormSection = defineComponent({
  name: 'FormSection',
  inheritAttrs: false,
  props: {
    title: String,
  },
  setup(props, { attrs, slots }) {
    return () => {
      const hasTitle = slots.title || props.title
      return (
        <div {...attrs} class={['grid gap-4 py-app-section-y', attrs.class]}>
          {hasTitle && <div class="text-base font-medium">{slots.title?.() ?? props.title}</div>}
          {slots.default?.()}
        </div>
      )
    }
  },
})
