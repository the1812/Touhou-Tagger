import { getApi, type BatchRunResult, type OperationFailure, type OperationResult } from '../api'
import { t } from '../i18n'
import type { WorkspaceContext } from './workspaceContext'

export const createWorkspaceWriting = (context: WorkspaceContext) => {
  const {
    result,
    failure,
    resultOpen,
    plan,
    phase,
    canCommit,
    starting,
    operations,
    notifications,
    operation,
    directory,
  } = context
  function receiveComplete(completion: OperationResult | BatchRunResult) {
    if (completion.kind !== 'workspace') {
      return
    }
    result.value = completion
    failure.value = undefined
    resultOpen.value = true
    plan.value = completion.plan ?? plan.value
    phase.value = plan.value ? 'ready' : 'failed'
  }

  function receiveFailure(nextFailure: OperationFailure) {
    if (nextFailure.kind !== 'workspace') {
      return
    }
    plan.value = nextFailure.plan ?? plan.value
    failure.value = nextFailure
    result.value = undefined
    resultOpen.value = true
    phase.value = nextFailure.planInvalidated || !plan.value ? 'failed' : 'ready'
  }

  const commit = async () => {
    if (!canCommit.value || !plan.value) {
      return
    }
    starting.value = true
    resultOpen.value = false
    failure.value = undefined
    const currentPlan = plan.value
    let reservedOperationId = ''
    result.value = undefined
    try {
      const api = await getApi()
      const started = await api.commitPlan(currentPlan.planId, currentPlan.revision)
      reservedOperationId = started.operationId
      operations.begin(
        {
          operationId: started.operationId,
          kind: 'workspace',
          stage: 'preparing',
          current: 0,
          total: currentPlan.items.length,
          message: t('notifications.preparingWrite'),
          cancellable: true,
        },
        {
          complete: receiveComplete,
          failure: receiveFailure,
        },
      )
      await api.startOperation(started.operationId)
    } catch (error) {
      operations.release(reservedOperationId)
      let cleanupDetails = ''
      if (reservedOperationId) {
        try {
          const api = await getApi()
          await api.cancelOperation(reservedOperationId)
        } catch (cleanupError) {
          cleanupDetails =
            cleanupError instanceof Error ? cleanupError.message : String(cleanupError)
        }
      }
      notifications.error(t('notifications.startWriteFailed'), error, {
        sticky: true,
        diagnostics: cleanupDetails || undefined,
      })
    } finally {
      starting.value = false
    }
  }

  const cancel = async () => {
    if (!operation.value?.cancellable) {
      return
    }
    try {
      const api = await getApi()
      await api.cancelOperation(operation.value.operationId)
    } catch (error) {
      notifications.error(t('notifications.cancelWriteFailed'), error)
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

  return { commit, cancel, reveal }
}
