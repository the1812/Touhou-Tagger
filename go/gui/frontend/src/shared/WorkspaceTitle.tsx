import { defineComponent } from 'vue'

export const WorkspaceTitle = defineComponent({
  name: 'WorkspaceTitle',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => (
      <div {...attrs} class={['mt-1 text-lg font-bold', attrs.class]}>
        {slots.default?.()}
      </div>
    )
  },
})
