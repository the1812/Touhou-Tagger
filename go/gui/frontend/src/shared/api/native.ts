import { Events } from '@wailsio/runtime'

import {
  AppearanceService,
  BatchService,
  SettingsService,
  WorkspaceService,
} from '../../../bindings/github.com/the1812/Touhou-Tagger/go/gui/internal/bridge/index.js'
import type {
  AlbumCandidate,
  BatchJobPreview,
  BatchPreview,
  Capabilities,
  GUIApi,
  OperationFailure,
  OperationProgress,
  OperationResult,
  PlanPreview,
  WorkspaceSummary,
} from './types'

export const nativeApi: GUIApi = {
  setDarkMode: dark => AppearanceService.SetDarkMode(dark),
  getCapabilities: async () => (await SettingsService.GetCapabilities()) as Capabilities,
  onDirectoryDrop: handler =>
    Events.On('gui:directory-dropped', event => handler(event.data as string)),
  getStartupDirectory: () => WorkspaceService.GetStartupDirectory(),
  selectAlbumDirectory: title => WorkspaceService.SelectAlbumDirectory(title),
  scanWorkspace: async directory =>
    (await WorkspaceService.ScanWorkspace(directory)) as WorkspaceSummary,
  searchAlbums: async (directory, query, source) =>
    (await WorkspaceService.SearchAlbums(directory, query, source)) as AlbumCandidate[],
  preparePlan: async (directory, candidateId, source) =>
    (await WorkspaceService.PreparePlan(directory, candidateId, source)) as PlanPreview,
  updatePlan: async patch => (await WorkspaceService.UpdatePlan(patch)) as PlanPreview,
  async discardPlan(planId) {
    await WorkspaceService.DiscardPlan(planId)
  },
  commitPlan: async (planId, revision) => WorkspaceService.CommitPlan(planId, revision),
  startOperation: operationId => WorkspaceService.StartOperation(operationId),
  async cancelOperation(operationId) {
    await WorkspaceService.CancelOperation(operationId)
  },
  revealDirectory: directory => WorkspaceService.RevealDirectory(directory),
  selectBatchDirectory: title => BatchService.SelectBatchDirectory(title),
  scanBatch: async (directory, depth, source) =>
    (await BatchService.ScanBatch(directory, depth, source)) as BatchPreview,
  loadBatchJob: async (batchId, jobId) =>
    (await BatchService.LoadBatchJob(batchId, jobId)) as BatchJobPreview,
  resolveBatchCandidate: async (batchId, jobId, candidateId) =>
    (await BatchService.ResolveBatchCandidate(batchId, jobId, candidateId)) as BatchJobPreview,
  discardBatch: batchId => BatchService.DiscardBatch(batchId),
  runBatch: async (batchId, failedOnly) => BatchService.RunBatch(batchId, failedOnly),
  startBatch: operationId => BatchService.StartBatch(operationId),
  async cancelBatch(operationId) {
    await BatchService.CancelBatch(operationId)
  },
  loadSettings: () => SettingsService.LoadSettings(),
  saveSettings: settings => SettingsService.SaveSettings(settings),
  resetSettings: () => SettingsService.ResetSettings(),
  onProgress(handler) {
    return Events.On('gui:operation-progress', event => handler(event.data as OperationProgress))
  },
  onComplete(handler) {
    return Events.On('gui:operation-complete', event => handler(event.data as OperationResult))
  },
  onFailure(handler) {
    return Events.On('gui:operation-failed', event => handler(event.data as OperationFailure))
  },
}
