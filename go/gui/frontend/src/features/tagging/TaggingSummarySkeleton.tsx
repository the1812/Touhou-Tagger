import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

import { WorkspaceTitle } from '../../shared/WorkspaceTitle'

export const TaggingSummarySkeleton = defineComponent({
  name: 'TaggingSummarySkeleton',
  setup() {
    return () => (
      <div>
        <div class="workspace-heading">
          <div class="min-w-0 flex-1">
            <WorkspaceTitle>
              <Skeleton width="55%" height="1.75rem" />
            </WorkspaceTitle>
            <div class="mt-1.5">
              <Skeleton width="80%" height="1.5rem" />
            </div>
          </div>
          <div class="flex items-center gap-4.5">
            <div class="flex items-center gap-1">
              <Skeleton shape="circle" size="2.5rem" />
              <Skeleton shape="circle" size="2.5rem" />
            </div>
            <Skeleton width="7rem" height="2.5rem" />
          </div>
        </div>
        <div class="mt-3 -mx-1.5 -mb-1.5 flex items-center">
          {[1, 2, 3, 4].map(index => (
            <div key={index} class="p-1.5">
              <Skeleton width={index === 1 ? '2.5rem' : '1rem'} height="1.25rem" />
            </div>
          ))}
        </div>
      </div>
    )
  },
})
