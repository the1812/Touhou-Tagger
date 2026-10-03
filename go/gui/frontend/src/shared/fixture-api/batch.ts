import type { BatchApi, BatchRunResult } from '../api/types'
import { t } from '../i18n'
import { batchEntries } from './batchData'
import { batchDirectory, createPlan } from './data'
import { clone, executeSequence, fixtureState, wait } from './state'

export const fixtureBatchApi: BatchApi = {
  async selectBatchDirectory() {
    await wait()
    return batchDirectory
  },

  async scanBatch(directory, depth) {
    await wait(220)
    fixtureState.batchSequence += 1
    fixtureState.activeBatch = {
      batchId: `fixture-batch-${String(fixtureState.batchSequence)}`,
      rootDirectory: directory,
      depth,
      entries: batchEntries().map(entry =>
        entry.readiness === 'skipped'
          ? entry
          : {
              ...entry,
              readiness: 'pending',
              issues: [],
              candidates: [],
              selectedCandidateId: undefined,
            },
      ),
    }
    return clone(fixtureState.activeBatch)
  },

  async loadBatchEntry(_batchId, entryId) {
    await wait(240)
    const loaded = batchEntries().find(entry => entry.id === entryId)
    const index = fixtureState.activeBatch.entries.findIndex(entry => entry.id === entryId)
    if (!loaded || index < 0) {
      throw new Error('批量写入专辑不存在。')
    }
    fixtureState.activeBatch.entries[index] = loaded
    return clone(loaded)
  },

  async resolveBatchCandidate(_batchId, entryId, candidateId) {
    await wait(120)
    const entry = fixtureState.activeBatch.entries.find(item => item.id === entryId)
    if (!entry) {
      throw new Error('批量写入专辑不存在。')
    }
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

  async discardBatch() {
    await wait()
  },

  executeBatch(_batchId, failedOnly, operationId) {
    const entries = failedOnly
      ? fixtureState.activeBatch.entries.filter(
          entry => entry.readiness === 'ready' && entry.outcome === 'failed',
        )
      : fixtureState.activeBatch.entries.filter(entry => entry.readiness === 'ready')
    const cancelledResult = () => {
      fixtureState.activeBatch.entries = fixtureState.activeBatch.entries.map(entry =>
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
        entries: clone(fixtureState.activeBatch.entries),
      }
    }
    return executeSequence<BatchRunResult>(
      operationId,
      'batch',
      Math.max(entries.length, 1),
      () => {
        fixtureState.activeBatch.entries = fixtureState.activeBatch.entries.map(entry => ({
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
          entries: clone(fixtureState.activeBatch.entries),
        }
      },
      cancelledResult,
    )
  },

  cancelBatch(operationId) {
    if (fixtureState.operationCancel?.id === operationId) {
      fixtureState.operationCancel.cancel()
    }
    return Promise.resolve()
  },
}
