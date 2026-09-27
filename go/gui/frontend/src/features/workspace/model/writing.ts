import { ref, type ComputedRef, type Ref } from 'vue'

import { useNotificationsStore, useOperationsStore } from '../../../entities/session'
import {
  getApi,
  type OperationFailure,
  type OperationResult,
  type PlanPreview,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'

export type WorkspaceCompletion =
  | { kind: 'result'; result: Extract<OperationResult, { kind: 'workspace' }> }
  | { kind: 'failure'; failure: OperationFailure }

export const useWorkspaceWriting = (state: {
  plan: Ref<PlanPreview | undefined>
  stalePlan: Ref<boolean>
  directory: Ref<string>
  canCommit: ComputedRef<boolean>
}) => {
  const { plan, stalePlan, directory } = state
  const operations = useOperationsStore()
  const notifications = useNotificationsStore()
  const completion = ref<WorkspaceCompletion>()

  const complete = (result: OperationResult) => {
    if (result.kind !== 'workspace') {
      return
    }
    if (result.plan) {
      plan.value = result.plan
      stalePlan.value = false
    }
    completion.value = { kind: 'result', result }
  }

  const fail = (failure: OperationFailure) => {
    if (failure.kind !== 'workspace') {
      return
    }
    if (failure.plan) {
      plan.value = failure.plan
    }
    stalePlan.value = failure.planInvalidated || !plan.value
    completion.value = { kind: 'failure', failure }
  }

  const commit = async () => {
    const current = plan.value
    if (!state.canCommit.value || !current) {
      return
    }
    completion.value = undefined
    await operations.run({
      kind: 'workspace',
      reserve: async () => (await getApi()).commitPlan(current.planId, current.revision),
      start: async id => (await getApi()).startOperation(id),
      cancel: async id => (await getApi()).cancelOperation(id),
      initial: started => ({
        operationId: started.operationId,
        kind: 'workspace',
        stage: 'preparing',
        current: 0,
        total: current.items.length,
        message: t('notifications.preparingWrite'),
        cancellable: true,
      }),
      onStartFailure: () => (stalePlan.value = true),
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
    completion,
    commit,
    cancel: operations.cancel,
    reveal,
    closeCompletion: () => (completion.value = undefined),
  }
}
