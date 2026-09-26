import { Events } from '@wailsio/runtime'

import {
  AppearanceService,
  BatchService,
  SettingsService,
  WorkspaceService,
} from '../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/index.js'
import { sourceLabel } from '../i18n'
import { errorMessage } from './errorMessage'
import { normalizeIssue, normalizeProgress, normalizeResult, optionLabel } from './nativeMessages'
import {
  normalizeBatch,
  normalizeBatchJob,
  normalizeCandidate,
  normalizePlan,
  type Wire,
} from './nativeNormalization'
import type {
  AlbumCandidate,
  BatchJobPreview,
  BatchPreview,
  BatchRunResult,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  PlanPatch,
  PlanPreview,
  WorkspaceSummary,
} from './types'

export const nativeApi: GUIApi = {
  setDarkMode: dark => AppearanceService.SetDarkMode(dark),
  getCapabilities: async () => {
    const capabilities = await SettingsService.GetCapabilities()
    return {
      ...capabilities,
      sources: (capabilities.sources ?? []).map(source => ({
        ...source,
        label: sourceLabel(source.value),
      })),
      commentLanguages: (capabilities.commentLanguages ?? []).map(option => ({
        ...option,
        label: optionLabel(option.value, option.label),
      })),
      lyricTypes: (capabilities.lyricTypes ?? []).map(option => ({
        ...option,
        label: optionLabel(option.value, option.label),
      })),
    }
  },
  onDirectoryDrop: handler =>
    Events.On('gui:directory-dropped', event => handler(event.data as string)),
  getStartupDirectory: () => WorkspaceService.GetStartupDirectory(),
  selectAlbumDirectory: title => WorkspaceService.SelectAlbumDirectory(title),
  scanWorkspace: async directory => {
    const summary = (await WorkspaceService.ScanWorkspace(directory)) as Wire<WorkspaceSummary>
    return {
      ...summary,
      issues: (summary.issues ?? []).map(normalizeIssue),
      localCover: {
        ...summary.localCover,
        issue: summary.localCover.issue ? normalizeIssue(summary.localCover.issue) : undefined,
      },
    }
  },
  searchAlbums: async (directory, query, source) => {
    const candidates = (await WorkspaceService.SearchAlbums(directory, query, source)) as
      | AlbumCandidate[]
      | null
    return (candidates ?? []).map(normalizeCandidate)
  },
  preparePlan: async (directory, candidateId, source) =>
    normalizePlan(
      (await WorkspaceService.PreparePlan(directory, candidateId, source)) as Wire<PlanPreview>,
    ),
  updatePlan: async (patch: PlanPatch) =>
    normalizePlan((await WorkspaceService.UpdatePlan(patch)) as Wire<PlanPreview>),
  async discardPlan(planId) {
    await WorkspaceService.DiscardPlan(planId)
  },
  commitPlan: async (planId, revision) => await WorkspaceService.CommitPlan(planId, revision),
  startOperation: operationId => WorkspaceService.StartOperation(operationId),
  async cancelOperation(operationId) {
    await WorkspaceService.CancelOperation(operationId)
  },
  revealDirectory: directory => WorkspaceService.RevealDirectory(directory),
  selectBatchDirectory: title => BatchService.SelectBatchDirectory(title),
  scanBatch: async (directory, depth, source) =>
    normalizeBatch((await BatchService.ScanBatch(directory, depth, source)) as Wire<BatchPreview>),
  loadBatchJob: async (batchId, jobId) =>
    normalizeBatchJob((await BatchService.LoadBatchJob(batchId, jobId)) as Wire<BatchJobPreview>),
  resolveBatchCandidate: async (batchId, jobId, candidateId) => {
    const job = (await BatchService.ResolveBatchCandidate(
      batchId,
      jobId,
      candidateId,
    )) as Wire<BatchJobPreview>
    return normalizeBatchJob(job)
  },
  discardBatch: batchId => BatchService.DiscardBatch(batchId),
  runBatch: async (batchId, failedOnly) => await BatchService.RunBatch(batchId, failedOnly),
  startBatch: operationId => BatchService.StartBatch(operationId),
  async cancelBatch(operationId) {
    await BatchService.CancelBatch(operationId)
  },
  loadSettings: async () => await SettingsService.LoadSettings(),
  saveSettings: async settings => await SettingsService.SaveSettings(settings),
  resetSettings: async () => await SettingsService.ResetSettings(),
  onProgress(handler) {
    return Events.On('gui:operation-progress', event =>
      handler(normalizeProgress(event.data as OperationProgress)),
    )
  },
  onComplete(handler) {
    return Events.On('gui:operation-complete', event => {
      const result = normalizeResult(event.data as Wire<OperationResult | BatchRunResult>)
      handler(
        'jobs' in result
          ? {
              ...result,
              plan: result.plan ? normalizePlan(result.plan) : undefined,
              jobs: (result.jobs ?? []).map(normalizeBatchJob),
            }
          : { ...result, plan: result.plan ? normalizePlan(result.plan) : undefined },
      )
    })
  },
  onFailure(handler) {
    return Events.On('gui:operation-failed', event => {
      const failure = event.data as Wire<OperationFailure>
      handler({
        ...failure,
        plan: failure.plan ? normalizePlan(failure.plan) : undefined,
        message: failure.error ? errorMessage(failure.error) : failure.message,
      })
    })
  },
}
