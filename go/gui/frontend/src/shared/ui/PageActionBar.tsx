import { defineComponent, Teleport, type SlotsType, type VNodeChild } from 'vue'

export const PageActionBar = defineComponent({
  name: 'PageActionBar',
  slots: Object as SlotsType<{
    status?: () => VNodeChild
    secondaryAction?: () => VNodeChild
    action?: () => VNodeChild
  }>,
  setup(_, { slots }) {
    return () => (
      <Teleport defer to="#page-action-bar">
        <div class="action-bar">
          {slots.status && <div class="min-w-0 text-sm text-muted-color">{slots.status()}</div>}
          <div class="ml-auto flex shrink-0 items-center gap-2">
            {slots.secondaryAction?.()}
            {slots.action?.()}
          </div>
        </div>
      </Teleport>
    )
  },
})
