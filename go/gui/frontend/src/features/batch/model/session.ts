import { computed, ref, shallowRef, type Ref } from 'vue'

import { getApi, type BatchPreview } from '../../../shared/api'
import { useBatchEntries } from './entries'

export type BatchActivity = 'selecting' | 'scanning' | 'updating'

export const useBatchSession = (writeLocked: Readonly<Ref<boolean>>) => {
  const preview = shallowRef<BatchPreview>()
  const activity = ref<BatchActivity>()
  const entries = useBatchEntries({ preview, activity, writeLocked })
  const isBusy = computed(
    () => Boolean(activity.value) || writeLocked.value || entries.resolvingCount.value > 0,
  )
  const readyCount = computed(
    () => preview.value?.entries.filter(entry => entry.readiness === 'ready').length ?? 0,
  )
  const retryableCount = computed(
    () =>
      preview.value?.entries.filter(
        entry => entry.readiness === 'ready' && entry.outcome === 'failed',
      ).length ?? 0,
  )
  const loadPending = () =>
    entries.loadEntries(
      preview.value?.entries
        .filter(entry => entry.readiness === 'pending')
        .map(entry => entry.id) ?? [],
    )
  const discard = async () => {
    if (preview.value) {
      await (await getApi()).discardBatch(preview.value.batchId)
    }
    preview.value = undefined
    entries.clear()
  }
  return {
    preview,
    activity,
    entries,
    isBusy,
    readyCount,
    retryableCount,
    loadPending,
    discard,
  }
}

export type BatchSession = ReturnType<typeof useBatchSession>
