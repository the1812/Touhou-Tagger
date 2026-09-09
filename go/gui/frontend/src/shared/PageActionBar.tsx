import { defineComponent, Teleport } from 'vue'

export const PageActionBar = defineComponent({
  name: 'PageActionBar',
  props: {
    end: Boolean,
  },
  setup(props, { slots }) {
    return () => (
      <Teleport to="#page-action-bar">
        <div class={['action-bar', props.end ? 'justify-end' : 'justify-between']}>
          {slots.default?.()}
        </div>
      </Teleport>
    )
  },
})
