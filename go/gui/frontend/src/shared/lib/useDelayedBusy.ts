import { ref, watch } from 'vue'

export const useDelayedBusy = (busy: () => boolean) => {
  const visible = ref(false)
  watch(
    busy,
    (active, _previous, onCleanup) => {
      visible.value = false
      if (active) {
        const timer = window.setTimeout(() => {
          visible.value = true
        }, 200)
        onCleanup(() => window.clearTimeout(timer))
      }
    },
    { immediate: true },
  )
  return visible
}
