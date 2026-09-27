import type { BatchRunResult, OperationFailure, OperationProgress, OperationResult } from '../types'
import { batchJobs } from './batchData'
import { batchDirectory, createPlan, defaultSettings } from './data'
import { attachProgressMock, progressMock, progressMockKind } from './progress'

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const wait = (duration = 80) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, duration)
  })

export const fixtureState = {
  progressHandlers: new Set<(progress: OperationProgress) => void>(),
  completeHandlers: new Set<(result: OperationResult | BatchRunResult) => void>(),
  failureHandlers: new Set<(failure: OperationFailure) => void>(),
  operationTimers: new Map<string, number>(),
  pendingStarts: new Map<
    string,
    { kind: 'workspace' | 'batch'; start: () => void; cancel: () => void }
  >(),
  batchSequence: 0,
  operationCancels: new Map<string, () => void>(),
  settings: clone(defaultSettings),
  activeCandidateId: 'fixture:single-disc',
  activePlan: createPlan('fixture:single-disc'),
  activeBatch: {
    batchId: 'fixture-batch',
    rootDirectory: batchDirectory,
    depth: 2,
    jobs: batchJobs(),
  },
}

export const emitSequence = (
  operationId: string,
  kind: 'workspace' | 'batch',
  total: number,
  onDone: () => OperationResult | BatchRunResult,
  onCancel: () => OperationResult | BatchRunResult,
) => {
  if (progressMockKind === kind) {
    attachProgressMock(
      {
        operationId,
        kind,
        stage: 'writing',
        current: Math.max(1, Math.floor(total / 2)),
        total,
        message: '正在写入标签',
        cancellable: true,
      },
      kind === 'workspace'
        ? fixtureState.activePlan.items.map(item => item.sourceName)
        : fixtureState.activeBatch.jobs.map(job => job.relativePath),
      progress => fixtureState.progressHandlers.forEach(handler => handler(progress)),
      outcome => {
        fixtureState.operationCancels.delete(operationId)
        if (outcome === 'failure') {
          fixtureState.failureHandlers.forEach(handler =>
            handler({
              operationId,
              kind,
              message: '模拟写入失败',
              details: '无法写入文件：文件正被其他程序使用。',
              planInvalidated: false,
              plan: kind === 'workspace' ? clone(fixtureState.activePlan) : undefined,
            }),
          )
        } else {
          fixtureState.completeHandlers.forEach(handler =>
            handler(outcome === 'success' ? onDone() : onCancel()),
          )
        }
      },
    )
    fixtureState.operationCancels.set(operationId, () => progressMock.finish('cancel'))
    return
  }
  const stages: OperationProgress['stage'][] =
    kind === 'workspace'
      ? ['preparing', 'renaming', 'writing', 'writing', 'writing']
      : ['preparing', 'writing', 'writing', 'writing', 'writing']
  let index = 0

  const timer = window.setInterval(() => {
    const stage = stages[index]
    const current = Math.min(total, Math.ceil(((index + 1) / stages.length) * total))
    let message = `正在处理 ${String(current)} / ${String(total)}`
    if (stage === 'renaming') {
      message = '正在重命名'
    }
    const progress: OperationProgress = {
      operationId,
      kind,
      stage,
      current,
      total,
      path:
        kind === 'workspace'
          ? fixtureState.activePlan.items[
              Math.min(current - 1, fixtureState.activePlan.items.length - 1)
            ]?.sourceName
          : fixtureState.activeBatch.jobs[
              Math.min(current - 1, fixtureState.activeBatch.jobs.length - 1)
            ]?.relativePath,
      message,
      cancellable: kind === 'batch' || stage === 'preparing',
    }
    fixtureState.progressHandlers.forEach(handler => handler(progress))
    index += 1

    if (index === stages.length) {
      window.clearInterval(timer)
      fixtureState.operationTimers.delete(operationId)
      fixtureState.operationCancels.delete(operationId)
      fixtureState.completeHandlers.forEach(handler => handler(onDone()))
    }
  }, 260)
  fixtureState.operationTimers.set(operationId, timer)
  fixtureState.operationCancels.set(operationId, () => {
    window.clearInterval(timer)
    fixtureState.operationTimers.delete(operationId)
    fixtureState.operationCancels.delete(operationId)
    fixtureState.completeHandlers.forEach(handler => handler(onCancel()))
  })
}
