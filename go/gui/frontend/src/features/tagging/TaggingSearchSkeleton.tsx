import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

export const TaggingSearchSkeleton = defineComponent({
  name: 'TaggingSearchSkeleton',
  setup() {
    return () => (
      <div class="mt-4 grid gap-2">
        {[1, 2, 3].map(index => (
          <Skeleton key={index} height="3.25rem" />
        ))}
      </div>
    )
  },
})
