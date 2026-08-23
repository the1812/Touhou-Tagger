import { Events } from '@wailsio/runtime'

import {
  BatchService,
  SettingsService,
  WorkspaceService,
} from '../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/index.js'
import type {
  AlbumCandidate,
  BatchJobPreview,
  BatchPreview,
  BatchRunResult,
  Capabilities,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  OperationStart,
  PlanPatch,
  PlanPreview,
  ProcessError,
  Settings,
  WorkspaceSummary,
} from './types'

const normalizeCandidate = (candidate: AlbumCandidate): AlbumCandidate => ({
  ...candidate,
  artists: candidate.artists ?? [],
})

const normalizePlan = (plan: PlanPreview): PlanPreview => ({
  ...plan,
  album: {
    ...plan.album,
    artists: plan.album.artists ?? [],
    genres: plan.album.genres ?? [],
  },
  candidate: normalizeCandidate(plan.candidate),
  items: (plan.items ?? []).map((item) => ({
    ...item,
    artists: item.artists ?? [],
    issues: item.issues ?? [],
  })),
  issues: plan.issues ?? [],
})

const normalizeBatchJob = (job: BatchJobPreview): BatchJobPreview => ({
  ...job,
  issues: job.issues ?? [],
  candidates: (job.candidates ?? []).map(normalizeCandidate),
})

const normalizeBatch = (preview: BatchPreview): BatchPreview => ({
  ...preview,
  jobs: (preview.jobs ?? []).map(normalizeBatchJob),
})

export const nativeApi: GUIApi = {
  getCapabilities: async () => {
    const capabilities = (await SettingsService.GetCapabilities()) as Capabilities
    return {
      ...capabilities,
      sources: capabilities.sources ?? [],
      commentLanguages: capabilities.commentLanguages ?? [],
      lyricTypes: capabilities.lyricTypes ?? [],
    }
  },
  getStartupDirectory: () => WorkspaceService.GetStartupDirectory(),
  selectAlbumDirectory: () => WorkspaceService.SelectAlbumDirectory(),
  scanWorkspace: async (directory) => {
    const summary = (await WorkspaceService.ScanWorkspace(directory)) as WorkspaceSummary
    return { ...summary, issues: summary.issues ?? [] }
  },
  searchAlbums: async (directory, query, source) => {
    const candidates = (await WorkspaceService.SearchAlbums(directory, query, source)) as
      | AlbumCandidate[]
      | null
    return (candidates ?? []).map(normalizeCandidate)
  },
  preparePlan: async (directory, candidateId, source) =>
    normalizePlan(
      (await WorkspaceService.PreparePlan(directory, candidateId, source)) as PlanPreview,
    ),
  updatePlan: async (patch: PlanPatch) =>
    normalizePlan((await WorkspaceService.UpdatePlan(patch)) as PlanPreview),
  async discardPlan(planId) {
    await WorkspaceService.DiscardPlan(planId)
  },
  commitPlan: async (planId, revision) =>
    (await WorkspaceService.CommitPlan(planId, revision)) as OperationStart,
  startOperation: (operationId) => WorkspaceService.StartOperation(operationId),
  async cancelOperation(operationId) {
    await WorkspaceService.CancelOperation(operationId)
  },
  revealDirectory: (directory) => WorkspaceService.RevealDirectory(directory),
  selectBatchDirectory: () => BatchService.SelectBatchDirectory(),
  scanBatch: async (directory, depth, source) =>
    normalizeBatch(
      (await BatchService.ScanBatch(directory, depth, source)) as BatchPreview,
    ),
  loadBatchJob: async (batchId, jobId) =>
    normalizeBatchJob(
      (await BatchService.LoadBatchJob(batchId, jobId)) as BatchJobPreview,
    ),
  resolveBatchCandidate: async (batchId, jobId, candidateId) => {
    const job = (await BatchService.ResolveBatchCandidate(
      batchId,
      jobId,
      candidateId,
    )) as BatchJobPreview
    return normalizeBatchJob(job)
  },
  ignoreBatchJob: async (batchId, jobId) =>
    normalizeBatchJob(
      (await BatchService.IgnoreBatchJob(batchId, jobId)) as BatchJobPreview,
    ),
  discardBatch: (batchId) => BatchService.DiscardBatch(batchId),
  runBatch: async (batchId, failedOnly) =>
    (await BatchService.RunBatch(batchId, failedOnly)) as OperationStart,
  startBatch: (operationId) => BatchService.StartBatch(operationId),
  async cancelBatch(operationId) {
    await BatchService.CancelBatch(operationId)
  },
  loadSettings: async () => (await SettingsService.LoadSettings()) as Settings,
  saveSettings: async (settings) =>
    (await SettingsService.SaveSettings(settings)) as Settings,
  resetSettings: async () => (await SettingsService.ResetSettings()) as Settings,
  onProgress(handler) {
    return Events.On('gui:operation-progress', (event) =>
      handler(event.data as OperationProgress),
    )
  },
  onComplete(handler) {
    return Events.On('gui:operation-complete', (event) => {
      const result = event.data as OperationResult | BatchRunResult
      handler(
        'jobs' in result
          ? { ...result, jobs: (result.jobs ?? []).map(normalizeBatchJob) }
          : result,
      )
    })
  },
  onFailure(handler) {
    return Events.On('gui:operation-failed', (event) =>
      handler(event.data as OperationFailure),
    )
  },
  onProcessError(handler) {
    return Events.On('gui:process-error', (event) => handler(event.data as ProcessError))
  },
}
