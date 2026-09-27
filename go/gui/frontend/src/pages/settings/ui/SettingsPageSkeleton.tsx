import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

export const SettingsPageSkeleton = defineComponent({
  name: 'SettingsPageSkeleton',
  setup() {
    return () => (
      <div class={['grid h-full w-full max-w-app-settings gap-4', 'px-app-page-x py-app-page-y']}>
        <Skeleton height="10rem" />
        <Skeleton height="8rem" />
        <Skeleton height="12rem" />
      </div>
    )
  },
})
