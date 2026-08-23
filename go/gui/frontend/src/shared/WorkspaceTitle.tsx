import { defineComponent } from 'vue'

export const WorkspaceTitle = defineComponent({
  name: 'WorkspaceTitle',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => (
      <h2 {...attrs} class={['mt-1 text-app-heading font-bold', attrs.class]}>
        {slots.default?.()}
      </h2>
    )
  },
})
