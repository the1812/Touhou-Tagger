import { getApi, type BatchRunResult, type OperationFailure, type OperationResult } from '../api'
import { t } from '../i18n'
import type { BatchContext } from './batchContext'

export const createBatchWriting = (context: BatchContext) => {
  const {
    preview,
    result,
    failure,
    resultOpen,
    selecting,
    scanning,
    resolvingCount,
    isWriting,
    retryableCount,
    canRun,
    starting,
    operations,
    readyCount,
    notifications,
    operation,
    directory,
    contextVersion,
    discardCurrentPreview,
    source,
    defaultSource,
  } = context
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
    failure.value = undefined
    resultOpen.value = true
  }

  function receiveFailure(nextFailure: OperationFailure) {
    if (nextFailure.kind !== 'batch') {
      return
    }
    failure.value = nextFailure
    result.value = undefined
    resultOpen.value = true
  }

  const run = async (failedOnly = false) => {
    if (
      !preview.value ||
      selecting.value ||
      scanning.value ||
      resolvingCount.value > 0 ||
      isWriting.value ||
      (failedOnly ? retryableCount.value === 0 : !canRun.value)
    ) {
      return
    }
    starting.value = true
    resultOpen.value = false
    failure.value = undefined
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
          total: failedOnly ? retryableCount.value : readyCount.value,
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
    } finally {
      starting.value = false
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
    if (selecting.value || scanning.value || resolvingCount.value > 0 || isWriting.value) {
      return
    }
    contextVersion.value += 1
    await discardCurrentPreview()
    directory.value = ''
    source.value = defaultSource()
  }

  return { run, cancel, reveal, startOver }
}
