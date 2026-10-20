import Skeleton from 'primevue/skeleton'
import { defineComponent } from 'vue'

export const SettingsPageSkeleton = defineComponent({
  name: 'SettingsPageSkeleton',
  setup() {
    return () => (
      <div class="settings-sections">
        <Skeleton height="10rem" />
        <Skeleton height="8rem" />
        <Skeleton height="12rem" />
      </div>
    )
  },
})
