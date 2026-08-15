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
import { useNotificationsStore } from './notifications'
import { useOperationsStore } from './operations'
import { useSettingsStore } from './settings'

export const useBatchStore = defineStore('batch', () => {
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
        ['needs-candidate', 'track-mismatch', 'scan-failed'].includes(job.status),
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
      notifications.error('释放旧批量扫描结果失败', error)
    }
  }

  const setDepth = (value: number | null) => {
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
      const processFailures = preview.value.jobs.filter(job => job.status === 'scan-failed')
      if (processFailures.length) {
        notifications.error(
          '部分专辑扫描失败',
          `${processFailures.length} 个目录未能完成扫描或匹配，详情已保留在对应专辑行。`,
          {
            diagnostics: processFailures
              .map(
                job => `${job.relativePath}: ${job.issues.map(issue => issue.message).join('；')}`,
              )
              .join('\n'),
          },
        )
      }
    } catch (error) {
      if (requestVersion !== contextVersion) {
        return
      }
      notifications.error('批量扫描失败', error)
    } finally {
      scanning.value = false
    }
  }

  const selectDirectory = async () => {
    if (selecting.value || scanning.value || operation.value || resolvingCount.value > 0) {
      return
    }
    selecting.value = true
    let shouldScan = false
    try {
      const api = await getApi()
      const selected = await api.selectBatchDirectory()
      if (selected) {
        contextVersion += 1
        await discardCurrentPreview()
        source.value = defaultSource()
        directory.value = selected
        shouldScan = true
      }
    } catch (error) {
      notifications.error('无法选择批量写入根目录', error)
    } finally {
      selecting.value = false
    }
    if (shouldScan) {
      await scan()
    }
  }

  const updateJob = async (
    jobId: string,
    request: (api: Awaited<ReturnType<typeof getApi>>, batchId: string) => Promise<BatchJobPreview>,
    failureTitle: string,
  ) => {
    if (
      !preview.value ||
      selecting.value ||
      scanning.value ||
      operation.value ||
      resolvingCount.value > 0
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
        notifications.error(failureTitle, error)
      }
    } finally {
      if (resolveTokens.get(jobId) === resolveToken) {
        resolveTokens.delete(jobId)
        resolvingJobIds.value.delete(jobId)
      }
    }
  }

  const resolveCandidate = (jobId: string, candidateId: string) =>
    updateJob(
      jobId,
      (api, batchId) => api.resolveBatchCandidate(batchId, jobId, candidateId),
      '无法更新专辑搜索结果',
    )

  const ignoreJob = (jobId: string) =>
    updateJob(jobId, (api, batchId) => api.ignoreBatchJob(batchId, jobId), '无法忽略批量写入专辑')

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
        '批量写入完成，但有专辑失败',
        `${nextResult.failed} 个专辑未能完成，详情已保留在专辑列表中。`,
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
    notifications.error('批量写入过程失败', failure.message, {
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
          message: '正在准备批量写入',
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
      notifications.error('无法开始批量写入', error, {
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
      notifications.error('停止批量写入失败', error)
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
      notifications.error('无法在资源管理器中打开目录', error)
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
    resolveCandidate,
    ignoreJob,
    isResolving,
    run,
    cancel,
    reveal,
    startOver,
  }
})
