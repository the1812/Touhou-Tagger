import { defineComponent } from 'vue'

export const WorkspaceTitle = defineComponent({
  name: 'WorkspaceTitle',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => (
      <div {...attrs} class={['text-lg font-medium', attrs.class]}>
        {slots.default?.()}
      </div>
    )
  },
})
