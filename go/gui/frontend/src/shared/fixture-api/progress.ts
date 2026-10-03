import { ref } from 'vue'

import type { WriteOperationProgress } from '../api/types'

export const progressMockKind = new URLSearchParams(window.location.search).get('progress')
export const progressMock = {
  operation: ref<WriteOperationProgress>(),
  playing: ref(false),
  update: (() => {}) as (patch: Partial<WriteOperationProgress>) => void,
  finish: (() => {}) as (outcome: 'success' | 'failure' | 'cancel') => void,
}

export const attachProgressMock = (
  initial: WriteOperationProgress,
  paths: string[],
  emit: (progress: WriteOperationProgress) => void,
  finish: (outcome: 'success' | 'failure' | 'cancel') => void,
) => {
  progressMock.playing.value = false
  progressMock.update = patch => {
    const operation = { ...(progressMock.operation.value as WriteOperationProgress), ...patch }
    operation.path = paths[Math.max(0, Math.min(operation.current - 1, paths.length - 1))]
    operation.cancellable = operation.kind === 'batch' || operation.stage === 'preparing'
    progressMock.operation.value = operation
    emit(operation)
  }
  progressMock.operation.value = initial
  progressMock.finish = outcome => {
    progressMock.playing.value = false
    progressMock.operation.value = undefined
    finish(outcome)
  }
  progressMock.update({})
}
