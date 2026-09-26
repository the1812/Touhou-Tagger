import { defineStore } from 'pinia'

import { createBatchContext } from './batchContext'
import { createBatchDiscovery } from './batchDiscovery'
import { createBatchJobs } from './batchJobs'
import { createBatchWriting } from './batchWriting'

export const useBatchStore = defineStore('batch', () => {
  const context = createBatchContext()
  const jobs = createBatchJobs(context)
  const discovery = createBatchDiscovery(context, jobs)
  const writing = createBatchWriting(context)
  const isResolving = (jobId: string) => context.resolvingJobIds.value.has(jobId)
  return {
    directory: context.directory,
    depth: context.depth,
    preview: context.preview,
    selecting: context.selecting,
    scanning: context.scanning,
    operation: context.operation,
    isWriting: context.isWriting,
    result: context.result,
    failure: context.failure,
    resultOpen: context.resultOpen,
    skippedCount: context.skippedCount,
    retryableCount: context.retryableCount,
    readyCount: context.readyCount,
    resolvingCount: context.resolvingCount,
    canRun: context.canRun,
    setDepth: discovery.setDepth,
    selectDirectory: discovery.selectDirectory,
    scan: discovery.scan,
    loadJob: jobs.loadJob,
    resolveCandidate: discovery.resolveCandidate,
    isResolving,
    ...writing,
  }
})
