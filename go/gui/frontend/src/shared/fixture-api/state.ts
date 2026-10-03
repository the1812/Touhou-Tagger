import type { WriteOperationProgress, WriteOperationResult } from '../api/types'
import { batchEntries } from './batchData'
import { batchDirectory, createPlan, defaultSettings } from './data'
import { attachProgressMock, progressMock, progressMockKind } from './progress'

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
export const wait = (duration = 80) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, duration)
  })

export const fixtureState = {
  progressHandlers: new Set<(progress: WriteOperationProgress) => void>(),
  operationCancel: undefined as { id: string; cancel(): void } | undefined,
  batchSequence: 0,
  settings: clone(defaultSettings),
  activeCandidateId: 'fixture:single-disc',
  activePlan: createPlan('fixture:single-disc'),
  activeBatch: {
    batchId: 'fixture-batch',
    rootDirectory: batchDirectory,
    depth: 2,
    entries: batchEntries(),
  },
}

export const executeSequence = <Result extends WriteOperationResult>(
  operationId: string,
  kind: 'workspace' | 'batch',
  total: number,
  onDone: () => Result,
  onCancel: () => Result,
): Promise<Result> =>
  new Promise((resolve, reject) => {
    if (progressMockKind === kind) {
      fixtureState.operationCancel = {
        id: operationId,
        cancel: () => progressMock.finish('cancel'),
      }
      attachProgressMock(
        {
          operationId,
          kind,
          stage: 'preparing',
          current: 0,
          total,
          message: '正在准备写入',
          cancellable: true,
        },
        kind === 'workspace'
          ? fixtureState.activePlan.items.map(item => item.sourceName)
          : fixtureState.activeBatch.entries.map(entry => entry.relativePath),
        progress => fixtureState.progressHandlers.forEach(handler => handler(progress)),
        outcome => {
          fixtureState.operationCancel = undefined
          if (outcome === 'failure') {
            reject(
              new Error('模拟写入失败', {
                cause: {
                  code: 'permissionDenied',
                  message: '模拟写入失败',
                  details: '无法写入文件：文件正被其他程序使用。',
                  plan: kind === 'workspace' ? clone(fixtureState.activePlan) : undefined,
                },
              }),
            )
          } else {
            resolve(outcome === 'success' ? onDone() : onCancel())
          }
        },
      )
      return
    }
    const stages: WriteOperationProgress['stage'][] =
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
      fixtureState.progressHandlers.forEach(handler =>
        handler({
          operationId,
          kind,
          stage,
          current,
          total,
          message,
          path:
            kind === 'workspace'
              ? fixtureState.activePlan.items[
                  Math.min(current - 1, fixtureState.activePlan.items.length - 1)
                ]?.sourceName
              : fixtureState.activeBatch.entries[
                  Math.min(current - 1, fixtureState.activeBatch.entries.length - 1)
                ]?.relativePath,
          cancellable: kind === 'batch' || stage === 'preparing',
        }),
      )
      index += 1
      if (index === stages.length) {
        window.clearInterval(timer)
        fixtureState.operationCancel = undefined
        resolve(onDone())
      }
    }, 260)
    fixtureState.operationCancel = {
      id: operationId,
      cancel: () => {
        window.clearInterval(timer)
        fixtureState.operationCancel = undefined
        resolve(onCancel())
      },
    }
  })
