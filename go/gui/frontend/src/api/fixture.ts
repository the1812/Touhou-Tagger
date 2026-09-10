import { t } from '../i18n'
import {
  batchDirectory,
  batchJobs,
  capabilities,
  candidates,
  createPlan,
  defaultSettings,
  fixtureDirectory,
  workspaceSummary,
} from './fixtureData'
import type {
  BatchPreview,
  BatchRunResult,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  PlanPatch,
  ProcessError,
} from './types'

const progressHandlers = new Set<(progress: OperationProgress) => void>()
const completeHandlers = new Set<(result: OperationResult | BatchRunResult) => void>()
const failureHandlers = new Set<(failure: OperationFailure) => void>()
const processErrorHandlers = new Set<(error: ProcessError) => void>()
const operationTimers = new Map<string, number>()
const pendingStarts = new Map<string, { kind: 'workspace' | 'batch'; start: () => void }>()
const operationCancels = new Map<string, () => void>()

const clone = <T>(value: T): T => structuredClone(value)
const wait = (duration = 80) =>
  new Promise<void>(resolve => {
    window.setTimeout(resolve, duration)
  })

let settings = clone(defaultSettings)
let activePlan = createPlan('fixture:single-disc')
let activeBatch: BatchPreview = {
  batchId: 'fixture-batch',
  rootDirectory: batchDirectory,
  depth: 2,
  jobs: batchJobs(),
}

const emitSequence = (
  operationId: string,
  kind: 'workspace' | 'batch',
  total: number,
  onDone: () => OperationResult | BatchRunResult,
  onCancel: () => OperationResult | BatchRunResult,
) => {
  const stages: OperationProgress['stage'][] =
    kind === 'workspace'
      ? ['preparing', 'writing', 'writing', 'committing', 'renaming']
      : ['preparing', 'writing', 'writing', 'writing', 'committing']
  let index = 0

  const timer = window.setInterval(() => {
    const stage = stages[index]
    const current = Math.min(total, Math.ceil(((index + 1) / stages.length) * total))
    let message = `正在处理 ${String(current)} / ${String(total)}`
    if (stage === 'committing') {
      message = '正在保存文件'
    } else if (stage === 'renaming') {
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
          ? activePlan.items[Math.min(current - 1, activePlan.items.length - 1)]?.sourceName
          : activeBatch.jobs[Math.min(current - 1, activeBatch.jobs.length - 1)]?.relativePath,
      message,
      cancellable: stage === 'preparing' || stage === 'writing',
    }
    progressHandlers.forEach(handler => handler(progress))
    index += 1

    if (index === stages.length) {
      window.clearInterval(timer)
      operationTimers.delete(operationId)
      operationCancels.delete(operationId)
      completeHandlers.forEach(handler => handler(onDone()))
    }
  }, 260)
  operationTimers.set(operationId, timer)
  operationCancels.set(operationId, () => {
    window.clearInterval(timer)
    operationTimers.delete(operationId)
    operationCancels.delete(operationId)
    completeHandlers.forEach(handler => handler(onCancel()))
  })
}

