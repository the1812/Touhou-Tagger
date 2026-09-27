import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import type {
  OperationFailure,
  OperationKind,
  OperationProgress,
  OperationResult,
  OperationStart,
} from '../api'
import { t } from '../i18n'
import { useNotificationsStore } from './notifications'

interface OperationHandlers {
  complete(result: OperationResult): void
  failure(failure: OperationFailure): void
}

export interface OperationRunConfig extends OperationHandlers {
  kind: OperationKind
  reserve(): Promise<OperationStart>
  start(operationId: string): Promise<void>
  cancel(operationId: string): Promise<void>
  initial(start: OperationStart): OperationProgress
  onStartFailure?(): void
}

interface ActiveOperation {
  kind: OperationKind
  operationId?: string
  progress?: OperationProgress
  cancel(operationId: string): Promise<void>
}

const operationFailureTitle = (kind: OperationKind, action: 'start' | 'cancel') =>
  t(`notifications.${action}${kind === 'workspace' ? 'Write' : 'Batch'}Failed`)

export const useOperationsStore = defineStore('operations', () => {
  const active = shallowRef<ActiveOperation>()
  const notifications = useNotificationsStore()
  let handlers: OperationHandlers | undefined

  const operation = computed(() => active.value?.progress)
  const activeKind = computed(() => active.value?.kind)
  const isActive = computed(() => active.value !== undefined)

  const cancel = async () => {
    const current = active.value
    if (!current?.operationId || !current.progress?.cancellable) {
      return
    }
    try {
      await current.cancel(current.operationId)
    } catch (error) {
      notifications.error(operationFailureTitle(current.kind, 'cancel'), error)
    }
  }

  const run = async (config: OperationRunConfig) => {
    if (active.value) {
      return
    }
    active.value = { kind: config.kind, cancel: config.cancel }
    let started: OperationStart
    try {
      started = await config.reserve()
    } catch (error) {
      active.value = undefined
      notifications.error(operationFailureTitle(config.kind, 'start'), error)
      return
    }

    const { operationId } = started
    active.value = {
      kind: config.kind,
      operationId,
      progress: config.initial(started),
      cancel: config.cancel,
    }
    handlers = { complete: config.complete, failure: config.failure }
    try {
      await config.start(operationId)
    } catch (error) {
      config.onStartFailure?.()
      notifications.error(operationFailureTitle(config.kind, 'start'), error)
      await cancel()
    }
  }

  const receiveProgress = (progress: OperationProgress) => {
    if (active.value?.operationId === progress.operationId) {
      active.value = { ...active.value, progress }
    }
  }

  const receiveComplete = (result: OperationResult) => {
    const currentHandlers = handlers
    if (!currentHandlers || active.value?.operationId !== result.operationId) {
      return
    }
    active.value = undefined
    handlers = undefined
    currentHandlers.complete(result)
  }

  const receiveFailure = (failure: OperationFailure) => {
    const currentHandlers = handlers
    if (!currentHandlers || active.value?.operationId !== failure.operationId) {
      return
    }
    active.value = undefined
    handlers = undefined
    currentHandlers.failure(failure)
  }

  return {
    operation,
    activeKind,
    isActive,
    run,
    cancel,
    receiveProgress,
    receiveComplete,
    receiveFailure,
  }
})
