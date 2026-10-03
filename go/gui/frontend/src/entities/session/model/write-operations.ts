import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import {
  errorInfo,
  type WriteOperationFailure,
  type WriteOperationKind,
  type WriteOperationProgress,
  type WriteOperationResult,
} from '../../../shared/api'
import { t } from '../../../shared/i18n'
import { useNotificationsStore } from './notifications'

export interface WriteOperationRunConfig<Result extends WriteOperationResult> {
  kind: WriteOperationKind
  execute(operationId: string): Promise<Result>
  cancel(operationId: string): Promise<void>
  initial(operationId: string): WriteOperationProgress
  complete(result: Result): void
  failure(failure: WriteOperationFailure): void
}

interface ActiveWriteOperation {
  kind: WriteOperationKind
  operationId: string
  progress: WriteOperationProgress
  cancel(operationId: string): Promise<void>
}

export const useWriteOperationsStore = defineStore('write-operations', () => {
  const active = shallowRef<ActiveWriteOperation>()
  const notifications = useNotificationsStore()
  const operation = computed(() => active.value?.progress)
  const activeKind = computed(() => active.value?.kind)
  const isActive = computed(() => active.value !== undefined)

  const cancel = async () => {
    const current = active.value
    if (!current?.progress.cancellable) {
      return
    }
    try {
      await current.cancel(current.operationId)
    } catch (error) {
      notifications.error(
        t(`notifications.cancel${current.kind === 'workspace' ? 'Write' : 'Batch'}Failed`),
        error,
      )
    }
  }

  const run = async <Result extends WriteOperationResult>(
    config: WriteOperationRunConfig<Result>,
  ) => {
    if (active.value) {
      return
    }
    const operationId = crypto.randomUUID()
    active.value = {
      kind: config.kind,
      operationId,
      progress: config.initial(operationId),
      cancel: config.cancel,
    }
    try {
      config.complete(await config.execute(operationId))
    } catch (error) {
      const info = errorInfo(error)
      config.failure({
        operationId,
        kind: config.kind,
        error: info,
        message: info.message,
        details: info.details,
        plan: info.plan,
        planInvalidated: info.planInvalidated ?? false,
      })
    } finally {
      active.value = undefined
    }
  }

  const receiveProgress = (progress: WriteOperationProgress) => {
    if (active.value?.operationId === progress.operationId) {
      active.value = { ...active.value, progress }
    }
  }

  return { operation, activeKind, isActive, run, cancel, receiveProgress }
})
