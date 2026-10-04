import type { BatchApi, BatchPreview, BatchEntryPreview, BatchRunResult } from '../api/types'
import { t } from '../i18n'
import { batchEntries } from './batchData'
import { appendFixtureDirectories, createFixtureBatch } from './batchSessions'
import { batchDirectory, createPlan } from './data'
import { clone, executeSequence, fixtureState, wait } from './state'

export const fixtureBatchApi: BatchApi = {
  async selectBatchDirectory() {
    await wait()
    return batchDirectory
  },
  async selectMultipleDirectories() {
    await wait()
    return batchEntries().map(entry => entry.directory)
  },
  async scanBatchDirectories(directory) {
    await wait(220)
    return createFixtureBatch(
      batchEntries().map(entry => `${directory}/${entry.relativePath}`),
      directory,
    )
  },
  async createBatchFromDirectories(directories) {
    await wait(220)
    return createFixtureBatch(directories)
  },
  async addBatchDirectories(batchId, directories) {
    await wait()
    const batch = fixtureState.batches.get(batchId) as BatchPreview
    appendFixtureDirectories(batch, directories)
    return clone(batch)
  },
  async removeBatchEntry(batchId, entryId) {
    await wait()
    const batch = fixtureState.batches.get(batchId) as BatchPreview
    batch.entries = batch.entries.filter(entry => entry.id !== entryId)
    fixtureState.batchEntries.delete(entryId)
    return clone(batch)
  },

  async loadBatchEntry(batchId, entryId) {
    await wait(240)
    const loaded = clone(fixtureState.batchEntries.get(entryId) as BatchEntryPreview)
    const batch = fixtureState.batches.get(batchId) as BatchPreview
    const index = batch.entries.findIndex(entry => entry.id === entryId)
    batch.entries[index] = loaded
    return clone(loaded)
  },

  async resolveBatchCandidate(batchId, entryId, candidateId) {
    await wait(120)
    const batch = fixtureState.batches.get(batchId) as BatchPreview
    const entry = batch.entries.find(item => item.id === entryId) as BatchEntryPreview
    entry.selectedCandidateId = candidateId
    const plan = createPlan(candidateId)
    entry.readiness =
      entry.audioCount === plan.items.length && plan.canExecute ? 'ready' : 'blocked'
    entry.outcome = undefined
    entry.issues =
      entry.readiness === 'ready'
        ? []
        : [
            {
              code: 'track-count-mismatch',
              message: t('backend.issue.trackMismatch'),
              severity: 'error',
            },
          ]
    return clone(entry)
  },

  async discardBatch(batchId) {
    await wait()
    fixtureState.batches
      .get(batchId)
      ?.entries.forEach(entry => fixtureState.batchEntries.delete(entry.id))
    fixtureState.batches.delete(batchId)
  },

  executeBatch(batchId, failedOnly, operationId) {
    const batch = fixtureState.batches.get(batchId) as BatchPreview
    const entries = failedOnly
      ? batch.entries.filter(entry => entry.readiness === 'ready' && entry.outcome === 'failed')
      : batch.entries.filter(entry => entry.readiness === 'ready')
    const cancelledResult = () => {
      batch.entries = batch.entries.map(entry =>
        entries.some(selected => selected.id === entry.id)
          ? { ...entry, outcome: 'cancelled' }
          : entry,
      )
      return {
        operationId,
        kind: 'batch' as const,
        succeeded: 0,
        failed: 0,
        renamed: 0,
        coversSaved: 0,
        lrcFiles: 0,
        durationMs: 320,
        cancelled: true,
        message: '已停止写入后续专辑。',
        entries: clone(batch.entries),
      }
    }
    return executeSequence<BatchRunResult>(
      operationId,
      'batch',
      Math.max(entries.length, 1),
      () => {
        batch.entries = batch.entries.map(entry => ({
          ...entry,
          outcome: entries.some(selected => selected.id === entry.id) ? 'succeeded' : entry.outcome,
        }))
        return {
          operationId,
          kind: 'batch',
          succeeded: entries.length,
          failed: 0,
          renamed: 25,
          coversSaved: 2,
          lrcFiles: 0,
          durationMs: 2830,
          cancelled: false,
          message: '批量写入完成。',
          entries: clone(batch.entries),
        }
      },
      cancelledResult,
      entries.map(entry => entry.relativePath || entry.directory),
    )
  },

  cancelBatch(operationId) {
    if (fixtureState.operationCancel?.id === operationId) {
      fixtureState.operationCancel.cancel()
    }
    return Promise.resolve()
  },
}
