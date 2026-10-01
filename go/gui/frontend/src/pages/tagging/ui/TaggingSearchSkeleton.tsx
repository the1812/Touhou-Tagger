import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

export const TaggingSearchSkeleton = defineComponent({
  name: 'TaggingSearchSkeleton',
  props: { showCover: Boolean },
  setup(props) {
    return () => (
      <div class="mt-4 grid gap-2">
        {[1, 2, 3].map(index => (
          <Skeleton key={index} height={props.showCover ? '5.5rem' : '4.5rem'} />
        ))}
      </div>
    )
  },
})
