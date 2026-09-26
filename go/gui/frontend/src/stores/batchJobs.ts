import { unref } from 'vue'

import { getApi, type BatchJobPreview } from '../api'
import { t } from '../i18n'
import type { BatchContext } from './batchContext'

export const createBatchJobs = (context: BatchContext) => {
  const loadConcurrency = 4
  const {
    preview,
    selecting,
    scanning,
    isWriting,
    resolvingJobIds,
    contextVersion,
    resolveSequence,
    resolveTokens,
    notifications,
  } = context
  const updateJob = async (
    jobId: string,
    request: (api: Awaited<ReturnType<typeof getApi>>, batchId: string) => Promise<BatchJobPreview>,
    failureTitle: string,
    notifyFailure = true,
  ) => {
    if (
      !preview.value ||
      selecting.value ||
      scanning.value ||
      isWriting.value ||
      resolvingJobIds.value.has(jobId)
    ) {
      return
    }
    const requestVersion = contextVersion.value
    const { batchId } = preview.value
    resolveSequence.value += 1
    const resolveToken = resolveSequence.value
    resolveTokens.set(jobId, resolveToken)
    resolvingJobIds.value.add(jobId)
    try {
      const api = await getApi()
      const updated = await request(api, batchId)
      if (
        requestVersion !== contextVersion.value ||
        unref(preview)?.batchId !== batchId ||
        resolveTokens.get(jobId) !== resolveToken
      ) {
        return
      }
      const index = preview.value.jobs.findIndex(job => job.id === jobId)
      if (index >= 0) {
        preview.value.jobs[index] = updated
      }
    } catch (error) {
      if (requestVersion === contextVersion.value && resolveTokens.get(jobId) === resolveToken) {
        const job = unref(preview)?.jobs.find(item => item.id === jobId)
        if (job) {
          const message = error instanceof Error ? error.message : String(error)
          job.canRun = false
          job.status = 'scan-failed'
          job.matchDescription = t('batch.loadFailed')
          job.issues = [{ code: 'load-failed', message, severity: 'error' }]
        }
        if (notifyFailure) {
          notifications.error(failureTitle, error)
        }
      }
    } finally {
      if (resolveTokens.get(jobId) === resolveToken) {
        resolveTokens.delete(jobId)
        resolvingJobIds.value.delete(jobId)
      }
    }
  }

  const loadJob = async (jobId: string, notifyFailure = true) => {
    const job = preview.value?.jobs.find(item => item.id === jobId)
    if (
      !job ||
      selecting.value ||
      scanning.value ||
      isWriting.value ||
      resolvingJobIds.value.has(jobId)
    ) {
      return
    }
    job.status = 'loading'
    job.canRun = false
    job.matchDescription = t('batch.loading')
    job.issues = []
    await updateJob(
      jobId,
      (api, batchId) => api.loadBatchJob(batchId, jobId),
      t('notifications.loadAlbumFailed'),
      notifyFailure,
    )
  }

  async function loadJobs(jobIds: string[]) {
    let nextIndex = 0
    const worker = async () => {
      while (nextIndex < jobIds.length) {
        const jobId = jobIds[nextIndex]
        nextIndex += 1
        await loadJob(jobId, false)
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(loadConcurrency, jobIds.length) }, () => worker()),
    )
  }

  return { updateJob, loadJob, loadJobs }
}
