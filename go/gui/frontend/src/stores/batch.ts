import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  getApi,
  type BatchJobPreview,
  type BatchPreview,
  type BatchRunResult,
  type OperationFailure,
  type OperationResult,
} from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'
import { useOperationsStore } from './operations'
import { useSettingsStore } from './settings'

export const useBatchStore = defineStore('batch', () => {
  const loadConcurrency = 4
  const directory = ref('')
  const depth = ref(1)
  const source = ref('thb-wiki')
  const preview = ref<BatchPreview>()
  const selecting = ref(false)
  const scanning = ref(false)
  const result = ref<BatchRunResult>()
  const resolvingJobIds = ref(new Set<string>())
  const notifications = useNotificationsStore()
  const operations = useOperationsStore()
  const settings = useSettingsStore()
  let contextVersion = 0
  let resolveSequence = 0
  const resolveTokens = new Map<string, number>()
  const operation = computed(() => operations.get('batch'))
  const defaultSource = () => settings.saved?.defaultSource ?? 'thb-wiki'

  const unresolvedCount = computed(
    () =>
      preview.value?.jobs.filter(job =>
        ['loading', 'needs-candidate', 'track-mismatch', 'scan-failed'].includes(job.status),
      ).length ?? 0,
  )
  const readyCount = computed(
    () =>
      preview.value?.jobs.filter(job => ['ready', 'local-metadata'].includes(job.status)).length ??
      0,
  )
  const failedCount = computed(
    () => preview.value?.jobs.filter(job => job.status === 'failed').length ?? 0,
  )
  const resolvingCount = computed(() => resolvingJobIds.value.size)
  const canRun = computed(() =>
    Boolean(
      preview.value &&
      depth.value === preview.value.depth &&
      readyCount.value > 0 &&
      unresolvedCount.value === 0 &&
      resolvingCount.value === 0 &&
      !selecting.value &&
      !scanning.value &&
      !operation.value,
    ),
  )

  const discardCurrentPreview = async () => {
    const batchId = preview.value?.batchId
    preview.value = undefined
    result.value = undefined
    resolvingJobIds.value.clear()
    resolveTokens.clear()
    if (!batchId) {
      return
    }
    try {
      const api = await getApi()
      await api.discardBatch(batchId)
    } catch (error) {
      notifications.error(t('notifications.discardBatchFailed'), error)
    }
  }

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
      operation.value ||
      resolvingJobIds.value.has(jobId)
    ) {
      return
    }
    const requestVersion = contextVersion
    const { batchId } = preview.value
    resolveSequence += 1
    const resolveToken = resolveSequence
    resolveTokens.set(jobId, resolveToken)
    resolvingJobIds.value.add(jobId)
    try {
      const api = await getApi()
      const updated = await request(api, batchId)
      if (
        requestVersion !== contextVersion ||
        preview.value?.batchId !== batchId ||
        resolveTokens.get(jobId) !== resolveToken
      ) {
        return
      }
      const index = preview.value.jobs.findIndex(job => job.id === jobId)
      if (index >= 0) {
        preview.value.jobs[index] = updated
      }
    } catch (error) {
      if (requestVersion === contextVersion && resolveTokens.get(jobId) === resolveToken) {
        const job = preview.value?.jobs.find(item => item.id === jobId)
        if (job) {
          const message = error instanceof Error ? error.message : String(error)
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
      operation.value ||
      resolvingJobIds.value.has(jobId)
    ) {
      return
    }
    job.status = 'loading'
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

  const scan = async () => {
    if (
      !directory.value ||
      selecting.value ||
      scanning.value ||
      resolvingCount.value > 0 ||
      operation.value
    ) {
      return
    }
    contextVersion += 1
    const requestVersion = contextVersion
    scanning.value = true
    try {
      await discardCurrentPreview()
      if (requestVersion !== contextVersion) {
        return
      }
      source.value = defaultSource()
      const api = await getApi()
      const nextPreview = await api.scanBatch(directory.value, depth.value, source.value)
      if (requestVersion !== contextVersion) {
        return
      }
      preview.value = nextPreview
      result.value = undefined
      scanning.value = false
      loadJobs(nextPreview.jobs.filter(job => job.status === 'loading').map(job => job.id))
    } catch (error) {
      if (requestVersion !== contextVersion) {
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
      operation.value
    ) {
      return
    }
    depth.value = value
    await scan()
  }

  const selectDirectory = async () => {
    if (selecting.value || scanning.value || operation.value || resolvingCount.value > 0) {
      return
    }
    selecting.value = true
    let shouldScan = false
    try {
      const api = await getApi()
      const selected = await api.selectBatchDirectory(t('batch.selectDirectoryDialog'))
      if (selected) {
        contextVersion += 1
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

  const ignoreJob = (jobId: string) =>
    updateJob(
      jobId,
      (api, batchId) => api.ignoreBatchJob(batchId, jobId),
      t('notifications.ignoreBatchAlbumFailed'),
    )

  function receiveComplete(nextResult: OperationResult | BatchRunResult) {
    if (nextResult.kind !== 'batch') {
      return
    }
    if ('jobs' in nextResult) {
      result.value = nextResult
      if (preview.value) {
        preview.value.jobs = nextResult.jobs
      }
    } else {
      result.value = { ...nextResult, jobs: preview.value?.jobs ?? [] }
    }
    if (nextResult.failed > 0) {
      const failedJobs = result.value?.jobs.filter(job => job.status === 'failed') ?? []
      notifications.error(
        t('notifications.batchCompletedWithFailures'),
        t('notifications.batchCompletedWithFailuresDetail', { count: nextResult.failed }),
        {
          sticky: true,
          diagnostics: failedJobs
            .map(job => `${job.relativePath}: ${job.issues.map(issue => issue.message).join('；')}`)
            .join('\n'),
        },
      )
    }
  }

  function receiveFailure(failure: OperationFailure) {
    if (failure.kind !== 'batch') {
      return
    }
    notifications.error(t('notifications.batchWriteFailed'), failure.message, {
      sticky: true,
      diagnostics: failure.details,
    })
  }

  const run = async (failedOnly = false) => {
    if (
      !preview.value ||
      selecting.value ||
      scanning.value ||
      resolvingCount.value > 0 ||
      operation.value ||
      (failedOnly ? failedCount.value === 0 : !canRun.value)
    ) {
      return
    }
    const currentPreview = preview.value
    let reservedOperationId = ''
    try {
      const api = await getApi()
      const started = await api.runBatch(currentPreview.batchId, failedOnly)
      reservedOperationId = started.operationId
      operations.begin(
        {
          operationId: started.operationId,
          kind: 'batch',
          stage: 'preparing',
          current: 0,
          total: failedOnly ? failedCount.value : readyCount.value,
          message: t('notifications.preparingBatchWrite'),
          cancellable: true,
        },
        {
          complete: receiveComplete,
          failure: receiveFailure,
        },
      )
      result.value = undefined
      await api.startBatch(started.operationId)
    } catch (error) {
      operations.release(reservedOperationId)
      let cleanupDetails = ''
      if (reservedOperationId) {
        try {
          const api = await getApi()
          await api.cancelBatch(reservedOperationId)
          await discardCurrentPreview()
        } catch (cleanupError) {
          cleanupDetails =
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }
      }
      notifications.error(t('notifications.startBatchFailed'), error, {
        sticky: true,
        diagnostics: cleanupDetails || undefined,
      })
    }
  }

  const cancel = async () => {
    if (!operation.value) {
      return
    }
    try {
      const api = await getApi()
      await api.cancelBatch(operation.value.operationId)
    } catch (error) {
      notifications.error(t('notifications.cancelBatchFailed'), error)
    }
  }

  const reveal = async () => {
    if (!directory.value) {
      return
    }
    try {
      const api = await getApi()
      await api.revealDirectory(directory.value)
    } catch (error) {
      notifications.error(t('notifications.revealDirectoryFailed'), error)
    }
  }

  const startOver = async () => {
    if (selecting.value || scanning.value || resolvingCount.value > 0 || operation.value) {
      return
    }
    contextVersion += 1
    await discardCurrentPreview()
    directory.value = ''
    source.value = defaultSource()
  }

  const isResolving = (jobId: string) => resolvingJobIds.value.has(jobId)

  return {
    directory,
    depth,
    preview,
    selecting,
    scanning,
    operation,
    result,
    unresolvedCount,
    readyCount,
    failedCount,
    resolvingCount,
    canRun,
    setDepth,
    selectDirectory,
    scan,
    loadJob,
    resolveCandidate,
    ignoreJob,
    isResolving,
    run,
    cancel,
    reveal,
    startOver,
  }
})
