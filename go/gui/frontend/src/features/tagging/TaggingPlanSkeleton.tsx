import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

export const TaggingPlanSkeleton = defineComponent({
  name: 'TaggingPlanSkeleton',
  setup() {
    return () => (
      <>
        <div class="workspace-section grid w-full grid-cols-[var(--spacing-app-cover)_minmax(300px,1fr)] gap-4">
          <Skeleton width="var(--spacing-app-cover)" height="var(--spacing-app-cover)" />
          <div class="grid content-start gap-4">
            <div class="workspace-heading">
              <Skeleton width="55%" height="1.75rem" />
            </div>
            <div class="grid gap-2">
              {[1, 2, 3, 4, 5].map(index => (
                <div key={index} class="grid grid-cols-[4rem_minmax(0,1fr)] gap-2">
                  <Skeleton width="3rem" height="1.5rem" />
                  <Skeleton width={index === 1 ? '55%' : '35%'} height="1.5rem" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div class="workspace-section grid w-full content-start gap-3">
          {[1, 2, 3, 4, 5].map(index => (
            <Skeleton key={index} height="1.875rem" />
          ))}
        </div>
      </>
    )
  },
})
