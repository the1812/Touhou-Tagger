import { ref } from 'vue'

import type { OperationProgress } from './types'

export const progressMockKind = new URLSearchParams(window.location.search).get('progress')
export const progressMock = {
  operation: ref<OperationProgress>(),
  playing: ref(false),
  update: (() => {}) as (patch: Partial<OperationProgress>) => void,
  finish: (() => {}) as (outcome: 'success' | 'failure' | 'cancel') => void,
}

export const attachProgressMock = (
  initial: OperationProgress,
  paths: string[],
  emit: (progress: OperationProgress) => void,
  finish: (outcome: 'success' | 'failure' | 'cancel') => void,
) => {
  progressMock.playing.value = false
  progressMock.update = patch => {
    const operation = { ...(progressMock.operation.value as OperationProgress), ...patch }
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
