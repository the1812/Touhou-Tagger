import type { ComputedRef, Ref } from 'vue'

import { useNotificationsStore, useWriteOperationsStore } from '../../../entities/session'
import {
  getApi,
  type WriteOperationFailure,
  type WorkspaceWriteOperationResult,
  type PlanPreview,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

export const useWorkspaceWriting = (state: {
  plan: Ref<PlanPreview | undefined>
  stalePlan: Ref<boolean>
  directory: Ref<string>
  canExecute: ComputedRef<boolean>
}) => {
  const { plan, stalePlan, directory } = state
  const operations = useWriteOperationsStore()
  const notifications = useNotificationsStore()

  const complete = (result: WorkspaceWriteOperationResult) => {
    if (result.plan) {
      plan.value = result.plan
      stalePlan.value = false
    }
    notifications.complete(result, directory.value)
  }

  const fail = (failure: WriteOperationFailure) => {
    if (failure.plan) {
      plan.value = failure.plan
    }
    stalePlan.value = !failure.plan
    notifications.error(t('notifications.writeFailed'), failure.error ?? failure, {
      diagnostics: failure.details,
      directory: directory.value,
    })
  }

  const execute = async () => {
    const current = plan.value
    if (!state.canExecute.value || !current) {
      return
    }
    await operations.run({
      kind: 'workspace',
      execute: async id => (await getApi()).executePlan(current.planId, id),
      cancel: async id => (await getApi()).cancelWriteOperation(id),
      initial: operationId => ({
        operationId,
        kind: 'workspace',
        stage: 'preparing',
        current: 0,
        total: current.items.length,
        message: t('notifications.preparingWrite'),
        cancellable: false,
      }),
      complete,
      failure: fail,
    })
  }

  const reveal = async () => {
    if (directory.value) {
      try {
        await (await getApi()).revealDirectory(directory.value)
      } catch (error) {
        notifications.error(t('notifications.revealDirectoryFailed'), error)
      }
    }
  }

  return {
    execute,
    cancel: operations.cancel,
    reveal,
  }
}
