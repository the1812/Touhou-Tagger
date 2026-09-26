import { t } from '../i18n'
import { batchJobs } from './fixtureBatchData'
import { batchDirectory, createPlan } from './fixtureData'
import { clone, emitSequence, fixtureState, wait } from './fixtureState'
import type { BatchApi } from './types'

export const fixtureBatchApi: BatchApi = {
  async selectBatchDirectory() {
    await wait()
    return batchDirectory
  },

  async scanBatch(directory, depth) {
    await wait(220)
    fixtureState.activeBatch = {
      batchId: 'fixture-batch',
      rootDirectory: directory,
      depth,
      jobs: batchJobs().map(job =>
        job.status === 'no-audio'
          ? job
          : {
              ...job,
              matchDescription: t('batch.loading'),
              status: 'loading',
              canRun: false,
              issues: [],
              candidates: [],
              selectedCandidateId: undefined,
            },
      ),
    }
    return clone(fixtureState.activeBatch)
  },

  async loadBatchJob(_batchId, jobId) {
    await wait(240)
    const loaded = batchJobs().find(job => job.id === jobId)
    const index = fixtureState.activeBatch.jobs.findIndex(job => job.id === jobId)
    if (!loaded || index < 0) {
      throw new Error('批量写入专辑不存在。')
    }
    fixtureState.activeBatch.jobs[index] = loaded
    return clone(loaded)
  },

  async resolveBatchCandidate(_batchId, jobId, candidateId) {
    await wait(120)
    const job = fixtureState.activeBatch.jobs.find(item => item.id === jobId)
    if (!job) {
      throw new Error('批量写入专辑不存在。')
    }
    job.selectedCandidateId = candidateId
    const plan = createPlan(candidateId)
    job.canRun = job.audioCount === plan.items.length && plan.canCommit
    job.status = job.canRun ? 'ready' : 'blocked'
    job.matchDescription = job.canRun ? '已选择搜索结果' : t('batch.status.blocked')
    job.issues = job.canRun
      ? []
      : [
          {
            code: 'track-count-mismatch',
            message: t('backend.issue.trackMismatch'),
            severity: 'error',
          },
        ]
    return clone(job)
  },

  async discardBatch() {
    await wait()
  },

  runBatch(_batchId, failedOnly) {
    const operationId = `fixture-batch-${String(Date.now())}`
    const jobs = failedOnly
      ? fixtureState.activeBatch.jobs.filter(job => job.status === 'failed' && job.canRun)
      : fixtureState.activeBatch.jobs.filter(job => job.canRun)
    fixtureState.pendingStarts.set(operationId, {
      kind: 'batch',
      start: () =>
        emitSequence(
          operationId,
          'batch',
          Math.max(jobs.length, 1),
          () => {
            fixtureState.activeBatch.jobs = fixtureState.activeBatch.jobs.map(job => ({
              ...job,
              status: jobs.some(selected => selected.id === job.id) ? 'succeeded' : job.status,
            }))
            return {
              operationId,
              kind: 'batch',
              succeeded: jobs.length,
              failed: 0,
              renamed: 25,
              coversSaved: 2,
              lrcFiles: 0,
              durationMs: 2830,
              cancelled: false,
              message: '批量写入完成。',
              jobs: clone(fixtureState.activeBatch.jobs),
            }
          },
          () => {
            fixtureState.activeBatch.jobs = fixtureState.activeBatch.jobs.map(job =>
              jobs.some(selected => selected.id === job.id) ? { ...job, status: 'cancelled' } : job,
            )
            return {
              operationId,
              kind: 'batch',
              succeeded: 0,
              failed: 0,
              renamed: 0,
              coversSaved: 0,
              lrcFiles: 0,
              durationMs: 320,
              cancelled: true,
              message: '已停止写入后续专辑。',
              jobs: clone(fixtureState.activeBatch.jobs),
            }
          },
        ),
    })
    return Promise.resolve({ operationId })
  },

  startBatch(operationId) {
    const pending = fixtureState.pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'batch') {
      return Promise.reject(new Error('批量写入操作不存在或已经开始。'))
    }
    fixtureState.pendingStarts.delete(operationId)
    pending.start()
    return Promise.resolve()
  },

  cancelBatch(operationId) {
    if (!fixtureState.pendingStarts.delete(operationId)) {
      fixtureState.operationCancels.get(operationId)?.()
    }
    return Promise.resolve()
  },
}
