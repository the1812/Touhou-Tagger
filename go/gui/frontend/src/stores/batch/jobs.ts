import { computed, shallowRef, type Ref, type ShallowRef } from 'vue'

import { getApi, type BatchJobPreview, type BatchPreview } from '../../api'
import { t } from '../../i18n'
import { useNotificationsStore } from '../notifications'

export const useBatchJobs = (state: {
  preview: ShallowRef<BatchPreview | undefined>
  activity: Readonly<Ref<'selecting' | 'scanning' | undefined>>
  writeLocked: Readonly<Ref<boolean>>
}) => {
  const resolving = shallowRef(new Map<string, string>())
  const notifications = useNotificationsStore()
  const resolvingCount = computed(() => resolving.value.size)
  const clear = () => (resolving.value = new Map())

  const updateJob = async (
    jobId: string,
    request: (batchId: string) => Promise<BatchJobPreview>,
    failureTitle: string,
    notifyFailure = true,
  ) => {
    const current = state.preview.value
    if (!current || state.activity.value || state.writeLocked.value || resolving.value.has(jobId)) {
      return
    }
    const { batchId } = current
    resolving.value = new Map(resolving.value).set(jobId, batchId)
    try {
      const updated = await request(batchId)
      if (state.preview.value?.batchId !== batchId || resolving.value.get(jobId) !== batchId) {
        return
      }
      state.preview.value = {
        ...state.preview.value,
        jobs: state.preview.value.jobs.map(job => (job.id === jobId ? updated : job)),
      }
    } catch (error) {
      if (state.preview.value?.batchId === batchId && resolving.value.get(jobId) === batchId) {
        const issues = [
          {
            code: 'load-failed',
            message: error instanceof Error ? error.message : String(error),
            severity: 'error' as const,
          },
        ]
        state.preview.value = {
          ...state.preview.value,
          jobs: state.preview.value.jobs.map(job =>
            job.id === jobId ? { ...job, readiness: 'blocked', issues } : job,
          ),
        }
        if (notifyFailure) {
          notifications.error(failureTitle, error)
        }
      }
    } finally {
      if (resolving.value.get(jobId) === batchId) {
        const next = new Map(resolving.value)
        next.delete(jobId)
        resolving.value = next
      }
    }
  }

  const loadJob = (jobId: string, notifyFailure = true) =>
    updateJob(
      jobId,
      batchId => getApi().then(api => api.loadBatchJob(batchId, jobId)),
      t('notifications.loadAlbumFailed'),
      notifyFailure,
    )
  const loadJobs = async (jobIds: string[]) => {
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < jobIds.length) {
        await loadJob(jobIds[nextIndex++], false)
      }
    }
    await Promise.all(Array.from({ length: Math.min(4, jobIds.length) }, worker))
  }
  const resolveCandidate = (jobId: string, candidateId: string) =>
    updateJob(
      jobId,
      batchId => getApi().then(api => api.resolveBatchCandidate(batchId, jobId, candidateId)),
      t('notifications.updateBatchCandidateFailed'),
    )

  return {
    resolvingCount,
    isResolving: (jobId: string) => resolving.value.has(jobId),
    clear,
    loadJob,
    loadJobs,
    resolveCandidate,
  }
}
