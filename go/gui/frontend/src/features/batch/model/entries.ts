import { computed, shallowRef, type Ref, type ShallowRef } from 'vue'

import { useNotificationsStore } from '../../../entities/session'
import { getApi, type BatchEntryPreview, type BatchPreview } from '../../../shared/api'
import { t } from '../../../shared/i18n'

export const useBatchEntries = (state: {
  preview: ShallowRef<BatchPreview | undefined>
  activity: Readonly<Ref<'selecting' | 'scanning' | undefined>>
  writeLocked: Readonly<Ref<boolean>>
}) => {
  const resolving = shallowRef(new Set<string>())
  const notifications = useNotificationsStore()
  const resolvingCount = computed(() => resolving.value.size)
  const clear = () => (resolving.value = new Set())

  const updateEntry = async (
    entryId: string,
    request: (batchId: string) => Promise<BatchEntryPreview>,
    failureTitle: string,
    notifyFailure = true,
  ) => {
    const current = state.preview.value
    if (
      !current ||
      state.activity.value ||
      state.writeLocked.value ||
      resolving.value.has(entryId)
    ) {
      return
    }
    const { batchId } = current
    resolving.value = new Set(resolving.value).add(entryId)
    try {
      const updated = await request(batchId)
      const preview = state.preview.value as BatchPreview
      state.preview.value = {
        ...preview,
        entries: preview.entries.map(entry => (entry.id === entryId ? updated : entry)),
      }
    } catch (error) {
      const preview = state.preview.value as BatchPreview
      const issues = [
        {
          code: 'load-failed',
          message: error instanceof Error ? error.message : String(error),
          severity: 'error' as const,
        },
      ]
      state.preview.value = {
        ...preview,
        entries: preview.entries.map(entry =>
          entry.id === entryId ? { ...entry, readiness: 'blocked', issues } : entry,
        ),
      }
      if (notifyFailure) {
        notifications.error(failureTitle, error)
      }
    } finally {
      const next = new Set(resolving.value)
      next.delete(entryId)
      resolving.value = next
    }
  }

  const loadEntry = (entryId: string, notifyFailure = true) =>
    updateEntry(
      entryId,
      batchId => getApi().then(api => api.loadBatchEntry(batchId, entryId)),
      t('notifications.loadAlbumFailed'),
      notifyFailure,
    )
  const loadEntries = async (entryIds: string[]) => {
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < entryIds.length) {
        await loadEntry(entryIds[nextIndex++], false)
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, entryIds.length) }, worker))
  }
  const resolveCandidate = (entryId: string, candidateId: string) =>
    updateEntry(
      entryId,
      batchId => getApi().then(api => api.resolveBatchCandidate(batchId, entryId, candidateId)),
      t('notifications.updateBatchCandidateFailed'),
    )

  return {
    resolvingCount,
    isResolving: (entryId: string) => resolving.value.has(entryId),
    clear,
    loadEntry,
    loadEntries,
    resolveCandidate,
  }
}
