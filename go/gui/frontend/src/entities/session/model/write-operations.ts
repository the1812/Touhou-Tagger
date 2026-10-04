import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import {
  errorInfo,
  getApi,
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

type ActiveOperation = ActiveWriteOperation | { kind: 'dump'; action: 'extract' | 'saveAs' }

export const useWriteOperationsStore = defineStore('write-operations', () => {
  const active = shallowRef<ActiveOperation>()
  const notifications = useNotificationsStore()
  const writeOperation = computed(() => (active.value?.kind === 'dump' ? undefined : active.value))
  const operation = computed(() => writeOperation.value?.progress)
  const activeKind = computed(() => active.value?.kind)
  const isActive = computed(() => active.value !== undefined)
  const isWriting = computed(() => writeOperation.value !== undefined)
  const dumpAction = computed(() =>
    active.value?.kind === 'dump' ? active.value.action : undefined,
  )

  const dumpMetadata = async (directory: string, saveAs: boolean) => {
    active.value = { kind: 'dump', action: saveAs ? 'saveAs' : 'extract' }
    try {
      const api = await getApi()
      const path = await api.selectDumpOutput(directory, saveAs)
      if (path) {
        return await api.dumpMetadata(directory, path)
      }
    } finally {
      active.value = undefined
    }
  }

  const cancel = async () => {
    const current = writeOperation.value
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
    if (isActive.value) {
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
      })
    } finally {
      active.value = undefined
    }
  }

  const receiveProgress = (progress: WriteOperationProgress) => {
    const current = writeOperation.value
    if (current?.operationId === progress.operationId) {
      active.value = { ...current, progress }
    }
  }

  return {
    operation,
    activeKind,
    isActive,
    isWriting,
    dumpAction,
    dumpMetadata,
    run,
    cancel,
    receiveProgress,
  }
})