export const fixtureApi: GUIApi = {
  async getCapabilities() {
    await wait()
    return clone(capabilities)
  },

  getStartupDirectory() {
    return Promise.resolve('')
  },

  async selectAlbumDirectory() {
    await wait()
    return fixtureDirectory
  },

  async scanWorkspace(directory) {
    await wait(160)
    return { ...clone(workspaceSummary), directory }
  },

  async searchAlbums(_directory, query) {
    await wait(220)
    const normalized = query.trim().toLocaleLowerCase()
    return clone(
      normalized
        ? candidates.filter(
            candidate =>
              candidate.title.toLocaleLowerCase().includes(normalized) || candidate.exactMatch,
          )
        : candidates,
    )
  },

  async preparePlan(_directory, candidateId) {
    await wait(200)
    activePlan = createPlan(candidateId)
    return clone(activePlan)
  },

  async updatePlan(patch: PlanPatch) {
    await wait(120)
    const album = { ...activePlan.album, ...patch.album }
    const changedTracks = new Map(patch.tracks?.map(track => [track.id, track]) ?? [])
    const items = activePlan.items.map(item => {
      const change = changedTracks.get(item.id)
      if (!change) {
        return item
      }
      const updated = { ...item, ...change }
      const prefix =
        updated.discNumber === '1'
          ? updated.trackNumber.padStart(2, '0')
          : `${updated.discNumber}-${updated.trackNumber.padStart(2, '0')}`
      return { ...updated, targetName: `${prefix}. ${updated.title}.mp3` }
    })
    activePlan = createPlan(
      activePlan.candidate.id,
      activePlan.revision + 1,
      album,
      items,
      patch.saveCover ?? activePlan.options.saveCover,
    )
    return clone(activePlan)
  },

  async discardPlan() {
    await wait()
  },

  commitPlan() {
    const operationId = `fixture-workspace-${String(Date.now())}`
    pendingStarts.set(operationId, {
      kind: 'workspace',
      start: () =>
        emitSequence(
          operationId,
          'workspace',
          activePlan.items.length,
          () => ({
            operationId,
            kind: 'workspace',
            succeeded: activePlan.items.length,
            failed: 0,
            renamed: activePlan.options.renameFiles,
            coversSaved: activePlan.options.saveCover ? 1 : 0,
            lrcFiles: activePlan.options.lrcFiles,
            durationMs: 1840,
            cancelled: false,
            message: '写入完成。',
          }),
          () => ({
            operationId,
            kind: 'workspace',
            succeeded: 0,
            failed: 0,
            renamed: 0,
            coversSaved: 0,
            lrcFiles: 0,
            durationMs: 320,
            cancelled: true,
            message: '已取消写入。',
          }),
        ),
    })
    return Promise.resolve({ operationId })
  },

  startOperation(operationId) {
    const pending = pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'workspace') {
      return Promise.reject(new Error('写入操作不存在或已经开始。'))
    }
    pendingStarts.delete(operationId)
    pending.start()
    return Promise.resolve()
  },

  async cancelOperation(operationId) {
    await wait()
    if (pendingStarts.delete(operationId)) {
      return
    }
    operationCancels.get(operationId)?.()
  },

  async revealDirectory() {
    await wait()
  },

  async selectBatchDirectory() {
    await wait()
    return batchDirectory
  },

  async scanBatch(directory, depth) {
    await wait(220)
    activeBatch = {
      batchId: 'fixture-batch',
      rootDirectory: directory,
      depth,
      jobs: batchJobs().map(job =>
        job.status === 'ignored'
          ? job
          : {
              ...job,
              matchDescription: t('batch.loading'),
              status: 'loading',
              issues: [],
              candidates: [],
              selectedCandidateId: undefined,
            },
      ),
    }
    return clone(activeBatch)
  },

  async loadBatchJob(_batchId, jobId) {
    await wait(240)
    const loaded = batchJobs().find(job => job.id === jobId)
    const index = activeBatch.jobs.findIndex(job => job.id === jobId)
    if (!loaded || index < 0) {
      throw new Error('批量写入专辑不存在。')
    }
    activeBatch.jobs[index] = loaded
    return clone(loaded)
  },

  async resolveBatchCandidate(_batchId, jobId, candidateId) {
    await wait(120)
    const job = activeBatch.jobs.find(item => item.id === jobId)
    if (!job) {
      throw new Error('批量写入专辑不存在。')
    }
    job.selectedCandidateId = candidateId
    job.status = 'ready'
    job.matchDescription = '已选择搜索结果'
    job.issues = []
    return clone(job)
  },

  async ignoreBatchJob(_batchId, jobId) {
    await wait(120)
    const job = activeBatch.jobs.find(item => item.id === jobId)
    if (!job) {
      throw new Error('批量写入专辑不存在。')
    }
    job.selectedCandidateId = undefined
    job.status = 'ignored'
    job.matchDescription = '已由用户忽略'
    job.issues = []
    return clone(job)
  },

  async discardBatch() {
    await wait()
  },

  runBatch(_batchId, failedOnly) {
    const operationId = `fixture-batch-${String(Date.now())}`
    const jobs = failedOnly
      ? activeBatch.jobs.filter(job => job.status === 'failed')
      : activeBatch.jobs
    pendingStarts.set(operationId, {
      kind: 'batch',
      start: () =>
        emitSequence(
          operationId,
          'batch',
          Math.max(jobs.length, 1),
          () => {
            activeBatch.jobs = activeBatch.jobs.map(job => ({
              ...job,
              status: job.status === 'ignored' ? 'ignored' : 'succeeded',
            }))
            return {
              operationId,
              kind: 'batch',
              succeeded: activeBatch.jobs.filter(job => job.status === 'succeeded').length,
              failed: 0,
              renamed: 25,
              coversSaved: 2,
              lrcFiles: 0,
              durationMs: 2830,
              cancelled: false,
              message: '批量写入完成。',
              jobs: clone(activeBatch.jobs),
            }
          },
          () => {
            activeBatch.jobs = activeBatch.jobs.map(job =>
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
              jobs: clone(activeBatch.jobs),
            }
          },
        ),
    })
    return Promise.resolve({ operationId })
  },

  startBatch(operationId) {
    const pending = pendingStarts.get(operationId)
    if (!pending || pending.kind !== 'batch') {
      return Promise.reject(new Error('批量写入操作不存在或已经开始。'))
    }
    pendingStarts.delete(operationId)
    pending.start()
    return Promise.resolve()
  },

  cancelBatch(operationId) {
    if (!pendingStarts.delete(operationId)) {
      operationCancels.get(operationId)?.()
    }
    return Promise.resolve()
  },

  async loadSettings() {
    await wait()
    return clone(settings)
  },

  async saveSettings(nextSettings) {
    await wait(120)
    settings = clone(nextSettings)
    return clone(settings)
  },

  async resetSettings() {
    await wait()
    settings = clone(defaultSettings)
    return clone(settings)
  },

  onProgress(handler) {
    progressHandlers.add(handler)
    return () => progressHandlers.delete(handler)
  },

  onComplete(handler) {
    completeHandlers.add(handler)
    return () => completeHandlers.delete(handler)
  },

  onFailure(handler) {
    failureHandlers.add(handler)
    return () => failureHandlers.delete(handler)
  },

  onProcessError(handler) {
    processErrorHandlers.add(handler)
    return () => processErrorHandlers.delete(handler)
  },
}
