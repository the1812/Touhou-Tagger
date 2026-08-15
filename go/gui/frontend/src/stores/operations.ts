import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type {
  BatchRunResult,
  OperationFailure,
  OperationKind,
  OperationProgress,
  OperationResult,
} from '../api'

type CompletionResult = OperationResult | BatchRunResult

interface OperationHandlers {
  complete(result: CompletionResult): void
  failure(failure: OperationFailure): void
}

export const useOperationsStore = defineStore('operations', () => {
  const active = ref<Partial<Record<OperationKind, OperationProgress>>>({})
  const handlers = new Map<string, OperationHandlers>()

  const current = computed(() => active.value.workspace ?? active.value.batch)

  const get = (kind: OperationKind) => active.value[kind]

  const begin = (operation: OperationProgress, callbacks: OperationHandlers) => {
    active.value = { ...active.value, [operation.kind]: operation }
    handlers.set(operation.operationId, callbacks)
  }

  const release = (operationId: string) => {
    const operation = Object.values(active.value).find(item => item?.operationId === operationId)
    if (operation) {
      const next = { ...active.value }
      delete next[operation.kind]
      active.value = next
    }
    handlers.delete(operationId)
  }

  const receiveProgress = (progress: OperationProgress) => {
    if (!handlers.has(progress.operationId)) {
      return
    }
    active.value = { ...active.value, [progress.kind]: progress }
  }

  const receiveComplete = (result: CompletionResult) => {
    const callbacks = handlers.get(result.operationId)
    if (!callbacks) {
      return
    }
    release(result.operationId)
    callbacks.complete(result)
  }

  const receiveFailure = (failure: OperationFailure) => {
    const callbacks = handlers.get(failure.operationId)
    if (!callbacks) {
      return
    }
    release(failure.operationId)
    callbacks.failure(failure)
  }

  return {
    current,
    get,
    begin,
    release,
    receiveProgress,
    receiveComplete,
    receiveFailure,
  }
})
