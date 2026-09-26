import { getApi } from '../api'
import { t } from '../i18n'
import type { BatchContext } from './batchContext'
import type { createBatchJobs } from './batchJobs'

export const createBatchDiscovery = (
  context: BatchContext,
  jobs: ReturnType<typeof createBatchJobs>,
) => {
  const {
    directory,
    depth,
    source,
    preview,
    selecting,
    scanning,
    result,
    resolvingCount,
    isWriting,
    contextVersion,
    defaultSource,
    discardCurrentPreview,
    notifications,
  } = context
  const { updateJob, loadJobs } = jobs
  const scan = async () => {
    if (
      !directory.value ||
      selecting.value ||
      scanning.value ||
      resolvingCount.value > 0 ||
      isWriting.value
    ) {
      return
    }
    contextVersion.value += 1
    const requestVersion = contextVersion.value
    scanning.value = true
    try {
      await discardCurrentPreview()
      if (requestVersion !== contextVersion.value) {
        return
      }
      source.value = defaultSource()
      const api = await getApi()
      const nextPreview = await api.scanBatch(directory.value, depth.value, source.value)
      if (requestVersion !== contextVersion.value) {
        return
      }
      preview.value = nextPreview
      result.value = undefined
      scanning.value = false
      void loadJobs(nextPreview.jobs.filter(job => job.status === 'loading').map(job => job.id))
    } catch (error) {
      if (requestVersion !== contextVersion.value) {
        return
      }
      notifications.error(t('notifications.scanBatchFailed'), error)
    } finally {
      scanning.value = false
    }
  }

  const setDepth = async (value: number | null) => {
    if (
      value === null ||
      value === depth.value ||
      selecting.value ||
      scanning.value ||
      resolvingCount.value > 0 ||
      isWriting.value
    ) {
      return
    }
    depth.value = value
    await scan()
  }

  const selectDirectory = async (targetDirectory?: string) => {
    if (selecting.value || scanning.value || isWriting.value || resolvingCount.value > 0) {
      return
    }
    selecting.value = true
    let shouldScan = false
    try {
      const api = await getApi()
      const selected =
        targetDirectory ?? (await api.selectBatchDirectory(t('batch.selectDirectoryDialog')))
      if (selected) {
        contextVersion.value += 1
        await discardCurrentPreview()
        source.value = defaultSource()
        directory.value = selected
        shouldScan = true
      }
    } catch (error) {
      notifications.error(t('notifications.selectBatchDirectoryFailed'), error)
    } finally {
      selecting.value = false
    }
    if (shouldScan) {
      await scan()
    }
  }

  const resolveCandidate = (jobId: string, candidateId: string) =>
    updateJob(
      jobId,
      (api, batchId) => api.resolveBatchCandidate(batchId, jobId, candidateId),
      t('notifications.updateBatchCandidateFailed'),
    )

  return { scan, setDepth, selectDirectory, resolveCandidate }
}
